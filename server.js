//////////////////////////////////////////////////////////////
// Rain Man Business Engine — CLEAN + YOUTUBE MODE (FINAL)
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

//////////////////////////////////////////////////////////////
// OPENAI
//////////////////////////////////////////////////////////////
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

//////////////////////////////////////////////////////////////
// STORAGE HELPERS
//////////////////////////////////////////////////////////////
const DATA_DIR = "/data";
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

function readJSON(file, fallback = { total: 0 }) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

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

    const answer = out.choices[0].message.content.trim().toUpperCase();
    res.json({ valid: answer === "VALID" });

  } catch {
    res.json({ valid: true }); // fail-open
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
Rewrite the user's text into one concise executive instruction.
Rules:
- ALWAYS rewrite
- NEVER answer
- EXACTLY 1 sentence
- No filler
- Neutral executive tone
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

    let rewritten = out.choices[0].message.content
      .replace(/["“”‘’]/g, "")
      .trim();

    rewritten = rewritten.split(".")[0] + ".";
    res.json({ rewritten });

  } catch {
    res.json({ rewritten: query });
  }
});

//////////////////////////////////////////////////////////////
// CLARITY SCORE ENGINE (SINGLE SOURCE OF TRUTH)
//////////////////////////////////////////////////////////////
app.post("/api/score", async (req, res) => {
  const raw = req.body.text || "";

  const prompt = `
Evaluate the clarity of this input.
Return EXACTLY:
Score: <number>/100
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
    res.json({ score: "Score: -/100" });
  }
});

//////////////////////////////////////////////////////////////
// COUNTERS
//////////////////////////////////////////////////////////////
const VIEW_FILE  = `${DATA_DIR}/views.json`;
const ENTER_FILE = `${DATA_DIR}/enter.json`;
const NEXT_FILE  = `${DATA_DIR}/next.json`;

app.get("/api/views/read", (req, res) => {
  res.json(readJSON(VIEW_FILE));
});

app.get("/api/enter", (req, res) => {
  res.json(readJSON(ENTER_FILE));
});

app.post("/api/enter", (req, res) => {
  const d = readJSON(ENTER_FILE);
  d.total++;
  writeJSON(ENTER_FILE, d);
  res.json(d);
});

app.get("/api/next", (req, res) => {
  res.json(readJSON(NEXT_FILE));
});

app.post("/api/next", (req, res) => {
  const d = readJSON(NEXT_FILE);
  d.total++;
  writeJSON(NEXT_FILE, d);
  res.json(d);
});

//////////////////////////////////////////////////////////////
// YOUTUBE SCRAPER (LIGHTWEIGHT)
//////////////////////////////////////////////////////////////
async function fetchYouTubeVideo(query) {
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const html = await fetch(url).then(r => r.text());

    const matches = [...html.matchAll(/"videoId":"(.*?)"/g)]
      .map(m => m[1]);

    const unique = [...new Set(matches)];
    if (!unique.length) return null;

    const videoId = unique[0];
    return {
      embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1`
    };

  } catch {
    return null;
  }
}

//////////////////////////////////////////////////////////////
// SOCKET.IO — VIDEO DELIVERY
//////////////////////////////////////////////////////////////
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

io.on("connection", socket => {
  console.log("🔌 Socket connected");

  socket.on("personaSearch", async query => {
    const d = readJSON(NEXT_FILE);
    d.total++;
    writeJSON(NEXT_FILE, d);

    try {
      const video = await fetchYouTubeVideo(query);
      if (!video) {
        socket.emit("personaChunk", { error: "No video found." });
        return;
      }
      socket.emit("personaChunk", video);
    } catch {
      socket.emit("personaChunk", { error: "Video search failed." });
    }
  });
});

//////////////////////////////////////////////////////////////
// STATIC HOSTING
//////////////////////////////////////////////////////////////
app.use(express.static(path.join(__dirname, "public")));

//////////////////////////////////////////////////////////////
// START SERVER
//////////////////////////////////////////////////////////////
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log("🔥 Rain Man Business Engine running on port", PORT);
});