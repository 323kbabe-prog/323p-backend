const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const OpenAI = require("openai");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors({ origin: "*" }));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------------- State ---------------- */
const roomTrends = {};
let generatingNext = {};
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
let raceIndex = 0; // keeps track of race sequence

function randomPersona() {
  const races = ["Black", "Korean", "White", ""]; // "" = generic (no race)
  const vibes = ["idol", "dancer", "vlogger", "streetwear model", "influencer"];
  const styles = ["casual", "glam", "streetwear", "retro", "Y2K-inspired", "minimalist"];

  const race = races[raceIndex % races.length];
  raceIndex++;

  const vibe = vibes[Math.floor(Math.random() * vibes.length)];
  const style = styles[Math.floor(Math.random() * styles.length)];

  if (race) {
    return `a young ${race} female ${vibe} with a ${style} style`;
  } else {
    return `a young female ${vibe} with a ${style} style`;
  }
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

/* ---------------- AI-Weird Gen-Z Sticker Pool ---------------- */
const stickerPool = [
  "🤖","👾","⚡","💻","📟","⌨️","📡","🔮","🧠","💿","🪩","📼",
  "🪐","🌀","🌐","☄️","👁️","🫀","🦷","🐸","🥒","🧃","🥤","🍄",
  "💅","💋","👑","🔥","😎","🫦","🥹","😭","😂","😵‍💫","🤯",
  "🦋","🐰","🌸","🍓","🍭","🍉","🍒","🍼","☁️","🌙","✨","🌈",
  ":)","<3","☆","^_^","¯\\_(ツ)_/¯","(✿◠‿◠)","(｡♥‿♥｡)","(⌐■_■)",
  "(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧","(っ◔◡◔)っ ♥","(ノಠ益ಠ)ノ彡┻━┻","(☞ﾟヮﾟ)☞"
];
function randomStickers(countMin = 5, countMax = 12) {
  const count = Math.floor(Math.random() * (countMax - countMin + 1)) + countMin;
  return Array.from({ length: count }, () =>
    stickerPool[Math.floor(Math.random() * stickerPool.length)]
  ).join(" ");
}

/* ---------------- Top 50 Cosmetics ---------------- */
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

/* ---------------- Persistence ---------------- */
const PICKS_FILE = path.join(__dirname, "dailyPicks.json");

function loadDailyPicks() {
  try {
    if (fs.existsSync(PICKS_FILE)) {
      const data = JSON.parse(fs.readFileSync(PICKS_FILE));
      if (data.dailyDate === new Date().toISOString().slice(0, 10)) {
        dailyDate = data.dailyDate;
        dailyPicks = data.dailyPicks;
        console.log(`📂 Loaded Daily Pick from file (${dailyDate})`);
      }
    }
  } catch (err) {
    console.error("❌ Failed to load daily pick file:", err.message);
  }
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

/* ---------------- Image Generator ---------------- */
async function generateImageUrl(brand, product, persona) {
  try {
    const bg = genzBackgrounds[Math.floor(Math.random() * genzBackgrounds.length)];
    const stickers = randomStickers();
    const out = await openai.images.generate({
      model: "gpt-image-1",
      prompt: `
        Create a photocard-style image with a sticker photo booth aesthetic.
        Foreground subject: ${persona}, Gen-Z aesthetic.
        They are holding and applying ${product} by ${brand}.
        
        Background must be a bold ${bg}, filling the entire canvas edge-to-edge.
        The background style should look like a Gen-Z sticker photo booth — playful, colorful, and layered.
        
        Overlay many sticker shapes (emoji + text emoticons like ${stickers}) floating around the subject.
        Stickers should feel chaotic, fun, and cover parts of the background.
        
        Square 1:1 format. No plain backgrounds. No text/logos.
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

/* ---------------- Drop Generator ---------------- */
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

/* ---------------- Daily Pick (only one per day) ---------------- */
async function generateDailyPicks() {
  dailyPicks = [];
  const usedIndexes = new Set();

  while (dailyPicks.length < 1) {
    const idx = Math.floor(Math.random() * TOP50_COSMETICS.length);
    if (usedIndexes.has(idx)) continue;
    usedIndexes.add(idx);

    const pick = TOP50_COSMETICS[idx];
    const persona = randomPersona();
    const description = await makeDescription(pick.brand, pick.product);
    const imageUrl = await generateImageUrl(pick.brand, pick.product, persona);

    dailyPicks.push({
      brand: decorateTextWithEmojis(pick.brand),
      product: decorateTextWithEmojis(pick.product),
      persona,
      description,
      hashtags: ["#BeautyTok", "#NowTrending"],
      image: imageUrl,
      refresh: 3000
    });
  }

  dailyDate = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(PICKS_FILE, JSON.stringify({ dailyDate, dailyPicks }, null, 2));

  console.log(`🌅 Daily Pick Generated (${dailyDate}):`);
  console.log(`1. ${dailyPicks[0].brand} – ${dailyPicks[0].product}`);
}

/* ---------------- Pre-gen ---------------- */
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
      console.warn("⚠️ Daily pick not ready, generating now as fallback...");
      await generateDailyPicks();
      console.log("✅ Fallback generation complete — daily pick is now ready.");
    }

    if (!roomTrends[roomId]) {
      roomTrends[roomId] = { dailyIndex: 0 };
    }

    let current;
    const dailyIndex = roomTrends[roomId].dailyIndex;

    if (dailyIndex < dailyPicks.length) {
      current = dailyPicks[dailyIndex];
      roomTrends[roomId].dailyIndex++;
      console.log(`🎬 Serving Daily Pick ${roomTrends[roomId].dailyIndex}/${dailyPicks.length} for room ${roomId}`);
    } else {
      if (roomTrends[roomId].next) {
        current = roomTrends[roomId].next;
        roomTrends[roomId].next = null;
        ensureNextDrop(roomId);
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
  if (roomTrends[roomId] && roomTrends[roomId].dailyIndex <= dailyPicks.length) {
    console.log(`⚡ Pre-gen first infinite drop triggered at voice start (room ${roomId})`);
  }
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
    loadDailyPicks();
  console.log(`🚀 323drop backend live on :${PORT}`);
});

