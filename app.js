// app.js — 323drop frontend logic
const socket = io("https://three23p-backend.onrender.com");
let audioPlayer = null;
let currentTrend = null;
let roomId = null;
let socialMode = false;

/* ---------------- Get room from URL ---------------- */
const params = new URLSearchParams(window.location.search);
roomId = params.get("room");
console.log("Loaded roomId from URL:", roomId);

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
  console.log("start-btn clicked, joining room:", roomId);

  document.getElementById("start-screen").style.display = "none";
  document.getElementById("app").style.display = "flex";

  // Join the room
  socket.emit("joinRoom", roomId);
  document.getElementById("room-label").innerText = "room: " + roomId;

  // Enable social mode if link had ?room
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
  socialMode = true;
  document.getElementById("bottom-panel").style.display = "flex";
  uiLog("Switched to social mode, room=" + roomId);

  socket.emit("socialMode", { roomId });

  const btn = document.getElementById("social-btn");
  btn.disabled = true;
  btn.style.cursor = "default";
  btn.textContent = "share the url to your shopping companion and chat";

  if (currentTrend) cycleTrend();
});