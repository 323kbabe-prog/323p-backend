const socket = io("https://three23p-backend.onrender.com");
let audioPlayer = null;
let currentTrend = null;
let roomId = null;
let lastDescriptionKey = null;
let stopCycle = false;

/* ---------------- Gen-Z Gradient Pool ---------------- */
const genzGradients = [
  // pastel cute
  "linear-gradient(-45deg, #f9d5ec, #c9e7ff, #e6d7ff)",
  // peach cream
  "linear-gradient(-45deg, #ffd6e8, #ffe6cc, #fff2cc)",
  // vaporwave neon
  "linear-gradient(-45deg, #ff9a9e, #00f2fe, #a18cd1)",
  // cyber drip
  "linear-gradient(-45deg, #ff00cc, #3333ff, #6600ff)",
  // aqua chill
  "linear-gradient(-45deg, #d7f9f5, #e0e7ff, #f5d9ff)",
  // sunset slay
  "linear-gradient(-45deg, #fcb69f, #ffecd2, #dcb0ed)",
  // dream glow
  "linear-gradient(-45deg, #e0c3fc, #8ec5fc, #d7e1ec)",
  // hot pink slay
  "linear-gradient(-45deg, #ff5f6d, #ffc371, #ff9a9e)",
  // gen-z mint pop
  "linear-gradient(-45deg, #a1ffce, #faffd1, #d4fc79)",
  // retro purple blue
  "linear-gradient(-45deg, #667eea, #764ba2, #6b73ff)"
];

/* ---------------- Room Setup ---------------- */
(function initRoom() {
  let params = new URLSearchParams(window.location.search);
  roomId = params.get("room");
  if (!roomId) {
    roomId = "room-" + Math.floor(Math.random() * 9000);
    const newUrl = window.location.origin + window.location.pathname + "?room=" + roomId;
    window.history.replaceState({}, "", newUrl);
  }
})();

/* ---------------- Voice ---------------- */
function playVoice(text, onEnd) {
  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer = null;
  }
  const url = "https://three23p-backend.onrender.com/api/voice?text=" + encodeURIComponent(text);
  audioPlayer = new Audio(url);
  audioPlayer.onplay = () => {
    document.getElementById("voice-status").innerText = "🤖🔊 vibin’ rn…";
    fetch(`https://three23p-backend.onrender.com/api/start-voice?room=${roomId}`)
      .catch(() => {});
    hideWarmupOverlay();
  };
  audioPlayer.onended = () => {
    document.getElementById("voice-status").innerText = "⚙️💻 preppin’ the drop…";
    if (onEnd) onEnd();
  };
  audioPlayer.onerror = () => {
    document.getElementById("voice-status").innerText = "⚙️💻 preppin’ the drop…";
    if (onEnd) onEnd();
  };
  audioPlayer.play();
}

/* ---------------- Warm-up Overlay ---------------- */
function showWarmupOverlay() {
  const center = document.getElementById("warmup-center");
  if (center) {
    center.style.display = "flex";
    center.innerText = "✨🔥💖 AI is warming up… 🌈🥹💅";
  }
}
function hideWarmupOverlay() {
  const center = document.getElementById("warmup-center");
  if (center) center.style.display = "none";
}

/* ---------------- Load Trend + Voice ---------------- */
async function loadTrend() {
  if (stopCycle) return;
  let apiUrl = "https://three23p-backend.onrender.com/api/trend?room=" + roomId;
  const res = await fetch(apiUrl);
  const newTrend = await res.json();
  if (!newTrend || !newTrend.description) {
    showWarmupOverlay();
    setTimeout(() => loadTrend(), 2000);
    return;
  }

  currentTrend = newTrend;

  // ✅ Pick a new gradient each drop + reset background cleanly
  const gradient = genzGradients[Math.floor(Math.random() * genzGradients.length)];
  document.body.style.background = gradient;
  document.body.style.backgroundSize = "400% 400%";
  document.body.style.animation = ""; // reset animation to avoid blending
  void document.body.offsetWidth; // force reflow (hack to restart CSS animation)
  document.body.style.animation = "gradientShift 12s ease infinite";

  console.log("🌈 New drop background:", gradient);

  // Update UI
  document.getElementById("r-title").innerText = currentTrend.brand;
  document.getElementById("r-artist").innerText = currentTrend.product;
  document.getElementById("r-persona").innerText = currentTrend.persona ? `👤 Featuring ${currentTrend.persona}` : "";
  document.getElementById("r-desc").innerText = currentTrend.description;

  // ⚡ Dynamic Gen-Z label
  if (!lastDescriptionKey) {
    document.getElementById("r-label").innerText = "⚡ today’s slay pick";
  } else {
    document.getElementById("r-label").innerText = "⚡ real-time drip";
  }

  if (currentTrend.image) {
    document.getElementById("r-img").src = currentTrend.image;
    document.getElementById("r-img").style.display = "block";
    document.getElementById("r-fallback").style.display = "none";
  } else {
    document.getElementById("r-img").style.display = "none";
    document.getElementById("r-fallback").style.display = "block";
  }

  const descriptionKey = currentTrend.description;
  if (descriptionKey !== lastDescriptionKey) {
    lastDescriptionKey = descriptionKey;
    playVoice(currentTrend.description, () => {
      if (!stopCycle) {
        showWarmupOverlay();
        setTimeout(() => loadTrend(), 2000);
      }
    });
  } else {
    setTimeout(() => loadTrend(), 2000);
  }
}

/* ---------------- Start Button ---------------- */
document.getElementById("start-btn").addEventListener("click", () => {
  document.getElementById("start-screen").style.display = "none";
  document.getElementById("app").style.display = "flex";
  socket.emit("joinRoom", roomId);

  showWarmupOverlay();

  // Force 3-second delay before first DailyDrop
  setTimeout(() => {
    loadTrend();
  }, 3000);
});
