// app.js — op3 frontend
const socket = io("https://three23p-backend.onrender.com");
let audioPlayer = null, currentTrend = null, roomId = null, stopCycle = false;
let currentTopic = "cosmetics"; 
let autoRefresh = false;

// ✅ Add deviceId
let deviceId = localStorage.getItem("deviceId");
if (!deviceId) {
  deviceId = self.crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  localStorage.setItem("deviceId", deviceId);
}

// ✅ Ensure userId exists
async function ensureUser() {
  let userId = localStorage.getItem("userId");
  if (!userId) {
    const res = await fetch("https://three23p-backend.onrender.com/api/create-user", {
      method: "POST",
      headers: {
        "x-passcode": "super-secret-pass",
        "x-device-id": deviceId
      }
    });
    const data = await res.json();
    if (data.userId) {
      userId = data.userId;
      localStorage.setItem("userId", userId);
    } else {
      alert("❌ " + (data.error || "Could not create user"));
    }
  }
  return userId;
}

// Example usage inside your existing loadTrend/description call
async function runLogAndLoad(topic){
  const userId = await ensureUser();
  const res = await fetch(
    `https://three23p-backend.onrender.com/api/description?topic=${topic}&userId=${userId}`,
    {
      headers: {
        "x-passcode": "super-secret-pass",
        "x-device-id": deviceId
      }
    }
  );
  const trend = await res.json();
  console.log("Trend:", trend);
  return trend;
}
