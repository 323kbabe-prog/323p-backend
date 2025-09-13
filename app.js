// app.js — add brand+product to URL correctly
const socket = io("https://three23p-backend.onrender.com", {
  transports: ["polling"]   // stable transport
});

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
  let params = new URLSearchParams(window.location.search);
  let brand = params.get("brand");
  let product = params.get("product");

  // Build API URL
  let url = "https://three23p-backend.onrender.com/api/trend";
  if (roomId) url += "?room=" + roomId;
  if (brand && product) {
    url += (roomId ? "&" : "?") + "brand=" + encodeURIComponent(brand) + "&product=" + encodeURIComponent(product);
  }

  console.log("🌐 Fetching trend from:", url);
  const res = await fetch(url);
  currentTrend = await res.json();

  console.log("🎶 Trend loaded:", currentTrend);

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

  const voiceUrl = "https://three23p-backend.onrender.com/api/voice?text=" + encodeURIComponent(currentTrend.description);
  await playAndWaitVoice(voiceUrl);

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
  console.log("▶️ Start button clicked");

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
  console.log("💬 Sending chat:", text);
  socket.emit("chatMessage", { roomId: roomId, user: "anon", text });
  document.getElementById("chat-input").value = "";
});

/* 🍜 button → lock brand+product in URL */
document.getElementById("social-btn").addEventListener("click", () => {
  console.log("🍜 Button clicked by host");

  socialMode = true;
  document.getElementById("bottom-panel").style.display = "flex";

  // ✅ Use brand+product directly, including emojis
  const brand = currentTrend?.brand || "Unknown";
  const product = currentTrend?.product || "Unknown";

  const newUrl = window.location.origin + window.location.pathname +
    "?room=" + roomId +
    "&brand=" + encodeURIComponent(brand) +
    "&product=" + encodeURIComponent(product);

  window.history.replaceState({}, "", newUrl);
  console.log("🔗 Updated URL to:", newUrl);

  const btn = document.getElementById("social-btn");
  btn.disabled = true;
  btn.style.cursor = "default";
  btn.textContent = "share the url to your shopping companion and chat";

  if (currentTrend) loadTrend();
});
