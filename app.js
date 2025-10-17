// app.js — OP19$ Dual Button Version (cosmetics + aidrop, live voice + auto refresh)
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

/* ---------------- Progressive Description Stream (cosmetics + aidrop, live voice) ---------------- */
let voiceQueue = Promise.resolve();
socket.on("paragraph", async ({ index, paragraph, brand, product }) => {
  console.log("🧾 Paragraph", index, paragraph);

  // 🧠 Update header on first paragraph
  if (index === 1) {
    document.getElementById("r-title").innerText = `💄👑 ${brand || "…"}`;
    document.getElementById("r-artist").innerText = `🖊️ ${product || "…"}`;
    document.getElementById("r-desc").textContent = "";
  }

  // ✍️ Show paragraph live
  const descEl = document.getElementById("r-desc");
  descEl.textContent += (descEl.textContent ? "\n\n" : "") + paragraph;
  descEl.scrollTop = descEl.scrollHeight;

  // 🎧 Queue voice playback
  const voiceUrl = `https://three23p-backend.onrender.com/api/voice?lang=${userLang}&text=${encodeURIComponent(paragraph)}`;
  voiceQueue = voiceQueue.then(
    () =>
      new Promise(resolve => {
        const audio = new Audio(voiceUrl);
        audio.volume = 1.0;
        audio.onended = resolve;
        setTimeout(() => {
          audio.play().catch(err => console.warn("Audio blocked:", err));
        }, 300);
      })
  );
});

// ✅ Auto-refresh after all voices finish
socket.on("done", async () => {
  appendOverlay("✅ All paragraphs generated.", "#d9f0ff");
  await voiceQueue;

  if (autoRefresh && !stopCycle) {
    appendOverlay("🔄 loading next drop…", "#d9f0ff", true);
    console.log("🔁 Auto-refresh next drop...");
    setTimeout(() => loadTrend(), 2000);
  }

  hideOverlay();
});

socket.on("error", data => {
  appendOverlay("❌ " + data.message, "#ffcccc");
  hideOverlay();
});

/* ---------------- Core Variables ---------------- */
let audioPlayer = null,
  currentTrend = null,
  roomId = null,
  stopCycle = false;
let currentTopic = "cosmetics";
let autoRefresh = false;

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
  deviceId =
    (window.crypto && crypto.randomUUID)
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

/* ---------------- Non-stream voice (music/politics fallback) ---------------- */
async function playVoiceAndRevealText(text, onEnd) {
  const audioEl = document.getElementById("voice-player");
  const descEl = document.getElementById("r-desc");
  descEl.textContent = "";

  const words = text.split(/\s+/);
  const segments = [];
  for (let i = 0; i < words.length; i += 30) {
    segments.push(words.slice(i, i + 30).join(" "));
  }

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const res = await fetch(`https://three23p-backend.onrender.com/api/voice?text=${encodeURIComponent(seg)}&lang=${userLang}`);
    const blob = await res.blob();
    audioEl.src = URL.createObjectURL(blob);
    descEl.textContent += (descEl.textContent ? " " : "") + seg;
    await audioEl.play();
    await new Promise(r => (audioEl.onended = r));
  }
  if (onEnd) onEnd();
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
    if (topic === "cosmetics" || topic === "aidrop") {
      clearInterval(descTimer);
      removeOverlayLine(descLine, "💬 streaming paragraph by paragraph...");
      socket.emit("startDescription", { topic, userId, lang: userLang, roomId });
      return; // handled by socket + auto refresh in "done"
    }

    const descRes = await fetch(
      `https://three23p-backend.onrender.com/api/description?topic=${topic}&userId=${userId}&lang=${userLang}`
    );
    if (!descRes.ok) {
      clearInterval(descTimer);
      removeOverlayLine(descLine, "❌ description failed");
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

  playVoiceAndRevealText(trend.description, () => {
    if (autoRefresh && !stopCycle) setTimeout(() => loadTrend(), 2000);
  });

  const imgLine = appendOverlay("🖼️ waiting for the image…", "#d9f0ff", true);
  let imgElapsed = 0;
  const imgTimer = setInterval(() => {
    imgElapsed++;
    imgLine.innerText = "🖼️ waiting for the image… " + imgElapsed + "s";
  }, 1000);

  try {
    const imgRes = await fetch(
      `https://three23p-backend.onrender.com/api/image?topic=${topic}&brand=${encodeURIComponent(trend.brand)}&product=${encodeURIComponent(trend.product)}&persona=${encodeURIComponent(trend.persona)}`
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
    { method: "POST" }
  );
  const data = await res.json();
  if (data.url) window.location.href = data.url;
  else alert("Checkout failed: " + (data.error || "unknown error"));
}
document.getElementById("buy-small").addEventListener("click", () => buyCredits("small"));
document.getElementById("buy-medium").addEventListener("click", () => buyCredits("medium"));
document.getElementById("buy-large").addEventListener("click", () => buyCredits("large"));

/* ---------------- Stripe Return ---------------- */
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

/* ---------------- Dual Drop Buttons ---------------- */
document.getElementById("start-btn").addEventListener("click", () => {
  document.getElementById("start-screen").style.display = "none";
  document.getElementById("app").style.display = "flex";
  socket.emit("joinRoom", roomId);
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