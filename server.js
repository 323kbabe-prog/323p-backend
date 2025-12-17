//////////////////////////////////////////////////////////////
// Rain Man Business Engine — CLEAN VERSION + YOUTUBE ENGINE
// + ADDED /run ENDPOINT FOR NEW UI
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

console.log("🚀 Rain Man Business Engine Started");

//////////////////////////////////////////////////////////////
// 🔹 NEW UNIFIED ENDPOINT FOR BLUE OCEAN UI
//////////////////////////////////////////////////////////////
app.post("/run", async (req, res) => {
  const topic = (req.body.topic || "").trim();

  if (topic.length < 3) {
    return res.json({
      report: "Please enter a clearer topic.",
      audio: ""
    });
  }

  try {
    // 1. Background rewrite (silent)
    const rewriteOut = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `Rewrite into one clear strategic directive:\n${topic}`
      }],
      temperature: 0.2
    });

    const rewrite = rewriteOut.choices[0].message.content.trim();

    // 2. Generate future report (simple, stable)
    const futureOut = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `
You are an AI foresight system.

Directive:
${rewrite}

Write a calm, realistic report describing the world
six months from now if trends continue.

Rules:
- Neutral tone
- 3–5 short paragraphs
- Focus on everyday impact
`
      }],
      temperature: 0.4
    });

    const report = futureOut.choices[0].message.content.trim();

    res.json({
      report,
      audio: "" // audio added later
    });

  } catch (err) {
    console.error("RUN ERROR:", err);
    res.json({
      report: "The system is temporarily unavailable.",
      audio: ""
    });
  }
});

//////////////////////////////////////////////////////////////
// INPUT VALIDATION (OLD SYSTEM)
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
    res.json({
      valid: out.choices[0].message.content.trim().toUpperCase() === "VALID"
    });
  } catch {
    res.json({ valid: true });
  }
});

//////////////////////////////////////////////////////////////
// EXECUTIVE REWRITE ENGINE (OLD)
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
// VIEW / ENTER / NEXT COUNTERS (UNCHANGED)
//////////////////////////////////////////////////////////////
const DATA_DIR = "/data";
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

function readJSON(file, def) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return def; }
}
function writeJSON(file, v) {
  fs.writeFileSync(file, JSON.stringify(v, null, 2));
}

app.get("/api/views", (req, res) => {
  const f = `${DATA_DIR}/views.json`;
  const v = readJSON(f, { total: 0 });
  v.total++;
  writeJSON(f, v);
  res.json(v);
});

app.post("/api/enter", (req, res) => {
  const f = `${DATA_DIR}/enter.json`;
  const v = readJSON(f, { total: 0 });
  v.total++;
  writeJSON(f, v);
  res.json(v);
});

app.post("/api/next", (req, res) => {
  const f = `${DATA_DIR}/next.json`;
  const v = readJSON(f, { total: 0 });
  v.total++;
  writeJSON(f, v);
  res.json(v);
});

//////////////////////////////////////////////////////////////
// SOCKET.IO (UNCHANGED)
//////////////////////////////////////////////////////////////
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

io.on("connection", socket => {
  console.log("Socket connected");
});

//////////////////////////////////////////////////////////////
// STATIC HOSTING (UNCHANGED)
//////////////////////////////////////////////////////////////
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log("🔥 Rain Man Engine running on", PORT);
});