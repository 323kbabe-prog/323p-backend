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

/* ---------------- API: Persona Search (Web-Live Data Mode + JSON Fix) ---------------- */
app.get("/api/persona-search", async (req, res) => {
  const query = req.query.query || "latest AI trends";
  console.log(`🌐 Live Persona Search for: "${query}"`);

  // 1️⃣ Fetch live data from SerpAPI or NewsAPI
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
      webContext = "No live web context available.";
    }
  }

  // 2️⃣ Build GPT prompt with real data
  const prompt = `
You are an AI-Native persona generator connected to live web data.
Use this real web context about "${query}":
${webContext}

Generate 10 unique JSON entries. Each entry must include:
- "persona": a realistic creative founder persona
- "thought": a short first-person reflection (max 25 words) inspired by the real data
- "hashtags": exactly 3 relevant, real-world hashtags (no # symbols).

Return ONLY a valid JSON array (no markdown, no notes).
`;

  // 3️⃣ GPT request with auto-fix logic
  let raw = "";
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      messages: [
        { role: "system", content: "You only output valid JSON arrays. Nothing else." },
        { role: "user", content: prompt }
      ],
    });
    raw = completion.choices?.[0]?.message?.content?.trim() || "";
  } catch (err) {
    console.error("❌ GPT request failed:", err.message);
  }

  // 4️⃣ Try to recover valid JSON from GPT response
  let parsed = [];
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) parsed = JSON.parse(match[0]);
  } catch (e) {
    console.warn("⚠️ JSON parse failed, auto-repairing...");
    // Fallback repair: remove bad characters & reparse
    const clean = raw.replace(/^[^{[]+/, "").replace(/[^}\]]+$/, "");
    try {
      parsed = JSON.parse(clean);
    } catch {
      parsed = [];
    }
  }

  // 5️⃣ Fallback sample if all else fails
  if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
    console.log("⚠️ Returning fallback persona sample.");
    parsed = [
      {
        persona: "a 22-year-old Asian-American trend forecaster with a pastel tech style",
        thought: "I’ve been tracking how creators in New York remix AI tools for real storytelling.",
        hashtags: ["ai", "design", "culture"]
      }
    ];
  }

  res.json(parsed);
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