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
    chatBox.style.display = "block";
  };

  async function loadTrend() {
    try {
      const r = await fetch(`${API_BASE}/api/trend`);
      const j = await r.json();
      document.getElementById("r-title").textContent = j.product;
      document.getElementById("r-artist").textContent = j.brand;
      document.getElementById("r-desc").textContent = j.description;
      if (j.image) {
        const img = document.getElementById("r-img");
        img.src = j.image;
        img.style.display = "block";
      }
    } catch (e) {
      console.error("❌ trend fetch failed", e);
    }
  }

  document.getElementById("chat-send").onclick = () => {
    const text = document.getElementById("chat-input").value.trim();
    if (!text) return;
    socket.emit("chatMessage", { roomId, user: "anon", text });
    document.getElementById("chat-input").value = "";
  };

  socket.on("chatMessage", ({ user, text }) => {
    const msg = document.createElement("p");
    msg.textContent = `${user}: ${text}`;
    document.getElementById("messages").appendChild(msg);
  });
});
