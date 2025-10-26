// server.js — Persona-First GPT Extraction System (with Persona Pool)
// -----------------------------------------------------------
// This backend creates 10 personas from your persona pool,
// extracts search keywords from each persona’s thought,
// looks up matching videos on YouTube Shorts / TikTok / IG,
// and returns only personas with verified links.
// -----------------------------------------------------------

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

// ✅ Log which keys are loaded (helpful for Render debugging)
console.log("🚀 Starting Persona-First GPT Extraction backend...");
[
  "OPENAI_API_KEY",
  "SERPAPI_KEY",
  "NEWSAPI_KEY",
  "YOUTUBE_API_KEY",
  "RAPIDAPI_KEY",
  "IG_ACCESS_TOKEN",
  "IG_BUSINESS_ID"
].forEach(k => console.log(`${k}:`, !!process.env[k]));

// ✅ Create /data directory if missing (for view counter)
if (!fs.existsSync("/data")) fs.mkdirSync("/data");

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* -----------------------------------------------------------
   1. Persona Pool — creative DNA for GPT
----------------------------------------------------------- */
const ethnicities = ["Korean","Black","White","Latina","Asian-American","Mixed"];
const vibes = [
  "AI founder","tech designer","digital artist","trend forecaster","sound producer",
  "creative coder","AI choreographer","short-form producer","metaverse curator","brand futurist"
];

/* -----------------------------------------------------------
   2. /api/persona-search — main endpoint
----------------------------------------------------------- */
app.get("/api/persona-search", async (req, res) => {
  const query = req.query.query || "latest AI trends";
  console.log(`🌐 Persona-First flow for: "${query}"`);

  // ---------- Step 1: Context from SerpAPI / NewsAPI ----------
  let webContext = "";
  try {
    const serp = await fetch(
      `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=8&api_key=${process.env.SERPAPI_KEY}`
    );
    const data = await serp.json();
    const results = data.organic_results || [];
    webContext = results.map(r => `${r.title}: ${r.snippet}`).join(" ");
  } catch (e) {
    try {
      const news = await fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&pageSize=5&apiKey=${process.env.NEWSAPI_KEY}`
      );
      const d = await news.json();
      webContext = d.articles?.map(a => `${a.title}: ${a.description}`).join(" ") || "";
    } catch (e2) {
      webContext = "No live web context available.";
    }
  }

  // ---------- Step 2: GPT #1 — generate 10 personas ----------
  const personaPrompt = `
You are an AI-Native persona generator.

Use these ethnicities and creative roles as inspiration:
Ethnicities: ${ethnicities.join(", ")}
Roles: ${vibes.join(", ")}

Topic: "${query}"

Based on this context:
${webContext}

Generate 10 unique creative personas reacting to this topic.
Each entry must have:
- "persona": name + short identity
- "thought": 1 sentence, first-person reaction (max 25 words)
- "hashtags": 3 relevant tags (no #)
Return only a JSON array.
`;

  let personas = [];
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      messages: [
        { role: "system", content: "Output only valid JSON arrays." },
        { role: "user", content: personaPrompt }
      ]
    });
    const raw = completion.choices?.[0]?.message?.content?.trim() || "";
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) personas = JSON.parse(match[0]);
  } catch (err) {
    console.error("❌ GPT persona generation failed:", err.message);
  }

  if (!Array.isArray(personas) || personas.length === 0) {
    return res.json([{ persona: "System", thought: "No personas generated.", hashtags: [] }]);
  }

  // ---------- Step 3: GPT #2 + Cross-Platform Search ----------
  const results = [];
  for (let i = 0; i < personas.length; i++) {
    const p = personas[i];
    console.log(`🧠 Extracting keywords for persona ${i + 1}: ${p.persona}`);

    // GPT keyword extraction prompt
    const keywordPrompt = `
From this thought: "${p.thought}"
Extract 3-5 concise search keywords for finding short-form videos (YouTube Shorts, TikTok, Instagram Reels) related to it.
Return as JSON array of strings only.`;
    let keywords = [];
    try {
      const kw = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.5,
        messages: [
          { role: "system", content: "Output only JSON array of short search keywords." },
          { role: "user", content: keywordPrompt }
        ]
      });
      const rawKW = kw.choices?.[0]?.message?.content?.trim() || "";
      const matchKW = rawKW.match(/\[[\s\S]*\]/);
      if (matchKW) keywords = JSON.parse(matchKW[0]);
    } catch (err) {
      console.warn("⚠️ Keyword extraction failed for persona:", p.persona);
      continue; // Skip if keywords fail
    }

    if (!Array.isArray(keywords) || keywords.length === 0) continue;
    const term = encodeURIComponent(keywords[0]); // use first keyword

    // rotate platform: 0=YouTube, 1=TikTok, 2=IG
    const platformIndex = i % 3;
    let foundLink = null;

    try {
      if (platformIndex === 0 && process.env.YOUTUBE_API_KEY) {
        const yt = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${term}+shorts&maxResults=1&key=${process.env.YOUTUBE_API_KEY}`
        );
        const ytData = await yt.json();
        if (ytData.items?.length)
          foundLink = `https://www.youtube.com/shorts/${ytData.items[0].id.videoId}`;
      }
      if (!foundLink && platformIndex === 1 && process.env.RAPIDAPI_KEY) {
        const tt = await fetch(
          `https://tiktok-scraper-api.p.rapidapi.com/video/search?keywords=${term}`,
          { headers: { "X-RapidAPI-Key": process.env.RAPIDAPI_KEY } }
        );
        const ttData = await tt.json();
        if (ttData.data?.length) foundLink = ttData.data[0].url;
      }
      if (!foundLink && platformIndex === 2 && process.env.IG_ACCESS_TOKEN && process.env.IG_BUSINESS_ID) {
        const ig = await fetch(
          `https://graph.facebook.com/v18.0/${process.env.IG_BUSINESS_ID}/media?fields=caption,permalink,media_type&access_token=${process.env.IG_ACCESS_TOKEN}`
        );
        const igData = await ig.json();
        const match = igData.data?.find(x =>
          x.media_type === "REEL" && x.caption?.toLowerCase().includes(keywords[0].toLowerCase())
        );
        if (match) foundLink = match.permalink;
      }
    } catch (err) {
      console.warn("⚠️ Platform search error:", err.message);
    }

    // Skip persona if no link found
    if (!foundLink) continue;

    results.push({
      persona: p.persona,
      thought: p.thought,
      hashtags: p.hashtags,
      link: foundLink
    });

    // Stop if already have 10 results (safety)
    if (results.length >= 10) break;
  }

  // ---------- Step 4: Return results ----------
  res.json(results);
});

/* -----------------------------------------------------------
   3. View Counter (for footer)
----------------------------------------------------------- */
const VIEW_FILE = "/data/views.json";
function loadViews() {
  try { return JSON.parse(fs.readFileSync(VIEW_FILE, "utf8")); }
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

/* -----------------------------------------------------------
   4. Start Server
----------------------------------------------------------- */
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`✅ Backend running on :${PORT}`));