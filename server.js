//////////////////////////////////////////////////////////////
// Blue Ocean Browser — FINAL SERP-DOABLE FORESIGHT SERVER
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

// Match your working reference
const SERP_KEY = process.env.SERPAPI_KEY || null;

// ------------------------------------------------------------
// Utility — relative freshness label
// ------------------------------------------------------------
function relativeTime(dateStr) {
  if (!dateStr) return "recent";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "recent";
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diff <= 1) return "today";
  if (diff <= 7) return `${diff} days ago`;
  return "recent";
}

// ------------------------------------------------------------
// Step 2 — Semantic clarity check (reject nonsense)
// ------------------------------------------------------------
async function isClearTopic(topic) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Is the following text a meaningful topic or question that a human would ask?
Reply ONLY YES or NO.

"${topic}"
`
    }],
    temperature: 0
  });
  return out.choices[0].message.content.trim() === "YES";
}

// ------------------------------------------------------------
// Step 3 — Background rewrite (SERP-DOABLE, event-driven)
// ------------------------------------------------------------
async function rewriteForSerp(topic) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Rewrite the following topic into a short,
NEWS-DOABLE business headline phrase that would
realistically appear in Google News.

Rules:
- Imply real-world action or change
- Business / workforce / policy framing
- Prefer verbs: expands, announces, launches, updates, cuts
- Implicitly reference institutions (companies, governments, universities)
- 5–8 words total
- Neutral, factual tone
- NO opinions
- NO future tense

Input:
"${topic}"

Output:
`
    }],
    temperature: 0
  });
  return out.choices[0].message.content.trim();
}

// ------------------------------------------------------------
// Step 4 — SERP NEWS (reference-aligned, tolerant but real)
// ------------------------------------------------------------
async function fetchSerpSources(rewrittenTopic) {
  let sources = [];
  if (!SERP_KEY) return sources;

  const year = new Date().getFullYear();
  const serpQuery = `${rewrittenTopic} business news ${year}`;

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
// Step 5 — Rank signals by business impact
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

Return ONLY a list of numbers in order.

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
  return ranked.length ? ranked : sources;
}

// ------------------------------------------------------------
// Step 6 — Generate foresight using ranked sources
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
- Reference concrete developments from the news
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
    // SERP-doable rewrite (hidden)
    const rewritten = await rewriteForSerp(topic);

    // Fetch SERP news
    const rawSources = await fetchSerpSources(rewritten);

    // Enforce 3–5 source rule
    if (rawSources.length < 3) {
      return res.json({
        report:
          "Fewer than three verified business news sources were found for this topic. Please try a more specific or timely query."
      });
    }

    // Rank + cap
    const ranked = await rankSignalsByImpact(rawSources);
    const finalSources = ranked.slice(0, 5);

    // Generate foresight
    const prediction = await generatePrediction(topic, finalSources);

    // Build visible report
    let reportText = "Current Signals (Ranked by Business Impact)\n";
    finalSources.forEach(s => {
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
  console.log("🌊 Blue Ocean Browser (SERP-doable, final) running on port", PORT);
});
