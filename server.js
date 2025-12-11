//////////////////////////////////////////////////////////////
//  Rain Man Business Engine — CLEAN VERSION + YOUTUBE ENGINE
//////////////////////////////////////////////////////////////

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
// CLARITY SCORE ENGINE
//////////////////////////////////////////////////////////////

app.post("/api/score", async (req, res) => {
  const raw = req.body.text || "";

  const prompt = `
Rate this input ONLY on clarity (1–100):
"${raw}"
`;

  try {
    const out = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0
    });

    res.json({ score: out.choices[0].message.content.trim() });

  } catch {
    res.json({ score: "-" });
  }
});

//////////////////////////////////////////////////////////////
// CLARITY SCORE ENGINE with explanation
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

  } catch (err) {
    res.json({ score: "Score: -/100 Unable to evaluate clarity." });
  }
});

//////////////////////////////////////////////////////////////
// SHARE SYSTEM
//////////////////////////////////////////////////////////////

const ORIGIN_MAP = {
  blue: "https://blueoceanbrowser.com",
  npc: "https://npcbrowser.com",
  persona: "https://personabrowser.com",
  billy: "https://24billybrowser.com"
};

const SHARES_FILE = "/data/shares.json";
if (!fs.existsSync("/data")) fs.mkdirSync("/data");

function readShares() {
  try { return JSON.parse(fs.readFileSync(SHARES_FILE, "utf8")); }
  catch { return {}; }
}

function writeShares(v) {
  fs.writeFileSync(SHARES_FILE, JSON.stringify(v, null, 2));
}

app.post("/api/share", (req, res) => {
  const all = readShares();
  const id = Math.random().toString(36).substring(2, 8);

  all[id] = {
    personas: req.body.personas || [],
    query: req.body.query || "",
    origin: req.body.origin || "blue"
  };

  writeShares(all);
  res.json({ shortId: id });
});

app.get("/api/share/:id", (req, res) => {
  const all = readShares();
  const s = all[req.params.id];
  if (!s) return res.status(404).json([]);
  res.json(s.personas || []);
});

app.get("/s/:id", (req, res) => {
  const all = readShares();
  const s = all[req.params.id];

  if (!s) return res.redirect("https://blueoceanbrowser.com");

  const redirectURL = ORIGIN_MAP[s.origin] || ORIGIN_MAP.blue;

  res.send(`
    <!doctype html><html><head><meta charset="utf-8"/>
      <script>
        sessionStorage.setItem("sharedId","${req.params.id}");
        setTimeout(()=>{ 
          window.location.href="${redirectURL}?query="+encodeURIComponent("${s.query||""}");
        },400);
      </script>
    </head><body></body></html>
  `);
});

//////////////////////////////////////////////////////////////
// VIEW COUNTER
//////////////////////////////////////////////////////////////

const VIEW_FILE = "/data/views.json";

function readViews() {
  try { return JSON.parse(fs.readFileSync(VIEW_FILE, "utf8")); }
  catch { return { total: 0 }; }
}

function writeViews(v) {
  fs.writeFileSync(VIEW_FILE, JSON.stringify(v, null, 2));
}

app.get("/api/views", (req, res) => {
  const v = readViews();
  v.start = "2025-11-11";
  v.total++;
  writeViews(v);
  res.json({
    total: v.total,
    start: v.start,
    today: new Date().toISOString().split("T")[0]
  });
});

app.get("/api/views/read", (req, res) => {
  const v = readViews();
  res.json({
    total: v.total,
    start: v.start,
    today: new Date().toISOString().split("T")[0]
  });
});

//////////////////////////////////////////////////////////////
// ENTER COUNTER
//////////////////////////////////////////////////////////////

const ENTER_FILE = "/data/enter.json";

function readEnter() {
  try { return JSON.parse(fs.readFileSync(ENTER_FILE, "utf8")); }
  catch { return { total: 0 }; }
}

function writeEnter(v) {
  fs.writeFileSync(ENTER_FILE, JSON.stringify(v, null, 2));
}

app.get("/api/enter", (req, res) => {
  const c = readEnter();
  res.json({ total: c.total });
});

app.post("/api/enter", (req, res) => {
  const c = readEnter();
  c.total++;
  writeEnter(c);
  res.json({ total: c.total });
});

//////////////////////////////////////////////////////////////
// ⭐ NEXT COUNTER
//////////////////////////////////////////////////////////////

const NEXT_FILE = "/data/next.json";

function readNext() {
  try { return JSON.parse(fs.readFileSync(NEXT_FILE, "utf8")); }
  catch { return { total: 0 }; }
}

function writeNext(v) {
  fs.writeFileSync(NEXT_FILE, JSON.stringify(v, null, 2));
}

app.get("/api/next", (req, res) => {
  const c = readNext();
  res.json({ total: c.total });
});

app.post("/api/next", (req, res) => {
  const c = readNext();
  c.total++;
  writeNext(c);
  res.json({ total: c.total });
});

//////////////////////////////////////////////////////////////
// ⭐ NEW: GOOGLE VIDEO SEARCH → YouTube, TikTok, Instagram
//////////////////////////////////////////////////////////////

const SERP_KEY = process.env.SERP_KEY || "dc9b9d70304e66d123e5177b66e20c72a9c81db54dccad13333ead7432368540";

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

    return res.json({ results });

  } catch (err) {
    console.log("SERP API ERROR:", err);
    return res.json({ results: [] });
  }
});

//////////////////////////////////////////////////////////////
// ⭐ YOUTUBE ENGINE — WITH ~3 MONTH FILTER (UNCHANGED)
//////////////////////////////////////////////////////////////

const ytMemory = {};

async function fetchYouTubeVideo(query) {
  try {
    if (!ytMemory[query])
      ytMemory[query] = { list: [], used: new Set() };

    const bucket = ytMemory[query];

    if (bucket.list.length === 0 || bucket.used.size >= bucket.list.length) {

      const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
      const response = await fetch(url);
      const html = await response.text();

      const matches = [...html.matchAll(/"videoId":"(.*?)"/g)].map(m => m[1]);
      const unique = [...new Set(matches)];

      const publishedMatches = [...html.matchAll(/"publishedTimeText":\{"simpleText":"(.*?)"\}/g)]
        .map(m => m[1]);

      const dateMatches = [...html.matchAll(/"publishedAt":"(.*?)"/g)]
        .map(m => m[1]);

      const idsWithYearFilter = [];

      const NOW = Date.now();
      const THREE_MONTHS_MS = 1000 * 60 * 60 * 24 * 90;

      for (let i = 0; i < unique.length; i++) {
        const id = unique[i];
        let accept = false;

        const iso = dateMatches[i];

        if (iso) {
          const t = Date.parse(iso);
          if (!Number.isNaN(t)) {
            const ageMs = NOW - t;
            if (ageMs >= 0 && ageMs <= THREE_MONTHS_MS) accept = true;
          }
        }

        if (!accept) {
          const rel = (publishedMatches[i] || "").toLowerCase();
          if (
            rel.includes("hour") ||
            rel.includes("day") ||
            rel.includes("week") ||
            rel.includes("month")
          ) accept = true;
        }

        if (accept) idsWithYearFilter.push(id);
      }

      const finalList =
        idsWithYearFilter.length > 0 ? idsWithYearFilter : unique;

      bucket.list = finalList;
      bucket.used = new Set();
    }

    const available = bucket.list.filter(id => !bucket.used.has(id));
    if (available.length === 0) return null;

    const videoId = available[0];
    bucket.used.add(videoId);

    return {
      videoId,
      title: "YouTube Result",
      embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1`
    };

  } catch (err) {
    console.log("YouTube scrape error:", err);
    return null;
  }
}

//////////////////////////////////////////////////////////////
// SOCKET — personaSearch returns ONE YouTube video
//////////////////////////////////////////////////////////////

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

io.on("connection", socket => {
  console.log("Socket Connected — YouTube Search Mode Enabled");

  socket.on("personaSearch", async query => {

    const c = readNext();
    c.total++;
    writeNext(c);

    try {
      const video = await fetchYouTubeVideo(query);

      if (!video) {
        socket.emit("personaChunk", { error: "No video found." });
        socket.emit("personaDone");
        return;
      }

      socket.emit("personaChunk", video);
      socket.emit("personaDone");

    } catch (err) {
      socket.emit("personaChunk", { error: "Search failed." });
      socket.emit("personaDone");
    }
  });
});

//////////////////////////////////////////////////////////////
// STATIC HOSTING
//////////////////////////////////////////////////////////////

app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log("🔥 Rain Man Engine running — YOUTUBE MODE — on", PORT);
});