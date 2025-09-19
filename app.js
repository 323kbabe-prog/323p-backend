// app.js — Confirm first, then auto-refresh with live log overlay

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
function showOverlay(msg){
  const c=document.getElementById("warmup-center");
  if(c){c.style.display="flex";c.innerText=msg||"";}
}
function appendOverlay(msg){
  const c=document.getElementById("warmup-center");
  if(c){
    c.style.display="flex";
    c.innerText += "\n"+msg;
    c.scrollTop = c.scrollHeight;
  }
}
function hideOverlay(){
  const c=document.getElementById("warmup-center");
  if(c)c.style.display="none";
}

/* ---------------- UI Update ---------------- */
function updateUI(trend){
  document.getElementById("r-title").innerText=trend.brand;
  document.getElementById("r-artist").innerText=trend.product;
  document.getElementById("r-persona").innerText=trend.persona||"";
  document.getElementById("r-desc").innerText=trend.description;
  document.getElementById("r-label").innerText="🔄 live drop";
  if(trend.image){
    document.getElementById("r-img").src=trend.image;
    document.getElementById("r-img").style.display="block";
    document.getElementById("r-fallback").style.display="none";
  } else {
    document.getElementById("r-img").style.display="none";
    document.getElementById("r-fallback").style.display="block";
  }
}

/* ---------------- Live Log Sequence ---------------- */
async function runLogAndLoad(topic){
  showOverlay("[00:00] ✅ request sent (323"+topic+")");

  // log line by line with delays
  setTimeout(()=>appendOverlay("[00:01] 🧩 pool chosen"),1000);
  setTimeout(()=>appendOverlay("[00:02] 👤 persona locked: a young college student"),2000);
  setTimeout(()=>appendOverlay("[00:03] ✍️ drafting description…"),3000);

  // fetch drop while logs are playing
  const res=await fetch("https://three23p-backend.onrender.com/api/trend?room="+roomId+"&topic="+topic);
  const trend=await res.json();

  setTimeout(()=>appendOverlay("[00:04] ✅ description ready"),4000);
  setTimeout(()=>appendOverlay("[00:05] 🖼️ image rendering…"),5000);

  // reveal UI after ~6s
  setTimeout(()=>{
    hideOverlay();
    updateUI(trend);
    playVoice(trend.description,()=>{
      if(autoRefresh){
        showOverlay("⏳ fetching next…");
        setTimeout(()=>loadTrend(),2000);
      }
    });
  },6000);

  return trend;
}

/* ---------------- Load Trend ---------------- */
async function loadTrend(){
  if(stopCycle)return;
  currentTrend=await runLogAndLoad(currentTopic);
}

/* ---------------- Start Button ---------------- */
document.getElementById("start-btn").addEventListener("click",()=>{
  document.getElementById("start-screen").style.display="none";
  document.getElementById("app").style.display="flex";
  socket.emit("joinRoom",roomId);
  showOverlay("🔄 confirm first drop");

  const btn=document.createElement("button");
  btn.innerText="✅ generate first drop";
  btn.onclick=()=>{
    btn.remove();
    autoRefresh=true;
    loadTrend();
  };
  document.getElementById("warmup-center").appendChild(btn);
});

/* ---------------- Topic Toggle ---------------- */
document.querySelectorAll("#topic-picker button").forEach(btn=>{
  btn.addEventListener("click",()=>{
    currentTopic=btn.dataset.topic;
    autoRefresh=false;
    showOverlay("🔄 confirm new drop for "+currentTopic);
    const b=document.createElement("button");
    b.innerText="✅ generate";
    b.onclick=()=>{
      b.remove();
      autoRefresh=true;
      loadTrend();
    };
    document.getElementById("warmup-center").appendChild(b);
  });
});
