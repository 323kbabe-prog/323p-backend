// app.js — Sticker Booth Style (Gen-Z) — op2: all logs start together, desc+img parallel, voice log waiting
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

  // Hide image until loaded separately
  document.getElementById("r-img").style.display="none";
  document.getElementById("r-fallback").style.display="block";

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

/* ---------------- Voice ---------------- */
function playVoice(text,onEnd){
  if(audioPlayer){ audioPlayer.pause(); audioPlayer = null; }

  // Add log for voice generation
  let voiceLine = appendOverlay("🎤 generating voice…","#ffe0f0",true);
  let genElapsed = 0;
  const genTimer = setInterval(()=>{
    genElapsed++;
    voiceLine.innerText = "🎤 generating voice… " + genElapsed + "s";
  },1000);

  const url = "https://three23p-backend.onrender.com/api/voice?text=" + encodeURIComponent(text);
  audioPlayer = new Audio(url);

  audioPlayer.onplay = ()=>{
    // stop generation timer
    clearInterval(genTimer);
    removeOverlayLine(voiceLine,"✅ voice generated");

    // start playback log
    voiceLine = appendOverlay("🎶 voice playing…","#ffe0f0",true);
    let playElapsed = 0;
    const playTimer = setInterval(()=>{
      playElapsed++;
      voiceLine.innerText = "🎶 voice playing… " + playElapsed + "s";
    },1000);

    audioPlayer.onended = ()=>{
      clearInterval(playTimer);
      removeOverlayLine(voiceLine,"✅ voice finished ("+playElapsed+"s)");
      if(onEnd) onEnd();
    };
  };

  audioPlayer.onerror = ()=>{
    clearInterval(genTimer);
    removeOverlayLine(voiceLine,"❌ voice error");
    if(onEnd) onEnd();
  };

  audioPlayer.play();
}

/* ---------------- Live Log + Load ---------------- */
async function runLogAndLoad(topic){
  showOverlay();

  // Start all logs immediately
  let reqLine = appendOverlay(`${topicEmoji(topic)} request sent for 323${topic}`,"#fff",true);
  let poolLine = appendOverlay("🧩 pool chosen","#fff",true);
  let descLine = appendOverlay("✍️ drafting description…","#fff",true);
  let imgLine  = appendOverlay("🖼️ rendering image…","#d9f0ff",true);
  let voiceLine= appendOverlay("🔊 preparing voice…","#ffe0f0",true);

  // Timers for all
  let reqElapsed=0, poolElapsed=0, descElapsed=0, imgElapsed=0, voiceElapsed=0;
  const reqTimer=setInterval(()=>{reqElapsed++; reqLine.innerText=`${topicEmoji(topic)} request sent ${reqElapsed}s`;},1000);
  const poolTimer=setInterval(()=>{poolElapsed++; poolLine.innerText=`🧩 pool chosen ${poolElapsed}s`;},1000);
  const descTimer=setInterval(()=>{descElapsed++; descLine.innerText=`✍️ drafting description… ${descElapsed}s`;},1000);
  const imgTimer=setInterval(()=>{imgElapsed++; imgLine.innerText=`🖼️ rendering image… ${imgElapsed}s`;},1000);
  // voiceTimer is inside playVoice()

  // Fire description + image fetches in parallel
  const descPromise = fetch("https://three23p-backend.onrender.com/api/description?topic="+topic).then(r=>r.json());
  const imgPromise  = fetch("https://three23p-backend.onrender.com/api/image?topic="+topic).then(r=>r.json());

  // Handle description
  const trend = await descPromise;
  clearInterval(descTimer);
  descLine.innerText="✅ description ready";
  updateUI(trend);

  // Stop req/pool logs once desc is back
  clearInterval(reqTimer); reqLine.innerText="✅ request sent";
  clearInterval(poolTimer); poolLine.innerText="✅ pool chosen";

  // Start voice now that we have text (but log already running)
  playVoice(trend.description,voiceLine,()=>{
    if(autoRefresh){
      showOverlay();
      appendOverlay("⏳ fetching next drop…","#ffe0f0");
      setTimeout(()=>loadTrend(),2000);
    }
  });

  // Handle image
  imgPromise.then(data=>{
    clearInterval(imgTimer);
    imgLine.innerText="✅ image ready";
    updateImage(data.image);
  }).catch(()=>{
    clearInterval(imgTimer);
    imgLine.innerText="❌ image error";
    updateImage(null);
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
