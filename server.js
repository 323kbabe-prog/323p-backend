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
   BUSINESS — Rewrite topic for SERP
------------------------------------------------------------ */
async function rewriteForSerp(topic) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Rewrite into a short business / job-market headline.

Rules:
- 5–8 words
- Neutral, factual
- No future tense

"${topic}"
`
    }],
    temperature: 0
  });
  return out.choices[0].message.content.trim();
}

/* ------------------------------------------------------------
   AMAZON — Pick ONE product via Google
------------------------------------------------------------ */
async function fetchSingleAmazonProduct(query) {
  if (!SERP_KEY) return null;

  const q = `${query} site:amazon.com/dp OR site:amazon.com/gp/product`;
  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(q)}&num=5&api_key=${SERP_KEY}`;

  try {
    const r = await fetch(url);
    const j = await r.json();

    const p = (j.organic_results || []).find(
      x => x.link && (x.link.includes("/dp/") || x.link.includes("/gp/product/"))
    );

    if (!p) return null;

    return { title: p.title || "", link: p.link || "" };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------
   WHY THIS (shared logic)
------------------------------------------------------------ */
async function generateWhyLine(title, persona) {
  const label = persona === "AMAZON" ? "product" : "job";

  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Explain why this ${label} matters right now.

${label.toUpperCase()}:
"${title}"

Rules:
- 2–3 sentences
- Analytical, grounded in behavior or market demand
- No hype
- No future predictions
`
    }],
    temperature: 0.3
  });

  return `Why this ${label}:\n${out.choices[0].message.content.trim()}\n`;
}

/* ------------------------------------------------------------
   Fetch BUSINESS news (LinkedIn-style)
------------------------------------------------------------ */
async function fetchBusinessNews(topic) {
  if (!SERP_KEY) return [];
  const year = new Date().getFullYear();
  const q = `${topic} hiring jobs LinkedIn ${year}`;
  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(q)}&tbm=nws&num=10&api_key=${SERP_KEY}`;

  try {
    const r = await fetch(url);
    const j = await r.json();
    return j.news_results || [];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------
   Generate foresight body
------------------------------------------------------------ */
async function generatePredictionBody(sources, persona) {
  const signalText = sources.map(s => `• ${s.title}`).join("\n");

  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Write as if six months have already passed.

Verified signals:
${signalText}

Write ONLY:

Six-Month Reality:
- 3 short paragraphs

What Breaks If This Forecast Is Wrong:
- 3 bullet points
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

  /* ================= BUSINESS (LinkedIn) ================= */
  if (persona === "BUSINESS") {
    const headline = await rewriteForSerp(topic);
    const news = await fetchBusinessNews(headline);
    if (news.length < 3) return { report: "Not enough verified sources." };

    const why = await generateWhyLine(headline, "BUSINESS");
    const body = await generatePredictionBody(news, "BUSINESS");

    let report = why + "\n";
    report += "Current Signals (Ranked by Impact Level)\n";
    news.slice(0, 5).forEach(n => {
      report += `• ${n.title}\n  ${n.link}\n`;
    });

    report += "\n" + body;
    return { topic: headline, report };
  }

  /* ================= AMAZON ================= */
  const product = await fetchSingleAmazonProduct(topic);
  if (!product) return { report: "No Amazon product found." };

  const why = await generateWhyLine(product.title, "AMAZON");
  const body = await generatePredictionBody([{ title: product.title }], "AMAZON");

  let report = why + "\n";
  report += "Current Signals (Ranked by Impact Level)\n";
  report += `• ${product.title}\n  ${product.link}\n\n`;
  report += body;

  return { topic: product.title, report };
}

/* ------------------------------------------------------------
   ROUTES
------------------------------------------------------------ */
app.post("/run", async (req, res) => {
  const { topic = "", persona = "BUSINESS" } = req.body;
  if (!(await isClearTopic(topic))) {
    return res.json({ report: "Invalid topic." });
  }
  res.json(await runPipeline(topic.trim(), persona));
});

app.post("/next", async (req, res) => {
  const { lastTopic = "", persona = "BUSINESS" } = req.body;
  const seed = persona === "AMAZON" ? "Cosmetics products" : lastTopic || "Hiring trends";
  const result = await runPipeline(seed, persona);
  res.json(result);
});

/* ------------------------------------------------------------
   START SERVER
------------------------------------------------------------ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🌊 Blue Ocean Browser running on port", PORT);
});