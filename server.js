app.get("/api/trend", async (req, res) => {
  try {
    const roomId = req.query.room;
    const topic = req.query.topic || "cosmetics";
    if (!roomId) return res.status(400).json({ error: "room parameter required" });

    // Phase 1 placeholders
    if (topic !== "cosmetics") {
      let placeholder;
      if (topic === "music") {
        placeholder = {
          brand: "✨ 323music placeholder ✨",
          product: "coming soon",
          persona: "a young female dancer with a streetwear style",
          description: "I can’t wait to vibe with 323music soon… 🎶🔥",
          image: "https://placehold.co/600x600?text=323music",
          hashtags: ["#NowTrending"],
          refresh: 3000
        };
      } else if (topic === "politics") {
        placeholder = {
          brand: "✨ 323politics placeholder ✨",
          product: "coming soon",
          persona: "a young female activist with a casual style",
          description: "323politics is loading hot takes… ✊📢🔥",
          image: "https://placehold.co/600x600?text=323politics",
          hashtags: ["#NowTrending"],
          refresh: 3000
        };
      } else if (topic === "aidrop") {
        placeholder = {
          brand: "✨ 323aidrop placeholder ✨",
          product: "coming soon",
          persona: "a young female digital native with a retro style",
          description: "the 323aidrop is glitching into reality… 🤖⚡👾",
          image: "https://placehold.co/600x600?text=323aidrop",
          hashtags: ["#NowTrending"],
          refresh: 3000
        };
      }
      return res.json(placeholder);
    }

    // Existing cosmetics logic
    const today = new Date().toISOString().slice(0, 10);
    if (!dailyPicks.length || dailyDate !== today) {
      await generateDailyPicks();
    }
    if (!roomTrends[roomId]) roomTrends[roomId] = { dailyIndex: 0 };

    let current;
    const dailyIndex = roomTrends[roomId].dailyIndex;
    if (dailyIndex < dailyPicks.length) {
      current = dailyPicks[dailyIndex];
      roomTrends[roomId].dailyIndex++;
      ensureNextDrop(roomId);
    } else {
      if (roomTrends[roomId].next) {
        current = roomTrends[roomId].next;
        roomTrends[roomId].next = null;
      } else {
        current = await generateDrop();
      }
    }
    roomTrends[roomId].current = current;
    res.json(current);
  } catch (e) {
    console.error("❌ Trend API error:", e.message);
    res.json({ error: "Trend API failed" });
  }
});
