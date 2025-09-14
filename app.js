// app.js — 323drop frontend logic
const socket = io("https://three23p-backend.onrender.com");
let audioPlayer = null;
let currentTrend = null;
let roomId = null;
let socialMode = false;

/* ---------------- Room setup (auto on load) ---------------- */
(function initRoom() {
  let params = new URLSearchParams(window.location.search);
  roomId = params.get("room");

  // If no room in URL, generate one immediately
  if (!roomId) {
    roomId = "default-" + Math.floor(Math.random() * 9999);
    const newUrl =
      window.location.origin + window.location.pathname + "?room=" + roomId;
    window.history.replaceState({}, "", newUrl);
  }
})();

/* ---------------- Logger ---------------- */
function uiLog(msg) {
  const logBox = document.getElementById("console-log");
  const line = document.createElement("div");
  line.textContent = "[" + new Date().toLocaleTimeString() + "] " + msg;
  logBox.appendChild(line);
  logBox.scrollTop = logBox.scrollHeight;
  console.log(msg);
}

/* ---------------- Voice ---------------- */
async function playAndWaitVoice(url) {
  return new Promise((resolve) => {
    if (audioPlayer) {
      audioPlayer.pause();
      audioPlayer = null;
    }
    document.getElementById("voice-status").textContent = "🔄 Loading voice...";
    audioPlayer = new Audio(url);
    audioPlayer.onplay = () => {
      document.getElementById("voice-status").textContent = "🔊 Reading...";
    };
    audioPlayer.onended = () => {
      document.getElementById("voice-status").textContent = "⏸ Done";
      resolve();
    };
    audioPlayer.onerror = () => {
      document.getElementById("voice-status").textContent = "⚠️ Voice error";
      resolve();
    };
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

  const url =
    "https://three23p-backend.onrender.com/api/voice?text=" +
    encodeURIComponent("AI is warming up…");
  await playAndWaitVoice(url);
  loadTrend();
}

/* ---------------- Cycle ---------------- */
async function cycleTrend() {
  if (!currentTrend) return;
  const url =
    "https://three23p-backend.onrender.com/api/voice?text=" +
    encodeURIComponent(currentTrend.description);
  await playAndWaitVoice(url);
  if (!socialMode) {
    await loadTrend();
  } else {
    cycleTrend();
  }
}

/* ---------------- Load real drop ---------------- */
async function loadTrend() {
  uiLog("Fetching trend...");
  const res = await fetch("https://three23p-backend.onrender.com/api/trend");
  currentTrend = await res.json();
  uiLog("Trend loaded: " + currentTrend.brand + " - " + currentTrend.product);

  document.getElementById("r-title").innerText = currentTrend.brand;
  document.getElementById("r-artist").innerText = currentTrend.product;

  // 👤 Persona line
  document.getElementById("r-persona").innerText = currentTrend.persona
    ? `👤 Featuring ${currentTrend.persona}`
    : "";

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
  cycleTrend();
}

/* ---------------- Chat ---------------- */
function addChatLine(user, text) {
  const msgEl = document.createElement("p");
  msgEl.textContent = user + ": " + text;
  document.getElementById("messages").appendChild(msgEl);
}
socket.on("chatMessage", (msg) => {
  uiLog("Chat: " + msg.user + " - " + msg.text);
  addChatLine(msg.user, msg.text);
});
socket.on("chatHistory", (history) => {
  uiLog("Loaded history " + history.length);
  history.forEach((m) => addChatLine(m.user, m.text));
});

/* ---------------- Start button ---------------- */
document.getElementById("start-btn").addEventListener("click", () => {
  document.getElementById("start-screen").style.display = "none";
  document.getElementById("app").style.display = "flex";

  // Always join the room (already created/reused on page load)
  socket.emit("joinRoom", roomId);
  document.getElementById("room-label").innerText = "room: " + roomId;

  // If user came via shared link with ?room=..., enable social mode
  let params = new URLSearchParams(window.location.search);
  if (params.get("room")) {
    socialMode = true;
    document.getElementById("bottom-panel").style.display = "flex";
  }

  warmUp();
});

/* ---------------- Send chat ---------------- */
document.getElementById("chat-send").addEventListener("click", () => {
  const text = document.getElementById("chat-input").value;
  if (!text.trim()) return;
  socket.emit("chatMessage", { roomId: roomId, user: "anon", text });
  uiLog("Sent chat: " + text);
  document.getElementById("chat-input").value = "";
});

/* ---------------- 🍜 Social mode ---------------- */
document.getElementById("social-btn").addEventListener("click", () => {
  // ✅ Do not touch URL or roomId here, just enable chat/social mode
  socialMode = true;
  document.getElementById("bottom-panel").style.display = "flex"; // show chat dock
  uiLog("Switched to social mode, room=" + roomId);

  // 👇 Emit to backend so it logs activation
  socket.emit("socialMode", { roomId });

  const btn = document.getElementById("social-btn");
  btn.disabled = true;
  btn.style.cursor = "default";
  btn.textContent = "share the url to your shopping companion and chat";

  if (currentTrend) cycleTrend();
});