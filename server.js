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
   REAL STANFORD UNIVERSITY MAJORS (BUSINESS LENSES)
------------------------------------------------------------ */
const STANFORD_MAJORS = [
  "Computer Science",
  "Economics",
  "Management Science and Engineering",
  "Political Science",
  "Psychology",
  "Sociology",
  "Symbolic Systems",
  "Statistics",
  "Electrical Engineering",
  "Biomedical Engineering",
  "Biology",
  "Environmental Science",
  "International Relations",
  "Communication",
  "Design",
  "Education",
  "Philosophy",
  "Law"
];

function pickNextMajor(lastMajor = "") {
  const pool = STANFORD_MAJORS.filter(m => m !== lastMajor);
  return pool[Math.floor(Math.random() * pool.length)];
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

Output:
`
    }],
    temperature: 0
  });
  return out.choices[0].message.content.trim();
}

/* ------------------------------------------------------------
   AMAZON — A. Wang chooses WHAT TO BUY (unchanged)
------------------------------------------------------------ */
async function generateNextTopicAWang(lastTopic = "") {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
You are A. Wang, an Amazon cosmetics buyer.

Choose ONE cosmetics category or product
that you would consider buying this season.

Rules:
- Buyer mindset
- Practical, purchase-oriented
- Can be a product type or specific item
- Avoid repeating: "${lastTopic}"
- 4–8 words

Output ONLY the topic.
`
    }],
    temperature: 0.7
  });

  return out.choices[0].message.content.trim();
}

/* ------------------------------------------------------------
   AMAZON — Find ONE Amazon product via Google
------------------------------------------------------------ */
async function fetchSingleAmazonProduct(query) {
  if (!SERP_KEY) return null;

  try {
    const q = `${query} site:amazon.com/dp OR site:amazon.com/gp/product`;
    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(q)}&num=5&api_key=${SERP_KEY}`;
    const r = await fetch(url);
    const j = await r.json();

    const product = (j.organic_results || []).find(
      x => x.link && (x.link.includes("/dp/") || x.link.includes("/gp/product/"))
    );

    if (!product) return null;

    return {
      title: product.title || "",
      link: product.link || "",
      source: "Amazon"
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------
   STEP 3 — Fetch SERP Sources (BUSINESS unchanged)
------------------------------------------------------------ */
async function fetchSerpSources(topic, persona = "BUSINESS") {
  if (!SERP_KEY) return [];

  const year = new Date().getFullYear();
  const query = `${topic} business news ${year}`;
  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&tbm=nws&num=20&api_key=${SERP_KEY}`;

  try {
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
   STEP 4 — Rank signals by impact (unchanged)
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
      ? "Analyze purchasing rationale, price sensitivity, and buyer behavior."
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
async function generateNextTopicGDJ(lastTopic = "", lastMajor = "") {
  const major = pickNextMajor(lastMajor);

  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
You are GD-J, an analytical business thinker.

Academic lens:
${major} (Stanford University)

Task:
Generate ONE future-facing business topic
for the next 3–6 months.

Rules:
- View the topic through the academic lens above
- Relevant to real-world business decisions
- Avoid repeating: "${lastTopic}"
- Neutral, analytical tone
- Output ONLY the topic text
`
    }],
    temperature: 0.7
  });

  return {
    topic: out.choices[0].message.content.trim(),
    major
  };
}

/* ------------------------------------------------------------
   CORE PIPELINE
------------------------------------------------------------ */
async function runPipeline(topic, persona) {

  // BUSINESS
  if (persona === "BUSINESS") {
    const baseTopic = await rewriteForSerp(topic);
    const sources = await fetchSerpSources(baseTopic, "BUSINESS");
    if (sources.length < 3) return { report: "Not enough verified sources." };

    const ranked = await rankSignalsByImpact(sources);
    const body = await generatePredictionBody(ranked.slice(0,10), "BUSINESS");

    let report = "Current Signals (Ranked by Impact Level)\n";
    ranked.slice(0,10).forEach(s=>{
      report += `• ${s.title} — ${s.source} (${relativeTime(s.date)})\n`;
      if (s.link) report += `  ${s.link}\n`;
    });

    return { report: report + "\n" + body };
  }

  // AMAZON (unchanged)
  const product = await fetchSingleAmazonProduct(topic);
  if (!product) {
    return { report: "No Amazon product found for this topic." };
  }

  const brand = product.title.split(" ")[0];
  const body = await generatePredictionBody(
    [{ title: product.title, source: "Amazon" }],
    "AMAZON"
  );

  let report = "Current Signals (Ranked by Impact Level)\n";
  report += `• ${product.title} — ${brand}\n`;
  report += `  ${product.link}\n`;

  return {
    topic: `${brand} ${topic}`,
    report: report + "\n" + body
  };
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
  const lastTopic = (req.body.lastTopic || "").trim();
  const lastMajor = (req.body.lastMajor || "").trim();

  if (persona === "BUSINESS") {
    const result = await generateNextTopicGDJ(lastTopic, lastMajor);
    const report = await runPipeline(result.topic, "BUSINESS");

    res.json({
      topic: result.topic,
      major: result.major,
      report: report.report
    });
    return;
  }

  const topic = await generateNextTopicAWang(lastTopic);
  const report = await runPipeline(topic, "AMAZON");

  res.json({ topic: report.topic || topic, report: report.report });
});

/* ------------------------------------------------------------
   START SERVER
------------------------------------------------------------ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🌊 Blue Ocean Browser — GD-J + 8-BALL + AMAZON running on port", PORT);
});