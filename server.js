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

console.log("🚀 Starting AI-Native Persona Swap Browser backend...");
console.log("OPENAI_API_KEY:", !!process.env.OPENAI_API_KEY);
console.log("SERPAPI_KEY:", !!process.env.SERPAPI_KEY);
console.log("NEWSAPI_KEY:", !!process.env.NEWSAPI_KEY);

if (!fs.existsSync("/data")) fs.mkdirSync("/data");

app.use(express.static(path.join(__dirname, "public")));
app.use("/aidrop", express.static(path.join(__dirname, "public/aidrop")));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

function randomPersona() {
  const ethnicity = ethnicities[Math.floor(Math.random() * ethnicities.length)];
  const vibe = vibes[Math.floor(Math.random() * vibes.length)];
  const firstNames = ["Aiko", "Marcus", "Sofia", "Ravi", "Mina", "David", "Lila", "Oliver", "Kenji", "Isabella"];
  const lastNames = ["Tanaka", "Lee", "Martinez", "Singh", "Park", "Johnson", "Thompson", "Patel", "Kim", "Garcia"];
  const name = `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
  return `${name}, ${ethnicity} ${vibe.charAt(0).toUpperCase() + vibe.slice(1)}`;
}

app.get("/api/persona-search", async (req, res) => {
  const query = req.query.query || "latest AI trends";
  console.log(`🌐 Live Persona Search for: "${query}"`);

  let webContext = "";
  let linkPool = [];
  try {
    const serp = await fetch(
      `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=5&api_key=${process.env.SERPAPI_KEY}`
    );
    const serpData = await serp.json();
    const results = serpData.organic_results || [];
    linkPool = results.map(r => r.link).filter(Boolean);
    const snippets = results.map(r => r.snippet || r.title) || [];
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
      linkPool = newsData.articles?.map(a => a.url).filter(Boolean) || [];
      webContext = articles.join(" ");
    } catch (err2) {
      console.warn("⚠️ NewsAPI fallback failed:", err2.message);
      webContext = "No live web context available.";
    }
  }

  const prompt = `
You are an AI-Native persona generator connected to live web data.

Use this real-world context about "${query}":
${webContext}

Generate 10 unique JSON entries. Each entry must include:
- "persona": e.g. "${randomPersona()}"
- "thought": a short first-person real-world event (max 25 words)
- "hashtags": exactly 3 short real hashtags (no # symbols)
- "link": one real relevant link from context (pick from this list: ${linkPool.slice(0,5).join(", ")})

Return ONLY a valid JSON array.
`;

  let raw = "";
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      messages: [
        { role: "system", content: "Output only valid JSON arrays, nothing else." },
        { role: "user", content: prompt }
      ],
    });
    raw = completion.choices?.[0]?.message?.content?.trim() || "";
  } catch (err) {
    console.error("❌ GPT request failed:", err.message);
  }

  let parsed = [];
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) parsed = JSON.parse(match[0]);
  } catch {
    parsed = [];
  }

  if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
    parsed = [
      {
        persona: "Aiko Tanaka, Japanese Language Enthusiast",
        thought: "I learned Japanese by journaling every morning and translating my own words with an AI model.",
        hashtags: ["JapaneseLanguage", "LearningJourney", "AIStudy"],
        link: "https://www.japantimes.co.jp"
      }
    ];
  }

  res.json(parsed);
});

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

io.on("connection", socket => {
  socket.on("joinRoom", id => socket.join(id));
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () =>
  console.log(`✅ AI-Native Persona Swap Browser backend live on :${PORT}`)
);