//////////////////////////////////////////////////////////////
//  Rain Man Business Engine — CLEAN VERSION (NO DROP CARDS)
//  • Rewrite Engine (always rewrite, never answer)
//  • Nonsense Detector
//  • Clarity Score Engine
//  • Suggestion Engine
//  • Share System (kept for safety)
//  • View Counter
//  • Enter Counter
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

const SERP_KEY = process.env.SERPAPI_KEY || null;

console.log("🚀 Rain Man Business Engine Started — Drop Cards OFF");

//////////////////////////////////////////////////////////////
// INPUT VALIDATION — Strong Nonsense Detector
//////////////////////////////////////////////////////////////

app.post("/api/validate", async (req, res) => {
  const text = (req.body.text || "").trim();

  // RULE 1 — auto-fail empty or <3 chars
  if (text.length < 3) return res.json({ valid: false });

  // RULE 2 — 1-word but meaningless
  if (text.split(/\s+/).length === 1) {
    const word = text.toLowerCase();
    const englishLike = /^[a-zA-Z]+$/.test(word);
    if (word.length < 4 || !englishLike) return res.json({ valid: false });
  }

  // RULE 3 — AI meaning check
  const prompt = `
Determine if this text is meaningful or nonsense.
Return ONLY one word: VALID or NONSENSE.

User text:
"${text}"
`;

  try {
    const out = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0
    });

    const answer = out.choices[0].message.content.trim().toUpperCase();
    res.json({ valid: answer === "VALID" });

  } catch (err) {
    res.json({ valid: true }); // fail-open
  }
});

//////////////////////////////////////////////////////////////
// EXECUTIVE REWRITE ENGINE — always rewrites, never answers
//////////////////////////////////////////////////////////////

app.post("/api/rewrite", async (req, res) => {
  let { query } = req.body;
  query = (query || "").trim();
  if (!query) return res.json({ rewritten: "" });

  const prompt = `
Rewrite the user's text into one concise, strategic directive using business-level reasoning.

Rules:
- ALWAYS rewrite, even if it's a question.
- NEVER answer the question.
- Convert ALL questions into decisive executive instructions.
- EXACTLY 1 sentence.
- No emotion.
- No metaphors.
- No filler.
- Must sound like senior executive instruction.

User input:
${query}

Rewritten:
`;

  try {
    const out = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    });

    let rewritten = out.choices[0].message.content
      .replace(/["“”‘’]/g, "")
      .trim();

    rewritten = rewritten.split(".")[0] + ".";

    res.json({ rewritten });

  } catch (err) {
    console.log("Rewrite Error:", err);
    res.json({ rewritten: query });
  }
});

//////////////////////////////////////////////////////////////
// CLARITY SCORE ENGINE
//////////////////////////////////////////////////////////////

app.post("/api/score", async (req, res) => {
  const raw = req.body.text || "";

  const prompt = `
Rate this input ONLY on clarity and business-readiness.
Return ONLY a number from 1 to 100.

"${raw}"
`;

  try {
    const out = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0
    });

    const score = out.choices[0].message.content.trim();
    res.json({ score });

  } catch (err) {
    console.log("Score Error:", err);
    res.json({ score: "-" });
  }
});

//////////////////////////////////////////////////////////////
// SUGGESTION ENGINE — explains why user scored low
//////////////////////////////////////////////////////////////

app.post("/api/suggest", async (req, res) => {
  const { raw, rewritten, score } = req.body;

  const prompt = `
You are an AI communication coach.

User wrote:
"${raw}"

Rewrite:
"${rewritten}"

Score: ${score}/100

Provide EXACTLY 3 bullet points explaining:
- why the score is what it is
- how to improve clarity next time
- what the user should change

Rules:
- Start each bullet with "• "
- Put ONE blank line between each bullet
- Only 3 bullets
- No intro or closing text
`;

  try {
    const out = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4
    });

    res.json({ suggestions: out.choices[0].message.content.trim() });

  } catch (err) {
    console.log("Suggestion Error:", err);
    res.json({
      suggestions:
        "• Unable to generate suggestions.\n• Try again.\n• AI will provide guidance shortly."
    });
  }
});

//////////////////////////////////////////////////////////////
// SHARE SYSTEM (kept intact)
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
    start: v.start || "2025-11-11",
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
// PERSONA ENGINE — DISABLED (NO DROP CARDS)
//////////////////////////////////////////////////////////////

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

io.on("connection", socket => {
  console.log("Socket connected — Persona Engine is disabled.");
  socket.on("personaSearch", () => socket.emit("personaDone"));
});

//////////////////////////////////////////////////////////////
// STATIC HOSTING + START
//////////////////////////////////////////////////////////////

app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log("🔥 Final Rain Man Business Engine running (Drop Cards OFF) on", PORT);
});