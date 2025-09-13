// app.js — auto trend + random room in URL
const socket = io("https://three23p-backend.onrender.com");

let currentTrend = null;

/* Trend loader */
async function loadTrend() {
  const res = await fetch("/api/trend");
  currentTrend = await res.json();

  document.getElementById("r-title").innerText = currentTrend.brand;
  document.getElementById("r-artist").innerText = currentTrend.product;
  document.getElementById("r-desc").innerText = currentTrend.description;

  if (currentTrend.image) {
    const img = document.getElementById("r-img");
    img.src = currentTrend.image;
    img.style.display = "none";
    document.getElementById("r-fallback").style.display = "none";

    img.onload = () => {
      img.style.display = "block";
      document.getElementById("social-btn").style.display = "block"; // 🍜 only when image loads
    };
    img.onerror = () => {
      document.getElementById("r-fallback").style.display = "block";
      document.getElementById("social-btn").style.display = "none";
    };
  } else {
    document.getElementById("r-img").style.display = "none";
    document.getElementById("r-fallback").style.display = "block";
    document.getElementById("social-btn").style.display = "none";
  }
}

/* Socket.IO */
socket.on("connect", () => {
  let params = new URLSearchParams(window.location.search);
  let roomId = params.get("room");
  if (!roomId) {
    roomId = "default-" + Math.floor(Math.random() * 9999);
    const newUrl = window.location.origin + "?room=" + roomId;
    window.history.replaceState({}, "", newUrl);
  }

  socket.emit("joinRoom", roomId);
  document.getElementById("room-label").innerText = "room: " + roomId;
  document.getElementById("chat-box").style.display = "block";

  loadTrend();
});

socket.on("chatMessage", (msg) => {
  const msgEl = document.createElement("p");
  msgEl.textContent = `${msg.user}: ${msg.text}`;
  document.getElementById("messages").appendChild(msgEl);
});

/* Chat send */
document.getElementById("chat-send").addEventListener("click", () => {
  const text = document.getElementById("chat-input").value;
  if (!text.trim()) return;
  const room = document.getElementById("room-label").innerText.replace("room: ", "");
  socket.emit("chatMessage", { roomId: room, user: "anon", text });
  document.getElementById("chat-input").value = "";
});
