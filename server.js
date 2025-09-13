// server.js — add brand+product query support
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const OpenAI = require("openai");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "*" }));

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

/* ---------------- Emoji Helper ---------------- */
const EMOJI_POOL = ["✨", "💖", "🔥", "👀", "😍", "💅", "🌈", "🌸", "😎", "🤩", "🫶", "🥹", "🧃", "🌟", "💋"];
function randomEmojis(count = 2) {
  let out = [];
  for (let i = 0; i < count; i++) {
    out.push(EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)]);
  }
  return out.join(" ");
}
function decorateTextWithEmojis(text) {
  return `${randomEmojis(2)} ${text} ${randomEmojis(2)}`;
}

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

    let desc = completion.choices[0].message.content.trim();
    desc = desc.replace(new RegExp(`${product}`, "gi"), `${product} ${randomEmojis(2)}`);
    desc = desc.replace(new RegExp(`${brand}`, "gi"), `${brand} ${randomEmojis(2)}`);
    desc = `${desc} ${randomEmojis(3)}`;
    return desc;
  } catch (e) {
    console.error("❌ Description error:", e.response?.data || e.message);
    return decorateTextWithEmojis(`Using ${product} by ${brand} feels unforgettable and addictive.`);
  }
}

async function generateImageUrl(brand, product) {
  try {
    const out = await openai.images.generate({
      model: "gpt-image-1",
      prompt: `
        Create a photocard-style image.
        Subject: young female Korean idol, Gen-Z aesthetic.
        She is holding and applying ${product} by ${brand}.
        Pastel gradient background (milk pink, baby blue, lilac).
        Glitter bokeh, glossy K-beauty skin glow.
        Sticker shapes only (hearts, stars, sparkles, emoji, text emoticon).
        Square 1:1 format. No text/logos.
      `,
      size: "1024x1024"
    });

    const d = out?.data?.[0];
    if (d?.b64_json) return `data:image/png;base64,${d.b64_json}`;
    if (d?.url) return d.url;
  } catch (e) {
    console.error("❌ Image error:", e.response?.data || e.message);
  }
  return "https://placehold.co/600x600?text=No+Image";
}

async function generateNextPick() {
  const pick = TOP50_COSMETICS[Math.floor(Math.random() * TOP50_COSMETICS.length)];
  const description = await makeDescription(pick.brand, pick.product);
  const imageUrl = await generateImageUrl(pick.brand, pick.product);
  return {
    brand: decorateTextWithEmojis(pick.brand),
    product: decorateTextWithEmojis(pick.product),
    description,
    hashtags: ["#BeautyTok", "#NowTrending"],
    image: imageUrl,
    refresh: 3000
  };
}

/* ---------------- API Routes ---------------- */
app.get("/api/trend", async (req, res) => {
  try {
    const { brand, product } = req.query;

    // ✅ If brand+product provided → generate for those
    if (brand && product) {
      console.log(`🎯 Locked to brand=${brand}, product=${product}`);
      const description = await makeDescription(brand, product);
      const imageUrl = await generateImageUrl(brand, product);
      return res.json({
        brand: decorateTextWithEmojis(brand),
        product: decorateTextWithEmojis(product),
        description,
        hashtags: ["#BeautyTok", "#NowTrending"],
        image: imageUrl,
        refresh: 3000
      });
    }

    // otherwise random
    if (!nextPickCache) {
      console.log("⏳ Generating first drop...");
      nextPickCache = await generateNextPick();
    }

    const result = nextPickCache;
    nextPickCache = null;
    generateNextPick().then(p => nextPickCache = p);
    res.json(result);
  } catch (e) {
    console.error("❌ Trend API error:", e.response?.data || e.message);
    res.json({
      brand: decorateTextWithEmojis("Error"),
      product: decorateTextWithEmojis("System"),
      description: decorateTextWithEmojis("Something went wrong. Retrying soon…"),
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

/* ---------------- Socket.IO ---------------- */
io.on("connection", (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);
  socket.on("chatMessage", ({ roomId, user, text }) => {
    console.log(`💬 [${roomId}] ${user}: ${text}`);
    io.to(roomId).emit("chatMessage", { user, text });
  });
});

/* ---------------- Serve static ---------------- */
app.use(express.static(path.join(__dirname)));

/* ---------------- Start ---------------- */
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, async () => {
  console.log(`🚀 323drop backend live on :${PORT}`);
  nextPickCache = await generateNextPick();
});
