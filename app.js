const socket = io("https://three23p-backend.onrender.com");
let audioPlayer = null;
let currentTrend = null;
let roomId = null;
let lastDescriptionKey = null;
let stopCycle = false;
let currentTopic = "cosmetics"; // default topic

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
    fetch(`https://three23p-backend.onrender.com/api/start-voice?room=${roomId}`).catch(() => {});
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
function showWarmupOverlay(message) {
  const center = document.getElementById("warmup-center");
  if (center) {
    center.style.display = "flex";
    center.innerText = message || "✨🔥💖 AI is warming up… 🌈🥹💅";
  }
}
function hideWarmupOverlay() {
  const center = document.getElementById("warmup-center");
  if (center) center.style.display = "none";
}

/* ---------------- Load Trend + Voice ---------------- */
async function loadTrend() {
  if (stopCycle) return;
  let apiUrl = "https://three23p-backend.onrender.com/api/trend?room=" + roomId + "&topic=" + currentTopic;
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

  // Dynamic Label
  let label;
  if (currentTrend.isDaily) {
    label = "🌅 pick of the day";
  } else {
    if (currentTopic === "cosmetics") label = "⚡ beauty drip";
    else if (currentTopic === "music") label = "🎶 looped vibe";
    else if (currentTopic === "politics") label = "🏛 ongoing rant";
    else label = "🌐 glitch loop";
  }
  document.getElementById("r-label").innerText = label;

  if (currentTrend.image) {
    document.getElementById("r-img").src = currentTrend.image;
    document.getElementById("r-img").style.display = "block";
    document.getElementById("r-fallback").style.display = "none";
  } else {
    document.getElementById("r-img").style.display = "none";
    document.getElementById("r-fallback").style.display = "block";
  }

  // Voice playback + preload cycle
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
  setTimeout(() => {
    loadTrend();
  }, 3000);
});

/* ---------------- Topic Toggle ---------------- */
document.querySelectorAll("#topic-picker button").forEach(btn => {
  btn.addEventListener("click", () => {
    currentTopic = btn.dataset.topic;
    showWarmupOverlay(`✨ switching vibe to 323${currentTopic}…`);
    stopCycle = false;
    setTimeout(() => loadTrend(), 2000);
  });
});
