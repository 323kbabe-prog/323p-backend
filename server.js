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
// ⭐ X — Explicit location extraction (manual only)
// ------------------------------------------------------------
async function extractExplicitLocation(text) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Does this text explicitly mention a geographic location
(city, state, country, or region)?

If YES, extract ONLY the location name.
If NO, reply NO.

Text:
"${text}"
`
    }],
    temperature: 0
  });

  const result = out.choices[0].message.content.trim();
  return result === "NO" ? null : result;
}

// ------------------------------------------------------------
// MARKETS — rewrite theme using lens (X + location)
// ------------------------------------------------------------
async function rewriteMarketTheme(input, lens, location) {
  const locationLine = location ? `Geographic context: ${location}` : "";
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Academic lens: ${lens}
${locationLine}

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
// MARKETS — Google Finance signal (unchanged)
// ------------------------------------------------------------
async function fetchMarketSignal(theme) {
  if (!SERP_KEY) return null;
  try {
    const url = `https://serpapi.com/search.json?tbm=nws&q=${encodeURIComponent(theme)}&num=5&api_key=${SERP_KEY}`;
    const r = await fetch(url);
    const j = await r.json();
    const hit = (j.news_results || [])[0];
    if (!hit) return null;
    return { title: hit.title, link: hit.link, source: hit.source || "Google News" };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------
// MARKETS — extract company name (unchanged)
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
// AMAZON — topic generation using lens (X + location)
// ------------------------------------------------------------
async function generateNextAmazonTopic(lens, location) {
  const recent = AMAZON_TOPIC_MEMORY.join(", ");
  const locationLine = location ? `Geographic context: ${location}` : "";
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Academic lens: ${lens}
${locationLine}

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
// BUSINESS — job title via lens (X + location)
// ------------------------------------------------------------
async function generateNextJobTitle(lens, location) {
  const locationLine = location ? `Geographic context: ${location}` : "";
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Academic lens: ${lens}
${locationLine}

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
// 6-month future date label (unchanged)
// ------------------------------------------------------------
function sixMonthDateLabel() {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
}

// ------------------------------------------------------------
// BODY GENERATION (unchanged)
// ------------------------------------------------------------
async function generatePredictionBody(sources, persona) {
  const signalText = sources.map(s => `• ${s.title} — ${s.source}`).join("\n");
  let personaInstruction = "";

  if (persona === "AMAZON") {
    personaInstruction = `You are an AI product-use analyst.`;
  } else if (persona === "BUSINESS") {
    personaInstruction = `You are an AI labor-market foresight analyst.`;
  } else if (persona === "MARKETS") {
    personaInstruction = `You are an AI market signal analyst.`;
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
- No markdown symbols

Then write this section header exactly:
If this prediction is correct, what works:

Then write EXACTLY 3 short sentences.
`
    }],
    temperature: 0.3
  });

  return out.choices[0].message.content.trim();
}

// ------------------------------------------------------------
// CORE PIPELINE (X applied only here)
// ------------------------------------------------------------
async function runPipeline(topic, persona, manual) {
  const lens = pickStanfordLens();
  let location = null;

  if (manual === true) {
    location = await extractExplicitLocation(topic);
  }

  if (persona === "MARKETS") {
    const theme = await rewriteMarketTheme(topic, lens, location);
    const signal = await fetchMarketSignal(theme);
    if (!signal) return { report: "No market signal found." };

    let company = await extractCompanyNameFromTitle(signal.title);
    MARKETS_ENTITY_MEMORY.push(company);
    if (MARKETS_ENTITY_MEMORY.length > MARKETS_MEMORY_LIMIT) MARKETS_ENTITY_MEMORY.shift();

    const body = await generatePredictionBody([{ title: signal.title, source: "Reuters" }], "MARKETS");
    return { topic: company, report: `Current Signals\n• ${signal.title} — Google News\n${signal.link}\n\n${body}` };
  }

  if (persona === "BUSINESS") {
    let jobTitle = await generateNextJobTitle(lens, location);
    BUSINESS_ENTITY_MEMORY.push(jobTitle);
    if (BUSINESS_ENTITY_MEMORY.length > BUSINESS_MEMORY_LIMIT) BUSINESS_ENTITY_MEMORY.shift();

    const job = await fetchSingleLinkedInJob(jobTitle);
    if (!job) return { report: "No hiring signal found." };

    const body = await generatePredictionBody([{ title: jobTitle, source: "LinkedIn" }], "BUSINESS");
    return { topic: jobTitle, report: `• ${jobTitle} — LinkedIn\n${job.link}\n\n${body}` };
  }

  const amazonTopic = await generateNextAmazonTopic(lens, location);
  const product = await fetchSingleAmazonProduct(amazonTopic);
  if (!product) return { report: "No product found." };

  const body = await generatePredictionBody([{ title: product.title, source: "Amazon" }], "AMAZON");
  return { topic: product.title, report: `• ${product.title} — Amazon\n${product.link}\n\n${body}` };
}

// ------------------------------------------------------------
// ROUTES (X applied only to /run)
// ------------------------------------------------------------
app.post("/run", async (req, res) => {
  const { topic = "", persona = "BUSINESS", manual = false } = req.body;
  if (!(await isClearTopic(topic))) return res.json({ report: "Invalid topic." });
  res.json(await runPipeline(topic, persona, manual));
});

app.post("/next", async (req, res) => {
  const persona = req.body.persona || "BUSINESS";
  const seed = persona === "MARKETS" ? "AI infrastructure" : "";
  res.json(await runPipeline(seed, persona, false));
});

// ------------------------------------------------------------
app.listen(process.env.PORT || 3000, () =>
  console.log("🌊 Blue Ocean Browser running")
);