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
let raceIndex = 0;
function randomPersona() {
  const races = ["Black", "Korean", "White", ""]; // "" = generic
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

/* ---------------- Backgrounds ---------------- */
const genzBackgrounds = [
  "pastel gradient background (milk pink, baby blue, lilac)",
  "vaporwave gradient background (neon pink, cyan, purple)",
  "sunset gradient background (peach, coral, lavender)",
  "aqua gradient background (mint, aqua, periwinkle)",
  "cyberpunk gradient background (hot pink, electric purple, deep blue)",
  "dreamy gradient background (lavender, sky blue, soft pink)"
];

/* ---------------- Sticker Pool ---------------- */
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

/* ---------------- Pools ---------------- */
const TOP50_COSMETICS = [ /* … your existing 50 cosmetics items … */ ];

const TOP_MUSIC = [ /* … 50 items from 323music pool … */ ];

const TOP_POLITICS = [ /* … 50 items from 323politics pool … */ ];

const TOP_AIDROP = [ /* … 50 items from 323aidrop canon … */ ];

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
async function makeDescriptionCosmetics(brand, product) {
  const prompt = `Write a 70+ word first-person description of using "${product}" by ${brand}. Make it sensory, authentic, and Gen-Z relatable. Add emojis inline.`;
  return await runChat(prompt, "You are a beauty lover speaking in first person.");
}
async function makeDescriptionMusic(artist, track) {
  const prompt = `Write a 70+ word first-person hype reaction to hearing "${track}" by ${artist}. Make it emotional, Gen-Z tone, and use emojis inline.`;
  return await runChat(prompt, "You are a fan reacting to music.");
}
async function makeDescriptionPolitics(issue, keyword) {
  const prompt = `Write a 70+ word first-person passionate rant about ${issue}, referencing ${keyword}. Gen-Z activist tone with emojis inline.`;
  return await runChat(prompt, "You are a young activist speaking to peers.");
}
async function makeDescriptionAidrop(concept) {
  const prompt = `Write a 70+ word first-person surreal, glitchy story about ${concept}. Use chaotic Gen-Z slang and emojis inline.`;
  return await runChat(prompt, "You are an AI-native Gen-Z creator.");
}

async function runChat(userPrompt, systemPrompt) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    });
    return completion.choices[0].message.content.trim() + " " + randomEmojis(3);
  } catch (e) {
    console.error("❌ Description error:", e.message);
    return decorateTextWithEmojis(userPrompt);
  }
}

/* ---------------- Image Generator ---------------- */
async function generateImageUrl(topic, context, persona) {
  let bg = genzBackgrounds[Math.floor(Math.random() * genzBackgrounds.length)];
  let stickers = randomStickers();
  let prompt;

  if (topic === "cosmetics") {
    prompt = `Photocard-style sticker booth, ${persona}, applying ${context.product} by ${context.brand}. Background ${bg}. Stickers: ${stickers}. Square 1:1.`;
  } else if (topic === "music") {
    prompt = `Idol/dancer photocard, ${persona}, performing "${context.track}" by ${context.artist}. Neon stage gradient. Stickers: 🎤🎶⭐ ${stickers}. Square 1:1.`;
  } else if (topic === "politics") {
    prompt = `Protest poster/zine style, ${persona}, speaking on ${context.issue}. Bold red/black gradient. Stickers: ✊📢🔥 ${stickers}. Square 1:1.`;
  } else if (topic === "aidrop") {
    prompt = `Glitchy cyberpunk photocard, ${persona}, embodying ${context.concept}. Colors: purple, aqua. Stickers: 🤖⚡👾 ${stickers}. Square 1:1.`;
  }

  try {
    const out = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
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

/* ---------------- Drop Generators ---------------- */
async function generateDrop(topic) {
  let pick, description, imageUrl, persona = randomPersona();

  if (topic === "music") {
    pick = TOP_MUSIC[Math.floor(Math.random() * TOP_MUSIC.length)];
    description = await makeDescriptionMusic(pick.artist, pick.track);
    imageUrl = await generateImageUrl("music", pick, persona);
    return { brand: pick.artist, product: pick.track, persona, description, hashtags:["#NowTrending"], image: imageUrl, refresh: 3000 };
  }
  if (topic === "politics") {
    pick = TOP_POLITICS[Math.floor(Math.random() * TOP_POLITICS.length)];
    description = await makeDescriptionPolitics(pick.issue, pick.keyword);
    imageUrl = await generateImageUrl("politics", pick, persona);
    return { brand: pick.issue, product: pick.keyword, persona, description, hashtags:["#NowTrending"], image: imageUrl, refresh: 3000 };
  }
  if (topic === "aidrop") {
    pick = TOP_AIDROP[Math.floor(Math.random() * TOP_AIDROP.length)];
    description = await makeDescriptionAidrop(pick.concept);
    imageUrl = await generateImageUrl("aidrop", pick, persona);
    return { brand: "323aidrop", product: pick.concept, persona, description, hashtags:["#NowTrending"], image: imageUrl, refresh: 3000 };
  }

  // default cosmetics
  pick = TOP50_COSMETICS[Math.floor(Math.random() * TOP50_COSMETICS.length)];
  description = await makeDescriptionCosmetics(pick.brand, pick.product);
  imageUrl = await generateImageUrl("cosmetics", pick, persona);
  return { brand: pick.brand, product: pick.product, persona, description, hashtags:["#BeautyTok","#NowTrending"], image: imageUrl, refresh: 3000 };
}

/* ---------------- API Routes ---------------- */
app.get("/api/trend", async (req, res) => {
  try {
    const roomId = req.query.room;
    const topic = req.query.topic || "cosmetics";
    if (!roomId) return res.status(400).json({ error: "room parameter required" });

    const drop = await generateDrop(topic);
    roomTrends[roomId] = { current: drop };
    res.json(drop);
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
  if (!roomId) return res.status(400).json({ error: "room parameter required" });
  console.log(`🎤 Voice started for room ${roomId}`);
  res.json({ ok: true });
});

/* ---------------- Chat ---------------- */
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
httpServer.listen(PORT, () => {
  console.log(`🚀 323aidrop backend live on :${PORT}`);
});
