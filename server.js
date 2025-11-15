// ////////////////////////////////////////////////////////////
//  server.js — NPC Browser (Super Agentic Edition — SAFE)
// ////////////////////////////////////////////////////////////

const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const OpenAI = require("openai");
const cors = require("cors");
const fs = require("fs");

// ------------------------------
// Initialize Express
// ------------------------------
const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// ------------------------------
// OpenAI client
// ------------------------------
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

console.log("🚀 Agentic NPC backend starting...");
console.log("OPENAI_API_KEY loaded:", !!process.env.OPENAI_API_KEY);

// ==========================================================
//  SAFE JSON PARSER — never allows server crash
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
//  AGENTIC EXTRACTION ENDPOINT (gpt-4o-mini)
//  This powers the super agentic search engine.
// ==========================================================
app.post("/api/agentic", async (req, res) => {
  const thought = (req.body.thought || "").trim();

  // fallback summary + clusters if OpenAI fails
  const fallback = {
    summary: "npc perspective insight",
    clusters: [
      "npc reasoning",
      "agentic search",
      "interpretive signal"
    ]
  };

  if (!thought) return res.json(fallback);

  const prompt = `
Extract agentic reasoning from the NPC's thought.

NPC THOUGHT:
"${thought}"

Return JSON ONLY in this EXACT format:

{
  "summary": "one short phrase (5–9 words)",
  "clusters": ["2–4 word cluster", "cluster", "cluster", "cluster"]
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

    if (!parsed || !parsed.summary) {
      console.log("⚠️ OpenAI returned malformed JSON → using fallback.");
      return res.json(fallback);
    }

    if (!Array.isArray(parsed.clusters)) parsed.clusters = [];

    return res.json({
      summary: parsed.summary,
      clusters: parsed.clusters
    });

  } catch (err) {
    console.error("❌ Agentic extraction error:", err.message);
    return res.json(fallback);
  }
});

// ==========================================================
//  VIEW COUNTER (SAFE VERSION)
// ==========================================================
const VIEW_FILE = "/data/views.json";

function readViews() {
  try {
    return JSON.parse(fs.readFileSync(VIEW_FILE, "utf8"));
  } catch {
    return { total: 0 };
  }
}

function writeViews(v) {
  try {
    fs.writeFileSync(VIEW_FILE, JSON.stringify(v, null, 2));
  } catch (err) {
    console.error("⚠️ Could not save view count:", err.message);
  }
}

app.get("/api/views", (req, res) => {
  const data = readViews();
  data.total++;
  writeViews(data);
  res.json({ total: data.total });
});

// ==========================================================
//  STATIC FILES
// ==========================================================
app.use(express.static(path.join(__dirname, "public")));

// ==========================================================
//  SOCKET.IO (unchanged from your system)
// ==========================================================
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

io.on("connection", socket => {
  console.log("🛰️ Client connected:", socket.id);
  socket.on("disconnect", () => console.log("❌ Client disconnected:", socket.id));
});

// ==========================================================
//  START SERVER
// ==========================================================
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () =>
  console.log(`🔥 Agentic NPC backend running on port ${PORT}`)
);