// app.js — Sticker Booth Style (Gen-Z) — updated with parallel timers
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

  let voiceLine = appendOverlay("🔊 preparing voice…","var(--music-color)",true);
  let voiceElapsed = 0;
  const voiceTimer = setInterval(()=>{
    voiceElapsed++;
    voiceLine.innerText = "🔊 preparing voice… " + voiceElapsed + "s";
  },1000);

  audioPlayer.onplay = ()=>{
    clearInterval(voiceTimer);
    removeOverlayLine(voiceLine,"✅ voice ready");
  };
  audioPlayer.onended = ()=>{
    if(onEnd) onEnd();
  };
  audioPlayer.onerror = ()=>{
    clearInterval(voiceTimer);
    removeOverlayLine(voiceLine,"❌ voice error");
    if(onEnd) onEnd();
  };
  audioPlayer.play();
}

/* ---------------- Overlay Helpers ---------------- */
function showOverlay(){
  const c = document.getElementById("warmup-center");
  if(c){
    c.style.display="flex";
    c.style.visibility="visible";
    c.innerHTML="";
  }
}
function hideOverlay(){
  const c = document.getElementById("warmup-center");
  if(c){
    c.style.display="none";
    c.style.visibility="hidden";
  }
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
    setTimeout(()=>line.remove(),800); // disappear after short delay
  }
}

/* ---------------- UI Update ---------------- */
function updateUI(trend){
  document.getElementById("r-title").innerText = trend.brand;
  document.getElementById("r-artist").innerText = trend.product;
  document.getElementById("r-persona").innerText = trend.persona || "";
  document.getElementById("r-desc").innerText = trend.description;
  document.getElementById("r-label").innerText = "🔄 live drop";

  if(trend.image){
    document.getElementById("r-img").src = trend.image;
    document.getElementById("r-img").style.display="block";
    document.getElementById("r-fallback").style.display="none";
  } else {
    document.getElementById("r-img").style.display="none";
    document.getElementById("r-fallback").style.display="block";
  }

  if(trend.mimicLine){
    let m = document.getElementById("r-mimic");
    if(!m){
      m = document.createElement("p");
      m.id = "r-mimic";
      m.style.marginTop = "10px";
      m.style.fontSize = "18px";
      m.style.background = "var(--music-color)";
      m.style.color = "#000";
      m.style.padding = "8px 12px";
      m.style.borderRadius = "12px";
      m.style.display = "inline-block";
      document.getElementById("drop-card").appendChild(m);
    }
    m.innerText = trend.mimicLine;
    m.style.display = "inline-block";
  } else {
    const m = document.getElementById("r-mimic");
    if(m) m.style.display="none";
  }
}

/* ---------------- Live Log + Load ---------------- */
async function runLogAndLoad(topic){
  showOverlay();

  appendOverlay(`${topicEmoji(topic)} request sent for 323${topic}`,"#fff");
  setTimeout(()=>appendOverlay("🧩 pool chosen","#fff"),500);

  // Timers for description + image
  let descLine = appendOverlay("✍️ drafting description…","#fff",true);
  let imgLine  = appendOverlay("🖼️ rendering image…","#d9f0ff",true);
  let descElapsed=0, imgElapsed=0;

  const descTimer = setInterval(()=>{
    descElapsed++;
    descLine.innerText = "✍️ drafting description… " + descElapsed + "s";
  },1000);
  const imgTimer = setInterval(()=>{
    imgElapsed++;
    imgLine.innerText = "🖼️ rendering image… " + imgElapsed + "s";
  },1000);

  const res = await fetch("https://three23p-backend.onrender.com/api/trend?room="+roomId+"&topic="+topic);
  const trend = await res.json();

  clearInterval(descTimer);
  removeOverlayLine(descLine,"✅ description ready");
  clearInterval(imgTimer);
  removeOverlayLine(imgLine,"✅ image ready");

  // Update UI and start voice right away
  updateUI(trend);
  playVoice(trend.description,()=>{
    if(autoRefresh){
      showOverlay();
      appendOverlay("⏳ fetching next drop…","#ffe0f0");
      setTimeout(()=>loadTrend(),2000);
    } else {
      hideOverlay();
    }
  });

  return trend;
}

async function loadTrend(){ 
  if(stopCycle) return; 
  currentTrend = await runLogAndLoad(currentTopic); 
}

/* ---------------- Emoji map ---------------- */
function topicEmoji(topic){
  if(topic==="cosmetics") return "💄";
  if(topic==="music") return "🎶";
  if(topic==="politics") return "🏛️";
  if(topic==="aidrop") return "🌐";
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
document.querySelectorAll("#topic-picker button").forEach(btn=>{
  btn.addEventListener("click",()=>{
    currentTopic = btn.dataset.topic;
    autoRefresh = false;
    showConfirmButton();
  });
});
