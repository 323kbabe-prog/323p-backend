// app.js — 323drop frontend
const socket = io("https://three23p-backend.onrender.com");

let audioPlayer = null;
let voiceLoopActive = false;
let chatInterrupting = false;
let currentTrend = null;
let voiceUrl = "";

/* ---------------- Helpers ---------------- */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function playVoice(url) {
  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer = null;
  }
  return new Promise((resolve) => {
    audioPlayer = new Audio(url);
    audioPlayer.onended = () => resolve();
    audioPlayer.onerror = () => resolve();
    audioPlayer.play();
  });
}

/* ---------------- Voice Loop ---------------- */
async function startVoiceLoop(url) {
  voiceUrl = url;
  voiceLoopActive = true;
  while (voiceLoopActive) {
    if (chatInterrupting) { await sleep(500); continue; }
    await playVoice(voiceUrl);
    await sleep(500);
  }
}
function stopVoiceLoop() { 
  voiceLoopActive = false; 
  if (audioPlayer) audioPlayer.pause(); 
}

/* ---------------- Trend Loader ---------------- */
async function loadTrend() {
  const res = await fetch("/api/trend");
  currentTrend = await res.json();

  document.getElementById("r-title").innerText = currentTrend.brand;
  document.getElementById("r-artist").innerText = currentTrend.product;
  document.getElementById("r-desc").innerText = currentTrend.description;

  if (currentTrend.image) {
    document.getElementById("r-img").src = currentTrend.image;
    document.getElementById("r-img").style.display = "block";
    document.getElementById("r-fallback").style.display = "none";
  } else {
    document.getElementById("r-img").style.display = "none";
    document.getElementById("r-fallback").style.display = "block";
  }

  return `/api/voice?text=${encodeURIComponent(currentTrend.description)}`;
}

/* ---------------- Chat Handling ---------------- */
async function handleChatMessage({ user, text }) {
  chatInterrupting = true;
  stopVoiceLoop();

  const msgEl = document.createElement("p");
  msgEl.textContent = `${user}: ${text}`;
  document.getElementById("messages").appendChild(msgEl);

  const chatVoiceUrl = `/api/voice?text=${encodeURIComponent(text)}`;
  await playVoice(chatVoiceUrl);

  chatInterrupting = false;
  if (currentTrend) {
    const url = `/api/voice?text=${encodeURIComponent(currentTrend.description)}`;
    startVoiceLoop(url);
  }
}

/* ---------------- Socket.IO ---------------- */
socket.on("connect", () => {
  console.log("✅ connected");
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get("room") || "default-" + Math.floor(Math.random() * 9999);

  socket.emit("joinRoom", roomId);
  document.getElementById("room-label").innerText = "room: " + roomId;
  document.getElementById("chat-box").style.display = "block";
});

socket.on("chatMessage", (msg) => handleChatMessage(msg));

/* ---------------- UI Events ---------------- */
document.getElementById("start-btn").addEventListener("click", async () => {
  document.getElementById("start-screen").style.display = "none";
  document.getElementById("app").style.display = "block";
  const url = await loadTrend();
  if (url) startVoiceLoop(url);
});

document.getElementById("chat-send").addEventListener("click", () => {
  const text = document.getElementById("chat-input").value;
  if (!text.trim()) return;
  const room = document.getElementById("room-label").innerText.replace("room: ", "");
  socket.emit("chatMessage", { roomId: room, user: "anon", text });
  document.getElementById("chat-input").value = "";
});

document.getElementById("social-btn").addEventListener("click", () => {
  document.getElementById("chat-box").style.display = "block";
});
