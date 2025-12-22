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

// ------------------------------------------------------------
// Stanford lenses + no-repeat memory (X)
// ------------------------------------------------------------
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

let LAST_LENS = "";

function pickStanfordLens() {
  const pool = STANFORD_MAJORS.filter(m => m !== LAST_LENS);
  const lens = pool[Math.floor(Math.random() * pool.length)];
  LAST_LENS = lens;
  return lens;
}

// ------------------------------------------------------------
// Entity no-repeat memory (per persona)
// ------------------------------------------------------------
const AMAZON_TOPIC_MEMORY = [];
const AMAZON_MEMORY_LIMIT = 5;

const BUSINESS_ENTITY_MEMORY = [];
const BUSINESS_MEMORY_LIMIT = 5;

const MARKETS_ENTITY_MEMORY = [];
const MARKETS_MEMORY_LIMIT = 5;
// ------------------------------------------------------------
// STEP 1 — Semantic clarity check (unchanged)
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
// MARKETS — rewrite theme using lens (X)
// ------------------------------------------------------------
async function rewriteMarketTheme(input, lens) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Academic lens: ${lens}

Rewrite into a neutral market attention theme.
Rules:
- 3–7 words
- No tickers
- No price language
- Capital / attention narrative only

Input: "${input}"
`
    }],
    temperature: 0.2
  });
  return out.choices[0].message.content.trim();
}

// ------------------------------------------------------------
// MARKETS — Google Finance signal (UPDATED)
// ------------------------------------------------------------
async function fetchMarketSignal(theme) {
  if (!SERP_KEY) return null;

  try {
    const url = `https://serpapi.com/search.json?tbm=nws&q=${encodeURIComponent(
      theme
    )}&num=5&api_key=${SERP_KEY}`;

    const r = await fetch(url);
    const j = await r.json();

    const hit = (j.news_results || [])[0];
    if (!hit) return null;

    return {
      title: hit.title,
      link: hit.link,
      source: hit.source || "Google News"
    };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------
// MARKETS — extract company name (X)
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
// AMAZON — topic generation using lens (X)
// ------------------------------------------------------------
async function generateNextAmazonTopic(lens) {
  const recent = AMAZON_TOPIC_MEMORY.join(", ");
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Academic lens: ${lens}

Choose ONE real-world cosmetics product or beauty category with strong near-term consumer buying interest.

Rules:
- Buyer mindset
- Everyday consumer goods
- Avoid repetition
- 4–8 words

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
// AMAZON — fetch product (unchanged)
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
// BUSINESS — job title via lens (X)
// ------------------------------------------------------------
async function generateNextJobTitle(lens) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Academic lens: ${lens}

Generate ONE real AI job title companies are actively recruiting for right now.
Output ONLY the job title.
`
    }],
    temperature: 0.7
  });
  return out.choices[0].message.content.trim();
}

// ------------------------------------------------------------
// BUSINESS — LinkedIn SERP (unchanged)
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
// 6-month future date label (REQUIRED)
// ------------------------------------------------------------
function sixMonthDateLabel() {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

// ------------------------------------------------------------
// BODY GENERATION (persona-aware, SAME structure)
// ------------------------------------------------------------
async function generatePredictionBody(sources, persona) {
  const signalText = sources
    .map(s => `• ${s.title} — ${s.source}`)
    .join("\n");

  let personaInstruction = "";

  // ---------------- AMAZON (COSMETICS ONLY) ----------------
  if (persona === "AMAZON") {
    personaInstruction = `
You are an AI product-use analyst.

Scope:
- Cosmetics and personal beauty products ONLY

Focus on:
- What this cosmetic product actually does
- Core functional features (ingredients, formulation, usage)
- How users apply it in daily routines
- What skin, beauty, or self-care problem it solves
- Where users feel supported, understood, and empowered

DO NOT discuss:
- Brand strategy
- Market share
- Pricing tactics
- Competitors
- General retail trends
`;
  }

  // ---------------- BUSINESS (JOB MARKET) ----------------
  else if (persona === "BUSINESS") {
    personaInstruction = `
You are an AI labor-market foresight analyst.

Focus on:
- Core responsibilities of this role
- Skills and experience companies expect
- Why organizations are hiring for this role now
- How the role may evolve over the next six months
- Changes in workflows, tools, or team structure

DO NOT:
- Give career advice
- Recommend specific companies
- Discuss salaries or compensation
`;
  }

  // ---------------- MARKETS (STOCK / COMPANY SIGNALS) ----------------
  else if (persona === "MARKETS") {
    personaInstruction = `
You are an AI market signal analyst.

Focus ONLY on:
- Company-level attention and visibility
- Capital flow narratives
- Strategic positioning and momentum
- How institutions, media, or sectors are reacting

DO NOT:
- Predict stock prices
- Give investment advice
- Suggest buying or selling
- Mention price targets or tickers
`;
  }

  // ---------------- SAFETY FALLBACK ----------------
  else {
    personaInstruction = `
You are an AI analyst producing neutral foresight from real-world signals.
`;
  }

  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
${personaInstruction}

Verified real-world signal:
${signalText}

START WITH THIS LINE EXACTLY:
Reality · ${sixMonthDateLabel()}

Write a 6-month foresight.

Rules:
- EXACTLY 5 short paragraphs
- Neutral, analytical tone
- No markdown symbols (**, ###, -, *)
- No bullet points in the paragraphs

Then write this section header exactly:
If this prediction is correct, what works:

Then write EXACTLY 3 short sentences.
No bullets. No numbering. No markdown.
`
    }],
    temperature: 0.3
  });

  return out.choices[0].message.content.trim();
}

// ------------------------------------------------------------
// CORE PIPELINE (X applied only inside)
// ------------------------------------------------------------
async function runPipeline(topic, persona) {

  const lens = pickStanfordLens();

  if (persona === "MARKETS") {
    const theme = await rewriteMarketTheme(topic, lens);
    const signal = await fetchMarketSignal(theme);
    if (!signal) return { report: "No market signal found." };

    let company = await extractCompanyNameFromTitle(signal.title);
let attempts = 0;

while (
  MARKETS_ENTITY_MEMORY.includes(company) &&
  attempts < 3
) {
  const retryTheme = await rewriteMarketTheme(topic, pickStanfordLens());
  const retrySignal = await fetchMarketSignal(retryTheme);
  if (!retrySignal) break;

  company = await extractCompanyNameFromTitle(retrySignal.title);
  attempts++;
}

MARKETS_ENTITY_MEMORY.push(company);
if (MARKETS_ENTITY_MEMORY.length > MARKETS_MEMORY_LIMIT) {
  MARKETS_ENTITY_MEMORY.shift();
}
    const body = await generatePredictionBody([{ title: signal.title, source: "Reuters" }], "MARKETS");

    return {
      topic: company,
      report: `Current Signals\n• ${signal.title} — Google News\n${signal.link}\n\n${body}`
    };
  }

  if (persona === "BUSINESS") {
    let jobTitle;
let attempts = 0;

do {
  jobTitle = await generateNextJobTitle(lens);
  attempts++;
} while (
  BUSINESS_ENTITY_MEMORY.includes(jobTitle) &&
  attempts < 3
);

BUSINESS_ENTITY_MEMORY.push(jobTitle);
if (BUSINESS_ENTITY_MEMORY.length > BUSINESS_MEMORY_LIMIT) {
  BUSINESS_ENTITY_MEMORY.shift();
}
    const job = await fetchSingleLinkedInJob(jobTitle);
    if (!job) return { report: "No hiring signal found." };

    const body = await generatePredictionBody([{ title: jobTitle, source: "LinkedIn" }], "BUSINESS");
    return { topic: jobTitle, report: `• ${jobTitle} — LinkedIn\n${job.link}\n\n${body}` };
  }

  const amazonTopic = await generateNextAmazonTopic(lens);
  const product = await fetchSingleAmazonProduct(amazonTopic);
  if (!product) return { report: "No product found." };

  const body = await generatePredictionBody([{ title: product.title, source: "Amazon" }], "AMAZON");
  return { topic: product.title, report: `• ${product.title} — Amazon\n${product.link}\n\n${body}` };
}

// ------------------------------------------------------------
// ROUTES (unchanged)
// ------------------------------------------------------------
app.post("/run", async (req, res) => {
  const { topic = "", persona = "BUSINESS" } = req.body;
  if (!(await isClearTopic(topic))) return res.json({ report: "Invalid topic." });
  res.json(await runPipeline(topic, persona));
});

app.post("/next", async (req, res) => {
  const persona = req.body.persona || "BUSINESS";
  const seed = persona === "MARKETS" ? "AI infrastructure" : "";
  res.json(await runPipeline(seed, persona));
});

// ------------------------------------------------------------
app.listen(process.env.PORT || 3000, () =>
  console.log("🌊 Blue Ocean Browser running")
);