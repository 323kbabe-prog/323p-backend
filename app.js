// app.js — trend feed + chat + room locking (with debug logs)
const socket = io("https://three23p-backend.onrender.com");

let audioPlayer = null;
let currentTrend = null;
let roomId = null;
let socialMode = false;

/* Voice */
async function playAndWaitVoice(url) {
  return new Promise(resolve => {
    if (audioPlayer) { audioPlayer.pause(); audioPlayer = null; }
    document.getElementById("voice-status").textContent = "🔄 loading voice…";
    audioPlayer = new Audio(url);
    audioPlayer.onplay = () => { document.getElementById("voice-status").textContent = "🔊 reading…"; };
    audioPlayer.onended = () => { document.getElementById("voice-status").textContent = "⏸ done"; resolve(); };
    audioPlayer.onerror = () => { document.getElementById("voice-status").textContent = "⚠️ voice error"; resolve(); };
    audioPlayer.play();
  });
}

/* Load trend */
async function loadTrend() {
  const res = await fetch(`https://three23p-backend.onrender.com/api/trend${roomId ? "?room=" + roomId : ""}`);
  currentTrend = await res.json();

  console.log("🎶 Trend loaded:", currentTrend); // DEBUG

  document.getElementById("r-title").innerText = currentTrend.brand;
  document.getElementById("r-artist").innerText = currentTrend.product;
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

  const url = "https://three23p-backend.onrender.com/api/voice?text=" + encodeURIComponent(currentTrend.description);
  await playAndWaitVoice(url);

  if (!socialMode) loadTrend();
}

/* Chat */
function addChatLine(user, text) {
  const msgEl = document.createElement("p");
  msgEl.textContent = user + ": " + text;
  document.getElementById("messages").appendChild(msgEl);
}
socket.on("chatMessage", (msg) => addChatLine(msg.user, msg.text));

/* Start button */
document.getElementById("start-btn").addEventListener("click", () => {
  document.getElementById("start-screen").style.display = "none";
  document.getElementById("app").style.display = "flex";

  let params = new URLSearchParams(window.location.search);
  roomId = params.get("room");
  if (!roomId) { roomId = "default-" + Math.floor(Math.random() * 9999); }
  socket.emit("joinRoom", roomId);
  document.getElementById("room-label").innerText = "room: " + roomId;

  if (params.get("room")) {
    socialMode = true;
    document.getElementById("bottom-panel").style.display = "flex";
  }
  loadTrend();
});

/* Send chat */
document.getElementById("chat-send").addEventListener("click", () => {
  const text = document.getElementById("chat-input").value;
  if (!text.trim()) return;
  socket.emit("chatMessage", { roomId: roomId, user: "anon", text });
  document.getElementById("chat-input").value = "";
});

/* 🍜 button → lock trend */
document.getElementById("social-btn").addEventListener("click", () => {
  console.log("🍜 button clicked"); // DEBUG

  socialMode = true;
  document.getElementById("bottom-panel").style.display = "flex";

  const newUrl = window.location.origin + window.location.pathname + "?room=" + roomId;
  window.history.replaceState({}, "", newUrl);

  if (currentTrend) {
    console.log("🔐 Emitting lockTrend:", roomId, currentTrend); // DEBUG
    socket.emit("lockTrend", { roomId, trend: currentTrend });
  } else {
    console.warn("⚠️ No currentTrend to lock!");
  }

  const btn = document.getElementById("social-btn");
  btn.disabled = true;
  btn.style.cursor = "default";
  btn.textContent = "share the url to your shopping companion and chat";

  if (currentTrend) loadTrend();
});
