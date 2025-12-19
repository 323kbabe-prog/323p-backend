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
   AMAZON ONLY — Google SERP search demand (REAL DATA)
------------------------------------------------------------ */
async function fetchGoogleTopBeautySearches(seed = "beauty products") {
  if (!SERP_KEY) return [];

  try {
    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(seed)}&num=10&api_key=${SERP_KEY}`;
    const r = await fetch(url);
    const j = await r.json();

    const set = new Set();

    if (j.related_searches) {
      j.related_searches.forEach(x => x.query && set.add(x.query.toLowerCase()));
    }

    if (j.organic_results) {
      j.organic_results.forEach(x => x.title && set.add(x.title.toLowerCase()));
    }

    return Array.from(set).slice(0, 10);
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------
   STEP 3 — Fetch SERP Sources (persona-aware)
------------------------------------------------------------ */
async function fetchSerpSources(topic, persona = "BUSINESS") {
  if (!SERP_KEY) return [];

  let query, url;

  if (persona === "AMAZON") {
    // 🔥 Google Web search → Amazon PRODUCT pages only
    query = `${topic} site:amazon.com/dp OR site:amazon.com/gp/product`;
    url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=20&api_key=${SERP_KEY}`;
  } else {
    const year = new Date().getFullYear();
    query = `${topic} business news ${year}`;
    url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&tbm=nws&num=20&api_key=${SERP_KEY}`;
  }

  try {
    const r = await fetch(url);
    const j = await r.json();

    const results = persona === "AMAZON"
      ? (j.organic_results || [])
      : (j.news_results || []);

    return results
      .filter(x =>
        persona !== "AMAZON" ||
        (x.link && (x.link.includes("/dp/") || x.link.includes("/gp/product/")))
      )
      .map(x => ({
        title: x.title || "",
        source: persona === "AMAZON" ? "Amazon" : (x.source || "Unknown"),
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
async function applyAWangFraming(googleQuery) {
  try {
    const out = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `
You are A. Wang, Amazon’s Head of Beauty.

Take this REAL Google search query:
"${googleQuery}"

Rewrite it into an Amazon-buying-focused topic.
Rules:
- Keep original intent
- Emphasize purchasing, sales, or demand
- 6–10 words
- Neutral, analytical tone
- No hype words

Output ONLY the rewritten topic.
`
      }],
      temperature: 0.3
    });

    return out.choices[0].message.content.trim();

  } catch (err) {
    console.error("A. Wang framing failed:", err.message);
    // 🔒 HARD FAILSAFE
    return `top selling ${googleQuery} on amazon`;
  }
}

/* ------------------------------------------------------------
   8-BALL TOPIC GENERATORS
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

async function generateNextTopicAWang() {
  const searches = await fetchGoogleTopBeautySearches("beauty products");
  return searches.length ? searches[0] : "best selling beauty products on amazon";
}

/* ------------------------------------------------------------
   CORE PIPELINE
------------------------------------------------------------ */
async function runPipeline(topic, persona) {
  let baseTopic;

  if (persona === "BUSINESS") {
    baseTopic = await rewriteForSerp(topic);
  } else {
    // AMAZON: topic from Google search demand
    baseTopic = (await fetchGoogleTopBeautySearches(topic))[0] || topic;
  }

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
   /run
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
   /next — 8-BALL
------------------------------------------------------------ */
app.post("/next", async (req, res) => {
  const persona = req.body.persona || "BUSINESS";

  const topic =
    persona === "AMAZON"
      ? await generateNextTopicAWang()
      : await generateNextTopicGDJ();

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