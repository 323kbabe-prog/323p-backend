// app.js — OP19$ Sticker Booth Style (Gen-Z, sequential desc → image → voice)
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
  console.log("🎬 Room initialized:", roomId);
})();

/* ---------------- Device ID ---------------- */
let deviceId = localStorage.getItem("deviceId");
if (!deviceId) {
  if (window.crypto && crypto.randomUUID) {
    deviceId = crypto.randomUUID();
  } else {
    deviceId = Math.random().toString(36).slice(2);
  }
  localStorage.setItem("deviceId", deviceId);
}
console.log("🔑 deviceId is", deviceId);

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

/* ---------------- Ensure User ---------------- */
async function ensureUser() {
  let userId = localStorage.getItem("userId");
  if (!userId) {
    console.log("⚡ Calling /api/create-user for new device");
    const res = await fetch("https://three23p-backend.onrender.com/api/create-user", {
      method: "POST",
      headers: { "x-device-id": deviceId }
    });
    const data = await res.json();
    if (data.userId) {
      userId = data.userId;
      localStorage.setItem("userId", userId);
      console.log("✅ Created new user:", userId, "credits:", data.credits);
    } else {
      alert("❌ Could not create user: " + (data.error || "unknown error"));
    }
  }
  return userId;
}

/* ---------------- UI Update ---------------- */
function updateUI(trend){
  document.getElementById("r-title").innerText = `💄👑 ${trend.brand || "…"}`;
  document.getElementById("r-artist").innerText = `🖊️ ${trend.product || "…"}`;
  document.getElementById("r-persona").innerText = `👩‍🎤 ${trend.persona || "…"}`;
  document.getElementById("r-desc").innerText = trend.description || "…loading description…";
  document.getElementById("r-label").innerText = "🔄 live drop";

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
function updateImage(imageUrl,imgLine,imgTimer){
  clearInterval(imgTimer);
  removeOverlayLine(imgLine,"✅ image ready");
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
  let voiceLine = appendOverlay("🎤 generating voice…","#ffe0f0",true);
  let genElapsed = 0;
  const genTimer = setInterval(()=>{
    genElapsed++;
    voiceLine.innerText = "🎤 generating voice… " + genElapsed + "s";
  },1000);

  const url = "https://three23p-backend.onrender.com/api/voice?text=" + encodeURIComponent(text);
  audioPlayer = new Audio(url);
  audioPlayer.play().then(()=>{
    clearInterval(genTimer);
    removeOverlayLine(voiceLine,"✅ voice started");
  }).catch(()=>{
    clearInterval(genTimer);
    removeOverlayLine(voiceLine,"❌ voice error");
    if(onEnd) onEnd();
  });

  audioPlayer.onended = ()=>{
    document.querySelector("#voice-status .text").textContent = "preparing…";
    if(onEnd) onEnd();
  };
  audioPlayer.onplay = ()=>{
    document.querySelector("#voice-status .text").textContent = "vibin’ rn…";
  };
}

/* ---------------- Live Log + Load ---------------- */
async function runLogAndLoad(topic){
  showOverlay();
  const userId = await ensureUser();
  if (!userId) return;

  let reqLine = appendOverlay(`${topicEmoji(topic)} request sent for 323${topic}`,"#fff",true);
  setTimeout(()=>removeOverlayLine(reqLine,"✅ request sent"),1000);

  let poolLine = appendOverlay("🧩 pool chosen","#fff",true);
  setTimeout(()=>removeOverlayLine(poolLine,"✅ pool chosen"),2000);

  let descLine = appendOverlay("✍️ drafting description…","#fff",true);
  let descElapsed=0;
  const descTimer=setInterval(()=>{
    descElapsed++;
    descLine.innerText="✍️ drafting description… "+descElapsed+"s";
  },1000);

  const descRes = await fetch(
    `https://three23p-backend.onrender.com/api/description?topic=${topic}&userId=${userId}`
  );
  const trend = await descRes.json();

  clearInterval(descTimer);
  if (!trend || !trend.brand) {
    removeOverlayLine(descLine,"❌ description failed");
    return;
  }

  removeOverlayLine(descLine,"✅ description ready");
  updateUI(trend);

  playVoice(trend.description,()=>{
    if(autoRefresh){
      showOverlay();
      appendOverlay("⏳ fetching next drop…","#ffe0f0");
      setTimeout(()=>loadTrend(),2000);
    }
  });

  let imgLine = appendOverlay("🖼️ rendering image…","#d9f0ff",true);
  let imgElapsed=0;
  const imgTimer=setInterval(()=>{
    imgElapsed++;
    imgLine.innerText="🖼️ rendering image… "+imgElapsed+"s";
  },1000);

  try {
    const imgRes = await fetch(
      `https://three23p-backend.onrender.com/api/image?topic=${topic}&brand=${encodeURIComponent(trend.brand)}&product=${encodeURIComponent(trend.product)}&persona=${encodeURIComponent(trend.persona)}`
    );
    const imgData = await imgRes.json();
    updateImage(imgData.image,imgLine,imgTimer);
  } catch(e){
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
    if(btn.dataset.topic === "cosmetics"){
      return;
    }
    currentTopic = btn.dataset.topic;
    autoRefresh = false;
    showConfirmButton();
  });
});

/* ---------------- Buy Credits ---------------- */
async function buyCredits(pack) {
  const userId = await ensureUser();
  if (!userId) return;

  console.log("buyCredits → userId:", userId, "roomId:", roomId);

  const res = await fetch(
    `https://three23p-backend.onrender.com/api/buy?userId=${userId}&pack=${pack}&roomId=${roomId}`,
    { method: "POST" }
  );
  const data = await res.json();
  if (data.url) {
    window.location.href = data.url;
  } else {
    alert("Checkout failed: " + (data.error || "unknown error"));
  }
}

document.getElementById("buy-small").addEventListener("click", () => buyCredits("small"));
document.getElementById("buy-medium").addEventListener("click", () => buyCredits("medium"));
document.getElementById("buy-large").addEventListener("click", () => buyCredits("large"));

/* ---------------- Stripe Return Check ---------------- */
(function checkStripeReturn(){
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id");
  if (sessionId) {
    console.log("✅ Stripe returned with session:", sessionId);
    alert("✅ Payment successful! Your credits have been updated.");
    updateCredits();

    const roomParam = params.get("room");
    params.delete("session_id");
    let newUrl = window.location.origin + window.location.pathname;
    if (roomParam) newUrl += "?room=" + roomParam;
    window.history.replaceState({}, "", newUrl);
  }
})();

/* ---------------- Credits Updater ---------------- */
async function updateCredits() {
  const userId = await ensureUser();
  if (!userId) return;
  try {
    const res = await fetch(`https://three23p-backend.onrender.com/api/credits?userId=${userId}`);
    const data = await res.json();
    if (data.credits !== undefined) {
      const creditBar = document.getElementById("credit-balance");
      const userLabel = document.getElementById("user-id-label");
      if (creditBar) creditBar.textContent = `✨ Credits left: ${data.credits}`;
      if (userLabel) userLabel.textContent = `👤 User: ${userId} | Room: ${roomId}`;
    }
  } catch (err) {
    console.error("❌ Failed to fetch credits:", err);
  }
}
document.addEventListener("DOMContentLoaded", updateCredits);
setInterval(updateCredits, 30000);
