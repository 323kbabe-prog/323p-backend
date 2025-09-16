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

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------------- State ---------------- */
const roomTrends = {}; // { roomId: { current: {}, next: {}, dailyIndex: number } }
let generatingNext = {};

// NEW: cache for daily picks
let dailyPicks = [];
let dailyDate = null;

/* ---------------- Emoji Helper ---------------- */
const EMOJI_POOL = ["✨","💖","🔥","👀","😍","💅","🌈","🌸","😎","🤩","🫶","🥹","🧃","🌟","💋"];
function randomEmojis(count = 2) {
  return Array.from({ length: count }, () => EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)]).join(" ");
}
function decorateTextWithEmojis(text) {
  return `${randomEmojis(2)} ${text} ${randomEmojis(2)}`;
}

/* ---------------- Persona Generator ---------------- */
function randomPersona() {
  const vibes = ["idol", "dancer", "vlogger", "streetwear model", "influencer"];
  const styles = ["casual", "glam", "streetwear", "retro", "Y2K-inspired", "minimalist"];
  return `a young female ${vibes[Math.floor(Math.random() * vibes.length)]} with a ${styles[Math.floor(Math.random() * styles.length)]} style`;
}

/* ---------------- Background Pool ---------------- */
const genzBackgrounds = [
  "pastel gradient background (milk pink, baby blue, lilac)",
  "vaporwave gradient background (neon pink, cyan, purple)",
  "sunset gradient background (peach, coral, lavender)",
  "aqua gradient background (mint, aqua, periwinkle)",
  "cyberpunk gradient background (hot pink, electric purple, deep blue)",
  "dreamy gradient background (lavender, sky blue, soft pink)"
];

/* ---------------- Helpers ---------------- */
async function makeDescription(brand, product) {
  try {
    const prompt = `Write a 70+ word first-person description of using "${product}" by ${brand}. Make it sensory, authentic, and Gen-Z relatable. Add emojis inline.`;
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      messages: [
        { role: "system", content: "You are a beauty lover speaking in first person." },
        { role: "user", content: prompt }
      ]
    });
    let desc = completion.choices[0].message.content.trim();
    return `${desc} ${randomEmojis(3)}`;
  } catch (e) {
    console.error("❌ Description error:", e.message);
    return decorateTextWithEmojis(`Using ${product} by ${brand} feels unforgettable and addictive.`);
  }
}

async function generateImageUrl(brand, product, persona) {
  try {
    const bg = genzBackgrounds[Math.floor(Math.random() * genzBackgrounds.length)];
    const out = await openai.images.generate({
      model: "gpt-image-1",
      prompt: `
        Create a photocard-style image.
        Subject: ${persona}, Gen-Z aesthetic.
        They are holding and applying ${product} by ${brand}.
        ${bg}.
        Sticker shapes only (lots of emoji + text emoticons like 💖✨🌸🔥🦋💅🤩🥹✌️ :), <3, ☆, ^_^, (✿◠‿◠), (｡♥‿♥｡)).
        Square 1:1 format. No text/logos.
      `,
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

async function generateDrop() {
  // Temporary fixed brand/product until real trending fetch integrated
  const pick = { brand: "Demo Brand", product: "Demo Product" };
  const persona = randomPersona();
  const description = await makeDescription(pick.brand, pick.product);
  const imageUrl = await generateImageUrl(pick.brand, pick.product, persona);
  return {
    brand: decorateTextWithEmojis(pick.brand),
    product: decorateTextWithEmojis(pick.product),
    persona,
    description,
    hashtags: ["#BeautyTok", "#NowTrending"],
    image: imageUrl,
    refresh: 3000
  };
}

// NEW: generate 3 daily picks
async function generateDailyPicks() {
  dailyPicks = [];
  for (let i = 0; i < 3; i++) {
    const drop = await generateDrop();
    dailyPicks.push(drop);
  }
  dailyDate = new Date().toISOString().slice(0, 10);
  console.log(`🌅 Daily Picks Generated (${dailyDate}):`);
  dailyPicks.forEach((p, idx) => {
    console.log(`${idx + 1}. ${p.brand} – ${p.product}`);
  });
}

async function ensureNextDrop(roomId) {
  if (generatingNext[roomId]) return;
  generatingNext[roomId] = true;
  try {
    const nextDrop = await generateDrop();
    if (!roomTrends[roomId]) roomTrends[roomId] = {};
    roomTrends[roomId].next = nextDrop;
    console.log(`✅ Pre-generated next drop for room ${roomId}`);
  } catch (e) {
    console.error("❌ ensureNextDrop failed:", e.message);
  } finally {
    generatingNext[roomId] = false;
  }
}

/* ---------------- API Routes ---------------- */
app.get("/api/trend", async (req, res) => {
  try {
    const roomId = req.query.room;
    if (!roomId) {
      return res.status(400).json({ error: "room parameter required" });
    }

    const today = new Date().toISOString().slice(0, 10);
    if (!dailyPicks.length || dailyDate !== today) {
      console.log("🌅 Generating new daily picks...");
      await generateDailyPicks();
    }

    if (!roomTrends[roomId]) {
      roomTrends[roomId] = { dailyIndex: 0 };
    }

    let current;
    if (roomTrends[roomId].dailyIndex < dailyPicks.length) {
      // Serve one of the 3 daily picks
      current = dailyPicks[roomTrends[roomId].dailyIndex];
      roomTrends[roomId].dailyIndex++;
    } else {
      // After the 3rd pick, serve pre-gen cycle
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

app.get("/api/voice", async (req, res) => {
  try {
    const text = req.query.text || "";
    if (!text.trim()) {
      res.setHeader("Content-Type", "audio/mpeg");
      return res.send(Buffer.alloc(1000));
    }
    const out = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: text,
    });
    const audioBuffer = Buffer.from(await out.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(audioBuffer);
  } catch (e) {
    console.error("❌ Voice API error:", e.message);
    res.status(500).json({ error: "Voice TTS failed" });
  }
});

app.get("/api/start-voice", async (req, res) => {
  const roomId = req.query.room;
  if (!roomId) {
    return res.status(400).json({ error: "room parameter required" });
  }
  console.log(`⚡ Pre-gen triggered by voice for room ${roomId}`);
  ensureNextDrop(roomId);
  res.json({ ok: true, message: "Pre-generation triggered by voice" });
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
    console.log(`❌ User disconnected: ${socket.id}`);
  });
});

/* ---------------- Serve static ---------------- */
app.use(express.static(path.join(__dirname)));

/* ---------------- Start ---------------- */
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, async () => {
  console.log(`🚀 323drop backend live on :${PORT}`);
});
