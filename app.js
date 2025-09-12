// Redirect if no room param
const params = new URLSearchParams(window.location.search);
if (!params.get("room")) {
  const newRoom = Math.random().toString(36).substring(2, 8);
  window.location.replace(`${window.location.origin}/?room=${newRoom}`);
}

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://three23p-backend.onrender.com";
  const roomId = new URLSearchParams(window.location.search).get("room");

  const socket = io(API_BASE);
  socket.emit("joinRoom", roomId);

  const startBtn = document.getElementById("start-btn");
  const socialBtn = document.getElementById("social-btn");
  const chatBox = document.getElementById("chat-box");
  const roomLabel = document.getElementById("room-label");
  const voicePlayer = new Audio();

  let currentDescription = "";
  let chatMode = false;
  let loopInterval;

  // show sharable link
  const fullUrl = `${window.location.origin}/?room=${roomId}`;
  roomLabel.textContent = fullUrl;
  roomLabel.onclick = () => navigator.clipboard.writeText(fullUrl);

  startBtn.onclick = () => {
    document.getElementById("start-screen").style.display = "none";
    document.getElementById("app").style.display = "block";
    loadTrend();
  };

  socialBtn.onclick = () => {
    chatMode = true;
    chatBox.style.display = "block";
    if (currentDescription) playLoop(currentDescription);
  };

  async function loadTrend() {
    try {
      const r = await fetch(`${API_BASE}/api/trend`);
      const j = await r.json();
      document.getElementById("r-title").textContent = j.product;
      document.getElementById("r-artist").textContent = j.brand;
      document.getElementById("r-desc").textContent = j.description;
      currentDescription = j.description;

      if (j.image) {
        const img = document.getElementById("r-img");
        img.src = j.image;
        img.style.display = "block";
      }

      if (chatMode && currentDescription) playLoop(currentDescription);
    } catch (e) {
      console.error("❌ trend fetch failed", e);
    }
  }

  // play looped description voice
  async function playLoop(text) {
    clearInterval(loopInterval);
    await playVoice(text);
    loopInterval = setInterval(() => playVoice(text), 12000); // every ~12s
  }

  // play single voice clip
  async function playVoice(text) {
    return new Promise(async (resolve) => {
      try {
        voicePlayer.src = `${API_BASE}/api/voice?text=${encodeURIComponent(text)}`;
        await voicePlayer.play();
        voicePlayer.onended = () => resolve();
      } catch (e) {
        console.error("🔇 voice error", e);
        resolve();
      }
    });
  }

  // send chat
  document.getElementById("chat-send").onclick = () => {
    const text = document.getElementById("chat-input").value.trim();
    if (!text) return;
    socket.emit("chatMessage", { roomId, user: "anon", text });
    document.getElementById("chat-input").value = "";
  };

  // receive chat
  socket.on("chatMessage", async ({ user, text }) => {
    const msg = document.createElement("p");
    msg.textContent = `${user}: ${text}`;
    document.getElementById("messages").appendChild(msg);

    // interrupt voice
    clearInterval(loopInterval);
    voicePlayer.pause();

    // play chat TTS
    await playVoice(`${user} says ${text}`);

    // resume looping desc
    if (chatMode && currentDescription) playLoop(currentDescription);
  });
});
