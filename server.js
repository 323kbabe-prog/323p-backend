// server.js — AI-Native Persona Swap Browser (Web Live Data Mode)
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const OpenAI = require("openai");
const cors = require("cors");
const fs = require("fs");
const fetch = require("node-fetch");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// ✅ Logging environment
console.log("🚀 Starting AI-Native Persona Swap Browser backend...");
console.log("OPENAI_API_KEY:", !!process.env.OPENAI_API_KEY);
console.log("SERPAPI_KEY:", !!process.env.SERPAPI_KEY);
console.log("NEWSAPI_KEY:", !!process.env.NEWSAPI_KEY);

// ✅ Make sure /data exists
if (!fs.existsSync("/data")) fs.mkdirSync("/data");

// ✅ Serve static files
app.use(express.static(path.join(__dirname, "public")));
app.use("/aidrop", express.static(path.join(__dirname, "public/aidrop")));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------------- Persona Generator Pool ---------------- */
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
  const age = Math.floor(Math.random() * 6) + 18; // 18–23
  return `a ${age}-year-old ${ethnicity} ${vibe} with a ${style} style`;
}

/* ---------------- API: Persona Search (Web-Live Data Mode) ---------------- */
app.get("/api/persona-search", async (req, res) => {
  const query = req.query.query || "latest AI trends";
  console.log(`🌐 Live Persona Search for: "${query}"`);

  // 1️⃣ Fetch live context from SerpAPI → fallback NewsAPI
  let webContext = "";
  try {
    const serp = await fetch(
      `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=5&api_key=${process.env.SERPAPI_KEY}`
    );
    const serpData = await serp.json();
    const snippets = serpData.organic_results?.map(r => r.snippet || r.title) || [];
    webContext = snippets.join(" ");
    if (!webContext) throw new Error("SerpAPI empty");
  } catch (err) {
    console.warn("⚠️ SerpAPI failed:", err.message);
    try {
      const news = await fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&pageSize=5&apiKey=${process.env.NEWSAPI_KEY}`
      );
      const newsData = await news.json();
      const articles = newsData.articles?.map(a => a.title + " " + a.description) || [];
      webContext = articles.join(" ");
    } catch (err2) {
      console.warn("⚠️ NewsAPI fallback failed:", err2.message);
      webContext = "No live context available.";
    }
  }

  // 2️⃣ GPT prompt with real context
  const prompt = `
You are an AI-Native persona generator connected to live web data.

Use this real context related to "${query}":
${webContext}

Generate 10 unique JSON entries.
Each entry must include:
- "persona": from creative or AI-related founder archetypes
- "thought": one first-person statement (max 25 words) based on the real data above
- "hashtags": 3 short real-world tags (no # symbol).

Return ONLY valid JSON array (no markdown, no comments).
`;

  // 3️⃣ Generate via GPT
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      messages: [
        { role: "system", content: "You output only valid JSON arrays." },
        { role: "user", content: prompt }
      ]
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    if (!parsed.length) throw new Error("Empty GPT output");
    res.json(parsed);
  } catch (err) {
    console.error("❌ Persona generation failed:", err.message);
    res.status(500).json({ error: "Real data persona generation failed." });
  }
});

/* ---------------- API: View Counter ---------------- */
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

/* ---------------- Socket ---------------- */
io.on("connection", socket => {
  socket.on("joinRoom", id => socket.join(id));
});

/* ---------------- Start ---------------- */
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () =>
  console.log(`✅ AI-Native Persona Swap Browser backend live on :${PORT}`)
);