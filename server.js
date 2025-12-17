//////////////////////////////////////////////////////////////
// Blue Ocean Browser — SERP-Enhanced Foresight Server (FINAL)
//////////////////////////////////////////////////////////////

const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const OpenAI = require("openai");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// IMPORTANT: match your working reference
const SERP_KEY = process.env.SERPAPI_KEY || null;

// ------------------------------------------------------------
// Utility — relative time label
// ------------------------------------------------------------
function relativeTime(dateStr) {
  if (!dateStr) return "recent";
  const d = new Date(dateStr);
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diff <= 1) return "today";
  if (diff <= 7) return `${diff} days ago`;
  return "recent";
}

// ------------------------------------------------------------
// Step 2 — Semantic clarity check
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// Step 3 — Background rewrite (SERP-aware, news tone)
// ------------------------------------------------------------
async function rewriteForSerp(topic) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Rewrite the input into a short, business-news-searchable phrase.

Rules:
- Neutral, journalistic tone
- Business / policy / workforce focus
- 3–6 words
- No opinions

Input:
"${topic}"
`
    }],
    temperature: 0
  });
  return out.choices[0].message.content.trim();
}

// ------------------------------------------------------------
// SERP NEWS Context — reference-aligned
// ------------------------------------------------------------
async function fetchSerpSources(rewrittenTopic) {
  let sources = [];

  if (!SERP_KEY) return sources;

  const serpQuery = `${rewrittenTopic} business news ${new Date().getFullYear()}`;

  try {
    const url = `https://serpapi.com/search.json?q=${
      encodeURIComponent(serpQuery)
    }&tbm=nws&num=8&api_key=${SERP_KEY}`;

    const r = await fetch(url);
    const j = await r.json();

    sources = (j.news_results || [])
      .filter(Boolean)
      .map(x => ({
        title: x.title || "",
        source: x.source || "Unknown",
        link: x.link || "",
        date: x.date || "",
        snippet: x.snippet || ""
      }));

  } catch (e) {
    console.log("SERP NEWS FAIL:", e.message);
  }

  return sources;
}

// ------------------------------------------------------------
// Step 4 — Rank signals by business impact (AI-assisted)
// ------------------------------------------------------------
async function rankSignalsByImpact(sources) {
  if (!sources.length) return sources;

  const list = sources.map(
    (s, i) => `${i + 1}. ${s.title} — ${s.source}`
  ).join("\n");

  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Rank the following news headlines by expected BUSINESS IMPACT
over the next six months (highest impact first).

Only return a list of numbers in order.

${list}
`
    }],
    temperature: 0
  });

  const order = out.choices[0].message.content
    .match(/\d+/g)
    ?.map(n => parseInt(n, 10) - 1) || [];

  const ranked = [];
  order.forEach(i => sources[i] && ranked.push(sources[i]));

  // fallback if ranking fails
  return ranked.length ? ranked : sources;
}

// ------------------------------------------------------------
// Step 5 — Generate foresight using ranked signals
// ------------------------------------------------------------
async function generatePrediction(topic, sources) {
  const signalText = sources.map(s =>
    `• ${s.title} — ${s.source}`
  ).join("\n");

  const prompt = `
You are an AI foresight analyst.

Topic:
${topic}

Recent high-impact business news:
${signalText}

Task:
Write a realistic six-month outlook that is clearly derived
from these signals.

Rules:
- Reference concrete developments
- No hype, no certainty claims
- Neutral, analytical tone
- 3–5 short paragraphs
`;

  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4
  });

  return out.choices[0].message.content.trim();
}

// ------------------------------------------------------------
// MAIN /run ENDPOINT
// ------------------------------------------------------------
app.post("/run", async (req, res) => {
  const topic = (req.body.topic || "").trim();

  if (topic.length < 3) {
    return res.json({ report: "Please enter a clearer topic." });
  }

  const ok = await isClearTopic(topic);
  if (!ok) {
    return res.json({
      report: "That doesn’t look like a meaningful topic. Try a short phrase or question."
    });
  }

  try {
    const rewritten = await rewriteForSerp(topic);
    const rawSources = await fetchSerpSources(rewritten);

    if (!rawSources.length) {
      return res.json({
        report: "No verified recent business news was found for this topic."
      });
    }

    const rankedSources = await rankSignalsByImpact(rawSources);
    const prediction = await generatePrediction(topic, rankedSources);

    // Build visible report
    let reportText = "Current Signals (Ranked by Business Impact)\n";
    rankedSources.slice(0, 5).forEach(s => {
      reportText += `• ${s.title} — ${s.source} (${relativeTime(s.date)})\n`;
      if (s.link) reportText += `  ${s.link}\n`;
    });

    reportText += "\nSix-Month Outlook\n";
    reportText += prediction;

    res.json({ report: reportText });

  } catch (err) {
    console.error("RUN ERROR:", err);
    res.json({
      report: "The system is temporarily unavailable."
    });
  }
});

// ------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🌊 Blue Ocean Browser (SERP-enhanced) running on", PORT);
});