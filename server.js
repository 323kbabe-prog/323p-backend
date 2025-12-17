//////////////////////////////////////////////////////////////
// Blue Ocean Browser — Server (Text Report + AI Voice Podcast)
//////////////////////////////////////////////////////////////

import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const SERP_KEY = process.env.SERP_KEY;

// ----------------------------
// In-memory cache & rate guard
// ----------------------------
const cache = new Map();
const lastHit = new Map();

function allowRequest(ip) {
  const now = Date.now();
  const prev = lastHit.get(ip) || 0;
  lastHit.set(ip, now);
  return now - prev > 3000;
}

// ----------------------------
// Step 2: Input validation
// ----------------------------
function isValidInput(text) {
  if (!text) return false;
  const t = text.trim();
  if (t.length < 3) return false;
  if (/^[^a-zA-Z]+$/.test(t)) return false;
  return true;
}

// ----------------------------
// Step 3: Background rewrite
// ----------------------------
async function rewriteSilently(topic) {
  const prompt = `
Rewrite the following input into one clear strategic directive.
Rules:
- One sentence
- Neutral, analytical
- No explanation

Input:
${topic}
`;

  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2
  });

  return out.choices[0].message.content.trim();
}

// ----------------------------
// Step 4: Fetch recent news (7 days)
// ----------------------------
async function fetchRecentNews(query) {
  try {
    const url =
      `https://serpapi.com/search.json?engine=google_news&q=${encodeURIComponent(query)}&api_key=${SERP_KEY}`;
    const raw = await fetch(url);
    const data = await raw.json();

    if (!data.news_results || !data.news_results.length) {
      return "No recent news found. Use broader context.";
    }

    return data.news_results
      .slice(0, 5)
      .map(n => `- ${n.title}`)
      .join("\n");
  } catch {
    return "No recent news found. Use broader context.";
  }
}

// ----------------------------
// Step 5–6: 6-month future report
// ----------------------------
async function generateFutureReport(rewrite, news) {
  const prompt = `
You are an AI foresight system.

Current directive:
${rewrite}

Recent real-world signals (past 7 days):
${news}

Task:
Write a clear, structured report describing a plausible world
six months in the future if these trends continue.

Rules:
- Do not predict certainty
- Neutral, calm tone
- 3–5 short paragraphs
- Focus on everyday impact
`;

  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4
  });

  return out.choices[0].message.content.trim();
}

// ----------------------------
// Step 7: Text-to-speech podcast
// ----------------------------
async function narrateReport(text) {
  const audio = await openai.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice: "alloy",
    input: text
  });

  const buffer = Buffer.from(await audio.arrayBuffer());
  return `data:audio/mp3;base64,${buffer.toString("base64")}`;
}

// ----------------------------
// Main endpoint
// ----------------------------
app.post("/run", async (req, res) => {
  const ip = req.ip;
  if (!allowRequest(ip)) {
    return res.json({
      report: "Please wait a moment before generating another future.",
      audio: ""
    });
  }

  const topic = (req.body.topic || "").trim();
  if (!isValidInput(topic)) {
    return res.json({
      report: "Please enter a clear and meaningful topic.",
      audio: ""
    });
  }

  // Cache by topic
  if (cache.has(topic)) {
    return res.json(cache.get(topic));
  }

  try {
    const rewrite = await rewriteSilently(topic);
    const news = await fetchRecentNews(rewrite);
    const report = await generateFutureReport(rewrite, news);
    const audio = await narrateReport(report);

    const result = { report, audio };
    cache.set(topic, result);
    res.json(result);

  } catch (err) {
    res.json({
      report: "Unable to generate a future scenario at this time.",
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