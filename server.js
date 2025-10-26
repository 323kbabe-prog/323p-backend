// server.js — AI-Native Persona Swap Browser (Personas React to Video Content)
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

// 🔍 Environment check
console.log("🚀 Starting AI-Native Persona Swap Browser backend...");
[
  "OPENAI_API_KEY",
  "SERPAPI_KEY",
  "NEWSAPI_KEY",
  "YOUTUBE_API_KEY",
  "RAPIDAPI_KEY",
  "IG_ACCESS_TOKEN",
  "IG_BUSINESS_ID"
].forEach(k => console.log(`${k}:`, !!process.env[k]));

if (!fs.existsSync("/data")) fs.mkdirSync("/data");

app.use(express.static(path.join(__dirname, "public")));
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------------- Persona Pool ---------------- */
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
  const firstNames = ["Aiko","Marcus","Sofia","Ravi","Mina","David","Lila","Oliver","Kenji","Isabella"];
  const lastNames = ["Tanaka","Lee","Martinez","Singh","Park","Johnson","Thompson","Patel","Kim","Garcia"];
  const name = `${firstNames[Math.floor(Math.random()*firstNames.length)]} ${lastNames[Math.floor(Math.random()*lastNames.length)]}`;
  return `${name}, ${ethnicity} ${vibe.charAt(0).toUpperCase()+vibe.slice(1)}`;
}

/* ---------------- Persona Search API ---------------- */
app.get("/api/persona-search", async (req, res) => {
  const query = req.query.query || "latest AI trends";
  console.log(`🌐 Persona Search for: "${query}"`);

  let webContext = "";

  /* --- STEP 1: SERP + NEWS CONTEXT --- */
  try {
    const serp = await fetch(
      `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=8&api_key=${process.env.SERPAPI_KEY}`
    );
    const serpData = await serp.json();
    const results = serpData.organic_results || [];
    webContext = results.map(r => `${r.title}: ${r.snippet}`).join(" ");
  } catch (err) {
    console.warn("⚠️ SerpAPI failed:", err.message);
    try {
      const news = await fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&pageSize=5&apiKey=${process.env.NEWSAPI_KEY}`
      );
      const newsData = await news.json();
      webContext = newsData.articles?.map(a => `${a.title}: ${a.description}`).join(" ") || "";
    } catch (err2) {
      console.warn("⚠️ NewsAPI fallback failed:", err2.message);
      webContext = "No live web context available.";
    }
  }

  /* --- STEP 2: FETCH SHORT-FORM VIDEOS (YouTube, TikTok, IG) --- */
  let shortLinks = [];
  try {
    // 🎥 YouTube Shorts
    if (process.env.YOUTUBE_API_KEY) {
      const yt = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query + " shorts")}&maxResults=5&key=${process.env.YOUTUBE_API_KEY}`
      );
      const ytData = await yt.json();
      ytData.items?.forEach(v =>
        shortLinks.push({
          platform: "YouTube",
          title: v.snippet.title,
          link: `https://www.youtube.com/shorts/${v.id.videoId}`
        })
      );
    }

    // 🎵 TikTok (RapidAPI)
    if (process.env.RAPIDAPI_KEY) {
      const tiktok = await fetch(
        `https://tiktok-scraper-api.p.rapidapi.com/video/search?keywords=${encodeURIComponent(query)}`,
        { headers: { "X-RapidAPI-Key": process.env.RAPIDAPI_KEY } }
      );
      const ttData = await tiktok.json();
      ttData.data?.slice(0, 5).forEach(v =>
        shortLinks.push({
          platform: "TikTok",
          title: v.title || v.desc || "TikTok video",
          link: v.url
        })
      );
    }

    // 📱 Instagram Reels (Graph API)
    if (process.env.IG_ACCESS_TOKEN && process.env.IG_BUSINESS_ID) {
      const ig = await fetch(
        `https://graph.facebook.com/v18.0/${process.env.IG_BUSINESS_ID}/media?fields=caption,permalink,media_type&access_token=${process.env.IG_ACCESS_TOKEN}`
      );
      const igData = await ig.json();
      igData.data
        ?.filter(x => x.media_type === "REEL" && x.caption?.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 5)
        .forEach(v =>
          shortLinks.push({
            platform: "Instagram",
            title: v.caption.slice(0, 80),
            link: v.permalink
          })
        );
    }
  } catch (err) {
    console.warn("⚠️ Short-form fetch failed:", err.message);
  }

  if (shortLinks.length === 0) {
    shortLinks = [{ platform: "YouTube", title: "Generic short", link: "https://www.youtube.com/shorts" }];
  }

  /* --- STEP 3: GPT PROMPT — PERSONA TALKS ABOUT EACH VIDEO --- */
  const prompt = `
You are an AI-Native persona generator that reacts to short-form videos about "${query}".

Below are trending short-form clips (with platform + title + link).  
For each video, imagine a young creative persona who just watched it and is posting a first-person reaction.  
Each persona must clearly talk about that video's content — not generic topics.

${shortLinks.map((v, i) => `(${i + 1}) [${v.platform}] ${v.title} — ${v.link}`).join("\n")}

Return one JSON object per video with:
- "persona": creative name + short identity (e.g. "${randomPersona()}")
- "thought": first-person comment that fits that video's title (max 25 words)
- "hashtags": 3 relevant trending hashtags (no # symbols)
- "link": that video's link

Output only a valid JSON array.
`;

  /* --- STEP 4: GPT CALL --- */
  let raw = "", parsed = [];
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
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) parsed = JSON.parse(match[0]);
  } catch (err) {
    console.error("❌ GPT generation failed:", err.message);
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    parsed = [
      {
        persona: "Mina Park, Korean AI trend forecaster",
        thought: "That new NYC bar reel is wild — neon lights, AI bartender, future feels so close!",
        hashtags: ["NYCNightlife", "AIDesign", "FutureVibes"],
        link: shortLinks[0].link
      }
    ];
  }

  res.json(parsed);
});

/* ---------------- View Counter ---------------- */
const VIEW_FILE = "/data/views.json";
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
  console.log(`✅ Backend running and listening on port ${PORT}`)
);