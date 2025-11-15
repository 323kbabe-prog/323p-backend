// ////////////////////////////////////////////////////////////
//  server.js — NPC Browser (Super Agentic Edition — PATCHED)
// ////////////////////////////////////////////////////////////

const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const OpenAI = require("openai");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

console.log("🚀 Super Agentic NPC backend starting...");
console.log("OPENAI_API_KEY:", !!process.env.OPENAI_API_KEY);

// ==========================================================
// SAFE JSON PARSER
// ==========================================================
function safeJSON(str) {
  try { return JSON.parse(str); }
  catch {
    try {
      const match = str.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch {}
  }
  return null;
}

// ==========================================================
// TREND WORD SPLITTER (FIX for TikTok/Instagram)
// ==========================================================
function splitTrendWord(word){
  return word
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])([0-9])/g, "$1 $2")
    .replace(/([0-9])([A-Za-z])/g, "$1 $2")
    .replace(/[\-_]/g, " ")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim();
}

// ==========================================================
// RANDOM DEMOGRAPHICS + RANDOM FIELDS
// ==========================================================
const genders = ["Female", "Male", "Nonbinary"];
const races = ["Asian", "Black", "White", "Latino", "Middle Eastern", "Mixed"];
const ages = [20, 21, 22, 23, 24, 25];

// Clean academic identity names
const fields = [
  "Psychology",
  "Sociology",
  "Computer Science",
  "Economics",
  "Philosophy",
  "Human Biology",
  "Symbolic Systems",
  "Political Science",
  "Mechanical Engineering",
  "Art & Theory",
  "Anthropology",
  "Linguistics",
  "Earth Systems",
  "Media Studies",
  "Cognitive Science"
];

function pickUnique(arr, count) {
  const copy = [...arr];
  const selected = [];
  while (selected.length < count && copy.length > 0) {
    const idx = Math.floor(Math.random() * copy.length);
    selected.push(copy.splice(idx, 1)[0]);
  }
  return selected;
}

// ==========================================================
// AGENTIC EXTRACTION (Google/YT)
// ==========================================================
app.post("/api/agentic", async (req, res) => {
  const thought = (req.body.thought || "").trim();

  const fallback = {
    summary: "agentic perspective insight",
    clusters: ["semantic signal", "npc analysis"]
  };

  if (!thought) return res.json(fallback);

  const prompt = `
Extract agentic reasoning.

INPUT:
"${thought}"

Return JSON only:
{
  "summary": "5–9 word phrase",
  "clusters": ["cluster1", "cluster2", "cluster3"]
}
`;

  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.25
    });

    const raw = resp.choices?.[0]?.message?.content || "";
    const parsed = safeJSON(raw);

    if (!parsed || !parsed.summary) return res.json(fallback);
    if (!Array.isArray(parsed.clusters)) parsed.clusters = [];

    return res.json(parsed);

  } catch (err) {
    console.error("Agentic extraction error:", err);
    return res.json(fallback);
  }
});

// ==========================================================
// SOCKET.IO - PERSONA GENERATOR (10 UNIQUE)
// ==========================================================
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

io.on("connection", socket => {
  console.log("🛰️ Client connected:", socket.id);

  socket.on("personaSearch", async query => {
    try {
      const selectedFields = pickUnique(fields, 10);

      for (let i = 0; i < 10; i++) {
        const persona = {
          persona: {
            gender: genders[Math.floor(Math.random() * genders.length)],
            race: races[Math.floor(Math.random() * races.length)],
            age: ages[Math.floor(Math.random() * ages.length)],
            identity: selectedFields[i]
          },
          thought: "",
          hashtags: [],
          trend: []
        };

        // NPC Thought + Hashtags
        const prompt = `
IDENTITY:
${persona.persona.gender}, ${persona.persona.race}, ${persona.persona.age}, ${persona.persona.identity}

TOPIC: "${query}"

TASK:
1. Write a 2–3 sentence deep academic/agentic interpretation.
2. Provide 3–5 hashtags (no # symbol).

Return JSON:
{
  "thought": "...",
  "hashtags": ["...", "...", "..."]
}
`;

        const resp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7
        });

        const raw = resp.choices?.[0]?.message?.content || "";
        const parsed = safeJSON(raw) || {
          thought: "An NPC perspective forms.",
          hashtags: ["npc","analysis"]
        };

        persona.thought = parsed.thought || "An NPC reflects.";
        persona.hashtags = parsed.hashtags || ["npc","signal"];

        // ======================================================
        // AGENTIC TREND QUERY (For TikTok/Instagram)
        // Option 4: thought + hashtags + user topic
        // ======================================================
        const trendPrompt = `
Create 4–6 SHORT TikTok/Instagram-friendly keywords (NO #, NO commas).
Use:
- NPC thought: "${persona.thought}"
- Hashtags: ${persona.hashtags.join(", ")}
- User topic: "${query}"

Return JSON:
{
  "trend": ["word1", "word2", "word3"]
}
`;

        const trendResp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: trendPrompt }],
          temperature: 0.5
        });

        const trendRaw = trendResp.choices?.[0]?.message?.content || "";
        const trendParsed = safeJSON(trendRaw) || { trend: ["LA","vibes","culture"] };

        // PATCH: split fused keywords for TikTok/IG
        persona.trend = trendParsed.trend.map(w => splitTrendWord(w));

        socket.emit("personaChunk", persona);
      }

      socket.emit("personaDone");

    } catch (err) {
      console.error("❌ personaSearch error:", err);
      socket.emit("personaError", "NPC system error");
    }
  });

  socket.on("disconnect", () =>
    console.log("❌ Client disconnected:", socket.id)
  );
});

// ==========================================================
// VIEW COUNTER
// ==========================================================
const VIEW_FILE = "/data/views.json";

function readViews() {
  try { return JSON.parse(fs.readFileSync(VIEW_FILE,"utf8")); }
  catch { return { total: 0 }; }
}

function writeViews(v) {
  try { fs.writeFileSync(VIEW_FILE, JSON.stringify(v, null, 2)); }
  catch (err) { console.error("⚠️ Could not save views:", err.message); }
}

app.get("/api/views", (req, res) => {
  const v = readViews();
  v.total++;
  writeViews(v);
  res.json({ total: v.total });
});

// ==========================================================
// STATIC FILES
// ==========================================================
app.use(express.static(path.join(__dirname, "public")));

// ==========================================================
// START SERVER
// ==========================================================
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () =>
  console.log(`🔥 Super Agentic NPC backend running on :${PORT}`)
);