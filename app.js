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
      roomId = "room-" + Math.floor(1000 + Math.random() * 9000);
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
      // Trigger pre-generation when voice starts
      fetch(`https://three23p-backend.onrender.com/api/start-voice?room=${roomId}`)
        .catch(() => {});
    };
    audioPlayer.onended = () => {
      if (onEnd) onEnd();
    };
    audioPlayer.onerror = () => {
      if (onEnd) onEnd();
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
    let apiUrl =
      "https://three23p-backend.onrender.com/api/trend?room=" + roomId;
    if (isGuestMode) {
      apiUrl += "&guest=true";
    }

    const res = await fetch(apiUrl);
    const newTrend = await res.json();

    if (!newTrend || !newTrend.description) {
      // waiting for drop
      showWarmupOverlay(); // overlay visible (no voice after first drop)
      setTimeout(() => loadTrend(isGuestMode), 2000);
      return;
    }

    hideWarmupOverlay();
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
      // Guest loops description until host moves on
      guestLoop = true;
      function loopGuest() {
        if (!guestLoop) return;
        playVoice(currentTrend.description, loopGuest);
      }
      loopGuest();
    } else {
      // Host: read description once
      const descriptionKey = currentTrend.description;
      if (descriptionKey !== lastDescriptionKey) {
        lastDescriptionKey = descriptionKey;
        playVoice(currentTrend.description, () => {
          // After voice ends: overlay appears while waiting
          showWarmupOverlay();
          loadTrend(isGuestMode);
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
    if (!isHost) return; // only host

    // open chat dock
    document.getElementById("bottom-panel").style.display = "flex";

    // show large overlay message
    const overlay = document.getElementById("social-center");
    if (overlay) {
      overlay.style.display = "flex";
      overlay.innerText =
        `${randomGenZEmojis(3)} share the url to your shopping companion and chat. ${randomGenZEmojis(3)}`;
    }

    // disable button
    const btn = document.getElementById("social-btn");
    btn.disabled = true;
  });
});
