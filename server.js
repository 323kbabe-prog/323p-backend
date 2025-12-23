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

// ------------------------------------------------------------
// Stanford lenses + no-repeat memory (UNCHANGED)
// ------------------------------------------------------------
const STANFORD_MAJORS = [
  "Computer Science","Economics","Management Science and Engineering",
  "Political Science","Psychology","Sociology","Symbolic Systems",
  "Statistics","Electrical Engineering","Biomedical Engineering",
  "Biology","Environmental Science","International Relations",
  "Communication","Design","Education","Philosophy","Law"
];

let LAST_LENS = "";
function pickStanfordLens() {
  const pool = STANFORD_MAJORS.filter(m => m !== LAST_LENS);
  const lens = pool[Math.floor(Math.random() * pool.length)];
  LAST_LENS = lens;
  return lens;
}

// ------------------------------------------------------------
// Entity no-repeat memory (UNCHANGED)
// ------------------------------------------------------------
const AMAZON_TOPIC_MEMORY = [];
const AMAZON_MEMORY_LIMIT = 5;

const BUSINESS_ENTITY_MEMORY = [];
const BUSINESS_MEMORY_LIMIT = 5;

const MARKETS_ENTITY_MEMORY = [];
const MARKETS_MEMORY_LIMIT = 5;

// ------------------------------------------------------------
// Semantic clarity check (UNCHANGED)
// ------------------------------------------------------------
async function isClearTopic(topic) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `Is the following text a meaningful topic a human would search? Reply YES or NO.\n"${topic}"`
    }],
    temperature: 0
  });
  return out.choices[0].message.content.trim() === "YES";
}

// ------------------------------------------------------------
// ⭐ X — dynamic future date label
// ------------------------------------------------------------
function futureDateLabel(months) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

// ------------------------------------------------------------
// MARKETS — rewrite theme (UNCHANGED)
// ------------------------------------------------------------
async function rewriteMarketTheme(input, lens) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Academic lens: ${lens}
Rewrite into a neutral market attention theme focused on AI-related companies.
3–7 words. No tickers. No price language.
Input: "${input}"
`
    }],
    temperature: 0.2
  });
  return out.choices[0].message.content.trim();
}

// ------------------------------------------------------------
// MARKETS — Google News signal (UNCHANGED)
// ------------------------------------------------------------
async function fetchMarketSignal(theme) {
  if (!SERP_KEY) return null;
  const url = `https://serpapi.com/search.json?tbm=nws&q=${encodeURIComponent(theme)}&num=5&api_key=${SERP_KEY}`;
  const r = await fetch(url);
  const j = await r.json();
  const hit = (j.news_results || [])[0];
  if (!hit) return null;
  return { title: hit.title, link: hit.link, source: hit.source || "Google News" };
}

// ------------------------------------------------------------
// MARKETS — extract company name (UNCHANGED)
// ------------------------------------------------------------
async function extractCompanyNameFromTitle(title) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `Extract the primary company name from this headline. Return ONLY the name.\n"${title}"`
    }],
    temperature: 0
  });
  return out.choices[0].message.content.trim() || "Unknown";
}

// ------------------------------------------------------------
// AMAZON — topic generation (UNCHANGED)
// ------------------------------------------------------------
async function generateNextAmazonTopic(lens) {
  const recent = AMAZON_TOPIC_MEMORY.join(", ");
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Academic lens: ${lens}
Choose ONE cosmetics product or beauty category people are likely to buy soon.
Avoid: ${recent}
`
    }],
    temperature: 0.7
  });
  const topic = out.choices[0].message.content.trim();
  AMAZON_TOPIC_MEMORY.push(topic);
  if (AMAZON_TOPIC_MEMORY.length > AMAZON_MEMORY_LIMIT) AMAZON_TOPIC_MEMORY.shift();
  return topic;
}

// ------------------------------------------------------------
// AMAZON — fetch product (UNCHANGED)
// ------------------------------------------------------------
async function fetchSingleAmazonProduct(query) {
  if (!SERP_KEY) return null;
  const q = `${query} site:amazon.com/dp OR site:amazon.com/gp/product`;
  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(q)}&num=5&api_key=${SERP_KEY}`;
  const r = await fetch(url);
  const j = await r.json();
  return (j.organic_results || []).find(x =>
    x.link && (x.link.includes("/dp/") || x.link.includes("/gp/product"))
  );
}

// ------------------------------------------------------------
// BUSINESS — job title via lens (UNCHANGED)
// ------------------------------------------------------------
async function generateNextJobTitle(lens) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Academic lens: ${lens}
Generate ONE real AI job title companies are actively hiring for.
`
    }],
    temperature: 0.7
  });
  return out.choices[0].message.content.trim();
}

// ------------------------------------------------------------
// BUSINESS — LinkedIn SERP (UNCHANGED)
// ------------------------------------------------------------
async function fetchSingleLinkedInJob(jobTitle) {
  if (!SERP_KEY) return null;
  const q = `${jobTitle} site:linkedin.com/jobs`;
  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(q)}&num=5&api_key=${SERP_KEY}`;
  const r = await fetch(url);
  const j = await r.json();
  return (j.organic_results || []).find(x => x.link && x.link.includes("linkedin.com/jobs"));
}

// ------------------------------------------------------------
// ⭐ X — BODY GENERATION WITH REAL HORIZON
// ------------------------------------------------------------
async function generatePredictionBody(sources, persona, months) {
  const signalText = sources.map(s => `• ${s.title} — ${s.source}`).join("\n");

  let horizonInstruction = "";
  if (months === 6) horizonInstruction = "Near-term execution and adoption.";
  if (months === 12) horizonInstruction = "Strategic shifts and organizational change.";
  if (months === 36) horizonInstruction = "Structural, industry-level transformation.";

  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
${horizonInstruction}

Verified real-world signal:
${signalText}

START WITH:
Reality · ${futureDateLabel(months)}

Write EXACTLY 5 short paragraphs.

Then write:
If this prediction is correct, what works:
Write EXACTLY 3 short sentences.
`
    }],
    temperature: 0.3
  });

  return out.choices[0].message.content.trim();
}

// ------------------------------------------------------------
// ⭐ X — CORE PIPELINE WITH MONTHS
// ------------------------------------------------------------
async function runPipeline(topic, persona, months = 6) {

  const lens = pickStanfordLens();

  if (persona === "MARKETS") {
    const theme = await rewriteMarketTheme(topic, lens);
    const signal = await fetchMarketSignal(theme);
    if (!signal) return { report: "No market signal found." };

    const company = await extractCompanyNameFromTitle(signal.title);
    const body = await generatePredictionBody(
      [{ title: signal.title, source: signal.source }],
      "MARKETS",
      months
    );

    return { topic: company, report: body };
  }

  if (persona === "BUSINESS") {
    const jobTitle = await generateNextJobTitle(lens);
    const job = await fetchSingleLinkedInJob(jobTitle);
    if (!job) return { report: "No hiring signal found." };

    const body = await generatePredictionBody(
      [{ title: jobTitle, source: "LinkedIn" }],
      "BUSINESS",
      months
    );

    return { topic: jobTitle, report: body };
  }

  const amazonTopic = await generateNextAmazonTopic(lens);
  const product = await fetchSingleAmazonProduct(amazonTopic);
  if (!product) return { report: "No product found." };

  const body = await generatePredictionBody(
    [{ title: product.title, source: "Amazon" }],
    "AMAZON",
    months
  );

  return { topic: product.title, report: body };
}

// ------------------------------------------------------------
// ROUTES (ONLY X: months passthrough)
// ------------------------------------------------------------
app.post("/run", async (req, res) => {
  const { topic = "", persona = "BUSINESS", months = 6 } = req.body;
  if (!(await isClearTopic(topic))) return res.json({ report: "Invalid topic." });
  res.json(await runPipeline(topic, persona, Number(months)));
});

app.post("/next", async (req, res) => {
  const persona = req.body.persona || "BUSINESS";
  const months = Number(req.body.months || 6);
  const seed = persona === "MARKETS" ? "AI infrastructure" : "";
  res.json(await runPipeline(seed, persona, months));
});

// ------------------------------------------------------------
app.listen(process.env.PORT || 3000, () =>
  console.log("🌊 Blue Ocean Browser running")
);