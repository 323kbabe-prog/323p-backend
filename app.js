function playVoice(text, onEnd) {
  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer = null;
  }
  const url = "https://three23p-backend.onrender.com/api/voice?text=" + encodeURIComponent(text);
  audioPlayer = new Audio(url);
  audioPlayer.onplay = () => {
    document.getElementById("voice-status").innerText = "🤖🔊 vibin’ rn…";
    fetch(`https://three23p-backend.onrender.com/api/start-voice?room=${roomId}`)
      .catch(() => {});
    hideWarmupOverlay();
  };
  audioPlayer.onended = () => {
    document.getElementById("voice-status").innerText = "⚙️💻 preppin’ the drop…";
    if (onEnd) onEnd();
  };
  audioPlayer.onerror = () => {
    document.getElementById("voice-status").innerText = "⚙️💻 preppin’ the drop…";
    if (onEnd) onEnd();
  };
  audioPlayer.play();
}

async function loadTrend() {
  if (stopCycle) return;
  let apiUrl = "https://three23p-backend.onrender.com/api/trend?room=" + roomId;
  const res = await fetch(apiUrl);
  const newTrend = await res.json();
  if (!newTrend || !newTrend.description) {
    showWarmupOverlay();
    setTimeout(() => loadTrend(), 2000);
    return;
  }

  currentTrend = newTrend;

  // Update UI
  document.getElementById("r-title").innerText = currentTrend.brand;
  document.getElementById("r-artist").innerText = currentTrend.product;
  document.getElementById("r-persona").innerText = currentTrend.persona ? `👤 Featuring ${currentTrend.persona}` : "";
  document.getElementById("r-desc").innerText = currentTrend.description;

  // ✅ Dynamic Gen-Z label
  if (!lastDescriptionKey) {
    document.getElementById("r-label").innerText = "⚡ today’s slay pick";
  } else {
    document.getElementById("r-label").innerText = "⚡ real-time drip";
  }

  if (currentTrend.image) {
    document.getElementById("r-img").src = currentTrend.image;
    document.getElementById("r-img").style.display = "block";
    document.getElementById("r-fallback").style.display = "none";
  } else {
    document.getElementById("r-img").style.display = "none";
    document.getElementById("r-fallback").style.display = "block";
  }

  const descriptionKey = currentTrend.description;
  if (descriptionKey !== lastDescriptionKey) {
    lastDescriptionKey = descriptionKey;
    playVoice(currentTrend.description, () => {
      if (!stopCycle) {
        showWarmupOverlay();
        setTimeout(() => loadTrend(), 2000);
      }
    });
  } else {
    setTimeout(() => loadTrend(), 2000);
  }
}
