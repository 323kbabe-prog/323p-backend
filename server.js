// server.js — AI-Native Persona Swap Browser — Web Live Data Mode
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const OpenAI = require("openai");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// ✅ Logging environment variables
console.log("🚀 Starting AI-Native Persona Swap Browser backend...");
console.log("OPENAI_API_KEY:", !!process.env.OPENAI_API_KEY);

// ✅ Data directory check
if (!fs.existsSync("/data")) fs.mkdirSync("/data");

// ✅ Serve static files (public folder for images etc.)
app.use(express.static(path.join(__dirname, "public")));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------------- Persona Pools ---------------- */
const ethnicities = ["Korean", "Black", "White", "Latina", "Asian-American", "Mixed"];
const vibes = [
  "AI founder", "tech designer", "digital artist", "vlogger", "streamer", "trend forecaster",
  "AR creator", "fashion engineer", "metaverse curator", "product tester", "AI researcher",
  "sound producer", "content strategist", "neural-net stylist", "startup intern", "creative coder",
  "virtual stylist", "app builder", "crypto storyteller", "UX dreamer", "AI makeup artist",
  "music technologist", "motion designer", "social media director", "brand futurist", "AI poet",
  "concept photographer", "video remixer", "fashion influencer", "streetwear archivist",
  "digital journalist", "UI visionary", "culture hacker", "AI choreographer", "sound curator",
  "data storyteller", "aesthetic researcher", "creator-economy coach", "AI community host",
  "trend analyst", "digital anthropologist", "cyber curator", "creator engineer", "neon editor",
  "AI copywriter", "content DJ", "tech-fashion hybrid", "virtual merch designer", "AI film editor",
  "short-form producer", "creative technologist"
];
const styles = [
  "clean girl", "cyber y2k", "soft grunge", "streetwear", "pastel tech", "chrome glow", "minimalcore",
  "vintage remix", "e-girl", "e-boy", "retro-futurist", "quiet luxury", "mirror selfie", "AIcore",
  "blurry nostalgia", "glow street", "dream archive", "LA casual", "NYC minimal", "K-pop inspired",
  "oversized fit", "iridescent glam", "techwear", "soft chaos", "loud-calm hybrid", "main-character energy",
  "monochrome mood", "afterlight aesthetic", "sunset filter", "glittercore", "vapor minimal",
  "coquette digital", "chrome pastel", "recycled glam", "studio glow", "hazy realism",
  "low-contrast street", "creative uniform", "digital thrift", "pastel glitch", "underground luxe",
  "city casual", "future-retro", "blurred edge", "sleek monochrome", "glassy shimmer", "AI street",
  "motion chic", "gen-alpha preview", "calm pop", "glow neutral"
];

// Utility to create random persona
function randomPersona() {
  const ethnicity = ethnicities[Math.floor(Math.random() * ethnicities.length)];
  const vibe = vibes[Math.floor(Math.random() * vibes.length)];
  const style = styles[Math.floor(Math.random() * styles.length)];
  const age = Math.floor(Math.random() * 6) + 18; // 18–23
  return `a ${age}-year-old ${ethnicity} ${vibe} with a ${style} style`;
}

/* ---------------- API: Persona Search ---------------- */
app.get("/api/persona-search", async (req, res) => {
  const query = req.query.query || "latest AI trend";
  console.log(`🌐 Persona Search: ${query}`);

  try {
    // 🔹 Ask OpenAI to generate results using your persona logic
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      messages: [
        {
          role: "system",
          content: `
You are an AI persona generation engine for AI-Drop posts. 
Each result must include:
1️⃣ persona (random from predefined pool)
2️⃣ founder thought (first-person reflection)
3️⃣ hashtags (3 total)
Tone: calm, reflective, first-person, human — not corporate.
Always base insights on real-time cultural or tech trends related to "${query}".
Output in JSON array format.
          `
        },
        {
          role: "user",
          content: `
Generate 10 unique persona-based founder outputs based on "${query}".
For each:
- "persona": a randomly constructed persona like "${randomPersona()}".
- "thought": one short first-person statement (max 25 words) describing their idea or app inspired by "${query}".
- "hashtags": exactly 3 relevant tags.
Return only a valid JSON array.
          `
        }
      ]
    });

    // 🧠 Parse model output
    const text = response.choices[0].message.content.trim();
    const json = JSON.parse(text);
    res.json(json);
  } catch (err) {
    console.error("❌ Persona Search Error:", err.message);
    res.status(500).json({ error: "Error generating persona results." });
  }
});

/* ---------------- API: Page View Counter ---------------- */
const VIEW_FILE = path.join("/data", "views.json");
function loadViews() {
  try { return JSON.parse(fs.readFileSync(VIEW_FILE, "utf-8")); }
  catch { return { total: 0 }; }
}
function saveViews(v) {
  fs.writeFileSync(VIEW_FILE, JSON.stringify(v, null, 2));
}

app.get("/api/views", (req, res) => {
  const v = loadViews();
  v.total += 1;
  saveViews(v);
  res.json({ total: v.total });
});

/* ---------------- SOCKET ---------------- */
io.on("connection", socket => {
  console.log("🧠 New socket connection");
  socket.on("joinRoom", roomId => {
    socket.join(roomId);
    socket.roomId = roomId;
  });
});

/* ---------------- START SERVER ---------------- */
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`✅ Backend live on :${PORT}`));