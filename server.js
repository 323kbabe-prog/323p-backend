// server.js (Phase 2.6 full backend with daily pick + preload + photo-realistic, college student personas)
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
let dailyData = {};
const generatingNext = {};

/* ---------------- Load Daily Picks ---------------- */
const PICKS_FILE = path.join(__dirname, "dailyPicks.json");
function loadDailyPicks() {
  try {
    if (fs.existsSync(PICKS_FILE)) {
      dailyData = JSON.parse(fs.readFileSync(PICKS_FILE));
      console.log(`📂 Loaded daily picks (${dailyData.dailyDate})`);
    }
  } catch (err) {
    console.error("❌ Failed to load daily picks:", err.message);
  }
}

/* ---------------- Persona Generator ---------------- */
function randomPersona() {
  return `a young college student`;
}

/* ---------------- Stickers ---------------- */
const stickerPool = ["🤖","👾","⚡","💻","📟","📡","🎶","🎤","✊","📢","🔥","🌈","✨","💖","😍"];
function randomStickers(countMin = 3, countMax = 6) {
  const count = Math.floor(Math.random() * (countMax - countMin + 1)) + countMin;
  return Array.from({ length: count }, () =>
    stickerPool[Math.floor(Math.random() * stickerPool.length)]
  ).join(" ");
}

/* ---------------- Pools ---------------- */
const { TOP50_COSMETICS, TOP_MUSIC, TOP_POLITICS, TOP_AIDROP } = require("./topicPools");

/* ---------------- Description Generator ---------------- */
async function makeDescription(topic, pick) {
  let prompt, system;
  if (topic === "cosmetics") {
    prompt = `Write a 70+ word first-person description of using "${pick.product}" by ${pick.brand}. Sensory, photo-realistic, Gen-Z relatable, emojis inline.`;
    system = "You are a college student talking about beauty.";
  } else if (topic === "music") {
    prompt = `Write a 70+ word first-person hype reaction to hearing "${pick.track}" by ${pick.artist}. Emotional, Gen-Z tone, emojis inline.`;
    system = "You are a college student reacting to music.";
  } else if (topic === "politics") {
    prompt = `Write a 70+ word first-person passionate rant about ${pick.issue}, referencing ${pick.keyword}. Activist college student voice, emojis inline.`;
    system = "You are a college student activist.";
  } else {
    prompt = `Write a 70+ word first-person surreal story about ${pick.concept}. Chaotic, Gen-Z slang, emojis inline.`;
    system = "You are a college student living AI culture.";
  }
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      messages: [{ role:"system", content: system }, { role:"user", content: prompt }]
    });
    return completion.choices[0].message.content.trim();
  } catch {
    return prompt;
  }
}

/* ---------------- Image Generator ---------------- */
async function generateImageUrl(topic, pick, persona) {
  const stickers = randomStickers();
  let prompt = `Photo-realistic mobile snapshot of ${persona}`;
  if (topic === "cosmetics") {
    prompt += ` applying ${pick.product} by ${pick.brand}, casual candid selfie vibe.`;
  } else if (topic === "music") {
    prompt += ` enjoying "${pick.track}" by ${pick.artist}, small live show vibe.`;
  } else if (topic === "politics") {
    prompt += ` at a protest about ${pick.issue}, holding a sign about ${pick.keyword}.`;
  } else {
    prompt += ` immersed in ${pick.concept}, candid Gen-Z vibe.`;
  }
  prompt += ` Natural light, realistic textures. Overlay stickers ${stickers}. Square 1:1.`;

  try {
    const out = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "auto"
    });
    const d = out?.data?.[0];
    if (d?.url) return d.url;
  } catch {}
  return "https://placehold.co/600x600?text=No+Image";
}

/* ---------------- Drop Generator ---------------- */
async function generateDrop(topic) {
  let pick;
  if (topic === "cosmetics") pick = TOP50_COSMETICS[Math.floor(Math.random()*TOP50_COSMETICS.length)];
  else if (topic === "music") pick = TOP_MUSIC[Math.floor(Math.random()*TOP_MUSIC.length)];
  else if (topic === "politics") pick = TOP_POLITICS[Math.floor(Math.random()*TOP_POLITICS.length)];
  else pick = TOP_AIDROP[Math.floor(Math.random()*TOP_AIDROP.length)];

  const persona = randomPersona();
  const description = await makeDescription(topic, pick);
  const imageUrl = await generateImageUrl(topic, pick, persona);

  return {
    brand: pick.brand || pick.artist || pick.issue || "323aidrop",
    product: pick.product || pick.track || pick.keyword || pick.concept,
    persona,
    description,
    hashtags: ["#NowTrending"],
    image: imageUrl,
    refresh: 3000,
    isDaily: false
  };
}

/* ---------------- Preload ---------------- */
async function ensureNextDrop(roomId, topic) {
  if (generatingNext[roomId]) return;
  generatingNext[roomId] = true;
  try {
    const nextDrop = await generateDrop(topic);
    if (!roomTrends[roomId]) roomTrends[roomId] = {};
    roomTrends[roomId].next = nextDrop;
    console.log(`✅ Pre-generated next drop for ${topic} in room ${roomId}`);
  } finally {
    generatingNext[roomId] = false;
  }
}

/* ---------------- API ---------------- */
app.get("/api/trend", async (req, res) => {
  const topic = req.query.topic || "cosmetics";
  const roomId = req.query.room;
  if (!roomId) return res.status(400).json({ error: "room parameter required" });

  const today = new Date().toISOString().slice(0,10);
  let current;

  if (dailyData.dailyDate === today && dailyData.dailyPicks?.[topic] && !roomTrends[roomId]?.dailyServed) {
    current = { ...dailyData.dailyPicks[topic], isDaily: true };
    roomTrends[roomId] = { current, dailyServed: true };
    ensureNextDrop(roomId, topic);
    return res.json(current);
  }

  if (roomTrends[roomId]?.next) {
    current = roomTrends[roomId].next;
    roomTrends[roomId].next = null;
    roomTrends[roomId].current = current;
    ensureNextDrop(roomId, topic);
    return res.json(current);
  }

  current = await generateDrop(topic);
  roomTrends[roomId] = { current, dailyServed: true };
  ensureNextDrop(roomId, topic);
  res.json(current);
});

/* ---------------- Voice ---------------- */
app.get("/api/voice", async (req, res) => {
  const text = req.query.text || "";
  if (!text.trim()) {
    res.setHeader("Content-Type", "audio/mpeg");
    return res.send(Buffer.alloc(1000));
  }
  const out = await openai.audio.speech.create({ model: "gpt-4o-mini-tts", voice: "alloy", input: text });
  const audioBuffer = Buffer.from(await out.arrayBuffer());
  res.setHeader("Content-Type", "audio/mpeg");
  res.send(audioBuffer);
});

/* ---------------- Chat ---------------- */
io.on("connection", (socket) => {
  socket.on("joinRoom", (roomId) => { socket.join(roomId); socket.roomId = roomId; });
});

/* ---------------- Start ---------------- */
app.use(express.static(path.join(__dirname)));
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => { loadDailyPicks(); console.log(`🚀 Backend live on :${PORT}`); });
