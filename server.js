// server.js — OP19$ backend + AI-Native Persona Swap Browser integration
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const OpenAI = require("openai");
const cors = require("cors");
const fs = require("fs");
const Stripe = require("stripe");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// ✅ Logging environment
console.log("🚀 Starting AI-Native Persona Swap Browser backend...");
console.log("OPENAI_API_KEY:", !!process.env.OPENAI_API_KEY);
console.log("STRIPE_SECRET_KEY:", !!process.env.STRIPE_SECRET_KEY);

if (!fs.existsSync("/data")) fs.mkdirSync("/data");

// ✅ Static assets
app.use(express.static(path.join(__dirname, "public")));
app.use("/aidrop", express.static(path.join(__dirname, "public/aidrop")));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

/* ---------------- Shared Persona Pool ---------------- */
const ethnicities = ["Korean", "Black", "White", "Latina", "Asian-American", "Mixed"];
const vibes = [
  "AI founder","tech designer","digital artist","vlogger","streamer","trend forecaster",
  "AR creator","fashion engineer","metaverse curator","product tester","AI researcher",
  "sound producer","content strategist","neural-net stylist","startup intern","creative coder",
  "virtual stylist","app builder","crypto storyteller","UX dreamer","AI makeup artist",
  "music technologist","motion designer","social media director","brand futurist","AI poet",
  "concept photographer","video remixer","fashion influencer","streetwear archivist",
  "digital journalist","UI visionary","culture hacker","AI choreographer","sound curator",
  "data storyteller","aesthetic researcher","creator-economy coach","AI community host",
  "trend analyst","digital anthropologist","cyber curator","creator engineer","neon editor",
  "AI copywriter","content DJ","tech-fashion hybrid","virtual merch designer","AI film editor",
  "short-form producer","creative technologist"
];
const styles = [
  "clean girl","cyber y2k","soft grunge","streetwear","pastel tech","chrome glow","minimalcore",
  "vintage remix","e-girl","e-boy","retro-futurist","quiet luxury","mirror selfie","AIcore",
  "blurry nostalgia","glow street","dream archive","LA casual","NYC minimal","K-pop inspired",
  "oversized fit","iridescent glam","techwear","soft chaos","loud-calm hybrid",
  "main-character energy","monochrome mood","afterlight aesthetic","sunset filter","glittercore",
  "vapor minimal","coquette digital","chrome pastel","recycled glam","studio glow","hazy realism",
  "low-contrast street","creative uniform","digital thrift","pastel glitch","underground luxe",
  "city casual","future-retro","blurred edge","sleek monochrome","glassy shimmer",
  "AI street","motion chic","gen-alpha preview","calm pop","glow neutral"
];

function randomPersona() {
  const ethnicity = ethnicities[Math.floor(Math.random() * ethnicities.length)];
  const vibe = vibes[Math.floor(Math.random() * vibes.length)];
  const style = styles[Math.floor(Math.random() * styles.length)];
  const age = Math.floor(Math.random() * 6) + 18;
  return `a ${age}-year-old ${ethnicity} ${vibe} with a ${style} style`;
}

/* ---------------- AI-Native Persona Search ---------------- */
app.get("/api/persona-search", async (req, res) => {
  const query = req.query.query || "latest AI trends";
  console.log(`🔍 Persona Search Query: "${query}"`);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      messages: [
        {
          role: "system",
          content: `
You are an AI-Native persona-swap generator.
Each output must include:
1️⃣ persona (from the persona pool)
2️⃣ founder thought — a short first-person event or reflection about "${query}"
3️⃣ hashtags — 3 relevant ones.
Tone: real, first-person, human, not corporate.
Return ONLY a JSON array with 10 unique results.
          `
        },
        {
          role: "user",
          content: `
Generate 10 unique persona-based outputs about "${query}".
Each object must have:
- "persona": e.g. "${randomPersona()}"
- "thought": a short first-person sentence (max 25 words)
- "hashtags": exactly 3 relevant tags (no symbols inside array).
Return only a JSON array.
          `
        }
      ]
    });

    const raw = completion.choices?.[0]?.message?.content?.trim();
    const match = raw.match(/\[[\s\S]*\]/);
    const data = match ? JSON.parse(match[0]) : [{ error: "No valid JSON" }];

    res.json(data);
  } catch (err) {
    console.error("❌ Persona Search Error:", err.message);
    res.status(500).json({ error: "Persona search failed. Check logs for details." });
  }
});

/* ---------------- Page View Counter ---------------- */
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

/* ---------------- Test OpenAI Connectivity ---------------- */
app.get("/test", async (req, res) => {
  try {
    const r = await openai.models.list();
    res.json({ status: "✅ OpenAI Connected", modelCount: r.data.length });
  } catch (err) {
    console.error("❌ OpenAI connection test failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ---------------- Socket ---------------- */
io.on("connection", socket => {
  socket.on("joinRoom", id => socket.join(id));
});

/* ---------------- Start ---------------- */
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`✅ AI-Native Persona Swap backend live on :${PORT}`));