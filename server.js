//////////////////////////////////////////////////////////////
// Blue Ocean Browser — REAL AI GD-J + 8-BALL + AMAZON (STATELESS)
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

const SERP_KEY = process.env.SERPAPI_KEY || null;

/* ------------------------------------------------------------
   Utility — relative freshness label
------------------------------------------------------------ */
function relativeTime(dateStr) {
  if (!dateStr) return "recent";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "recent";
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diff <= 1) return "today";
  if (diff <= 7) return `${diff} days ago`;
  return "recent";
}

/* ------------------------------------------------------------
   STEP 1 — Semantic clarity check
------------------------------------------------------------ */
async function isClearTopic(topic) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Is the following text a meaningful topic or question
that a human would realistically search?
Reply ONLY YES or NO.

"${topic}"
`
    }],
    temperature: 0
  });
  return out.choices[0].message.content.trim() === "YES";
}

/* ------------------------------------------------------------
   STEP 2 — Rewrite topic for SERP (BUSINESS only)
------------------------------------------------------------ */
async function rewriteForSerp(topic) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Rewrite the following topic into a short,
NEWS-DOABLE business headline phrase.

Rules:
- 5–8 words
- Neutral, factual tone
- Business / industry framing
- No future tense

Input:
"${topic}"

Output:
`
    }],
    temperature: 0
  });
  return out.choices[0].message.content.trim();
}

/* ------------------------------------------------------------
   STEP 3 — Fetch SERP News (persona-aware)
------------------------------------------------------------ */
async function fetchSerpSources(topic, persona = "BUSINESS") {
  if (!SERP_KEY) return [];

  let query;
  if (persona === "AMAZON") {
    query = `${topic} site:amazon.com OR site:aboutamazon.com OR site:sellercentral.amazon.com`;
  } else {
    const year = new Date().getFullYear();
    query = `${topic} business news ${year}`;
  }

  try {
    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&tbm=nws&num=20&api_key=${SERP_KEY}`;
    const r = await fetch(url);
    const j = await r.json();

    return (j.news_results || []).map(x => ({
      title: x.title || "",
      source: x.source || "Unknown",
      link: x.link || "",
      date: x.date || "",
      snippet: x.snippet || ""
    }));
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------
   STEP 4 — Rank signals by impact
------------------------------------------------------------ */
async function rankSignalsByImpact(sources) {
  if (sources.length < 2) return sources;

  const list = sources.map(
    (s, i) => `${i + 1}. ${s.title} — ${s.source}`
  ).join("\n");

  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Rank the following headlines by expected BUSINESS IMPACT
over the next 3–6 months.
Return ONLY the ordered list of numbers.

${list}
`
    }],
    temperature: 0
  });

  const order = out.choices[0].message.content
    .match(/\d+/g)
    ?.map(n => parseInt(n, 10) - 1) || [];

  return order.map(i => sources[i]).filter(Boolean);
}

/* ------------------------------------------------------------
   STEP 5 — Generate foresight BODY ONLY
------------------------------------------------------------ */
async function generatePredictionBody(sources, persona) {
  const signalText = sources.map(s => `• ${s.title} — ${s.source}`).join("\n");

  const personaHint =
    persona === "AMAZON"
      ? "Focus on buying behavior, pricing, demand, and purchasing strategy."
      : "Focus on business strategy, market structure, and decision-making.";

  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
You are an AI foresight system.
${personaHint}

Verified signals:
${signalText}

Write ONLY:
Six-Month Reality:
- 3–5 short paragraphs

What Breaks If This Forecast Is Wrong:
- 3–5 bullet points
`
    }],
    temperature: 0.3
  });

  return out.choices[0].message.content.trim();
}

/* ------------------------------------------------------------
   8-BALL TOPIC GENERATORS (RESTORED)
------------------------------------------------------------ */
async function generateNextTopicGDJ(lastTopic = "") {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
You are GD-J, an analytical business thinker.

Generate ONE future-facing business topic
for the next 3–6 months.
Avoid repeating: "${lastTopic}"

Output ONLY the topic text.
`
    }],
    temperature: 0.6
  });
  return out.choices[0].message.content.trim();
}

async function generateNextTopicAWang(lastTopic = "") {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
You are A. Wang, Amazon’s Head of Beauty.
Generate ONE purchasing-focused topic about what people are buying in beauty on Amazon, and include the specific product and brand.
in the next 3–6 months.
Avoid repeating: "${lastTopic}"

Output ONLY the topic text.
`
    }],
    temperature: 0.6
  });
  return out.choices[0].message.content.trim();
}

/* ------------------------------------------------------------
   CORE PIPELINE
------------------------------------------------------------ */
async function runPipeline(topic, persona) {
  const baseTopic = persona === "BUSINESS" ? await rewriteForSerp(topic) : topic;
  const sources = await fetchSerpSources(baseTopic, persona);

  if (sources.length < 3) {
    return { report: "Not enough verified sources." };
  }

  const ranked = await rankSignalsByImpact(sources);
  const body = await generatePredictionBody(ranked.slice(0, 10), persona);

  let report = "Current Signals (Ranked by Impact Level)\n";
  ranked.slice(0, 10).forEach(s => {
    report += `• ${s.title} — ${s.source} (${relativeTime(s.date)})\n`;
    if (s.link) report += `  ${s.link}\n`;
  });

  report += "\n" + body;
  return { report };
}

/* ------------------------------------------------------------
   /run — run with provided topic
------------------------------------------------------------ */
app.post("/run", async (req, res) => {
  const topic = (req.body.topic || "").trim();
  const persona = req.body.persona || "BUSINESS";

  if (!(await isClearTopic(topic))) {
    return res.json({ report: "Invalid topic." });
  }

  res.json(await runPipeline(topic, persona));
});

/* ------------------------------------------------------------
   /next — 8-BALL (generate NEW topic first)
------------------------------------------------------------ */
app.post("/next", async (req, res) => {
  const lastTopic = (req.body.lastTopic || "").trim();
  const persona = req.body.persona || "BUSINESS";

  const topic =
    persona === "AMAZON"
      ? await generateNextTopicAWang(lastTopic)
      : await generateNextTopicGDJ(lastTopic);

  if (!(await isClearTopic(topic))) {
    return res.json({ report: "Persona failed to generate topic." });
  }

  const result = await runPipeline(topic, persona);
  res.json({ topic, report: result.report });
});

/* ------------------------------------------------------------
   START SERVER
------------------------------------------------------------ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🌊 Blue Ocean Browser — GD-J + 8-BALL + AMAZON running on port", PORT);
});