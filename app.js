// app.js — Sticker Booth Style Logs
const socket = io("https://three23p-backend.onrender.com");
let audioPlayer=null,currentTrend=null,roomId=null,lastDescriptionKey=null,stopCycle=false;
let currentTopic="cosmetics";let autoRefresh=false;

/* ---------------- Room Setup ---------------- */
(function initRoom(){
  let params=new URLSearchParams(window.location.search);
  roomId=params.get("room");
  if(!roomId){
    roomId="room-"+Math.floor(Math.random()*9000);
    const newUrl=window.location.origin+window.location.pathname+"?room="+roomId;
    window.history.replaceState({}, "", newUrl);
  }
})();

/* ---------------- Voice ---------------- */
function playVoice(text,onEnd){
  if(audioPlayer){audioPlayer.pause();audioPlayer=null;}
  const url="https://three23p-backend.onrender.com/api/voice?text="+encodeURIComponent(text);
  audioPlayer=new Audio(url);
  audioPlayer.onplay=()=>{document.getElementById("voice-status").innerText="🤖🔊 vibin’ rn…";hideOverlay();};
  audioPlayer.onended=()=>{document.getElementById("voice-status").innerText="⚙️ preparing…";if(onEnd)onEnd();};
  audioPlayer.onerror=()=>{if(onEnd)onEnd();};
  audioPlayer.play();
}

/* ---------------- Overlay Helpers ---------------- */
function showOverlay(){const c=document.getElementById("warmup-center");if(c){c.style.display="flex";c.style.visibility="visible";c.innerHTML="";}}
function hideOverlay(){const c=document.getElementById("warmup-center");if(c){c.style.display="none";c.style.visibility="hidden";}}

/* ---------------- Sticker Log Helper ---------------- */
function appendOverlay(msg,color="#fff"){
  const line=document.createElement("div");
  line.className="log-line";
  line.style.background=color;
  line.innerText=msg;
  const c=document.getElementById("warmup-center");
  c.appendChild(line);
  c.scrollTop=c.scrollHeight;
}

/* ---------------- UI Update ---------------- */
function updateUI(trend){
  document.getElementById("r-title").innerText=trend.brand;
  document.getElementById("r-artist").innerText=trend.product;
  document.getElementById("r-persona").innerText=trend.persona||"";
  document.getElementById("r-desc").innerText=trend.description;
  document.getElementById("r-label").innerText="🔄 live drop";
  if(trend.image){document.getElementById("r-img").src=trend.image;document.getElementById("r-img").style.display="block";document.getElementById("r-fallback").style.display="none";}
  else{document.getElementById("r-img").style.display="none";document.getElementById("r-fallback").style.display="block";}
}

/* ---------------- Live Log + Load ---------------- */
async function runLogAndLoad(topic){
  showOverlay();

  appendOverlay("💡 request sent for 323"+topic,"#ffe0f0");
  setTimeout(()=>appendOverlay("🧩 pool chosen","#e0f0ff"),1000);
  setTimeout(()=>appendOverlay("👤 persona locked: a young college student","#fff9d9"),2000);
  setTimeout(()=>appendOverlay("✍️ drafting description…","#f0e0ff"),3000);

  const res=await fetch("https://three23p-backend.onrender.com/api/trend?room="+roomId+"&topic="+topic);
  const trend=await res.json();

  setTimeout(()=>appendOverlay("✅ description ready","#e0ffe0"),4000);
  setTimeout(()=>appendOverlay("🖼️ image rendering…","#d9f0ff"),5000);

  setTimeout(()=>{
    hideOverlay();
    updateUI(trend);
    playVoice(trend.description,()=>{
      if(autoRefresh){
        showOverlay();
        appendOverlay("⏳ fetching next drop…","#ffe0f0");
        setTimeout(()=>loadTrend(),2000);
      }
    });
  },6000);

  return trend;
}
async function loadTrend(){
  if(stopCycle)return;
  currentTrend=await runLogAndLoad(currentTopic);
}

/* ---------------- Emoji map ---------------- */
function topicEmoji(topic){
  if(topic==="cosmetics") return "💄";
  if(topic==="music") return "🎶";
  if(topic==="politics") return "🏛️";
  if(topic==="aidrop") return "🌐";
  return "⚡";
}

/* ---------------- Start confirm ---------------- */
document.getElementById("start-btn").addEventListener("click",()=>{
  document.getElementById("start-screen").style.display="none";
  document.getElementById("app").style.display="flex";
  socket.emit("joinRoom",roomId);

  const overlay=document.getElementById("warmup-center");
  overlay.style.display="flex";
  overlay.style.visibility="visible";
  overlay.style.background="transparent";
  overlay.style.boxShadow="none";
  overlay.style.color="#000";
  overlay.innerHTML="";

  const btn=document.createElement("button");
  btn.className="start-btn";
  btn.innerText=`${topicEmoji(currentTopic)} drop the ${currentTopic} rn`;
  btn.onclick=()=>{
    btn.remove();
    autoRefresh=true;
    loadTrend();
  };
  overlay.appendChild(btn);
});

/* ---------------- Topic toggle confirm ---------------- */
document.querySelectorAll("#topic-picker button").forEach(btn=>{
  btn.addEventListener("click",()=>{
    currentTopic=btn.dataset.topic;
    autoRefresh=false;

    const overlay=document.getElementById("warmup-center");
    overlay.style.display="flex";
    overlay.style.visibility="visible";
    overlay.style.background="transparent";
    overlay.style.boxShadow="none";
    overlay.style.color="#000";
    overlay.innerHTML="";

    const b=document.createElement("button");
    b.className="start-btn";
    b.innerText=`${topicEmoji(currentTopic)} drop the ${currentTopic} rn`;
    b.onclick=()=>{
      b.remove();
      autoRefresh=true;
      loadTrend();
    };
    overlay.appendChild(b);
  });
});