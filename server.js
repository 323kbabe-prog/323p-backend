// server.js — NPC Browser (Agentic Reasoning Edition — SAFE VERSION)
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

console.log("🚀 Agentic NPC backend booting...");
console.log("API key detected:", !!process.env.OPENAI_API_KEY);

/* ------------------------------------------
   SAFE JSON PARSER (never crashes)
------------------------------------------- */
function safeJSON(str) {
  try {
    // Try exact parse first
    return JSON.parse(str);
  } catch {
    try {
      // Extract JSON object using regex
      const match = str.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch {}
    return null; // failed completely
  }
}

/* ------------------------------------------
   AGENTIC EXTRACTION ENDPOINT (SAFE)
   Calls gpt-4o-mini → Extract summary & clusters
   ALWAYS returns something valid.
------------------------------------------- */
app.post("/api/agentic", async (req, res) => {
  const thought = req.body.thought || "";

  const fallback = {
    summary: "npc perspective insight",
    clusters: [
      "npc reasoning",
      "agentic search",
      "interpretive viewpoint"
    ]
  };

  if (!thought.trim()) {
    return res.json(fallback);
  }

  const prompt = `
Extract agentic reasoning from the NPC thought.

INPUT:
"${thought}"

OUTPUT JSON ONLY:
{
  "summary": "one short phrase (5–9 words)",
  "clusters": ["2–4 word cluster", "cluster", "cluster"]
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
      console.log("⚠️ OpenAI returned malformed JSON, using fallback.");
      return res.json(fallback);
    }

    // Clean clusters
    if (!Array.isArray(parsed.clusters)) parsed.clusters = [];

    return res.json({
      summary: parsed.summary,
      clusters: parsed.clusters
    });

  } catch (err) {
    console.error("❌ Agentic extraction failed:", err.message);
    return res.json(fallback);
  }
});

/* ------------------------------------------
   STATIC FILES
------------------------------------------- */
app.use(express.static(path.join(__dirname, "public")));

/* ------------------------------------------
   START SERVER
------------------------------------------- */
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🔥 Agentic NPC backend running on :${PORT}`);
});