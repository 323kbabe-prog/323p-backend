//////////////////////////////////////////////////////////////
//  Rain Man Business Engine — YOUTUBE + TIKTOK + INSTAGRAM
//  • Rewrite Engine
//  • Nonsense Detector
//  • Clarity Score Engine
//  • Suggestion Engine
//  • Share System
//  • View Counter
//  • Enter Counter
//  • Next Counter
//  • RANDOM VIDEO ENGINE (YT / TikTok / IG)
//  • personaSearch -> emits single video
//  • Static Hosting
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

console.log("🚀 Rain Man Business Engine Started — MULTI VIDEO MODE");

//////////////////////////////////////////////////////////////
// INPUT VALIDATION
//////////////////////////////////////////////////////////////

app.post("/api/validate", async (req, res) => {
  const text = (req.body.text || "").trim();
  if (text.length < 3) return res.json({ valid: false });

  if (text.split(/\s+/).length === 1) {
    if (text.length < 4 || !/^[a-zA-Z]+$/.test(text)) return res.json({ valid: false });
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

    res.json({
      valid: out.choices[0].message.content.trim().toUpperCase() === "VALID"
    });

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
// CLARITY SCORE
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
// NEXT COUNTER
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
// ⚡ RANDOM VIDEO ENGINE (YT + TikTok + Instagram)
//////////////////////////////////////////////////////////////

// --- YouTube (already existed) ---
async function fetchYouTubeVideo(query) {
  console.log("Trying YouTube…");

  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const html = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }}).then(r => r.text());
    const matches = [...html.matchAll(/"videoId":"(.*?)"/g)].map(m => m[1]);
    if (!matches.length) return null;

    const id = matches[0];
    return {
      provider: "youtube",
      embedUrl: `https://www.youtube.com/embed/${id}?autoplay=1`
    };
  } catch { return null; }
}

// --- TikTok ---
async function fetchTikTokVideo(query) {
  console.log("Trying TikTok…");

  try {
    const url = `https://www.tiktok.com/search?q=${encodeURIComponent(query)}`;
    const html = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }}).then(r => r.text());
    const match = html.match(/"videoId":"(.*?)"/);
    if (!match) return null;

    return {
      provider: "tiktok",
      embedUrl: `https://www.tiktok.com/embed/${match[1]}`
    };
  } catch { return null; }
}

// --- Instagram Reels ---
async function fetchInstagramVideo(query) {
  console.log("Trying Instagram…");

  try {
    const url = `https://www.instagram.com/explore/tags/${encodeURIComponent(query)}/`;
    const html = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }}).then(r => r.text());
    const match = html.match(/"shortcode":"(.*?)"/);
    if (!match) return null;

    return {
      provider: "instagram",
      embedUrl: `https://www.instagram.com/reel/${match[1]}/embed/`
    };
  } catch { return null; }
}

// --- Randomizer ---
async function fetchRandomVideo(query) {
  const providers = ["youtube", "tiktok", "instagram"];
  const pick = providers[Math.floor(Math.random() * providers.length)];

  console.log("🎬 Random provider:", pick);

  if (pick === "youtube") return await fetchYouTubeVideo(query);
  if (pick === "tiktok") return await fetchTikTokVideo(query);
  if (pick === "instagram") return await fetchInstagramVideo(query);

  return null;
}

//////////////////////////////////////////////////////////////
// SOCKET HANDLER — Return ONE Random Video
//////////////////////////////////////////////////////////////

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

io.on("connection", socket => {
  console.log("Socket connected.");

  socket.on("personaSearch", async query => {

    // Increase NEXT counter
    const c = readNext();
    c.total++;
    writeNext(c);

    const video = await fetchRandomVideo(query);

    if (!video) {
      socket.emit("personaChunk", { error: "No video found." });
      return;
    }

    socket.emit("personaChunk", video);
  });
});

//////////////////////////////////////////////////////////////
// STATIC HOSTING
//////////////////////////////////////////////////////////////

app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log("🔥 Final Engine Running — Multi Video Mode on", PORT);
});