// app.js — OP19$ Dual Button Version (cosmetics + aidrop)
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
let audioPlayer = null, currentTrend = null, roomId = null, stopCycle = false;
let currentTopic = "cosmetics";
let autoRefresh = false;

// Simulation mode check (?simulate=credits|descfail|imagefail)
const simulate = new URLSearchParams(window.location.search).get("simulate");

/* ---------------- Room Setup ---------------- */
(function initRoom() {
  const params = new URLSearchParams(window.location.search);
  roomId = params.get("room");
  if (!roomId) {
    roomId = "room-" + Math.floor(Math.random() * 9000);
    const newUrl = window.location.origin + window.location.pathname + "?room=" + roomId;
    window.history.replaceState({}, "", newUrl);
  }
  console.log("🎬 Room initialized:", roomId);
})();

/* ---------------- Device ID ---------------- */
let deviceId = localStorage.getItem("deviceId");
if (!deviceId) {
  deviceId = (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  localStorage.setItem("deviceId", deviceId);
}
console.log("🔑 deviceId is", deviceId);

/* ---------------- Overlay Helpers ---------------- */
function showOverlay() {
  const c = document.getElementById("warmup-center");
  if (c) { c.style.display = "flex"; c.style.visibility = "visible"; c.innerHTML = ""; }
}
function hideOverlay() {
  const c = document.getElementById("warmup-center");
  if (c) { c.style.display = "none"; c.style.visibility = "hidden"; c.innerHTML = ""; }
}
function appendOverlay(msg, color = "#fff", blinking = false) {
  const line = document.createElement("div");
  line.className = "log-line";
  if (blinking) line.classList.add("blinking");
  line.style.background = color;
  line.innerText = msg;
  const c = document.getElementById("warmup-center");
  c.appendChild(line);
  c.scrollTop = c.scrollHeight;
  return line;
}
function removeOverlayLine(line, finalMsg) {
  if (line) {
    line.classList.remove("blinking");
    line.innerText = finalMsg;
    setTimeout(() => line.remove(), 1200);
  }
}

/* ---------------- Ensure User ---------------- */
async function ensureUser() {
  let userId = localStorage.getItem("userId");
  if (!userId) {
    console.log("⚡ Creating new user for device");
    const res = await fetch("https://three23p-backend.onrender.com/api/create-user", {
      method: "POST",
      headers: { "x-device-id": deviceId }
    });
    const data = await res.json();
    if (data.userId) {
      userId = data.userId;
      localStorage.setItem("userId", userId);
      console.log("✅ New user:", userId, "credits:", data.credits);
    } else {
      alert("❌ Could not create user: " + (data.error || "unknown error"));
    }
  }
  return userId;
}

/* ---------------- UI Update ---------------- */
function updateUI(trend) {
  document.getElementById("r-title").innerText = `💄👑 ${trend.brand || "…"}`;
  document.getElementById("r-artist").innerText = `🖊️ ${trend.product || "…"}`;
  document.getElementById("r-persona").innerText = `👩‍🎤 ${trend.persona || "…"}`;
  document.getElementById("r-desc").innerText = trend.description || "…loading description…";
  document.getElementById("r-label").innerText = "🔄 live drop";

  document.getElementById("r-img").style.display = "none";
  document.getElementById("r-fallback").style.display = "block";

  // mimic line if music
  if (trend.mimicLine) {
    let m = document.getElementById("r-mimic");
    if (!m) {
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
  }
}

/* ---------------- Image Update ---------------- */
function updateImage(imageUrl, imgLine, imgTimer) {
  clearInterval(imgTimer);
  removeOverlayLine(imgLine, "✅ image ready");
  if (imageUrl) {
    document.getElementById("r-img").src = imageUrl;
    document.getElementById("r-img").style.display = "block";
    document.getElementById("r-fallback").style.display = "none";
  } else {
    document.getElementById("r-img").style.display = "none";
    document.getElementById("r-fallback").style.display = "block";
  }
}

/* ---------------- Voice ---------------- */
function playVoice(text, onEnd) {
  const voiceLine = appendOverlay("🎤 waiting for the voice…", "#ffe0f0", true);
  let genElapsed = 0;
  const genTimer = setInterval(() => {
    genElapsed++;
    voiceLine.innerText = "🎤 waiting for the voice… " + genElapsed + "s";
  }, 1000);

// 🟢 direct-stream playback (no blob)
clearInterval(genTimer);
removeOverlayLine(voiceLine, "✅ voice started");

const audioEl = document.getElementById("voice-player");

// set the audio source directly to the streaming API endpoint
audioEl.src = `https://three23p-backend.onrender.com/api/voice?text=${encodeURIComponent(text)}&lang=${userLang}`;

// start playback
audioEl.play().then(() => {
  document.querySelector("#voice-status .text").textContent = "🤖🔊 vibin’ rn…";
}).catch(err => console.warn("⚠️ autoplay blocked:", err));

audioPlayer = audioEl;

// handle when playback ends
audioEl.onended = () => {
  document.querySelector("#voice-status .text").textContent = "⚙️ preparing…";
  if (onEnd) onEnd();
};
}
/* ---------------- Main Drop Sequence ---------------- */
async function runLogAndLoad(topic) {
  showOverlay();
  const userId = await ensureUser();
  if (!userId) return;

  const descLine = appendOverlay("✍️ waiting for the description…", "#d9f0ff", true);
  let descElapsed = 0;
  const descTimer = setInterval(() => {
    descElapsed++;
    descLine.innerText = "✍️ waiting for the description… " + descElapsed + "s";
  }, 1000);

  if (simulate === "credits") {
    clearInterval(descTimer);
    removeOverlayLine(descLine, "💸 you’re dry rn… top-up to keep vibin’ (simulated)");
    hideOverlay();
    return;
  }

  let trend = null;
  try {
    const descRes = await fetch(
  `https://three23p-backend.onrender.com/api/description?topic=${topic}&userId=${userId}&lang=${userLang}`,

      {
        headers: { "x-passcode": "super-secret-pass", "x-device-id": deviceId }
      }
    );
    if (!descRes.ok) {
      clearInterval(descTimer);
      if (descRes.status === 403) {
        removeOverlayLine(descLine, "💸 you’re dry rn… top-up to keep vibin’");
        const banner = document.getElementById("simulate-banner");
        if (banner) {
          banner.textContent = "💸 you’re dry rn… top-up to keep vibin’";
          banner.style.display = "block";
        }
      } else removeOverlayLine(descLine, "❌ description failed");
      hideOverlay();
      return;
    }
    trend = await descRes.json();
  } catch (e) {
    console.error("❌ Description error:", e);
  }

  clearInterval(descTimer);
  if (!trend || !trend.brand) {
    removeOverlayLine(descLine, "❌ description failed");
    hideOverlay();
    return;
  }

  removeOverlayLine(descLine, "✅ description ready");
  updateUI(trend);
  updateCredits();

  playVoice(trend.description, () => {
    if (autoRefresh && !stopCycle) {
      setTimeout(() => loadTrend(), 2000);
    }
  });

  const imgLine = appendOverlay("🖼️ waiting for the image…", "#d9f0ff", true);
  let imgElapsed = 0;
  const imgTimer = setInterval(() => {
    imgElapsed++;
    imgLine.innerText = "🖼️ waiting for the image… " + imgElapsed + "s";
  }, 1000);

  try {
    const imgRes = await fetch(
      `https://three23p-backend.onrender.com/api/image?topic=${topic}&brand=${encodeURIComponent(trend.brand)}&product=${encodeURIComponent(trend.product)}&persona=${encodeURIComponent(trend.persona)}`,
      {
        headers: { "x-passcode": "super-secret-pass", "x-device-id": deviceId }
      }
    );
    const imgData = await imgRes.json();
    updateImage(imgData.image, imgLine, imgTimer);
  } catch (e) {
    clearInterval(imgTimer);
    removeOverlayLine(imgLine, "❌ image error");
    updateImage(null, imgLine, imgTimer);
  }
  hideOverlay();
  return trend;
}

async function loadTrend() {
  if (stopCycle) return;
  currentTrend = await runLogAndLoad(currentTopic);
}

/* ---------------- Buy Credits ---------------- */
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

document.getElementById("buy-small").addEventListener("click", () => buyCredits("small"));
document.getElementById("buy-medium").addEventListener("click", () => buyCredits("medium"));
document.getElementById("buy-large").addEventListener("click", () => buyCredits("large"));

/* ---------------- Stripe Return Check ---------------- */
(function checkStripeReturn() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id");
  if (sessionId) {
    alert("✅ Payment successful! Credits updated.");
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
    const res = await fetch(`https://three23p-backend.onrender.com/api/credits?userId=${userId}`, {
      headers: { "x-passcode": "super-secret-pass", "x-device-id": deviceId }
    });
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

/* ---------------- Dual Drop Buttons ---------------- */
document.getElementById("start-btn").addEventListener("click", () => {
  document.getElementById("start-screen").style.display = "none";
  document.getElementById("app").style.display = "flex";
  socket.emit("joinRoom", roomId);

  // showConfirmButton() removed — using two permanent buttons
  document.getElementById("warmup-center").style.display = "flex";
  document.getElementById("warmup-center").style.visibility = "visible";
});

document.getElementById("drop-cosmetics-btn").addEventListener("click", async () => {
  currentTopic = "cosmetics";
  autoRefresh = true;
  await loadTrend();
});

document.getElementById("drop-aidrop-btn").addEventListener("click", async () => {
  currentTopic = "aidrop";
  autoRefresh = true;
  await loadTrend();
});
