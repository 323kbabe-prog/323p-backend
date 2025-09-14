const socket = io("https://three23p-backend.onrender.com");
let audioPlayer = null;
let currentTrend = null;
let roomId = null;
let socialMode = false;
let isHost = false;
let isGuest = false;
let warmingUp = true;

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
  async function playAndWaitVoice(text, callback) {
    return new Promise((resolve) => {
      if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer = null;
      }
      const url =
        "https://three23p-backend.onrender.com/api/voice?text=" +
        encodeURIComponent(text);
      document.getElementById("voice-status").textContent = "🔄 Loading voice...";
      audioPlayer = new Audio(url);
      audioPlayer.onplay = () => {
        document.getElementById("voice-status").textContent = "🔊 Reading...";
      };
      audioPlayer.onended = () => {
        document.getElementById("voice-status").textContent = "⏸ Done";
        if (callback) callback();
        resolve();
      };
      audioPlayer.onerror = () => {
        document.getElementById("voice-status").textContent = "⚠️ Voice error";
        if (callback) callback();
        resolve();
      };
      audioPlayer.play();
    });
  }

  /* ---------------- Warm-up Loop ---------------- */
  async function warmUpLoop() {
    while (warmingUp) {
      await playAndWaitVoice("✨🔥💖 AI is warming up… ✨🔥💖");
      // loop again until a trend is ready
    }
  }

  /* ---------------- Load Trend + Voice ---------------- */
  async function loadTrend(isGuest) {
    let apiUrl =
      "https://three23p-backend.onrender.com/api/trend?room=" + roomId;
    if (isGuest) {
      apiUrl += "&guest=true";
    }

    const res = await fetch(apiUrl);
    currentTrend = await res.json();

    // If host generating first drop -> stop warm-up loop
    warmingUp = false;

    document.getElementById("r-title").innerText = currentTrend.brand;
    document.getElementById("r-artist").innerText = currentTrend.product;
    document.getElementById("r-persona").innerText = currentTrend.persona
      ? `👤 Featuring ${currentTrend.persona}`
      : "";
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

    // Voice reads description once
    await playAndWaitVoice(currentTrend.description, () => {
      // After voice finishes → immediately fetch next drop
      loadTrend(isGuest);
    });
  }

  /* ---------------- Start / Guest buttons ---------------- */
  document.getElementById("start-btn").addEventListener("click", () => {
    document.getElementById("start-screen").style.display = "none";
    document.getElementById("app").style.display = "flex";
    socket.emit("joinRoom", roomId);

    // Start warm-up loop
    warmingUp = true;
    warmUpLoop();

    // Trigger first trend fetch (host generates if needed)
    loadTrend(false);
  });

  document.getElementById("guest-btn").addEventListener("click", () => {
    document.getElementById("start-screen").style.display = "none";
    document.getElementById("app").style.display = "flex";
    socket.emit("joinRoom", roomId);

    // Guests don’t need warm-up loop
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
    socialMode = true;
    document.getElementById("bottom-panel").style.display = "flex";
    const newUrl =
      window.location.origin + window.location.pathname + "?room=" + roomId;
    window.history.replaceState({}, "", newUrl);
    const btn = document.getElementById("social-btn");
    btn.disabled = true;
    btn.textContent =
      "share the url to your shopping companion and chat";
    document.getElementById("room-label").innerText =
      "room: " + roomId + " (social mode active)";
  });
});
