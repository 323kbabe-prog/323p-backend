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
const roomTrends = {}; // { roomId: { current: {}, next: {} } }
let generatingNext = {};

// NEW: cache for daily drop
let dailyDrop = null;
let dailyDate = null;

/* ---------------- Product pool ---------------- */
const TOP50_COSMETICS = [
  { brand: "Rhode", product: "Peptide Lip Tint" },
  { brand: "Fenty Beauty", product: "Gloss Bomb Lip Gloss" },
  { brand: "Anastasia Beverly Hills", product: "Clear Brow Gel" },
  { brand: "YSL", product: "Make Me Blush Baby Doll" },
  { brand: "Laura Mercier", product: "Loose Setting Powder" },
  { brand: "Beautyblender", product: "Blending Sponge" },
  { brand: "Givenchy", product: "Prisme Libre Blush" },
  { brand: "Sephora Collection", product: "Pro Brushes" },
  { brand: "COSRX", product: "Advanced Snail 96 Mucin Essence" },
  { brand: "Lush", product: "Dream Cream" },
  { brand: "Nyx", product: "Jumbo Eye Pencil" },
  { brand: "Nars", product: "Radiant Creamy Concealer" },
  { brand: "Too Faced", product: "Better Than Sex Mascara" },
  { brand: "Charlotte Tilbury", product: "Magic Cream" },
  { brand: "Haus Labs", product: "Triclone Foundation" },
  { brand: "Dior", product: "Lip Glow Oil" },
  { brand: "Freck Beauty", product: "Faux Freckle Pen" },
  { brand: "Sol de Janeiro", product: "Brazilian Crush Mist" },
  { brand: "Paula’s Choice", product: "2% BHA Liquid Exfoliant" },
  { brand: "Essence", product: "Lash Princess Mascara" },
  { brand: "Color Wow", product: "Dream Coat Spray" },
  { brand: "Laneige", product: "Lip Sleeping Mask" },
  { brand: "Maybelline", product: "Sky High Mascara" },
  { brand: "Kitsch", product: "Heatless Curl Set" },
  { brand: "Biodance", product: "Bio-Collagen Mask" },
  { brand: "MAC", product: "Squirt Plumping Gloss Stick" },
  { brand: "Clinique", product: "Black Honey Lipstick" },
  { brand: "L’Oréal Paris", product: "Infallible Foundation" },
  { brand: "Isle of Paradise", product: "Self-Tanning Drops" },
  { brand: "Rare Beauty", product: "Liquid Blush" },
  { brand: "SHEGLAM", product: "Makeup Essentials" },
  { brand: "Huda Beauty", product: "Concealer" },
  { brand: "Cécred", product: "Haircare Treatment" },
  { brand: "Medicube", product: "PDRN Pink Glass Glow Set" },
  { brand: "E.L.F.", product: "Halo Glow Powder" },
  { brand: "Bubble Skincare", product: "Gel Cleanser" },
  { brand: "Tower 28 Beauty", product: "SOS Spray" },
  { brand: "Olay", product: "Regenerist Cream" },
  { brand: "I’m From", product: "Rice Toner" },
  { brand: "DIBS Beauty", product: "Desert Island Duo" },
  { brand: "Milk Makeup", product: "Cooling Water Jelly Tint" },
  { brand: "Glow Recipe", product: "Watermelon Dew Drops" },
  { brand: "Danessa Myricks Beauty", product: "Yummy Skin Balm Powder" },
  { brand: "Refy", product: "Brow Sculpt" },
  { brand: "Kosas", product: "Revealer Concealer" },
  { brand: "Bioderma", product: "Micellar Water" },
  { brand: "Embryolisse", product: "Lait-Crème Concentré" },
  { brand: "CurrentBody", product: "LED Hair Growth Helmet" },
  { brand: "Dyson Beauty", product: "Airwrap Styler" }
];

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
  const ethnicities = ["Korean", "Black", "White", "Latina", "Asian-American", "Mixed"];
  const vibes = ["idol", "dancer", "vlogger", "streetwear model", "trainee", "influencer"];
  const styles = ["casual", "glam", "streetwear", "retro", "Y2K-inspired", "minimalist"];
  return `a ${Math.floor(Math.random() * 7) + 17}-year-old female ${
    ethnicities[Math.floor(Math.random() * ethnicities.length)]
  } ${vibes[Math.floor(Math.random() * vibes.length)]} with a ${styles[Math.floor(Math.random() * styles.length)]} style`;
}

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
    const out = await openai.images.generate({
      model: "gpt-image-1",
      prompt: `
        Create a photocard-style image.
        Subject: ${persona}, Gen-Z aesthetic.
        They are holding and applying ${product} by ${brand}.
        Pastel gradient background (milk pink, baby blue, lilac).
        Glitter bokeh, glossy K-beauty skin glow.
        Sticker shapes only (hearts, emoji, text emoticon).
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
  const pick = TOP50_COSMETICS[Math.floor(Math.random() * TOP50_COSMETICS.length)];
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

    if (!roomTrends[roomId] || !roomTrends[roomId].current) {
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

      // Check if dailyDrop exists or is outdated
      if (!dailyDrop || dailyDate !== today) {
        console.log("🌅 Generating new dailyDrop...");
        dailyDrop = await generateDrop();
        dailyDate = today;
      }

      // Always use dailyDrop as the first drop for a room
      roomTrends[roomId] = { current: dailyDrop };
    } else {
      if (roomTrends[roomId].next) {
        roomTrends[roomId].current = roomTrends[roomId].next;
        roomTrends[roomId].next = null;
      }
    }
    res.json(roomTrends[roomId].current);
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
      return res.send(Buffer.alloc(1000)); // ~1s silence
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

// Trigger pre-generation when voice starts
app.get("/api/start-voice", async (req, res) => {
  const roomId = req.query.room;
  if (!roomId) {
    return res.status(400).json({ error: "room parameter required" });
  }
  ensureNextDrop(roomId);
  res.json({ ok: true, message: "Pre-generation triggered" });
});

/* ---------------- Minimal Socket.IO ---------------- */
io.on("connection", (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);
  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    socket.roomId = roomId;
    console.log(`👥 ${socket.id} joined room: ${roomId}`);
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
  console.log(`🚀 323drop backend (Base Mode Only) live on :${PORT}`);
});
