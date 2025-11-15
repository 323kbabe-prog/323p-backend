// ////////////////////////////////////////////////////////////
//  server.js — NPC Browser (Super Agentic Edition — FULL)
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

console.log("🚀 Super Agentic NPC backend booting...");
console.log("OPENAI_API_KEY:", !!process.env.OPENAI_API_KEY);

// ==========================================================
// SAFE JSON PARSER
// ==========================================================
function safeJSON(str) {
  try {
    return JSON.parse(str);
  } catch {
    try {
      const match = str.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch {}
  }
  return null;
}

// ==========================================================
// RANDOM DEMOGRAPHICS + FIELDS
// ==========================================================
const genders = ["Female", "Male", "Nonbinary"];
const races = ["Asian", "Black", "White", "Latino", "Middle Eastern", "Mixed"];
const ages = [20, 21, 22, 23, 24, 25];

const fields = [
  "Psychology researcher",
  "Sociology analyst",
  "Computer Science thinker",
  "Economics observer",
  "Philosophy analyst",
  "Human Biology researcher",
  "Symbolic Systems thinker",
  "Political Science observer",
  "Mechanical Engineering researcher",
  "Art & Theory observer",
  "Anthropology analyst",
  "Linguistics researcher",
  "Earth Systems observer",
  "Media Studies thinker",
  "Cognitive Science researcher"
];

// Pick 10 unique random items
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
// AGENTIC EXTRACTION (gpt-4o-mini)
// ==========================================================
app.post("/api/agentic", async (req, res) => {
  const thought = (req.body.thought || "").trim();

  const fallback = {
    summary: "npc insight perspective",
    clusters: ["agentic reasoning", "npc signal", "semantic analysis"]
  };

  if (!thought) return res.json(fallback);

  const prompt = `
Extract agentic reasoning.

NPC THOUGHT:
"${thought}"

Return JSON only:

{
  "summary": "one short phrase (5–9 words)",
  "clusters": ["cluster1", "cluster2", "cluster3"]
}
`;

  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    });

    const raw = resp.choices?.[0]?.message?.content || "";
    const parsed = safeJSON(raw);

    if (!parsed || !parsed.summary) return res.json(fallback);
    if (!Array.isArray(parsed.clusters)) parsed.clusters = [];

    return res.json({
      summary: parsed.summary,
      clusters: parsed.clusters
    });

  } catch (err) {
    console.error("❌ Agentic extraction error:", err);
    return res.json(fallback);
  }
});

// ==========================================================
// SOCKET.IO — PERSONA GENERATOR (10 UNIQUE)
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
          hashtags: []
        };

        const prompt = `
You are an NPC persona.

IDENTITY:
${persona.persona.gender}, ${persona.persona.race}, ${persona.persona.age}, ${persona.persona.identity}

TASK:
Think about the topic "${query}" from this field's academic worldview.
Write:
1. One deep agentic thought (2–3 sentences)
2. 3–5 hashtags (no # symbol, just words)

Return JSON ONLY:
{
  "thought": "...",
  "hashtags": ["...","...", "..."]
}
`;

        const resp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.6
        });

        const raw = resp.choices?.[0]?.message?.content || "";
        const parsed = safeJSON(raw) || {
          thought: "An NPC perspective emerges.",
          hashtags: ["npc", "perspective", "agentic"]
        };

        persona.thought = parsed.thought || "An NPC reflects.";
        persona.hashtags = parsed.hashtags || ["npc","perspective"];

        socket.emit("personaChunk", persona);
      }

      socket.emit("personaDone");

    } catch (err) {
      console.error("❌ personaSearch error:", err);
      socket.emit("personaError", "Agentic persona system error");
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
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
  const data = readViews();
  data.total++;
  writeViews(data);
  res.json({ total: data.total });
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