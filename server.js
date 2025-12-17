//////////////////////////////////////////////////////////////
// Blue Ocean Browser — SERP-GROUNDED FORESIGHT SERVER
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

const SERP_KEY = process.env.SERP_KEY;

// ---------------------------------
// STEP 2 — Semantic clarity check
// ---------------------------------
async function isClearTopic(topic) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Is the following text a meaningful topic or question a human would ask?
Reply ONLY YES or NO.

"${topic}"
`
    }],
    temperature: 0
  });

  return out.choices[0].message.content.trim() === "YES";
}

// ---------------------------------
// STEP 4 — Fetch SERP news (7 days)
// ---------------------------------
async function fetchSerpSignals(topic) {
  if (!SERP_KEY) return [];

  try {
    const url =
      `https://serpapi.com/search.json?engine=google_news&q=${encodeURIComponent(topic)}&api_key=${SERP_KEY}`;

    const res = await fetch(url);
    const data = await res.json();

    if (!data.news_results) return [];

    return data.news_results.slice(0, 5).map(n => ({
      title: n.title,
      source: n.source,
      snippet: n.snippet || ""
    }));
  } catch {
    return [];
  }
}

// ---------------------------------
// STEP 5 — Compress SERP signals
// ---------------------------------
async function summarizeSignals(signals) {
  if (signals.length === 0) {
    return "No strong recent news signals were found. Use general market context.";
  }

  const text = signals.map(s =>
    `• ${s.title} (${s.source}) — ${s.snippet}`
  ).join("\n");

  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Summarize the following recent news signals into a concise brief
that captures what is currently happening.

${text}
`
    }],
    temperature: 0.3
  });

  return out.choices[0].message.content.trim();
}

// ---------------------------------
// STEP 6 — 6-month foresight report
// ---------------------------------
async function generateFutureReport(topic, signalBrief) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
You are an AI foresight analyst.

Topic:
${topic}

Recent real-world signals (past 7 days):
${signalBrief}

Task:
Write a clear, realistic report describing how this topic is
likely to evolve over the next six months.

Rules:
- Base predictions directly on the signals above
- Reference concrete developments (policies, hiring, products, education, investment)
- No hype, no certainty claims
- Neutral, analytical tone
- 3–5 short paragraphs
`
    }],
    temperature: 0.4
  });

  return out.choices[0].message.content.trim();
}

// ---------------------------------
// MAIN /run ENDPOINT
// ---------------------------------
app.post("/run", async (req, res) => {
  const topic = (req.body.topic || "").trim();

  if (topic.length < 3) {
    return res.json({
      report: "Please enter a clearer topic."
    });
  }

  const ok = await isClearTopic(topic);
  if (!ok) {
    return res.json({
      report: "That doesn’t look like a meaningful topic. Try a short phrase or question."
    });
  }

  try {
    const signals = await fetchSerpSignals(topic);
    const signalBrief = await summarizeSignals(signals);
    const report = await generateFutureReport(topic, signalBrief);

    res.json({ report });

  } catch (err) {
    console.error(err);
    res.json({
      report: "The system is temporarily unavailable."
    });
  }
});

// ---------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🌊 Blue Ocean Browser (SERP-grounded) running on", PORT);
});