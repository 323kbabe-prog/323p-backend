const socket = io("https://three23p-backend.onrender.com");
let audioPlayer = null;
let currentTrend = null;
let roomId = null;
let lastDescriptionKey = null;
let stopCycle = false;

/* ---------------- Emoji Helper ---------------- */
const GENZ_EMOJIS = ["✨","🔥","💖","👀","😍","💅","🌈","🌸","😎","🤩","🫶","🥹","🧃","🌟","💋"];
function randomGenZEmojis(count = 3) {
  let chosen = [];
  for (let i = 0; i < count; i++) {
    chosen.push(GENZ_EMOJIS[Math.floor(Math.random() * GENZ_EMOJIS.length)]);
  }
  return chosen.join(" ");
}

/* ---------------- Room Setup ---------------- */
(function initRoom() {
  let params = new URLSearchParams(window.location.search);
  roomId = params.get("room");

  // If no roomId in URL, generate one and write to browser URL
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
    // ✅ Update status to Gen-Z tech vibe
    document.getElementById("voice-status").innerText = "🤖🔊 vibin’ rn…";

    // Trigger pre-generation when current voice starts
    fetch(`https://three23p-backend.onrender.com/api/start-voice?room=${roomId}`)
      .catch(() => {});
    hideWarmupOverlay();
  };
  audioPlayer.onended = () => {
    // ✅ Back to idle/prep status
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
    center.innerText = `${randomGenZEmojis(3)} AI is warming up… ${randomGenZEmojis(3)}`;
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

  // Update UI
  document.getElementById("r-title").innerText = currentTrend.brand;
  document.getElementById("r-artist").innerText = currentTrend.product;
  document.getElementById("r-persona").innerText = currentTrend.persona ? `👤 Featuring ${currentTrend.persona}` : "";
  document.getElementById("r-desc").innerText = currentTrend.description;

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
