// app.js (simplified frontend — shows live generation data in warm-up overlay)

const socket = io("https://three23p-backend.onrender.com");
let audioPlayer=null,currentTrend=null,roomId=null,lastDescriptionKey=null,stopCycle=false;
let currentTopic="cosmetics";

/* Setup room */
(function initRoom(){
  let params=new URLSearchParams(window.location.search);
  roomId=params.get("room");
  if(!roomId){
    roomId="room-"+Math.floor(Math.random()*9000);
    const newUrl=window.location.origin+window.location.pathname+"?room="+roomId;
    window.history.replaceState({}, "", newUrl);
  }
})();

/* Voice */
function playVoice(text,onEnd){
  if(audioPlayer){audioPlayer.pause();audioPlayer=null;}
  const url="https://three23p-backend.onrender.com/api/voice?text="+encodeURIComponent(text);
  audioPlayer=new Audio(url);
  audioPlayer.onplay=()=>{document.getElementById("voice-status").innerText="🤖🔊 vibin’ rn…";hideWarmupOverlay();};
  audioPlayer.onended=()=>{document.getElementById("voice-status").innerText="⚙️ preparing…";if(onEnd)onEnd();};
  audioPlayer.onerror=()=>{if(onEnd)onEnd();};
  audioPlayer.play();
}

/* Warm-up overlay */
function showWarmupOverlay(msg){const c=document.getElementById("warmup-center");if(c){c.style.display="flex";c.innerText=msg;}}
function hideWarmupOverlay(){const c=document.getElementById("warmup-center");if(c)c.style.display="none";}

/* Update UI */
function updateUIWithTrend(trend){
  document.getElementById("r-title").innerText=trend.brand;
  document.getElementById("r-artist").innerText=trend.product;
  document.getElementById("r-persona").innerText=trend.persona||"";
  document.getElementById("r-desc").innerText=trend.description;
  document.getElementById("r-label").innerText="🔄 live drop";
  if(trend.image){document.getElementById("r-img").src=trend.image;document.getElementById("r-img").style.display="block";document.getElementById("r-fallback").style.display="none";}else{document.getElementById("r-img").style.display="none";document.getElementById("r-fallback").style.display="block";}
}

/* Load trend */
async function loadTrend(){
  if(stopCycle)return;
  const res=await fetch("https://three23p-backend.onrender.com/api/trend?room="+roomId+"&topic="+currentTopic);
  const newTrend=await res.json();
  if(!newTrend||!newTrend.description){showWarmupOverlay("⚙️ generating live drop…");setTimeout(()=>loadTrend(),2000);return;}
  currentTrend=newTrend;

  // Show live preview while image loads
  showWarmupOverlay(
    `🔄 Generating Live Drop...\n\n` +
    `Brand: ${currentTrend.brand}\n` +
    `Product: ${currentTrend.product}\n` +
    `Persona: ${currentTrend.persona}\n\n` +
    `${currentTrend.description.slice(0,120)}...`
  );

  // Switch to full card after short delay
  setTimeout(()=>{
    hideWarmupOverlay();
    updateUIWithTrend(currentTrend);
    playVoice(currentTrend.description,()=>{if(!stopCycle){showWarmupOverlay("⏳ fetching next drop...");setTimeout(()=>loadTrend(),2000);}});
  },1500);
}

/* Start button */
document.getElementById("start-btn").addEventListener("click",()=>{
  document.getElementById("start-screen").style.display="none";
  document.getElementById("app").style.display="flex";
  socket.emit("joinRoom",roomId);
  showWarmupOverlay("⚙️ preparing first drop…");
  setTimeout(()=>{loadTrend();},1000);
});

/* Topic toggle */
document.querySelectorAll("#topic-picker button").forEach(btn=>{
  btn.addEventListener("click",()=>{
    currentTopic=btn.dataset.topic;
    showWarmupOverlay(`✨ switching vibe to 323${currentTopic}…`);
    stopCycle=false;
    setTimeout(()=>loadTrend(),2000);
  });
});
