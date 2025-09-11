// server.js — unified 323drop backend (serves frontend + APIs + chat)
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

/* ---------------- State ---------------- */
let nextPickCache = null;
let generatingNext = false;

/* ---------------- TikTok Top 50 Cosmetics (shortlist) ---------------- */
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
    const prompt = `
      Write a 70+ word first-person description of using "${product}" by ${brand}.
      Make it sensory (feel, look, vibe), authentic, and Gen-Z relatable.
    `;
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      messages: [
        { role: "system", content: "You are a beauty lover speaking in first person." },
        { role: "user", content: prompt }
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
      size: "1024x1024"
    });
    const d = out?.data?.[0];
    if (d?.b64_json) return `data:image/png;base64,${d.b64_json}`;
    if (d?.url) return d.url;
  } catch (e) {
    console.error("❌ Image error:", e.message);
  }
  return "https://placehold.co/600x600?text=No+Image";
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

async function generateNextPick() {
  if (generatingNext) return;
  generatingNext = true;
  try {
    const pick = TOP50_COSMETICS[Math.floor(Math.random() * TOP50_COSMETICS.length)];
    const description = await makeDescription(pick.brand, pick.product);
    const imageUrl = await generateImageUrl(pick.brand, pick.product);
    const audioBuffer = await generateVoice(description);

    let voiceBase64 = null;
    if (audioBuffer) {
      console.log("✅ OpenAI TTS voice generated");
      voiceBase64 = `data:audio/mpeg;base64,${audioBuffer.toString("base64")}`;
    }

    nextPickCache = {
      brand: pick.brand,
      product: pick.product,
      description,
      hashtags: ["#TikTokMadeMeBuyIt", "#BeautyTok", "#NowTrending"],
      image: imageUrl,
      voice: voiceBase64,
      refresh: 3000
    };
  } finally {
    generatingNext = false;
  }
}

/* ---------------- Serve Frontend ---------------- */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/* ---------------- APIs ---------------- */
app.get("/api/trend", async (req, res) => {
  try {
    if (!nextPickCache) await generateNextPick();
    const result = nextPickCache;
    nextPickCache = null;
    generateNextPick();
    res.json(result);
  } catch (e) {
    res.json({ error: "Trend failed" });
  }
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

app.get("/health", (_req,res) => res.json({ ok: true, time: Date.now() }));

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
httpServer.listen(PORT, async () => {
  console.log(`🚀 323drop backend live on :${PORT}`);
  await generateNextPick();
});
