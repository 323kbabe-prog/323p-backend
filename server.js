// server.js — 323drop backend (API + chat + static app.js)
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const OpenAI = require("openai");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

/* ---------------- OpenAI ---------------- */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------------- State ---------------- */
let nextPickCache = null;
let generatingNext = false;

/* ---------------- Products ---------------- */
const TOP50_COSMETICS = [
  { brand: "Rhode", product: "Peptide Lip Tint" },
  { brand: "Fenty Beauty", product: "Gloss Bomb Lip Gloss" },
  { brand: "Rare Beauty", product: "Liquid Blush" },
  { brand: "Glow Recipe", product: "Watermelon Dew Drops" },
  { brand: "Dior", product: "Lip Glow Oil" }
];

/* ---------------- Helpers ---------------- */
async function makeDescription(brand, product) {
  try {
    const prompt = `
      Write a 70+ word first-person description of using "${product}" by ${brand}.
      Make it sensory (feel, look, vibe), authentic, and Gen-Z relatable.
      Current time: ${new Date().toISOString()}.
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
    console.error("❌ Description error:", e.response?.data || e.message);
    return `Using ${product} by ${brand} feels unforgettable and addictive.`;
  }
}

async function generateImageUrl(brand, product) {
  try {
    const out = await openai.images.generate({
      model: "gpt-image-1",
      prompt: `Photocard of young Korean idol applying ${product} by ${brand}, pastel gradient background, glitter bokeh, glossy skin glow, K-beauty style.`,
      size: "1024x1024",
      response_format: "b64_json" // ✅ force base64 output
    });

    const d = out?.data?.[0];
    if (d?.b64_json) {
      return `data:image/png;base64,${d.b64_json}`; // ✅ usable in <img src="">
    }
    if (d?.url) return d.url;
    console.warn("⚠️ Image response had no URL or base64:", out);
  } catch (e) {
    console.error("❌ Image error:", e.response?.data || e.message);
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
    console.error("❌ Voice error:", e.response?.data || e.message);
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

    nextPickCache = {
      brand: pick.brand,
      product: pick.product,
      description,
      hashtags: ["#BeautyTok", "#NowTrending"],
      image: imageUrl,
      refresh: 3000
    };
    console.log("✅ Next pick ready:", nextPickCache.brand, "-", nextPickCache.product);
  } finally {
    generatingNext = false;
  }
}

/* ---------------- API Routes ---------------- */
app.get("/api/trend", async (req, res) => {
  try {
    if (!nextPickCache) {
      console.log("⏳ Generating first drop...");
      await generateNextPick();
    }
    const result = nextPickCache || {
      brand: "Loading",
      product: "Beauty Product",
      description: "AI is warming up… please wait.",
      hashtags: ["#Loading"],
      image: "https://placehold.co/600x600?text=Loading",
      refresh: 5000
    };
    nextPickCache = null;
    generateNextPick(); // prepare next one in background
    res.json(result);
  } catch (e) {
    console.error("❌ Trend API error:", e.response?.data || e.message);
    res.json({
      brand: "Error",
      product: "System",
      description: "Something went wrong. Retrying soon…",
      hashtags: ["#Error"],
      image: "https://placehold.co/600x600?text=Error",
      refresh: 5000
    });
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
    console.error("❌ Voice API error:", e.response?.data || e.message);
    res.status(500).json({ error: "Voice TTS failed" });
  }
});

app.get("/health", (_req,res) => res.json({ ok: true, time: Date.now() }));

// 🔎 Debug route to verify API key
app.get("/test-openai", async (req, res) => {
  try {
    const result = await openai.models.list();
    res.json({ ok: true, modelCount: result.data.length });
  } catch (e) {
    console.error("❌ Test OpenAI failed:", e.response?.data || e.message);
    res.status(500).json({ ok: false, error: e.response?.data || e.message });
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

/* ---------------- Serve static (app.js etc.) ---------------- */
app.use(express.static(path.join(__dirname)));

/* ---------------- Start ---------------- */
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, async () => {
  console.log(`🚀 323drop backend live on :${PORT}`);
  await generateNextPick();
});
