// server.js — unified 323drop backend (frontend + APIs + chat + OpenAI, pre-gen + history)
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const OpenAI = require("openai");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*", methods: ["GET", "POST"] } });

/* ---------------- OpenAI ---------------- */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------------- Demo product pool ---------------- */
const TOP50_COSMETICS = [
  { brand: "Rhode", product: "Peptide Lip Tint" },
  { brand: "Fenty Beauty", product: "Gloss Bomb Lip Gloss" },
  { brand: "Dior", product: "Lip Glow Oil" },
  { brand: "Rare Beauty", product: "Liquid Blush" },
  { brand: "Glow Recipe", product: "Watermelon Dew Drops" },
];

/* ---------------- Helpers ---------------- */
async function makeDescription(brand, product) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      messages: [
        { role: "system", content: "You are a beauty lover speaking in first person." },
        { role: "user", content: `Write a 70+ word first-person description of using "${product}" by ${brand}. Make it sensory, authentic, and Gen-Z relatable.` }
      ]
    });
    return completion.choices[0].message.content.trim();
  } catch (e) {
    console.error("❌ Description error:", e.message);
    return `Using ${product} by ${brand} feels unforgettable.`;
  }
}

async function generateImageUrl(brand, product) {
  try {
    const out = await openai.images.generate({
      model: "gpt-image-1",
      prompt: `Young female idol applying ${product} by ${brand}, pastel background, photocard style, glitter bokeh.`,
      size: "512x512" // smaller for faster
    });
    const d = out?.data?.[0];
    if (d?.b64_json) return `data:image/png;base64,${d.b64_json}`;
    if (d?.url) return d.url;
  } catch (e) {
    console.error("❌ Image error:", e.message);
  }
  return "https://placehold.co/512x512?text=No+Image";
}

async function generateVoice(text) {
  try {
    const out = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: text,
    });
    return Buffer.from(await out.arrayBuffer());
  } catch (e) {
    console.error("❌ Voice error:", e.message);
    return null;
  }
}

async function generateDrop(brand, product) {
  const descriptionPromise = makeDescription(brand, product);
  const imagePromise = generateImageUrl(brand, product);
  const description = await descriptionPromise;
  const [imageUrl, audioBuffer] = await Promise.all([
    imagePromise,
    generateVoice(description)
  ]);

  let voiceBase64 = null;
  if (audioBuffer) {
    voiceBase64 = `data:audio/mpeg;base64,${audioBuffer.toString("base64")}`;
  }

  return {
    brand,
    product,
    description,
    hashtags: ["#TikTokMadeMeBuyIt", "#BeautyTok", "#NowTrending"],
    image: imageUrl,
    voice: voiceBase64,
    refresh: 30000
  };
}

/* ---------------- Room cache with history ---------------- */
const roomCache = {}; 
// Example: { roomId: { history: [...], current, next } }

async function generateAndStoreDrop(roomId) {
  const pick = TOP50_COSMETICS[Math.floor(Math.random() * TOP50_COSMETICS.length)];
  const drop = await generateDrop(pick.brand, pick.product);

  if (!roomCache[roomId]) {
    roomCache[roomId] = { history: [], current: null, next: null };
  }

  roomCache[roomId].current = drop;
  roomCache[roomId].history.push(drop);

  if (roomCache[roomId].history.length > 20) {
    roomCache[roomId].history.shift(); // keep last 20
  }

  return drop;
}

/* ---------------- Serve frontend ---------------- */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/* ---------------- APIs ---------------- */
app.get("/api/trend", async (req, res) => {
  try {
    const roomId = req.query.room || "global";
    if (!roomCache[roomId]) {
      roomCache[roomId] = { history: [], current: null, next: null };
    }

    if (!roomCache[roomId].current) {
      await generateAndStoreDrop(roomId);
    }

    if (!roomCache[roomId].next) {
      const pick = TOP50_COSMETICS[Math.floor(Math.random() * TOP50_COSMETICS.length)];
      generateDrop(pick.brand, pick.product).then(drop => {
        roomCache[roomId].next = drop;
      });
    }

    const result = roomCache[roomId].current;

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

// ✅ New history endpoint
app.get("/api/history", (req, res) => {
  const roomId = req.query.room || "global";
  if (!roomCache[roomId]) return res.json([]);
  res.json(roomCache[roomId].history || []);
});

app.get("/api/voice", async (req, res) => {
  try {
    const text = req.query.text || "";
    if (!text) return res.status(400).json({ error: "Missing text" });
    const audioBuffer = await generateVoice(text);
    if (!audioBuffer) return res.status(500).json({ error: "No audio generated" });
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(audioBuffer);
  } catch (e) {
    res.status(500).json({ error: "Voice TTS failed" });
  }
});

/* ---------------- Chat (Socket.IO) ---------------- */
io.on("connection", (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);
  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    socket.roomId = roomId;
    console.log(`👥 ${socket.id} joined room: ${roomId}`);
  });
  socket.on("chatMessage", ({ roomId, user, text }) => {
    console.log(`💬 [${roomId}] ${user}: ${text}`);
    io.to(roomId).emit("chatMessage", { user, text });
  });
  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.id} (room ${socket.roomId || "none"})`);
  });
});

/* ---------------- Start ---------------- */
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 323drop backend live on :${PORT}`);
});
