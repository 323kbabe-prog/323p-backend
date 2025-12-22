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

// Keep last N Amazon topics to reduce repetition
const AMAZON_TOPIC_MEMORY = [];
const AMAZON_MEMORY_LIMIT = 5;

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
   ⭐ MARKETS — Rewrite market theme
------------------------------------------------------------ */
async function rewriteMarketTheme(input) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Rewrite the following text into a neutral market theme.

Rules:
- 3–7 words
- No stock tickers
- No price direction
- No buy/sell language
- Focus on market attention or capital narratives only

Input:
"${input}"

Output:
`
    }],
    temperature: 0.2
  });
  return out.choices[0].message.content.trim();
}

/* ------------------------------------------------------------
   ⭐ MARKETS — Fetch ONE Reuters article
------------------------------------------------------------ */
async function fetchMarketSignal(theme) {
  if (!SERP_KEY) return null;

  try {
    const q = `${theme} site:reuters.com`;
    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(q)}&num=5&api_key=${SERP_KEY}`;
    const r = await fetch(url);
    const j = await r.json();

    const hit = (j.organic_results || [])[0];
    if (!hit) return null;

    return {
      title: hit.title,
      link: hit.link,
      source: "Reuters"
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------
   ⭐ MARKETS — Extract company name from Reuters title (ONLY X)
------------------------------------------------------------ */
async function extractCompanyNameFromTitle(title) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Extract the primary company name mentioned in the following news headline.

Rules:
- Return ONLY the company name
- No tickers
- No extra words
- If no clear company exists, return "Unknown"

Headline:
"${title}"
`
    }],
    temperature: 0
  });

  return out.choices[0].message.content.trim();
}

/* ------------------------------------------------------------
   AMAZON — A. Wang chooses WHAT TO BUY (UNCHANGED)
------------------------------------------------------------ */
async function generateNextTopicAWang(lastTopic = "") {
  const recent = AMAZON_TOPIC_MEMORY.join(", ");
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
You are A. Wang, an Amazon cosmetics buyer.

Choose ONE cosmetics category or product
that you would consider buying this season.

Avoid choosing anything similar to:
${recent || lastTopic}

Rules:
- Buyer mindset
- Practical, purchase-oriented
- Avoid repetition or near-duplicates
- 4–8 words

Output ONLY the topic.
`
    }],
    temperature: 0.7
  });

  const topic = out.choices[0].message.content.trim();
  AMAZON_TOPIC_MEMORY.push(topic);
  if (AMAZON_TOPIC_MEMORY.length > AMAZON_MEMORY_LIMIT) {
    AMAZON_TOPIC_MEMORY.shift();
  }
  return topic;
}

/* ------------------------------------------------------------
   AMAZON — Find ONE Amazon product via Google (UNCHANGED)
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
   BUSINESS — Fetch ONE LinkedIn job (UNCHANGED)
------------------------------------------------------------ */
async function fetchSingleLinkedInJob(jobTitle) {
  if (!SERP_KEY) return null;

  try {
    const q = `${jobTitle} site:linkedin.com/jobs`;
    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(q)}&num=5&api_key=${SERP_KEY}`;
    const r = await fetch(url);
    const j = await r.json();

    const job = (j.organic_results || []).find(
      x => x.link && x.link.includes("linkedin.com/jobs")
    );

    if (!job) return null;

    return {
      title: job.title || jobTitle,
      link: job.link || "",
      source: "LinkedIn"
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------
   CORE PIPELINE
------------------------------------------------------------ */
async function runPipeline(topic, persona) {

  // ⭐ MARKETS (ONLY X APPLIED)
  if (persona === "MARKETS") {
    const theme = await rewriteMarketTheme(topic);
    const signal = await fetchMarketSignal(theme);
    if (!signal) return { report: "No strong live market signals found." };

    const company = await extractCompanyNameFromTitle(signal.title);

    const body = await generatePredictionBody(
      [{ title: signal.title, source: "Reuters" }],
      "MARKETS"
    );

    let report = "Current Signals (Market Attention)\n";
    report += `Company in focus: ${company}\n\n`;
    report += `• ${signal.title} — Reuters\n`;
    report += `  ${signal.link}\n`;

    return { topic: company, report: report + "\n" + body };
  }

  // BUSINESS (UNCHANGED)
  if (persona === "BUSINESS") {
    const job = await fetchSingleLinkedInJob(topic);
    if (!job) return { report: "No LinkedIn job signals found." };

    const body = await generatePredictionBody(
      [{ title: job.title, source: "LinkedIn" }],
      "BUSINESS"
    );

    let report = "Current Signals (Ranked by Impact Level)\n";
    report += `• ${job.title} — LinkedIn\n`;
    report += `  ${job.link}\n`;

    return { report: report + "\n" + body };
  }

  // AMAZON (UNCHANGED)
  const product = await fetchSingleAmazonProduct(topic);
  if (!product) return { report: "No Amazon product found for this topic." };

  const body = await generatePredictionBody(
    [{ title: product.title, source: "Amazon" }],
    "AMAZON"
  );

  let report = "Current Signals (Ranked by Impact Level)\n";
  report += `• ${product.title} — Amazon\n`;
  report += `  ${product.link}\n`;

  return { report: report + "\n" + body };
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

  if (persona === "MARKETS") {
    const theme = "AI infrastructure stocks";
    const result = await runPipeline(theme, "MARKETS");
    return res.json(result);
  }

  if (persona === "BUSINESS") {
    const result = await generateNextTopicGDJ("", "");
    const report = await runPipeline(result.topic, "BUSINESS");
    return res.json({ topic: result.topic, report: report.report });
  }

  const topic = await generateNextTopicAWang("");
  const report = await runPipeline(topic, "AMAZON");
  res.json({ topic, report: report.report });
});

/* ------------------------------------------------------------
   START SERVER
------------------------------------------------------------ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🌊 Blue Ocean Browser — GD-J + 8-BALL + AMAZON running on port", PORT);
});