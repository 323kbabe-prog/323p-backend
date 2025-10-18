// app.js — OP19$ AIDROP full version (voice-only + credits + stripe)
let userLang = localStorage.getItem("userLang") || "en";
const langSelect = document.getElementById("language-select");
if (langSelect) {
  langSelect.value = userLang;
  langSelect.addEventListener("change", e => {
    userLang = e.target.value;
    localStorage.setItem("userLang", userLang);
  });
}

const socket = io("https://three23p-backend.onrender.com");
let currentTrend = null, roomId = null, stopCycle = false;
let currentTopic = "aidrop";
let autoRefresh = false;

// ---------------- Room + Device ----------------
(function initRoom() {
  const p = new URLSearchParams(window.location.search);
  roomId = p.get("room") || "room-" + Math.floor(Math.random() * 9000);
  const newUrl = window.location.origin + window.location.pathname + "?room=" + roomId;
  window.history.replaceState({}, "", newUrl);
  console.log("🎬 Room initialized:", roomId);
})();
let deviceId = localStorage.getItem("deviceId");
if (!deviceId) {
  deviceId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  localStorage.setItem("deviceId", deviceId);
}
console.log("🔑 deviceId:", deviceId);

// ---------------- Overlay Helpers ----------------
function showOverlay() {
  const c = document.getElementById("warmup-center");
  c.style.display = "flex";
  c.style.visibility = "visible";
  c.innerHTML = "";
}
function hideOverlay() {
  const c = document.getElementById("warmup-center");
  c.style.display = "none";
  c.style.visibility = "hidden";
  c.innerHTML = "";
}
function appendOverlay(msg, color = "#fff", blink = false) {
  const line = document.createElement("div");
  line.className = "log-line";
  if (blink) line.classList.add("blinking");
  line.style.background = color;
  line.innerText = msg;
  const c = document.getElementById("warmup-center");
  c.appendChild(line);
  c.scrollTop = c.scrollHeight;
  return line;
}
function removeOverlayLine(line, finalMsg) {
  if (!line) return;
  line.classList.remove("blinking");
  line.innerText = finalMsg;
  setTimeout(() => line.remove(), 1200);
}

// ---------------- Ensure User ----------------
async function ensureUser() {
  let id = localStorage.getItem("userId");
  if (!id) {
    console.log("⚡ Creating new user");
    const res = await fetch("https://three23p-backend.onrender.com/api/create-user", {
      method: "POST",
      headers: { "x-device-id": deviceId }
    });
    const data = await res.json();
    if (data.userId) {
      id = data.userId;
      localStorage.setItem("userId", id);
      console.log("✅ New user:", id, "credits:", data.credits);
    } else {
      alert("❌ Could not create user");
      return null;
    }
  }
  return id;
}

// ---------------- UI ----------------
function updateUI(t) {
  // persona line
  document.getElementById("r-persona").innerText =
    `👩‍🎤 ${t.persona || "…"}`;

  // brand / product / concept / insight lines
  document.getElementById("r-label").innerText =
    `⚡ ${t.brand || "AI drop brand"}`;
  document.getElementById("r-title").innerText =
    `💄 ${t.product || "AI product"}`;
  document.getElementById("r-artist").innerText =
    `🎶 ${t.concept || "AI concept"} `;
  document.getElementById("r-fallback").innerText =
    `📸 ${t.mimicLine || "Created by next-month founder insight"}`;
  document.getElementById("voice-status").innerText =
    `⚙️ ${t.insight || "AI system insight loading..."}`;

  // description text
  document.getElementById("r-desc").innerText =
    t.description || "…loading description…";

  // hide image for voice-only
  document.getElementById("r-img").style.display = "none";
}

// ---------------- Voice ----------------
async function fetchVoiceSegment(seg) {
  const r = await fetch(
    `https://three23p-backend.onrender.com/api/voice?text=${encodeURIComponent(seg)}&lang=${userLang}`,
    { headers: { "x-device-id": deviceId } }
  );
  const b = await r.blob();
  return URL.createObjectURL(b);
}

async function playVoiceAndRevealText(text, onEnd) {
  const voiceLine = appendOverlay("🎤 streaming founder voice…", "#ffe0f0", true);
  const audio = document.getElementById("voice-player");
  const desc = document.getElementById("r-desc");
  desc.textContent = "";
  const parts = text.split(/\n+/).map(p => p.trim()).filter(p => p);
  if (!parts.length) {
    removeOverlayLine(voiceLine, "❌ no voice text");
    return;
  }

  let next = await fetchVoiceSegment(parts[0]);
  for (let i = 0; i < parts.length; i++) {
    const current = next;
    const nextP = i + 1 < parts.length ? fetchVoiceSegment(parts[i + 1]) : Promise.resolve(null);
    desc.innerHTML += (desc.innerHTML ? "<br><br>" : "") + parts[i];
    audio.src = current;
    await audio.play();
    await new Promise(r => (audio.onended = r));
    next = await nextP;
    removeOverlayLine(voiceLine, `▶️ part ${i + 1}/${parts.length}`);
  }
  removeOverlayLine(voiceLine, "✅ finished — refreshing next founder…");
  if (onEnd) onEnd();
}

// ---------------- Main Drop ----------------
async function runLogAndLoad(topic) {
  showOverlay();
  const userId = await ensureUser();
  if (!userId) return;

  const descLine = appendOverlay("✍️ waiting for description…", "#d9f0ff", true);
  const res = await fetch(
    `https://three23p-backend.onrender.com/api/description?topic=${topic}&userId=${userId}&lang=${userLang}`,
    { headers: { "x-passcode": "super-secret-pass", "x-device-id": deviceId } }
  );
  removeOverlayLine(descLine, "✅ description ready");
  const trend = await res.json();
  updateUI(trend);

  playVoiceAndRevealText(trend.description, () => {
    if (autoRefresh && !stopCycle) setTimeout(() => loadTrend(), 2000);
  });

  // --- voice-only (skip image for AIDROP) ---
  const imgLine = appendOverlay("🖼️ waiting for image…", "#d9f0ff", true);
  clearInterval(imgLine);
  removeOverlayLine(imgLine, "🧠 no image — voice-only drop");
  document.getElementById("r-img").style.display = "none";
  document.getElementById("r-fallback").style.display = "block";

  hideOverlay();
  return trend;
}

async function loadTrend() {
  if (stopCycle) return;
  currentTrend = await runLogAndLoad(currentTopic);
}

// ---------------- Credits / Stripe ----------------
async function buyCredits(pack) {
  const userId = await ensureUser();
  if (!userId) return;
  const res = await fetch(
    `https://three23p-backend.onrender.com/api/buy?userId=${userId}&pack=${pack}&roomId=${roomId}`,
    {
      method: "POST",
      headers: { "x-passcode": "super-secret-pass", "x-device-id": deviceId }
    }
  );
  const data = await res.json();
  if (data.url) window.location.href = data.url;
  else alert("Checkout failed: " + (data.error || "unknown error"));
}
document.getElementById("buy-small").onclick = () => buyCredits("small");
document.getElementById("buy-medium").onclick = () => buyCredits("medium");
document.getElementById("buy-large").onclick = () => buyCredits("large");

async function updateCredits() {
  const uid = await ensureUser();
  if (!uid) return;
  try {
    const r = await fetch(
      `https://three23p-backend.onrender.com/api/credits?userId=${uid}`,
      { headers: { "x-passcode": "super-secret-pass", "x-device-id": deviceId } }
    );
    const d = await r.json();
    if (d.credits !== undefined) {
      document.getElementById("credit-balance").textContent = `✨ Credits left: ${d.credits}`;
      document.getElementById("user-id-label").textContent = `👤 User: ${uid} | Room: ${roomId}`;
    }
  } catch (e) {
    console.error("❌ Credits fetch failed:", e);
  }
}
document.addEventListener("DOMContentLoaded", updateCredits);
setInterval(updateCredits, 30000);

// ---------------- Button ----------------
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("drop-aidrop-btn");
  if (btn) {
    btn.onclick = async () => {
      console.log("🌐 AIDROP pressed");
      currentTopic = "aidrop";
      autoRefresh = true;
      stopCycle = false;
      await loadTrend();
    };
  }
});

// ---------------- BUTTON SETUP ----------------
document.addEventListener("DOMContentLoaded", () => {
  // 1️⃣ Start Button
  const startBtn = document.getElementById("start-btn");
  if (startBtn) {
    startBtn.onclick = () => {
      console.log("🎬 START button clicked");
      document.getElementById("start-screen").style.display = "none";
      document.getElementById("app").style.display = "flex";
      const warm = document.getElementById("warmup-center");
      if (warm) {
        warm.style.display = "flex";
        warm.style.visibility = "visible";
      }
      socket.emit("joinRoom", roomId);
    };
  }

  // 2️⃣ Drop AIDROP Button
  const dropBtn = document.getElementById("drop-aidrop-btn");
  if (dropBtn) {
    dropBtn.onclick = async () => {
      console.log("🌐 AIDROP button clicked");
      currentTopic = "aidrop";
      autoRefresh = true;
      stopCycle = false;
      await loadTrend();
    };
  }
});
