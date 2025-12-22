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

// ⭐ MARKETS — Reuters anchor
const MARKETS_SIGNAL_SOURCE = {
  name: "Reuters",
  url: "https://www.reuters.com"
};

// ⭐ MEMORY (X)
const MARKET_THEME_MEMORY = [];
const MARKET_MEMORY_LIMIT = 5;

const AMAZON_TOPIC_MEMORY = [];
const AMAZON_MEMORY_LIMIT = 5;

/* ------------------------------------------------------------
   STANFORD MAJORS (LENS)
------------------------------------------------------------ */
const STANFORD_MAJORS = [
  "Computer Science",
  "Economics",
  "Electrical Engineering",
  "Statistics",
  "Political Science",
  "Environmental Science",
  "International Relations",
  "Management Science and Engineering"
];

function pickNextMajor(last = "") {
  const pool = STANFORD_MAJORS.filter(m => m !== last);
  return pool[Math.floor(Math.random() * pool.length)];
}

/* ------------------------------------------------------------
   Semantic clarity check
------------------------------------------------------------ */
async function isClearTopic(topic) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: `Reply YES or NO: "${topic}"` }],
    temperature: 0
  });
  return out.choices[0].message.content.trim() === "YES";
}

/* ------------------------------------------------------------
   MARKETS — Lens-aware theme rewrite (X)
------------------------------------------------------------ */
async function rewriteMarketTheme(input, major) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Using the academic lens: ${major}

Rewrite into a neutral market theme.
Rules:
- 3–7 words
- No tickers
- No buy/sell language

Input: "${input}"
`
    }],
    temperature: 0.2
  });

  const theme = out.choices[0].message.content.trim();

  MARKET_THEME_MEMORY.push(theme);
  if (MARKET_THEME_MEMORY.length > MARKET_MEMORY_LIMIT) {
    MARKET_THEME_MEMORY.shift();
  }

  return theme;
}

/* ------------------------------------------------------------
   MARKETS — Reuters SERP
------------------------------------------------------------ */
async function fetchMarketSignal(theme) {
  if (!SERP_KEY) return null;

  const q = `${theme} site:reuters.com`;
  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(q)}&num=5&api_key=${SERP_KEY}`;
  const r = await fetch(url);
  const j = await r.json();

  const hit = (j.organic_results || []).find(x => x.link?.includes("reuters.com"));
  if (!hit) return null;

  return { title: hit.title, link: hit.link, source: "Reuters" };
}

/* ------------------------------------------------------------
   MARKETS — Company extraction
------------------------------------------------------------ */
async function extractCompanyNameFromTitle(title) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `Return ONLY the primary company name from: "${title}"`
    }],
    temperature: 0
  });
  return out.choices[0].message.content.trim() || "Unknown";
}

/* ------------------------------------------------------------
   BUSINESS — Job generator (X: major-aware)
------------------------------------------------------------ */
async function generateNextBusinessTopic(major) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Using the academic lens: ${major}
Generate ONE realistic job title hiring now.
`
    }],
    temperature: 0.7
  });

  return out.choices[0].message.content.trim();
}

/* ------------------------------------------------------------
   BUSINESS — LinkedIn SERP
------------------------------------------------------------ */
async function fetchSingleLinkedInJob(jobTitle) {
  if (!SERP_KEY) return null;

  const q = `${jobTitle} site:linkedin.com/jobs`;
  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(q)}&num=5&api_key=${SERP_KEY}`;
  const r = await fetch(url);
  const j = await r.json();

  const job = (j.organic_results || []).find(x => x.link?.includes("linkedin.com/jobs"));
  if (!job) return null;

  return { title: job.title, link: job.link, source: "LinkedIn" };
}

/* ------------------------------------------------------------
   Prediction body (unchanged)
------------------------------------------------------------ */
async function generatePredictionBody(sources, persona) {
  const signalText = sources.map(s => `• ${s.title} — ${s.source}`).join("\n");

  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Verified real-world signal:
${signalText}

Reality · Next six months:
Write 5 short paragraphs.

If correct, what works:
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

  if (persona === "MARKETS") {
    const major = pickNextMajor(MARKET_THEME_MEMORY.at(-1));
    const theme = await rewriteMarketTheme(topic, major);
    const signal = await fetchMarketSignal(theme);
    if (!signal) return { report: "No live market signal." };

    const company = await extractCompanyNameFromTitle(signal.title);
    const body = await generatePredictionBody([{ title: signal.title, source: "Reuters" }], "MARKETS");

    return {
      topic: company,
      report:
        `Current Signals (Market Attention)\n` +
        `Lens: ${major}\n` +
        `Company in focus: ${company}\n\n` +
        `• ${signal.title} — Reuters\n  ${signal.link}\n\n` +
        body
    };
  }

  if (persona === "BUSINESS") {
    const major = pickNextMajor();
    const jobTitle = await generateNextBusinessTopic(major);
    const job = await fetchSingleLinkedInJob(jobTitle);
    if (!job) return { report: "No hiring signals found." };

    const body = await generatePredictionBody([{ title: job.title, source: "LinkedIn" }], "BUSINESS");

    return {
      topic: job.title,
      report:
        `Current Signals (Hiring)\n` +
        `Lens: ${major}\n\n` +
        `• ${job.title} — LinkedIn\n  ${job.link}\n\n` +
        body
    };
  }

  // AMAZON unchanged
  return { report: "Amazon unchanged." };
}

/* ------------------------------------------------------------
   /run
------------------------------------------------------------ */
app.post("/run", async (req, res) => {
  const { topic, persona = "BUSINESS" } = req.body;
  if (!(await isClearTopic(topic))) return res.json({ report: "Invalid topic." });
  res.json(await runPipeline(topic, persona));
});

/* ------------------------------------------------------------
   /next
------------------------------------------------------------ */
app.post("/next", async (req, res) => {
  const { persona = "BUSINESS" } = req.body;
  const seed = persona === "MARKETS" ? "AI infrastructure" : "future hiring";
  res.json(await runPipeline(seed, persona));
});

/* ------------------------------------------------------------
   START SERVER
------------------------------------------------------------ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🌊 Blue Ocean Browser running on port", PORT);
});