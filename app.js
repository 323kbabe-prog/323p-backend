// app.js — refined voice loop + chat interrupts

let audioPlayer = null;
let voiceLoopActive = false;
let chatInterrupting = false;
let voiceUrl = ""; // backend-provided TTS URL
let loopTimeout = null;

/* ---------------- Play Voice ---------------- */
async function playVoice(url) {
  // stop any current audio
  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer = null;
  }

  return new Promise((resolve) => {
    audioPlayer = new Audio(url);
    audioPlayer.onended = () => resolve();
    audioPlayer.onerror = () => resolve();
    audioPlayer.play();
  });
}

/* ---------------- Start Voice Loop ---------------- */
async function startVoiceLoop(url) {
  voiceUrl = url;
  voiceLoopActive = true;

  while (voiceLoopActive) {
    if (chatInterrupting) {
      // wait until chat is finished
      await new Promise(r => setTimeout(r, 500));
      continue;
    }

    await playVoice(voiceUrl);

    // wait a little before looping
    await new Promise(r => setTimeout(r, 500));
  }
}

/* ---------------- Stop Voice Loop ---------------- */
function stopVoiceLoop() {
  voiceLoopActive = false;
  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer = null;
  }
  if (loopTimeout) {
    clearTimeout(loopTimeout);
    loopTimeout = null;
  }
}

/* ---------------- Handle Chat Interrupt ---------------- */
async function handleChatMessage(message) {
  chatInterrupting = true;
  stopVoiceLoop();

  // read chat message out loud (or show in UI)
  const chatVoiceUrl = `/api/voice?text=${encodeURIComponent(message)}`;
  await playVoice(chatVoiceUrl);

  // resume loop
  chatInterrupting = false;
  if (!voiceLoopActive) {
    startVoiceLoop(voiceUrl);
  }
}

/* ---------------- Example Usage ---------------- */
// Start looping after first drop is loaded
document.getElementById("startBtn").addEventListener("click", () => {
  const url = "/api/voice?text=" + encodeURIComponent("Your drop description here.");
  startVoiceLoop(url);
});

// Handle incoming chat
function onChat(message) {
  handleChatMessage(message);
}
