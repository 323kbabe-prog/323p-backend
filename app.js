// app.js — op12: cosmetics only, sequential flow (desc → voice → image)
const socket = io("https://three23p-backend.onrender.com");
let audioPlayer = null, currentTrend = null, roomId = null, stopCycle = false;
let currentTopic = "cosmetics"; 
let autoRefresh = false;

/* ---------------- Room Setup ---------------- */
(function initRoom(){
  let params = new URLSearchParams(window.location.search);
  roomId = params.get("room");
  if(!roomId){
    roomId = "room-" + Math.floor(Math.random()*9000);
    const newUrl = window.location.origin + window.location.pathname + "?room=" + roomId;
    window.history.replaceState({}, "", newUrl);
  }
})();

/* ---------------- Voice ---------------- */
function playVoice(text,onEnd){
  if(audioPlayer){ audioPlayer.pause(); audioPlayer = null; }
  const url = "https://three23p-backend.onrender.com/api/voice?text=" + encodeURIComponent(text);
  audioPlayer = new Audio(url);

  audioPlayer.onplay = ()=>{
    document.getElementById("voice-status").innerText = "🤖🔊 vibin’ rn…";
  };
  audioPlayer.onended = ()=>{
    document.getElementById("voice-status").innerText = "⚙️ preparing…";
    if(onEnd) onEnd();
  };
  audioPlayer.onerror = ()=>{ if(onEnd) onEnd(); };
  audioPlayer.play();
}

/* ---------------- Overlay Helpers ---------------- */
function showOverlay(){
  const c = document.getElementById("warmup-center");
  if(c){ c.style.display="flex"; c.style.visibility="visible"; c.innerHTML=""; }
}
function hideOverlay(){
  const c = document.getElementById("warmup-center");
  if(c){ c.style.display="none"; c.style.visibility="hidden"; }
}
function appendOverlay(msg,color="#fff",blinking=false){
  const line = document.createElement("div");
  line.className="log-line";
  if(blinking) line.classList.add("blinking");
  line.style.background=color;
  line.innerText=msg;
  const c = document.getElementById("warmup-center");
  c.appendChild(line);
  c.scrollTop = c.scrollHeight;
  return line;
}
function removeOverlayLine(line,finalMsg){
  if(line){
    line.classList.remove("blinking");
    line.innerText = finalMsg;
    setTimeout(()=>line.remove(),800);
  }
}

/* ---------------- UI Update ---------------- */
function updateUI(trend){
  document.getElementById("r-title").innerText = trend.brand;
  document.getElementById("r-artist").innerText = trend.product;
  document.getElementById("r-persona").innerText = trend.persona || "";
  document.getElementById("r-desc").innerText = trend.description;
  document.getElementById("r-label").innerText = "🔄 live drop";
  document.getElementById("r-img").style.display="none";
  document.getElementById("r-fallback").style.display="block";
}

/* ---------------- Image Update ---------------- */
function updateImage(imageUrl){
  if(imageUrl){
    document.getElementById("r-img").src = imageUrl;
    document.getElementById("r-img").style.display="block";
    document.getElementById("r-fallback").style.display="none";
  } else {
    document.getElementById("r-img").style.display="none";
    document.getElementById("r-fallback").style.display="block";
  }
}

/* ---------------- Live Log + Load ---------------- */
async function runLogAndLoad(topic){
  showOverlay();

  // === Description first ===
  let descLine = appendOverlay("✍️ drafting description…","#fff",true);
  let descElapsed=0;
  const descTimer=setInterval(()=>{
    descElapsed++;
    descLine.innerText="✍️ drafting description… "+descElapsed+"s";
  },1000);

  const descRes = await fetch("https://three23p-backend.onrender.com/api/trend?room="+roomId+"&topic="+topic);
  const trend = await descRes.json();

  clearInterval(descTimer);
  removeOverlayLine(descLine,"✅ description ready");
  updateUI(trend);

  // === Voice second ===
  playVoice(trend.description,()=>{});

  // === Image last ===
  let imgLine = appendOverlay("🖼️ rendering image (after desc)…","#d9f0ff",true);
  let imgElapsed=0;
  const imgTimer=setInterval(()=>{
    imgElapsed++;
    imgLine.innerText="🖼️ rendering image… "+imgElapsed+"s";
  },1000);

  if(trend.image){
    clearInterval(imgTimer);
    removeOverlayLine(imgLine,"✅ image ready");
    updateImage(trend.image);
  } else {
    clearInterval(imgTimer);
    removeOverlayLine(imgLine,"❌ image error");
    updateImage(null);
  }

  return trend;
}

async function loadTrend(){ 
  if(stopCycle) return; 
  currentTrend = await runLogAndLoad(currentTopic); 
}

/* ---------------- Emoji map ---------------- */
function topicEmoji(topic){
  if(topic==="cosmetics") return "💄";
  return "⚡";
}

/* ---------------- Confirm Button ---------------- */
function showConfirmButton(){
  const overlay = document.getElementById("warmup-center");
  overlay.style.display="flex";
  overlay.style.visibility="visible";
  overlay.style.background="transparent";
  overlay.style.boxShadow="none";
  overlay.innerHTML="";
  const btn = document.createElement("button");
  btn.className="start-btn";
  btn.innerText=`${topicEmoji(currentTopic)} drop the ${currentTopic} rn`;
  btn.onclick=()=>{
    btn.remove();
    autoRefresh = true;
    loadTrend();
  };
  overlay.appendChild(btn);
}

/* ---------------- Start confirm ---------------- */
document.getElementById("start-btn").addEventListener("click",()=>{
  document.getElementById("start-screen").style.display="none";
  document.getElementById("app").style.display="flex";
  socket.emit("joinRoom",roomId);
  showConfirmButton();
});

/* ---------------- Topic toggle confirm ---------------- */
// Only cosmetics now in op12