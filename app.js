// app.js — Sticker Booth Style (Gen-Z) — op2 updated: fast voice + real readiness
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
    hideOverlay();
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
function appendOverlay(msg,color="#fff"){
  const line = document.createElement("div");
  line.className="log-line";
  line.style.background=color;
  line.innerText=msg;
  const c = document.getElementById("warmup-center");
  c.appendChild(line);
  c.scrollTop = c.scrollHeight;
  return line; // ✅ return reference
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

  // ✅ show mimicLine if exists
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
  let draftingTimer = null; // ✅ track timer for drafting line

  // start drafting log + counter
  let draftLine = appendOverlay("✍️ drafting description…", 
    topic==="cosmetics" ? "var(--cosmetics-color)" :
    topic==="music" ? "var(--music-color)" :
    topic==="politics" ? "var(--politics-color)" : "var(--aidrop-color)"
  );
  draftLine.classList.add("blinking");
  let elapsed = 0;
  draftingTimer = setInterval(()=>{
    elapsed++;
    if(elapsed < 60){
      draftLine.innerText = "✍️ drafting description… " + elapsed + "s";
    } else {
      const mins = Math.floor(elapsed/60);
      const secs = elapsed % 60;
      draftLine.innerText = "✍️ drafting description… " + mins + "min " + secs + "s";
    }
  },1000);

  try {
    const res = await fetch("https://three23p-backend.onrender.com/api/trend?room="+roomId+"&topic="+topic);
    const trend = await res.json();

    // stop drafting timer
    if(draftingTimer){ clearInterval(draftingTimer); }
    draftLine.classList.remove("blinking");
    appendOverlay("✅ description ready","#e0ffe0");

    // update UI immediately with description
    updateUI({ ...trend, image: null });
    // start voice immediately
    playVoice(trend.description, ()=>{
      if(autoRefresh){
        showOverlay();
        appendOverlay("⏳ fetching next drop…","#ffe0f0");
        setTimeout(()=>loadTrend(),2000);
      }
    });

    // log image rendering + update image separately
    appendOverlay("🖼️ image rendering…","#d9f0ff");
    if(trend.image){
      const img = new Image();
      img.onload = ()=>{
        appendOverlay("🖼️ image ready","#d9f0ff");
        updateUI(trend); // now show image
      };
      img.onerror = ()=>{
        appendOverlay("❌ image failed","#ffd9d9");
      };
      img.src = trend.image;
    }

    return trend;
  } catch(e){
    console.error("❌ Trend load error:", e);
    if(draftingTimer){ clearInterval(draftingTimer); }
    appendOverlay("❌ failed to load drop","#ffd9d9");
  }
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
