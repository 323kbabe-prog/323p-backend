const socket = io("https://three23p-backend.onrender.com");
let audioPlayer = null;
let currentTrend = null;
let roomId = null;
let socialMode = false;
let isHost = false;
let isGuest = false;
let firstDrop = true;
let guestLoop = false;
let lastDescriptionKey = null;
let stopCycle = false; // 👈 stop auto-refresh when 🍜 clicked

/* ---------------- Emoji Helper ---------------- */
const GENZ_EMOJIS = ["✨","🔥","💖","👀","😍","💅","🌈","🌸","😎","🤩","🫶","🥹","🧃","🌟","💋"];
function randomGenZEmojis(count = 3) {
  let chosen = [];
  for (let i = 0; i < count; i++) {
    chosen.push(GENZ_EMOJIS[Math.floor(Math.random() * GENZ_EMOJIS.length)]);
  }
  return chosen.join(" ");
}

window.addEventListener("DOMContentLoaded", () => {
  /* ---------------- Setup Room ---------------- */
  (function initRoom() {
    let params = new URLSearchParams(window.location.search);
    roomId = params.get("room");

    if (roomId) {
      isGuest = true;
    } else {
      isHost = true;
      roomId = "room-" + Math.floor(Math.random() * 9000);
      const newUrl =
        window.location.origin + window.location.pathname + "?room=" + roomId;
      window.history.replaceState({}, "", newUrl);
    }

    document.getElementById("room-label").innerText = "room: " + roomId;

    if (isHost) {
      document.getElementById("start-btn").style.display = "block";
      document.getElementById("guest-btn").style.display = "none";
    } else if (isGuest) {
      document.getElementById("start-btn").style.display = "none";
      document.getElementById("guest-btn").style.display = "block";
    }
  })();

  /* ---------------- Voice ---------------- */
  function playVoice(text, onEnd) {
    if (audioPlayer) {
      audioPlayer.pause();
      audioPlayer = null;
    }
    const url =
      "https://three23p-backend.onrender.com/api/voice?text=" +
      encodeURIComponent(text);

    audioPlayer = new Audio(url);
    audioPlayer.onplay = () => {
      if (!stopCycle) {
        fetch(`https://three23p-backend.onrender.com/api/start-voice?room=${roomId}`)
          .catch(() => {});
        hideWarmupOverlay();
      }
    };
    audioPlayer.onended = () => {
      if (onEnd && !stopCycle) onEnd();
    };
    audioPlayer.onerror = () => {
      if (onEnd && !stopCycle) onEnd();
    };
    audioPlayer.play();
  }

  /* ---------------- Warm-up Overlay ---------------- */
  function showWarmupOverlay() {
    const center = document.getElementById("warmup-center");
    if (center) {
      center.style.display = "flex";
      center.innerText = `${randomGenZEmojis(3)} AI is warming up… ${randomGenZEmojis(3)}`;
    }
  }

  function hideWarmupOverlay() {
    const center = document.getElementById("warmup-center");
    if (center) {
      center.style.display = "none";
    }
  }

  /* ---------------- Load Trend + Voice ---------------- */
  async function loadTrend(isGuestMode) {
    if (stopCycle) return; // 👈 stop auto-refresh when 🍜 clicked

    let apiUrl =
      "https://three23p-backend.onrender.com/api/trend?room=" + roomId;
    if (isGuestMode) {
      apiUrl += "&guest=true";
    }

    const res = await fetch(apiUrl);
    const newTrend = await res.json();

    if (!newTrend || !newTrend.description) {
      showWarmupOverlay();
      setTimeout(() => loadTrend(isGuestMode), 2000);
      return;
    }

    currentTrend = newTrend;

    // Update UI
    document.getElementById("r-title").innerText = currentTrend.brand;
    document.getElementById("r-artist").innerText = currentTrend.product;
    document.getElementById("r-persona").innerText = currentTrend.persona
      ? `👤 Featuring ${currentTrend.persona}`
      : "";
    document.getElementById("r-desc").innerText = currentTrend.description;
    document.getElementById("social-btn").style.display = isHost ? "block" : "none";

    if (currentTrend.image) {
      document.getElementById("r-img").src = currentTrend.image;
      document.getElementById("r-img").style.display = "block";
      document.getElementById("r-fallback").style.display = "none";
    } else {
      document.getElementById("r-img").style.display = "none";
      document.getElementById("r-fallback").style.display = "block";
    }

    if (isGuestMode) {
      guestLoop = true;
      function loopGuest() {
        if (!guestLoop || stopCycle) return;
        playVoice(currentTrend.description, loopGuest);
      }
      loopGuest();
    } else {
      const descriptionKey = currentTrend.description;
      if (descriptionKey !== lastDescriptionKey) {
        lastDescriptionKey = descriptionKey;
        playVoice(currentTrend.description, () => {
          if (!stopCycle) {
            showWarmupOverlay();
            setTimeout(() => loadTrend(isGuestMode), 2000);
          }
        });
      } else {
        setTimeout(() => loadTrend(isGuestMode), 2000);
      }
    }
  }

  /* ---------------- Start / Guest buttons ---------------- */
  document.getElementById("start-btn").addEventListener("click", () => {
    document.getElementById("start-screen").style.display = "none";
    document.getElementById("app").style.display = "flex";
    socket.emit("joinRoom", roomId);

    showWarmupOverlay();
    loadTrend(false);
  });

  document.getElementById("guest-btn").addEventListener("click", () => {
    document.getElementById("start-screen").style.display = "none";
    document.getElementById("app").style.display = "flex";
    socket.emit("joinRoom", roomId);

    guestLoop = true;
    loadTrend(true);
  });

  /* ---------------- Chat ---------------- */
  document.getElementById("chat-send").addEventListener("click", () => {
    const text = document.getElementById("chat-input").value;
    if (!text.trim()) return;
    socket.emit("chatMessage", { roomId: roomId, user: "anon", text });
    document.getElementById("chat-input").value = "";
  });

  socket.on("chatMessage", (msg) => {
    const messagesBox = document.getElementById("messages");
    const p = document.createElement("p");
    p.textContent = `${msg.user}: ${msg.text}`;
    messagesBox.appendChild(p);
    messagesBox.scrollTop = messagesBox.scrollHeight;
  });

  /* ---------------- 🍜 Social Button ---------------- */
  document.getElementById("social-btn").addEventListener("click", () => {
    if (!isHost) return;

    stopCycle = true; // stop auto-refresh

    // open chat dock
    document.getElementById("bottom-panel").style.display = "flex";

    // replace button with share message (styled bold & big)
    const btn = document.getElementById("social-btn");
    const shareMsg = document.createElement("p");
    shareMsg.textContent = `${randomGenZEmojis(3)} share the url to your shopping companion and chat. ${randomGenZEmojis(3)}`;
    shareMsg.style.fontWeight = "bold";
    shareMsg.style.fontSize = "20px";
    shareMsg.style.textAlign = "center";
    shareMsg.style.margin = "12px 0";
    btn.replaceWith(shareMsg);
  });
});
