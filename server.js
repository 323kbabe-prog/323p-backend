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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

console.log("🚀 Rain Man Business Engine Started — YOUTUBE MODE");

//////////////////////////////////////////////////////////////
// INPUT VALIDATION
//////////////////////////////////////////////////////////////
app.post("/api/validate", async (req, res) => {
  const text = (req.body.text || "").trim();
  if (text.length < 3) return res.json({ valid: false });
  if (text.split(/\s+/).length === 1) {
    if (text.length < 4 || !/^[a-zA-Z]+$/.test(text)) {
      return res.json({ valid: false });
    }
  }
  const prompt = `
Determine if this text is meaningful or nonsense.
Return ONLY VALID or NONSENSE.
"${text}"
`;
  try {
    const out = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0
    });
    res.json({ valid: out.choices[0].message.content.trim().toUpperCase() === "VALID" });
  } catch {
    res.json({ valid: true });
  }
});

//////////////////////////////////////////////////////////////
// EXECUTIVE REWRITE ENGINE
//////////////////////////////////////////////////////////////
app.post("/api/rewrite", async (req, res) => {
  let { query } = req.body;
  query = (query || "").trim();
  if (!query) return res.json({ rewritten: "" });

  const prompt = `
Rewrite the user's text into one concise, strategic directive.
Rules:
- ALWAYS rewrite.
- NEVER answer.
- EXACTLY 1 sentence.
- No filler.
- Executive tone.
User:
${query}
Rewritten:
`;

  try {
    const out = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    });

    let rewritten = out.choices[0].message.content.replace(/["“”‘’]/g, "").trim();
    rewritten = rewritten.split(".")[0] + ".";
    res.json({ rewritten });
  } catch {
    res.json({ rewritten: query });
  }
});

//////////////////////////////////////////////////////////////
// CLARITY SCORE ENGINE (FIXED: SINGLE ENDPOINT)
//////////////////////////////////////////////////////////////
app.post("/api/score", async (req, res) => {
  const raw = req.body.text || "";
  const prompt = `
Evaluate the clarity of this user message:
"${raw}"
Return EXACTLY:
Score: <number>/100 <one clean explanation sentence>
`;
  try {
    const out = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0
    });
    res.json({ score: out.choices[0].message.content.trim() });
  } catch {
    res.json({ score: "Score: -/100 Unable to evaluate clarity." });
  }
});

//////////////////////////////////////////////////////////////
// GOOGLE VIDEO SEARCH
//////////////////////////////////////////////////////////////
const SERP_KEY = process.env.SERP_KEY;

app.post("/api/searchVideos", async (req, res) => {
  const query = req.body.query || "";
  if (!query) return res.json({ results: [] });

  try {
    const url =
      `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query + " video")}&api_key=${SERP_KEY}`;
    const raw = await fetch(url);
    const data = await raw.json();

    const results = [];
    if (data.video_results) {
      for (const v of data.video_results.slice(0, 3)) {
        results.push({
          thumb: v.thumbnail || "",
          openUrl: v.link || "",
          source:
            v.link.includes("youtube") ? "youtube" :
            v.link.includes("tiktok") ? "tiktok" :
            v.link.includes("instagram") ? "instagram" :
            "other"
        });
      }
    }
    res.json({ results });
  } catch {
    res.json({ results: [] });
  }
});

//////////////////////////////////////////////////////////////
// YOUTUBE ENGINE
//////////////////////////////////////////////////////////////
const ytMemory = {};

async function fetchYouTubeVideo(query) {
  if (!ytMemory[query])
    ytMemory[query] = { list: [], used: new Set() };

  const bucket = ytMemory[query];

  if (bucket.list.length === 0 || bucket.used.size >= bucket.list.length) {
    const response = await fetch(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
    );
    const html = await response.text();

    const ids = [...new Set([...html.matchAll(/"videoId":"(.*?)"/g)].map(m => m[1]))];
    const times = [...html.matchAll(/"publishedTimeText":\{"simpleText":"(.*?)"\}/g)]
      .map(m => m[1]);

    const filtered = ids.filter((_, i) => {
      const t = (times[i] || "").toLowerCase();
      return t.includes("hour") || t.includes("day") || t.includes("week") || t.includes("month");
    });

    bucket.list = filtered.length ? filtered : ids;
    bucket.used = new Set();
  }

  const available = bucket.list.filter(id => !bucket.used.has(id));
  if (!available.length) return null;

  const videoId = available[0];
  bucket.used.add(videoId);

  return {
    videoId,
    title: "YouTube Result",
    embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1`
  };
}

//////////////////////////////////////////////////////////////
// SOCKET
//////////////////////////////////////////////////////////////
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

io.on("connection", socket => {
  socket.on("personaSearch", async query => {
    try {
      const video = await fetchYouTubeVideo(query);
      if (!video) {
        socket.emit("personaChunk", { error: "No video found." });
        socket.emit("personaDone");
        return;
      }
      socket.emit("personaChunk", video);
      socket.emit("personaDone");
    } catch {
      socket.emit("personaChunk", { error: "Search failed." });
      socket.emit("personaDone");
    }
  });
});

//////////////////////////////////////////////////////////////
// START
//////////////////////////////////////////////////////////////
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log("🔥 Rain Man Engine running — YOUTUBE MODE — on", PORT);
});