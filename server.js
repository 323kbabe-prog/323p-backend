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
// MARKETS — Reuters anchor
// ------------------------------------------------------------
const MARKETS_SIGNAL_SOURCE = {
  name: "Reuters",
  url: "https://www.reuters.com"
};

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function buildLinkedInJobUrl(jobTitle, location, manual) {
  const base = "https://www.linkedin.com/jobs/search/?";
  const params = new URLSearchParams();
  params.set("keywords", jobTitle);
  if (manual && location) params.set("location", location);
  return base + params.toString();
}

function buildYouTubeSearchUrl(query) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

// ------------------------------------------------------------
// Stanford lenses
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
// Memory
// ------------------------------------------------------------
const AMAZON_TOPIC_MEMORY = [];
const AMAZON_MEMORY_LIMIT = 5;

const BUSINESS_ENTITY_MEMORY = [];
const BUSINESS_MEMORY_LIMIT = 5;

const MARKETS_ENTITY_MEMORY = [];
const MARKETS_MEMORY_LIMIT = 5;

const YOUTUBER_TOPIC_MEMORY = [];
const YOUTUBER_MEMORY_LIMIT = 5;

// ------------------------------------------------------------
// Semantic clarity
// ------------------------------------------------------------
async function isClearTopic(topic) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `Is this meaningful human language? Reply YES or NO.\n"${topic}"`
    }],
    temperature: 0
  });
  return out.choices[0].message.content.trim() === "YES";
}

// ------------------------------------------------------------
// Location extraction (manual only)
// ------------------------------------------------------------
async function extractExplicitLocation(text) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `Extract a geographic location if present, else reply NO.\n"${text}"`
    }],
    temperature: 0
  });
  const r = out.choices[0].message.content.trim();
  return r === "NO" ? null : r;
}

// ------------------------------------------------------------
// MARKETS
// ------------------------------------------------------------
async function rewriteMarketTheme(input, lens, location) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Academic lens: ${lens}
${location ? `Location: ${location}` : ""}

Rewrite into a neutral market theme (3–7 words).
Input: "${input}"
`
    }],
    temperature: 0.2
  });
  return out.choices[0].message.content.trim();
}

async function fetchMarketSignal(theme) {
  if (!SERP_KEY) return null;
  const url = `https://serpapi.com/search.json?tbm=nws&q=${encodeURIComponent(theme)}&num=5&api_key=${SERP_KEY}`;
  const r = await fetch(url);
  const j = await r.json();
  const hit = (j.news_results || [])[0];
  if (!hit) return null;
  return { title: hit.title, link: hit.link, source: hit.source || "Google News" };
}

async function extractCompanyNameFromTitle(title) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: `Extract company name:\n"${title}"` }],
    temperature: 0
  });
  return out.choices[0].message.content.trim() || "Unknown";
}

// ------------------------------------------------------------
// AMAZON
// ------------------------------------------------------------
async function generateNextAmazonTopic(lens, location) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Academic lens: ${lens}
${location ? `Location: ${location}` : ""}

Suggest one beauty product (4–8 words).
`
    }],
    temperature: 0.7
  });
  return out.choices[0].message.content.trim();
}

async function fetchSingleAmazonProduct(query) {
  if (!SERP_KEY) return null;
  const q = `${query} site:amazon.com/dp OR site:amazon.com/gp/product`;
  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(q)}&num=5&api_key=${SERP_KEY}`;
  const r = await fetch(url);
  const j = await r.json();
  return (j.organic_results || []).find(x => x.link && (x.link.includes("/dp/") || x.link.includes("/gp/product")));
}

// ------------------------------------------------------------
// BUSINESS
// ------------------------------------------------------------
async function generateNextJobTitle(lens, location) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Academic lens: ${lens}
${location ? `Location: ${location}` : ""}

Generate one AI job title.
`
    }],
    temperature: 0.7
  });
  return out.choices[0].message.content.trim();
}

async function fetchSingleLinkedInJob(jobTitle) {
  if (!SERP_KEY) return null;
  const q = `${jobTitle} site:linkedin.com/jobs`;
  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(q)}&num=5&api_key=${SERP_KEY}`;
  const r = await fetch(url);
  const j = await r.json();
  return (j.organic_results || []).find(x => x.link && x.link.includes("linkedin.com/jobs"));
}

// ------------------------------------------------------------
// YOUTUBER — REAL VIDEO (last 2 weeks)
// ------------------------------------------------------------
async function normalizeYouTubeSearchIntent(rawInput, location) {
  if (!SERP_KEY || !rawInput) return { title: rawInput };

  const query = `${location ? location + " " : ""}${rawInput} site:youtube.com/watch`;
  const url =
    `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&tbs=qdr:w2&num=20&api_key=${SERP_KEY}`;

  try {
    const r = await fetch(url);
    const j = await r.json();

    const videos = (j.organic_results || []).filter(v =>
      v.link &&
      v.link.includes("watch?v=") &&
      !/\/@|\/c\/|\/user\/|\/playlist/i.test(v.link) &&
      !/(official|channel|vevo|records|studio|label)/i.test(v.title || "")
    );

    if (!videos.length) return { title: rawInput };

    const hit = videos[0];
    return {
      title: hit.title
        .replace(/[-–|].*$/, "")
        .replace(/\(.*?\)/g, "")
        .replace(/official|music video|full video|episode \d+/i, "")
        .replace(/\s+/g, " ")
        .trim(),
      link: hit.link
    };
  } catch {
    return { title: rawInput };
  }
}

// ------------------------------------------------------------
// BODY
// ------------------------------------------------------------
function sixMonthDateLabel() {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
}

async function generatePredictionBody(sources, persona) {
  const signalText = sources.map(s => `• ${s.title} — ${s.source}`).join("\n");

  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Verified signal:
${signalText}

Reality · ${sixMonthDateLabel()}

Write a 6-month foresight.
5 short paragraphs.
Then:
If this prediction is correct, what works:
3 sentences.
`
    }],
    temperature: 0.3
  });

  return out.choices[0].message.content.trim();
}

// ------------------------------------------------------------
// CORE PIPELINE
// ------------------------------------------------------------
async function runPipeline(topic, persona, manual) {
  const lens = pickStanfordLens();
  const location = manual ? await extractExplicitLocation(topic) : null;

  if (persona === "MARKETS") {
    const theme = await rewriteMarketTheme(topic, lens, location);
    const signal = await fetchMarketSignal(theme);
    if (!signal) return { report: "No market signal found." };

    const company = await extractCompanyNameFromTitle(signal.title);
    const body = await generatePredictionBody([{ title: signal.title, source: "Reuters" }], "MARKETS");

    return { topic: company, report: `• ${signal.title}\n${signal.link}\n\n${body}` };
  }

  if (persona === "BUSINESS") {
    const jobTitle = await generateNextJobTitle(lens, location);
    const job = await fetchSingleLinkedInJob(jobTitle);
    if (!job) return { report: "No hiring signal found." };

    const body = await generatePredictionBody([{ title: jobTitle, source: "LinkedIn" }], "BUSINESS");
    return { topic: jobTitle, report: `• ${jobTitle}\n${job.link}\n\n${body}` };
  }

  if (persona === "YOUTUBER") {
    const result = manual && topic
      ? await normalizeYouTubeSearchIntent(topic, location)
      : { title: await generateNextYouTuberSignal(lens) };

    const link = result.link || buildYouTubeSearchUrl(result.title);
    const body = await generatePredictionBody([{ title: result.title, source: "YouTube" }], "YOUTUBER");

    return { topic: result.title, report: `• ${result.title}\n${link}\n\n${body}` };
  }

  // AMAZON
  const amazonTopic = await generateNextAmazonTopic(lens, location);
  const product = await fetchSingleAmazonProduct(amazonTopic);
  if (!product) return { report: "No product found." };

  const body = await generatePredictionBody([{ title: product.title, source: "Amazon" }], "AMAZON");
  return { topic: product.title, report: `• ${product.title}\n${product.link}\n\n${body}` };
}

// ------------------------------------------------------------
// ROUTES
// ------------------------------------------------------------
app.post("/run", async (req, res) => {
  const { topic="", persona="BUSINESS", manual=false } = req.body;
  if (!(await isClearTopic(topic))) return res.json({ report: "Invalid topic." });
  res.json(await runPipeline(topic, persona, manual));
});

app.post("/next", async (req, res) => {
  const persona = req.body.persona || "BUSINESS";
  res.json(await runPipeline("", persona, false));
});

// ------------------------------------------------------------
app.listen(process.env.PORT || 3000, () =>
  console.log("🌊 Blue Ocean Browser running")
);