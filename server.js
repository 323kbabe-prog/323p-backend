//////////////////////////////////////////////////////////////
// Blue Ocean Browser — Stable Server (TEXT ONLY)
//////////////////////////////////////////////////////////////

const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const OpenAI = require("openai");

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ----------------------------
// Simple rate protection
// ----------------------------
const lastHit = new Map();
function allowRequest(ip) {
  const now = Date.now();
  const prev = lastHit.get(ip) || 0;
  lastHit.set(ip, now);
  return now - prev > 2000;
}

// ----------------------------
// Input validation
// ----------------------------
function isValidInput(text) {
  if (!text) return false;
  const t = text.trim();
  if (t.length < 3) return false;
  if (/^[^a-zA-Z]+$/.test(t)) return false;
  return true;
}

// ----------------------------
// Background rewrite
// ----------------------------
async function rewriteSilently(topic) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `Rewrite into one clear strategic directive:\n${topic}`
    }],
    temperature: 0.2
  });
  return out.choices[0].message.content.trim();
}

// ----------------------------
// Future report (NO SERP, NO AUDIO)
// ----------------------------
async function generateFutureReport(rewrite) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
You are an AI foresight system.

Directive:
${rewrite}

Write a clear, calm report describing a plausible world
six months in the future.

Rules:
- Neutral tone
- 3–5 short paragraphs
- Everyday impact
`
    }],
    temperature: 0.4
  });
  return out.choices[0].message.content.trim();
}

// ----------------------------
// Main endpoint
// ----------------------------
app.post("/run", async (req, res) => {
  const ip = req.ip || "unknown";

  if (!allowRequest(ip)) {
    return res.json({ report: "Please wait a moment.", audio: "" });
  }

  const topic = (req.body.topic || "").trim();
  if (!isValidInput(topic)) {
    return res.json({ report: "Please enter a clearer topic.", audio: "" });
  }

  try {
    const rewrite = await rewriteSilently(topic);
    const report = await generateFutureReport(rewrite);

    res.json({
      report,
      audio: ""   // intentionally empty
    });

  } catch (err) {
    console.error("RUN ERROR:", err);
    res.json({
      report: "The system is temporarily unavailable.",
      audio: ""
    });
  }
});

// ----------------------------
// Start server
// ----------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🌊 Blue Ocean Browser server running on", PORT);
});