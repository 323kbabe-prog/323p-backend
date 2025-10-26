// server.js — AI-Native Persona Swap Browser (Hybrid: SerpAPI/NewsAPI + YouTube/TikTok/IG Reels)
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const OpenAI = require("openai");
const cors = require("cors");
const fs = require("fs");
const fetch = require("node-fetch");
const https = require("https");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

console.log("🚀 Starting AI-Native Persona Swap Browser backend...");
console.log("OPENAI_API_KEY:", !!process.env.OPENAI_API_KEY);
console.log("SERPAPI_KEY:", !!process.env.SERPAPI_KEY);
console.log("NEWSAPI_KEY:", !!process.env.NEWSAPI_KEY);
console.log("YOUTUBE_API_KEY:", !!process.env.YOUTUBE_API_KEY);
console.log("RAPIDAPI_KEY:", !!process.env.RAPIDAPI_KEY);
console.log("IG_ACCESS_TOKEN:", !!process.env.IG_ACCESS_TOKEN);

if (!fs.existsSync("/data")) fs.mkdirSync("/data");

app.use(express.static(path.join(__dirname, "public")));
app.use("/aidrop", express.static(path.join(__dirname, "public/aidrop")));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------------- Persona Pool ---------------- */
const ethnicities = ["Korean","Black","White","Latina","Asian-American","Mixed"];
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
  const firstNames = ["Aiko","Marcus","Sofia","Ravi","Mina","David","Lila","Oliver","Kenji","Isabella"];
  const lastNames = ["Tanaka","Lee","Martinez","Singh","Park","Johnson","Thompson","Patel","Kim","Garcia"];
  const name = `${firstNames[Math.floor(Math.random()*firstNames.length)]} ${lastNames[Math.floor(Math.random()*lastNames.length)]}`;
  return `${name}, ${ethnicity} ${vibe.charAt(0).toUpperCase()+vibe.slice(1)}`;
}

/* ---------------- SSL Validator ---------------- */
async function validateHttpsLink(url) {
  return new Promise((resolve) => {
    try {
      const req = https.request(url, { method: "HEAD" }, res => {
        if (res.statusCode >= 200 && res.statusCode < 400) resolve(true);
        else resolve(false);
      });
      req.on("error", () => resolve(false));
      req.end();
    } catch {
      resolve(false);
    }
  });
}

/* ---------------- Persona Search API ---------------- */
app.get("/api/persona-search", async (req, res) => {
  const query = req.query.query || "latest AI trends";
  console.log(`🌐 Live Persona Search for: "${query}"`);

  let webContext = "";
  let linkPool = [];

  /* --- STEP 1: SerpAPI / NewsAPI text context --- */
  try {
    const serp = await fetch(
      `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=10&api_key=${process.env.SERPAPI_KEY}`
    );
    const serpData = await serp.json();
    const results = serpData.organic_results || [];
    linkPool = results
      .map(r => ({ link: r.link, title: r.title || "", snippet: r.snippet || "" }))
      .filter(r => r.link && r.link.startsWith("https://"))
      .slice(0, 10);

    const snippets = linkPool.map(r => r.snippet || r.title);
    webContext = snippets.join(" ");
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

  /* --- STEP 2: YouTube Shorts + TikTok + IG Reels link pool --- */
  let shortLinks = [];
  try {
    // 🎥 YouTube Shorts
    if (process.env.YOUTUBE_API_KEY) {
      const yt = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query + " shorts")}&maxResults=6&key=${process.env.YOUTUBE_API_KEY}`
      );
      const ytData = await yt.json();
      ytData.items?.forEach(v =>
        shortLinks.push(`https://www.youtube.com/shorts/${v.id.videoId}`)
      );
    }

    // 🎵 TikTok (RapidAPI)
    if (process.env.RAPIDAPI_KEY) {
      const tiktok = await fetch(
        `https://tiktok-scraper-api.p.rapidapi.com/video/search?keywords=${encodeURIComponent(query)}`,
        { headers: { "X-RapidAPI-Key": process.env.RAPIDAPI_KEY } }
      );
      const tiktokData = await tiktok.json();
      tiktokData.data?.forEach(v => shortLinks.push(v.url));
    }

    // 📱 Instagram Reels (Graph API)
    if (process.env.IG_ACCESS_TOKEN && process.env.IG_BUSINESS_ID) {
      const ig = await fetch(
        `https://graph.facebook.com/v18.0/${process.env.IG_BUSINESS_ID}/media?fields=caption,permalink,media_type&access_token=${process.env.IG_ACCESS_TOKEN}`
      );
      const igData = await ig.json();
      igData.data
        ?.filter(x => x.media_type === "REEL" && x.caption?.toLowerCase().includes(query.toLowerCase()))
        .forEach(v => shortLinks.push(v.permalink));
    }

    // Deduplicate + limit
    shortLinks = [...new Set(shortLinks)].slice(0, 10);
  } catch (err) {
    console.warn("⚠️ Short-form fetch failed:", err.message);
  }

  if (shortLinks.length === 0)
    shortLinks = ["https://www.youtube.com/shorts", "https://www.tiktok.com", "https://www.instagram.com/reels"];

  /* --- STEP 3: GPT Persona Generation --- */
  const prompt = `
You are an AI-Native persona generator connected to live web data.

Here’s recent context about "${query}" from verified web sources:
${webContext}

Now use these trending short-form video links as your cultural reference:
${shortLinks.join("\n")}

Generate 10 unique JSON entries. Each entry must include:
- "persona": e.g. "${randomPersona()}"
- "thought": a short first-person experience reacting to this trend (max 25 words)
- "hashtags": exactly 3 real hashtags (no # symbols)
- "link": one link from the short-form list above

Output ONLY a valid JSON array.
`;

  let raw = "";
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      messages: [
        { role: "system", content: "Output only valid JSON arrays, nothing else." },
        { role: "user", content: prompt }
      ]
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

  if (!parsed || parsed.length === 0) {
    parsed = [
      {
        persona: "Aiko Tanaka, Japanese Language Enthusiast",
        thought: "I learned Japanese by journaling every morning and translating my own words with an AI model.",
        hashtags: ["JapaneseLanguage", "LearningJourney", "AIStudy"],
        link: shortLinks[0]
      }
    ];
  }

  res.json(parsed);
});

/* ---------------- View Counter ---------------- */
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