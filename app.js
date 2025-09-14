const socket = io("https://three23p-backend.onrender.com");
let audioPlayer = null;
let currentTrend = null;
let roomId = null;
let socialMode = false;

/* ---------------- Setup Room ---------------- */
(function initRoom() {
  let params = new URLSearchParams(window.location.search);
  roomId = params.get("room");
  if (!roomId) {
    roomId = "room-" + Math.floor(1000 + Math.random() * 9000);
    const newUrl = window.location.origin + window.location.pathname + "?room=" + roomId;
    window.history.replaceState({}, "", newUrl);
  }
  document.getElementById("room-label").innerText = "room: " + roomId;
  // Show correct button
  if (params.get("room")) {
    document.getElementById("start-btn").style.display = "none";
    document.getElementById("guest-btn").style.display = "block";
  } else {
    document.getElementById("start-btn").style.display = "block";
    document.getElementById("guest-btn").style.display = "none";
  }
})();

/* ---------------- Voice ---------------- */
async function playAndWaitVoice(url) {
  return new Promise((resolve) => {
    if (audioPlayer) { audioPlayer.pause(); audioPlayer = null; }
    document.getElementById("voice-status").textContent = "🔄 Loading voice...";
    audioPlayer = new Audio(url);
    audioPlayer.onplay = () => { document.getElementById("voice-status").textContent = "🔊 Reading..."; };
    audioPlayer.onended = () => { document.getElementById("voice-status").textContent = "⏸ Done"; resolve(); };
    audioPlayer.onerror = () => { document.getElementById("voice-status").textContent = "⚠️ Voice error"; resolve(); };
    audioPlayer.play();
  });
}

/* ---------------- Warm-up ---------------- */
async function warmUp() {
  document.getElementById("app").style.display = "flex";
  document.getElementById("r-title").innerText = "—";
  document.getElementById("r-artist").innerText = "—";
  document.getElementById("r-persona").innerText = "";
  document.getElementById("r-desc").innerText = "AI is warming up…";
  document.getElementById("social-btn").style.display = "none";
  document.getElementById("r-img").style.display = "none";
  document.getElementById("r-fallback").style.display = "none";
  const url = "https://three23p-backend.onrender.com/api/voice?text=" + encodeURIComponent("AI is warming up…");
  await playAndWaitVoice(url);
  loadTrend();
}

/* ---------------- Load Trend ---------------- */
async function loadTrend() {
  const res = await fetch("https://three23p-backend.onrender.com/api/trend?room=" + roomId);
  currentTrend = await res.json();
  document.getElementById("r-title").innerText = currentTrend.brand;
  document.getElementById("r-artist").innerText = currentTrend.product;
  document.getElementById("r-persona").innerText = currentTrend.persona ? `👤 Featuring ${currentTrend.persona}` : "";
  document.getElementById("r-desc").innerText = currentTrend.description;
  document.getElementById("social-btn").style.display = "block";
  if (currentTrend.image) {
    document.getElementById("r-img").src = currentTrend.image;
    document.getElementById("r-img").style.display = "block";
    document.getElementById("r-fallback").style.display = "none";
  } else {
    document.getElementById("r-img").style.display = "none";
    document.getElementById("r-fallback").style.display = "block";
  }
}

/* ---------------- Start / Guest buttons ---------------- */
document.getElementById("start-btn").addEventListener("click", () => {
  document.getElementById("start-screen").style.display = "none";
  document.getElementById("app").style.display = "flex";
  socket.emit("joinRoom", roomId);
  warmUp(); // Host triggers trend generation if missing
});

document.getElementById("guest-btn").addEventListener("click", () => {
  document.getElementById("start-screen").style.display = "none";
  document.getElementById("app").style.display = "flex";
  socket.emit("joinRoom", roomId);
  loadTrend(); // Guest only loads cached trend
});

/* ---------------- Chat & 🍜 ---------------- */
document.getElementById("chat-send").addEventListener("click", () => {
  const text = document.getElementById("chat-input").value;
  if (!text.trim()) return;
  socket.emit("chatMessage", { roomId: roomId, user: "anon", text });
  document.getElementById("chat-input").value = "";
});

document.getElementById("social-btn").addEventListener("click", () => {
  socialMode = true;
  document.getElementById("bottom-panel").style.display = "flex";
  const newUrl = window.location.origin + window.location.pathname + "?room=" + roomId;
  window.history.replaceState({}, "", newUrl);
  const btn = document.getElementById("social-btn");
  btn.disabled = true;
  btn.textContent = "share the url to your shopping companion and chat";
  document.getElementById("room-label").innerText = "room: " + roomId + " (social mode active)";
});
