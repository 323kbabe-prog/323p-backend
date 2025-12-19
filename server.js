//////////////////////////////////////////////////////////////
// Blue Ocean Browser — REAL AI GD-J + AMAZON (STATELESS)
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
   STEP 2 — Rewrite into SERP-doable headline (BUSINESS ONLY)
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
- Implies real-world change
- No opinions
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
   STEP 3 — Fetch SERP Sources (PERSONA-LOCKED)
------------------------------------------------------------ */
async function fetchSerpSources(queryTerm, persona) {
  if (!SERP_KEY) return [];

  try {
    // BUSINESS = Google News
    if (persona === "BUSINESS") {
      const year = new Date().getFullYear();
      const q = `${queryTerm} business news ${year}`;
      const url = `https://serpapi.com/search.json?q=${encodeURIComponent(q)}&tbm=nws&num=20&api_key=${SERP_KEY}`;
      const r = await fetch(url);
      const j = await r.json();

      return (j.news_results || []).map(x => ({
        title: x.title || "",
        source: x.source || "Unknown",
        link: x.link || "",
        date: x.date || "",
        snippet: x.snippet || ""
      }));
    }

    // AMAZON = PRODUCT PAGES ONLY
    const amazonQuery =
      `${queryTerm} site:amazon.com (beauty OR skincare OR makeup OR haircare OR fragrance)`;

    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(amazonQuery)}&num=30&api_key=${SERP_KEY}`;
    const r = await fetch(url);
    const j = await r.json();

    return (j.organic_results || [])
      .map(x => ({
        title: x.title || "",
        source: "Amazon",
        link: x.link || "",
        date: "",
        snippet: x.snippet || ""
      }))
      .filter(it => {
        const u = (it.link || "").toLowerCase();
        return (
          u.includes("amazon.com") &&
          (u.includes("/dp/") ||
           u.includes("/gp/product/") ||
           u.includes("/gp/aw/d/"))
        );
      });

  } catch {
    return [];
  }
}

/* ------------------------------------------------------------
   STEP 4A — Rank BUSINESS signals (unchanged)
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

  const order = out.choices[0].message.content.match(/\d+/g)?.map(n => +n - 1) || [];
  return order.map(i => sources[i]).filter(Boolean);
}

/* ------------------------------------------------------------
   STEP 4B — Rank AMAZON signals (PURCHASE INTENT)
------------------------------------------------------------ */
async function rankAmazonPurchaseSignals(sources) {
  if (sources.length < 2) return sources;

  const list = sources.map(
    (s, i) => `${i + 1}. ${s.title}`
  ).join("\n");

  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Rank the following Amazon product pages by
PURCHASE SIGNAL STRENGTH over the next 6 months.

Signals include:
- Bundles / value packs
- Subscribe & Save
- Dupes
- Refill / eco language
- Price efficiency

Return ONLY ordered list of numbers.

${list}
`
    }],
    temperature: 0
  });

  const order = out.choices[0].message.content.match(/\d+/g)?.map(n => +n - 1) || [];
  return order.map(i => sources[i]).filter(Boolean);
}

/* ------------------------------------------------------------
   STEP 5 — Generate foresight (persona-aware)
------------------------------------------------------------ */
async function generatePrediction(topic, sources, persona) {
  const signalText = sources.map(s => `• ${s.title}`).join("\n");

  const system =
    persona === "AMAZON"
      ? `You are an Amazon beauty purchasing foresight engine.
         Focus ONLY on buying behavior, pricing, bundles, and methods.`
      : `You are an AI business foresight system.`;

  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "system",
      content: system
    },{
      role: "user",
      content: `
Title:
${topic}

Generate a date exactly six months from today.

Verified signals:
${signalText}

Rules:
- No hype
- No news commentary
- Write as if six months already passed
`
    }],
    temperature: 0.3
  });

  return out.choices[0].message.content.trim();
}

/* ------------------------------------------------------------
   CORE PIPELINE
------------------------------------------------------------ */
async function runPipeline(topic, persona) {
  const query =
    persona === "AMAZON" ? topic : await rewriteForSerp(topic);

  const sources = await fetchSerpSources(query, persona);

  if (sources.length < 3) {
    return { report: "Not enough verified sources." };
  }

  const ranked =
    persona === "AMAZON"
      ? await rankAmazonPurchaseSignals(sources)
      : await rankSignalsByImpact(sources);

  const finalSources = ranked.slice(0, 10);
  const prediction = await generatePrediction(topic, finalSources, persona);

  let report = "Current Signals\n";
  finalSources.forEach(s => {
    report += `• ${s.title}\n`;
    if (s.link) report += `  ${s.link}\n`;
  });

  report += "\n" + prediction;
  return { report };
}

/* ------------------------------------------------------------
   ROUTES
------------------------------------------------------------ */
app.post("/run", async (req, res) => {
  const { topic = "", persona = "BUSINESS" } = req.body;

  if (!(await isClearTopic(topic))) {
    return res.json({ report: "Invalid topic." });
  }

  res.json(await runPipeline(topic, persona));
});

app.post("/next", async (req, res) => {
  const { lastTopic = "", persona = "BUSINESS" } = req.body;

  const topic =
    persona === "AMAZON"
      ? await generateNextTopicAmazon(lastTopic)
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
  console.log("🌊 Blue Ocean Browser — GD-J + AMAZON running on port", PORT);
});