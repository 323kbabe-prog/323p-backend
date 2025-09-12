// Room cache now includes history
const roomCache = {}; 
// Example: { roomId: { history: [drops...], current, next } }

// Generate + store a new drop
async function generateAndStoreDrop(roomId) {
  const pick = TOP50_COSMETICS[Math.floor(Math.random() * TOP50_COSMETICS.length)];
  const drop = await generateDrop(pick.brand, pick.product);

  if (!roomCache[roomId]) {
    roomCache[roomId] = { history: [], current: null, next: null };
  }

  roomCache[roomId].current = drop;
  roomCache[roomId].history.push(drop);

  // Keep only last 20 drops per room (prevent memory bloat)
  if (roomCache[roomId].history.length > 20) {
    roomCache[roomId].history.shift();
  }

  return drop;
}

// Trend API with pre-generation
app.get("/api/trend", async (req, res) => {
  try {
    const roomId = req.query.room || "global";
    if (!roomCache[roomId]) {
      roomCache[roomId] = { history: [], current: null, next: null };
    }

    // If no current drop yet, generate one immediately
    if (!roomCache[roomId].current) {
      await generateAndStoreDrop(roomId);
    }

    // If next not ready, trigger background generation
    if (!roomCache[roomId].next) {
      const pick = TOP50_COSMETICS[Math.floor(Math.random() * TOP50_COSMETICS.length)];
      generateDrop(pick.brand, pick.product).then(drop => {
        roomCache[roomId].next = drop;
      });
    }

    // Serve current
    const result = roomCache[roomId].current;

    // Swap in next if ready
    if (roomCache[roomId].next) {
      roomCache[roomId].current = roomCache[roomId].next;
      roomCache[roomId].history.push(roomCache[roomId].next);
      if (roomCache[roomId].history.length > 20) {
        roomCache[roomId].history.shift();
      }
      roomCache[roomId].next = null;
    }

    return res.json(result);
  } catch (e) {
    console.error("❌ Trend API error:", e.message);
    res.json({ brand: "Error", product: "System", description: "Retry soon…", hashtags:["#Error"], image:null, voice:null, refresh:5000 });
  }
});

// ✅ New History API
app.get("/api/history", (req, res) => {
  const roomId = req.query.room || "global";
  if (!roomCache[roomId]) {
    return res.json([]);
  }
  res.json(roomCache[roomId].history || []);
});
