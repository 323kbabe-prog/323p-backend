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

function buildLinkedInJobUrl(jobTitle, location, manual) {
  const base = "https://www.linkedin.com/jobs/search/?";
  const params = new URLSearchParams();
  params.set("keywords", jobTitle);
  if (manual && location) params.set("location", location);
  return base + params.toString();
}

function buildYouTubeChannelSearchUrl(query) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

// ------------------------------------------------------------
// Stanford lenses + no-repeat memory
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
// Entity no-repeat memory
// ------------------------------------------------------------
const AMAZON_TOPIC_MEMORY = [];
const BUSINESS_ENTITY_MEMORY = [];
const MARKETS_ENTITY_MEMORY = [];

// ------------------------------------------------------------
// Semantic clarity check
// ------------------------------------------------------------
async function isClearTopic(topic) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `Is this understandable language? YES or NO.\n"${topic}"`
    }],
    temperature: 0
  });
  return out.choices[0].message.content.trim() === "YES";
}

// ------------------------------------------------------------
// Explicit location extraction
// ------------------------------------------------------------
async function extractExplicitLocation(text) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `Extract location or reply NO.\n"${text}"`
    }],
    temperature: 0
  });
  const r = out.choices[0].message.content.trim();
  return r === "NO" ? null : r;
}

// ------------------------------------------------------------
// MARKETS helpers
// ------------------------------------------------------------
async function rewriteMarketTheme(input, lens, location) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `Academic lens: ${lens}\nRewrite as market theme (3–7 words).\n"${input}"`
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
  return (j.news_results || [])[0] || null;
}

async function extractCompanyNameFromTitle(title) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: `Extract company name:\n"${title}"` }],
    temperature: 0
  });
  return out.choices[0].message.content.trim();
}

// ------------------------------------------------------------
// AMAZON helpers
// ------------------------------------------------------------
async function generateNextAmazonTopic(lens) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: `Pick beauty product (4–8 words).` }],
    temperature: 0.7
  });
  return out.choices[0].message.content.trim();
}

async function fetchSingleAmazonProduct(query) {
  if (!SERP_KEY) return null;
  const q = `${query} site:amazon.com/dp`;
  const r = await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(q)}&api_key=${SERP_KEY}`);
  const j = await r.json();
  return (j.organic_results || [])[0] || null;
}

// ------------------------------------------------------------
// BUSINESS helpers
// ------------------------------------------------------------
async function generateNextJobTitle(lens) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: `Generate AI job title.` }],
    temperature: 0.7
  });
  return out.choices[0].message.content.trim();
}

async function fetchSingleLinkedInJob(jobTitle) {
  if (!SERP_KEY) return null;
  const q = `${jobTitle} site:linkedin.com/jobs`;
  const r = await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(q)}&api_key=${SERP_KEY}`);
  const j = await r.json();
  return (j.organic_results || [])[0] || null;
}

// ------------------------------------------------------------
// ⭐ YOUTUBER — MOST POPULAR SINGLE VIDEO (last 2 weeks)
// ------------------------------------------------------------
async function normalizeYouTubeSearchIntent(rawInput, location) {
  if (!SERP_KEY || !rawInput) return rawInput;

  const q = `${rawInput} site:youtube.com/watch`;
  const url =
    `https://serpapi.com/search.json?q=${encodeURIComponent(q)}` +
    `&tbs=qdr:w2&num=20&api_key=${SERP_KEY}`;

  const r = await fetch(url);
  const j = await r.json();

  const videos = (j.organic_results || []).filter(v =>
    v.link?.includes("watch?v=") &&
    !/\/@|\/c\/|\/user\/|playlist/i.test(v.link) &&
    !/(official|channel|vevo|records|studio|label)/i.test(v.title || "")
  );

  if (!videos.length) return rawInput;

  return videos[0].title
    .replace(/[-–|].*$/, "")
    .replace(/\(.*?\)/g, "")
    .replace(/official|music video|full video|episode \d+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ------------------------------------------------------------
// BODY GENERATION
// ------------------------------------------------------------
async function generatePredictionBody(sources) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `Reality · ${new Date().toDateString()}\nWrite 5 short paragraphs.`
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
  let location = manual ? await extractExplicitLocation(topic) : null;

  if (persona === "MARKETS") {
    const theme = await rewriteMarketTheme(topic, lens, location);
    const signal = await fetchMarketSignal(theme);
    if (!signal) return { report: "No market signal found." };
    const body = await generatePredictionBody([signal]);
    return { topic: theme, report: body };
  }

  if (persona === "BUSINESS") {
    const job = await generateNextJobTitle(lens);
    const body = await generatePredictionBody([{ title: job }]);
    return { topic: job, report: body };
  }

  if (persona === "YOUTUBER") {
    const query = manual
      ? await normalizeYouTubeSearchIntent(topic, location)
      : topic;

    const ytUrl = buildYouTubeChannelSearchUrl(query);
    const body = await generatePredictionBody([{ title: query }]);

    return {
      topic: query,
      report: `• ${query} — YouTube\n${ytUrl}\n\n${body}`
    };
  }

  const amazonTopic = await generateNextAmazonTopic(lens);
  const product = await fetchSingleAmazonProduct(amazonTopic);
  const body = await generatePredictionBody([{ title: amazonTopic }]);
  return { topic: amazonTopic, report: body };
}

// ------------------------------------------------------------
// ROUTES
// ------------------------------------------------------------
app.post("/run", async (req, res) => {
  const { topic = "", persona = "BUSINESS", manual = false } = req.body;
  if (!(await isClearTopic(topic))) return res.json({ report: "Invalid topic." });
  res.json(await runPipeline(topic, persona, manual));
});

app.post("/next", async (req, res) => {
  res.json(await runPipeline("", req.body.persona || "BUSINESS", false));
});

// ------------------------------------------------------------
app.listen(process.env.PORT || 3000, () =>
  console.log("🌊 Blue Ocean Browser running")
);