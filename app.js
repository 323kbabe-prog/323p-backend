// app.js — voice loop + trend + chat
const socket = io("https://three23p-backend.onrender.com");

let audioPlayer = null;
let voiceLoopActive = false;
let chatInterrupting = false;
let currentTrend = null;
let voiceUrl = "";

/* ----- Helpers ----- */
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function playVoice(url) {
  if (audioPlayer) { audioPlayer.pause(); audioPlayer = null; }
  return new Promise((resolve) => {
    audioPlayer = new Audio(url);
    audioPlayer.onended = () => resolve();
    audioPlayer.onerror = () => resolve();
    audioPlayer.play();
  });
}

/* ----- Voice Loop ----- */
async function startVoiceLoop(url) {
  voiceUrl = url;
  voiceLoopActive = true;
  while (voiceLoopActive) {
    if (chatInterrupting) { await sleep(500); continue; }
    await playVoice(voiceUrl);
    await sleep(500);
  }
}
function stopVoiceLoop() { voiceLoopActive = false; if (audioPlayer) audioPlayer.pause(); }

/* ----- Load Trend ----- */
async function loadTrend() {
  const res = await fetch("/api/trend");
  currentTrend = await res.json();
  document.getElementById("r-title").innerText = currentTrend.brand;
  document.getElementById("r-artist").innerText = currentTrend.product;
  document.getElementById("r-desc").innerText = currentTrend.description;
  if (currentTrend.image?.startsWith("data:image")) {
    document.getElementById("r-img").src = currentTrend.image;
    document.getElementById("r-img").style.display = "block";
    document.getElementById("r-fallback").style.display = "none";
  }
  return `/api/voice?text=${encodeURIComponent(currentTrend.description)}`;
}

/* ----- Chat Handling ----- */
async function handleChatMessage({ user, text }) {
  chatInterrupting = true; stopVoiceLoop();
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

/* ----- Socket.IO ----- */
socket.on("connect", () => {
  console.log("connected");
  socket.emit("joinRoom", "default");
});
socket.on("chatMessage", (msg) => handleChatMessage(msg));

/* ----- UI Events ----- */
document.getElementById("start-btn").addEventListener("click", async () => {
  document.getElementById("start-screen").style.display = "none";
  document.getElementById("app").style.display = "block";
  const url = await loadTrend();
  if (url) startVoiceLoop(url);
});

document.getElementById("chat-send").addEventListener("click", () => {
  const text = document.getElementById("chat-input").value;
  if (!text.trim()) return;
  socket.emit("chatMessage", { roomId: "default", user: "anon", text });
  document.getElementById("chat-input").value = "";
});
