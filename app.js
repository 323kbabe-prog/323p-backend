// app.js — guest regenerates from brand+product in URL
const socket = io("https://three23p-backend.onrender.com");

let audioPlayer = null;
let currentTrend = null;
let roomId = null;
let socialMode = false;

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

async function playAndWaitVoice(url) {
  return new Promise((resolve) => {
    if (audioPlayer) { audioPlayer.pause(); audioPlayer = null; }
    audioPlayer = new Audio(url);
    audioPlayer.onended = () => resolve();
    audioPlayer.onerror = () => resolve();
    audioPlayer.play();
  });
}

// Warm-up
async function warmUp() {
  document.getElementById("app").style.display = "flex";
  document.getElementById("r-desc").innerText = "AI is warming up…";
  const url = `/api/voice?text=${encodeURIComponent("AI is warming up…")}`;
  await playAndWaitVoice(url);
  loadTrend();
}

// Load trend
async function loadTrend() {
  const params = new URLSearchParams(window.location.search);
  const brand = params.get("brand");
  const product = params.get("product");

  if (brand && product) {
    // Guest or host frozen drop → regenerate description+image
    currentTrend = {
      brand,
      product,
      description: `Using ${product} from ${brand} feels amazing every time 💖✨`,
      image: "https://placehold.co/600x600?text=" + encodeURIComponent(product)
    };
    document.getElementById("r-title").innerText = currentTrend.brand;
    document.getElementById("r-artist").innerText = currentTrend.product;
    document.getElementById("r-desc").innerText = currentTrend.description;
    document.getElementById("r-img").src = currentTrend.image;
    document.getElementById("r-img").style.display = "block";
    document.getElementById("r-fallback").style.display = "none";
    const url = `/api/voice?text=${encodeURIComponent(currentTrend.description)}`;
    await playAndWaitVoice(url);
    return;
  }

  // Normal base flow
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
  const url = `/api/voice?text=${encodeURIComponent(currentTrend.description)}`;
  await playAndWaitVoice(url);
}

// Socket
socket.on("connect", () => {
  const params = new URLSearchParams(window.location.search);
  roomId = params.get("room");
  if (!roomId) {
    roomId = "default-" + Math.floor(Math.random() * 9999);
    const newUrl = window.location.origin + "?room=" + roomId;
    window.history.replaceState({}, "", newUrl);
  }
  socket.emit("joinRoom", roomId);
  document.getElementById("room-label").innerText = "room: " + roomId;
  warmUp();
});

socket.on("chatMessage", (msg) => {
  const msgEl = document.createElement("p");
  msgEl.textContent = `${msg.user}: ${msg.text}`;
  document.getElementById("messages").appendChild(msgEl);
  const chatVoiceUrl = `/api/voice?text=${encodeURIComponent(msg.text)}`;
  playVoice(chatVoiceUrl);
});

// Send chat
document.getElementById("chat-send").addEventListener("click", () => {
  const text = document.getElementById("chat-input").value;
  if (!text.trim()) return;
  socket.emit("chatMessage", { roomId, user: "anon", text });
  document.getElementById("chat-input").value = "";
});

// 🍜 button
document.getElementById("social-btn").addEventListener("click", () => {
  socialMode = true;
  document.getElementById("bottom-panel").style.display = "flex";
  const newUrl = window.location.origin + window.location.pathname +
    `?room=${roomId}&brand=${encodeURIComponent(currentTrend.brand)}&product=${encodeURIComponent(currentTrend.product)}`;
  window.history.replaceState({}, "", newUrl);

  const btn = document.getElementById("social-btn");
  btn.disabled = true;
  btn.style.cursor = "default";
  btn.textContent = "share the url to your shopping companion and chat";
});
