// app.js — confirm first, then auto-refresh with live logs
const socket=io("https://three23p-backend.onrender.com");
let audioPlayer=null,currentTrend=null,roomId=null,lastDescriptionKey=null,stopCycle=false;
let currentTopic="cosmetics";let autoRefresh=false;

/* Setup room */
(function initRoom(){let params=new URLSearchParams(window.location.search);roomId=params.get("room");if(!roomId){roomId="room-"+Math.floor(Math.random()*9000);const newUrl=window.location.origin+window.location.pathname+"?room="+roomId;window.history.replaceState({}, "", newUrl);}})();

/* Voice */
function playVoice(text,onEnd){if(audioPlayer){audioPlayer.pause();audioPlayer=null;}const url="https://three23p-backend.onrender.com/api/voice?text="+encodeURIComponent(text);audioPlayer=new Audio(url);audioPlayer.onplay=()=>{document.getElementById("voice-status").innerText="🤖🔊 vibin’ rn…";hideOverlay();};audioPlayer.onended=()=>{document.getElementById("voice-status").innerText="⚙️ preparing…";if(onEnd)onEnd();};audioPlayer.onerror=()=>{if(onEnd)onEnd();};audioPlayer.play();}

/* Overlay */
function showOverlay(msg){const c=document.getElementById("warmup-center");if(c){c.style.display="flex";c.innerText=msg;}}
function appendOverlay(msg){const c=document.getElementById("warmup-center");if(c){c.style.display="flex";c.innerText+="\n"+msg;}}
function hideOverlay(){const c=document.getElementById("warmup-center");if(c)c.style.display="none";}

/* UI */
function updateUI(trend){document.getElementById("r-title").innerText=trend.brand;document.getElementById("r-artist").innerText=trend.product;document.getElementById("r-persona").innerText=trend.persona||"";document.getElementById("r-desc").innerText=trend.description;document.getElementById("r-label").innerText="🔄 live drop";if(trend.image){document.getElementById("r-img").src=trend.image;document.getElementById("r-img").style.display="block";document.getElementById("r-fallback").style.display="none";}else{document.getElementById("r-img").style.display="none";document.getElementById("r-fallback").style.display="block";}}

/* Load */
async function loadTrend(){if(stopCycle)return;showOverlay("[00:00] ✅ request sent");const res=await fetch("https://three23p-backend.onrender.com/api/trend?room="+roomId+"&topic="+currentTopic);const trend=await res.json();if(!trend||!trend.description){appendOverlay("⚠️ generation failed");return;}currentTrend=trend;
appendOverlay("[00:01] 🧩 pool chosen: 323"+currentTopic);
appendOverlay("[00:02] 👤 persona: "+trend.persona);
appendOverlay("[00:03] ✍️ writing description…");
setTimeout(()=>appendOverlay("[00:04] ✅ description ready"),500);
setTimeout(()=>appendOverlay("[00:05] 🖼️ rendering image…"),1000);
setTimeout(()=>{hideOverlay();updateUI(trend);playVoice(trend.description,()=>{if(autoRefresh){showOverlay("⏳ fetching next…");setTimeout(()=>loadTrend(),2000);}});},2000);}

/* Start button */
document.getElementById("start-btn").addEventListener("click",()=>{document.getElementById("start-screen").style.display="none";document.getElementById("app").style.display="flex";socket.emit("joinRoom",roomId);showOverlay("🔄 confirm first drop");const btn=document.createElement("button");btn.innerText="✅ generate first drop";btn.onclick=()=>{hideOverlay();autoRefresh=true;loadTrend();btn.remove();};document.getElementById("warmup-center").appendChild(btn);});

/* Topic toggle */
document.querySelectorAll("#topic-picker button").forEach(btn=>{btn.addEventListener("click",()=>{currentTopic=btn.dataset.topic;autoRefresh=false;showOverlay("🔄 confirm new drop for "+currentTopic);const b=document.createElement("button");b.innerText="✅ generate";b.onclick=()=>{hideOverlay();autoRefresh=true;loadTrend();b.remove();};document.getElementById("warmup-center").appendChild(b);});});
