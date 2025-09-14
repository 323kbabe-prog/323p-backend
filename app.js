const socket = io("https://three23p-backend.onrender.com");
let audioPlayer = null;
let currentTrend = null;
let lastTrendKey = null;
let roomId = null;
let socialMode = false;
let isHost = false;
let isGuest = false;
let warmingUp = true;
let guestLoop = false; // control guest repeating description

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
    audioPlayer.onended = () => {
      if (onEnd) onEnd();
    };
    audioPlayer.onerror = () => {
      if (onEnd) onEnd();
    };
    audioPlayer.play();
  }

  /* ---------------- Warm-up (show + voice) ---------------- */
  function showWarmup() {
    const center = document.getElementById("warmup-center");
    if (center) {
      center.style.display = "flex";
      center.innerText = "✨🔥💖 AI is warming up… ✨🔥💖";
    }
    warmingUp = true;
    warmUpLoop();
  }

  function hideWarmup() {
    const center = document.getElementById("warmup-center");
    if (center) {
      center.style.display = "none";
    }
    warmingUp = false;
  }

  async function warmUpLoop() {
    while (warmingUp) {
      await new Promise((resolve) => {
        playVoice("✨🔥💖 AI is warming up… ✨🔥💖", resolve);
      });
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

    // Build a unique key for this drop
    const trendKey = newTrend ? newTrend.brand + "|" + newTrend.product : null;

    // Host logic
    if (!isGuestMode) {
      // If drop is same as last one → show warm-up until a new one is ready
      if (trendKey && trendKey === lastTrendKey) {
        showWarmup();
        setTimeout(() => loadTrend(isGuestMode), 3000);
        return;
      }
      hideWarmup();
    }

    currentTrend = newTrend;
    lastTrendKey = trendKey;

    // Update screen
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
      // Guest loops description until next arrives
      guestLoop = true;
      function loopGuest() {
        if (!guestLoop) return;
        playVoice(currentTrend.description, loopGuest);
      }
      loopGuest();
    } else {
      // Host: read description once, then check for next drop
      playVoice(currentTrend.description, () => {
        loadTrend(isGuestMode);
      });
    }
  }

  /* ---------------- Start / Guest buttons ---------------- */
  document.getElementById("start-btn").addEventListener("click", () => {
    document.getElementById("start-screen").style.display = "none";
    document.getElementById("app").style.display = "flex";
    socket.emit("joinRoom", roomId);

    showWarmup();
    loadTrend(false);
  });

  document.getElementById("guest-btn").addEventListener("click", () => {
    document.getElementById("start-screen").style.display = "none";
    document.getElementById("app").style.display = "flex";
    socket.emit("joinRoom", roomId);

    guestLoop = true;
    loadTrend(true);
  });

  /* ---------------- Chat & 🍜 ---------------- */
  document.getElementById("chat-send").addEventListener("click", () => {
    const text = document.getElementById("chat-input").value;
    if (!text.trim()) return;
    socket.emit("chatMessage", { roomId: roomId, user: "anon", text });
    document.getElementById("chat-input").value = "";
  });

  document.getElementById("social-btn").addEventListener("click", () => {
    if (!isHost) return; // only host
    const btn = document.getElementById("social-btn");
    btn.disabled = true;
    btn.textContent =
      "✨🔥💖 share the url to your shopping companion and chat. ✨🔥💖";
  });
});
