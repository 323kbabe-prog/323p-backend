const socket = io("https://three23p-backend.onrender.com");
let audioPlayer=null,currentTrend=null,roomId=null,lastDescriptionKey=null,stopCycle=false;
let currentTopic="cosmetics";let autoRefresh=false;

/* ---------------- UI Update ---------------- */
function updateUI(trend){
  document.getElementById("r-title").innerText = trend.brand;
  document.getElementById("r-artist").innerText = trend.product;
  document.getElementById("r-persona").innerText = trend.persona || "";
  document.getElementById("r-desc").innerText = trend.description;
  document.getElementById("r-label").innerText = "🔄 live drop";

  // ✅ Show mimic line if available
  const mimicEl = document.getElementById("r-mimic");
  if(trend.mimicLine){
    mimicEl.innerText = trend.mimicLine;
    mimicEl.style.display = "block";
  } else {
    mimicEl.style.display = "none";
  }

  if(trend.image){
    document.getElementById("r-img").src = trend.image;
    document.getElementById("r-img").style.display = "block";
    document.getElementById("r-fallback").style.display = "none";
  } else {
    document.getElementById("r-img").style.display = "none";
    document.getElementById("r-fallback").style.display = "block";
  }
}

/* ---------------- Voice ---------------- */
function playVoice(text,onEnd){
  if(audioPlayer){audioPlayer.pause();audioPlayer=null;}
  const url="https://three23p-backend.onrender.com/api/voice?text="+encodeURIComponent(text);
  audioPlayer=new Audio(url);
  audioPlayer.onplay=()=>{
    document.getElementById("voice-status").innerText="🤖🔊 vibin’ rn…";
  };
  audioPlayer.onended=()=>{
    document.getElementById("voice-status").innerText="⚙️ preparing…";
    if(onEnd) onEnd();
  };
  audioPlayer.onerror=()=>{
    if(onEnd) onEnd();
  };
  audioPlayer.play();
}

/* ---------------- Load Trend ---------------- */
async function loadTrend(){
  if(stopCycle) return;
  let apiUrl="https://three23p-backend.onrender.com/api/trend?room="+roomId+"&topic="+currentTopic;
  const res=await fetch(apiUrl);
  const newTrend=await res.json();
  if(!newTrend||!newTrend.description){
    setTimeout(()=>loadTrend(),2000);
    return;
  }
  currentTrend=newTrend;
  updateUI(currentTrend);
  const descriptionKey=currentTrend.description;
  if(descriptionKey!==lastDescriptionKey){
    lastDescriptionKey=descriptionKey;
    playVoice(currentTrend.description,()=>{
      setTimeout(()=>loadTrend(),2000);
    });
  } else {
    setTimeout(()=>loadTrend(),2000);
  }
}

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

/* ---------------- Start Button ---------------- */
document.getElementById("start-btn").addEventListener("click",()=>{
  document.getElementById("start-screen").style.display="none";
  document.getElementById("app").style.display="flex";
  socket.emit("joinRoom",roomId);
  setTimeout(()=>{loadTrend();},3000);
});