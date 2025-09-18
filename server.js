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
const roomTrends = {}; // holds { current, next, dailyServed }
let dailyData = {};
const generatingNext = {}; // track preload in progress

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

/* ---------------- Helpers (emoji, persona, stickers) ---------------- */
const EMOJI_POOL = ["✨","💖","🔥","👀","😍","💅","🌈","🌸","😎","🤩","🫶","🥹","🧃","🌟","💋"];
function randomEmojis(count = 2) {
  return Array.from({ length: count }, () =>
    EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)]
  ).join(" ");
}
function decorateTextWithEmojis(text) {
  return `${randomEmojis(2)} ${text} ${randomEmojis(2)}`;
}
let raceIndex = 0;
function randomPersona() {
  const races = ["Black", "Korean", "White", ""];
  const vibes = ["college student"];
  const styles = ["casual","glam","streetwear","retro","Y2K-inspired","minimalist"];
  const race = races[raceIndex % races.length]; raceIndex++;
  const vibe = vibes[Math.floor(Math.random()*vibes.length)];
  const style = styles[Math.floor(Math.random()*styles.length)];
  return race ? `a young ${race} female ${vibe} with a ${style} style`
              : `a young female ${vibe} with a ${style} style`;
}
const genzBackgrounds = [
  "pastel gradient background (milk pink, baby blue, lilac)",
  "vaporwave gradient background (neon pink, cyan, purple)",
  "sunset gradient background (peach, coral, lavender)",
  "aqua gradient background (mint, aqua, periwinkle)",
  "cyberpunk gradient background (hot pink, electric purple, deep blue)",
  "dreamy gradient background (lavender, sky blue, soft pink)"
];
const stickerPool = ["🤖","👾","⚡","💻","📟","⌨️","📡","🔮","🧠","💿","🪩","📼","🪐","🌀","🌐","☄️","👁️","🫀","🦷","🐸","🥒","🧃","🥤","🍄","💅","💋","👑","🔥","😎","🫦","🥹","😭","😂","😵‍💫","🤯","🦋","🐰","🌸","🍓","🍭","🍉","🍒","🍼","☁️","🌙","✨","🌈",":)","<3","☆","^_^"];
function randomStickers(countMin = 5, countMax = 12) {
  const count = Math.floor(Math.random() * (countMax - countMin + 1)) + countMin;
  return Array.from({ length: count }, () => stickerPool[Math.floor(Math.random() * stickerPool.length)]).join(" ");
}

/* ---------------- Pools ---------------- */
const { TOP50_COSMETICS, TOP_MUSIC, TOP_POLITICS, TOP_AIDROP } = require("./topicPools");

/* ---------------- Description Generator ---------------- */
async function makeDescription(topic, pick) {
  let prompt, system;
  if (topic === "cosmetics") {
    prompt = `Write a 70+ word first-person description of using "${pick.product}" by ${pick.brand}. Sensory, Gen-Z relatable, emojis inline.`;
    system = "You are a beauty lover.";
  } else if (topic === "music") {
    prompt = `Write a 70+ word first-person hype reaction to hearing "${pick.track}" by ${pick.artist}. Emojis inline.`;
    system = "You are a music fan.";
  } else if (topic === "politics") {
    prompt = `Write a 70+ word first-person passionate rant about ${pick.issue}, referencing ${pick.keyword}. Activist Gen-Z tone, emojis inline.`;
    system = "You are a young activist.";
  } else {
    prompt = `Write a 70+ word first-person surreal story about ${pick.concept}. Chaotic Gen-Z slang, emojis inline.`;
    system = "You are an AI-native creator.";
  }
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      messages: [{ role:"system", content: system }, { role:"user", content: prompt }]
    });
    return completion.choices[0].message.content.trim() + " " + randomEmojis(3);
  } catch (e) {
    console.error("❌ Description error:", e.message);
    return decorateTextWithEmojis(prompt);
  }
}

/* ---------------- Image Generator ---------------- */
async function generateImageUrl(topic, pick, persona) {
  const bg = genzBackgrounds[Math.floor(Math.random() * genzBackgrounds.length)];
  const stickers = randomStickers();
  let prompt;
  if (topic === "cosmetics") {
    prompt = `Photobooth aesthetic, ${persona}, applying ${pick.product} by ${pick.brand}. Pastel background ${bg}, stickers ${stickers}. 1:1.`;
  } else if (topic === "music") {
    prompt = `Cinematic photo, ${persona}, performing "${pick.track}" by ${pick.artist}. Neon stage, photo-realistic, stickers 🎤🎶⭐ ${stickers}. 1:1.`;
  } else if (topic === "politics") {
    prompt = `Photo-realistic protest photo of ${persona}, about ${pick.issue}. Urban street, daylight, holding sign or megaphone. Stickers ✊📢🔥 ${stickers}. 1:1.`;
  }} else {
  prompt = `Photo-realistic cinematic portrait of ${persona}, embodying ${pick.concept}. 
Synthetic plastic-like skin texture, glossy reflective surfaces, slightly uncanny. 
Cyberpunk tones (purple, aqua, glitch blue). 
Overlay AI-native stickers 🤖⚡👾 ${stickers} like digital graffiti. 
Square 1:1 format.`;
}
  try {
    const out = await openai.images.generate({ model: "gpt-image-1", prompt, size: "1024x1024" });
    const d = out?.data?.[0];
    if (d?.b64_json) return `data:image/png;base64,${d.b64_json}`;
    if (d?.url) return d.url;
  } catch (e) {
    console.error("❌ Image error:", e.message);
  }
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
  } catch (e) {
    console.error("❌ ensureNextDrop failed:", e.message);
  } finally {
    generatingNext[roomId] = false;
  }
}

/* ---------------- API Routes ---------------- */
app.get("/api/trend", async (req, res) => {
  try {
    const topic = req.query.topic || "cosmetics";
    const roomId = req.query.room;
    if (!roomId) return res.status(400).json({ error: "room parameter required" });

    const today = new Date().toISOString().slice(0,10);
    let current;

    // Serve Daily Pick first if not served
    if (dailyData.dailyDate === today && dailyData.dailyPicks?.[topic] && !roomTrends[roomId]?.dailyServed) {
      current = { ...dailyData.dailyPicks[topic], isDaily: true };
      roomTrends[roomId] = { current, dailyServed: true };
      // Preload next in background
      ensureNextDrop(roomId, topic);
      return res.json(current);
    }

    // Serve preloaded next if available
    if (roomTrends[roomId]?.next) {
      current = roomTrends[roomId].next;
      roomTrends[roomId].next = null;
      roomTrends[roomId].current = current;
      // Preload again
      ensureNextDrop(roomId, topic);
      return res.json(current);
    }

    // Otherwise generate live
    current = await generateDrop(topic);
    roomTrends[roomId] = { current, dailyServed: true };
    // Preload again
    ensureNextDrop(roomId, topic);
    res.json(current);
  } catch (e) {
    console.error("❌ Trend API error:", e.message);
    res.json({ error: "Trend API failed" });
  }
});

/* ---------------- Voice ---------------- */
app.get("/api/voice", async (req, res) => {
  try {
    const text = req.query.text || "";
    if (!text.trim()) {
      res.setHeader("Content-Type", "audio/mpeg");
      return res.send(Buffer.alloc(1000));
    }
    const out = await openai.audio.speech.create({ model: "gpt-4o-mini-tts", voice: "alloy", input: text });
    const audioBuffer = Buffer.from(await out.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(audioBuffer);
  } catch (e) {
    console.error("❌ Voice API error:", e.message);
    res.status(500).json({ error: "Voice TTS failed" });
  }
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
    io.to(roomId).emit("chatMessage", { user, text });
  });
  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.id}`);
  });
});

/* ---------------- Static + Start ---------------- */
app.use(express.static(path.join(__dirname)));
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  loadDailyPicks();
  console.log(`🚀 323aidrop backend live on :${PORT}`);
});
