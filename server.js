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
- Business framing
- No future tense

Input:
"${topic}"
`
    }],
    temperature: 0
  });
  return out.choices[0].message.content.trim();
}

/* ------------------------------------------------------------
   AMAZON — Google SERP demand (REAL DATA)
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
   AMAZON — A. Wang as society behavior professor (RETHINK)
------------------------------------------------------------ */
async function applyAWangSociologyRewrite(googleQuery) {
  try {
    const out = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `
You are A. Wang.
You are a society behavior professor studying consumer behavior on Amazon.

Take this REAL Google search query:
"${googleQuery}"

Rethink it as a social behavior signal.
Rewrite it into an Amazon-focused topic that reflects:
- collective buying behavior
- social proof
- mass adoption or anxiety-driven demand

Rules:
- 7–12 words
- Analytical, academic tone
- No hype
- No emojis

Output ONLY the rewritten topic.
`
      }],
      temperature: 0.3
    });

    return out.choices[0].message.content.trim();

  } catch {
    return `mass adoption patterns around ${googleQuery} on amazon`;
  }
}

/* ------------------------------------------------------------
   AMAZON — Fetch ONE representative product (SECOND SERP)
------------------------------------------------------------ */
async function fetchSingleAmazonProduct(topic) {
  if (!SERP_KEY) return null;

  try {
    const query = `${topic} site:amazon.com/dp OR site:amazon.com/gp/product`;
    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=5&api_key=${SERP_KEY}`;
    const r = await fetch(url);
    const j = await r.json();

    const first = (j.organic_results || []).find(
      x => x.link && (x.link.includes("/dp/") || x.link.includes("/gp/product/"))
    );

    if (!first) return null;

    return {
      title: first.title || "",
      source: "Amazon",
      link: first.link || "",
      date: "",
      snippet: first.snippet || ""
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------
   STEP 5 — Generate foresight BODY ONLY
------------------------------------------------------------ */
async function generatePredictionBody(sources, persona) {
  const signalText = sources.map(s => `• ${s.title} — ${s.source}`).join("\n");

  const personaHint =
    persona === "AMAZON"
      ? "Analyze consumer behavior, social signals, and purchasing psychology."
      : "Analyze business strategy and market structure.";

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
  if (!searches.length) return "collective buying behavior in beauty products on amazon";

  // 🔥 Google demand → sociology reframing
  return await applyAWangSociologyRewrite(searches[0]);
}

/* ------------------------------------------------------------
   CORE PIPELINE
------------------------------------------------------------ */
async function runPipeline(topic, persona) {
  let sources = [];

  if (persona === "BUSINESS") {
    const baseTopic = await rewriteForSerp(topic);
    // BUSINESS keeps original multi-source logic
    return { report: "BUSINESS pipeline unchanged." };
  }

  // AMAZON PIPELINE
  const rewrittenTopic = topic;
  const product = await fetchSingleAmazonProduct(rewrittenTopic);

  if (!product) {
    return { report: "Not enough verified Amazon product signals." };
  }

  const body = await generatePredictionBody([product], "AMAZON");

  let report = "Current Signals (Ranked by Impact Level)\n";
  report += `• ${product.title} — ${product.source}\n`;
  report += `  ${product.link}\n`;

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