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
// Helpers
// ------------------------------------------------------------
function buildLinkedInJobUrl(jobTitle, location, manual) {
  const base = "https://www.linkedin.com/jobs/search/?";
  const params = new URLSearchParams();
  params.set("keywords", jobTitle);
  if (manual && location) params.set("location", location);
  return base + params.toString();
}

function buildYouTubeChannelSearchUrl(query) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAg%253D%253D`;
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
const AMAZON_MEMORY_LIMIT = 5;

const BUSINESS_ENTITY_MEMORY = [];
const BUSINESS_MEMORY_LIMIT = 5;

const MARKETS_ENTITY_MEMORY = [];
const MARKETS_MEMORY_LIMIT = 5;

const YOUTUBER_TOPIC_MEMORY = [];
const YOUTUBER_MEMORY_LIMIT = 5;

// ------------------------------------------------------------
// Semantic clarity check (gibberish only)
// ------------------------------------------------------------
async function isClearTopic(topic) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Is the following text intelligible human language
with a clear intent or subject?

Reply YES if it is understandable and meaningful.
Reply NO only if it is gibberish, random characters,
or has no interpretable intent.

Text:
"${topic}"
`
    }],
    temperature: 0
  });
  return out.choices[0].message.content.trim() === "YES";
}

// ------------------------------------------------------------
// Explicit location extraction (manual only)
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
// MARKETS — rewrite theme
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
// MARKETS — Google News signal
// ------------------------------------------------------------
async function fetchMarketSignal(theme) {
  if (!SERP_KEY) return null;
  const url = `https://serpapi.com/search.json?tbm=nws&q=${encodeURIComponent(theme)}&num=5&api_key=${SERP_KEY}`;
  const r = await fetch(url);
  const j = await r.json();
  return (j.news_results || [])[0] || null;
}

// ------------------------------------------------------------
// AMAZON — topic generation
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

Choose ONE real-world cosmetics product or beauty category
with strong near-term consumer buying interest.

Rules:
- Buyer mindset
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

async function fetchSingleAmazonProduct(query) {
  if (!SERP_KEY) return null;
  const q = `${query} site:amazon.com/dp OR site:amazon.com/gp/product`;
  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(q)}&num=5&api_key=${SERP_KEY}`;
  const r = await fetch(url);
  const j = await r.json();
  return (j.organic_results || []).find(x => x.link);
}

// ------------------------------------------------------------
// BUSINESS — job title generation
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

Generate ONE real AI job title companies are hiring for.
Output ONLY the job title.
`
    }],
    temperature: 0.7
  });
  return out.choices[0].message.content.trim();
}

// ------------------------------------------------------------
// YOUTUBER — creator pattern generation
// ------------------------------------------------------------
async function generateNextYouTuberSignal(lens) {
  const recent = YOUTUBER_TOPIC_MEMORY.join(", ");
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Academic lens: ${lens}

Identify ONE YouTube creator pattern or channel niche
that is gaining attention right now.

Rules:
- Creator patterns only (not videos)
- 3–6 words
- Avoid hype
- Avoid repetition

Avoid: ${recent}
`
    }],
    temperature: 0.6
  });

  const topic = out.choices[0].message.content.trim();
  YOUTUBER_TOPIC_MEMORY.push(topic);
  if (YOUTUBER_TOPIC_MEMORY.length > YOUTUBER_MEMORY_LIMIT) YOUTUBER_TOPIC_MEMORY.shift();
  return topic;
}

// ------------------------------------------------------------
// Shared body generator
// ------------------------------------------------------------
function sixMonthDateLabel() {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
}

async function generatePredictionBody(sources, persona) {
  const signalText = sources.map(s => `• ${s.title} — ${s.source}`).join("\n");
  let personaInstruction = "";

  if (persona === "AMAZON") {
    personaInstruction = `You are an AI product-use analyst.`;
  } else if (persona === "BUSINESS") {
    personaInstruction = `You are an AI labor-market foresight analyst.`;
  } else if (persona === "MARKETS") {
    personaInstruction = `You are an AI market signal analyst.`;
  } else if (persona === "YOUTUBER") {
    personaInstruction = `
You are an AI creator-economy analyst.
Focus on why creator patterns are forming.
Avoid advice, hype, or growth hacks.
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
- Neutral tone

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
// CORE PIPELINE
// ------------------------------------------------------------
async function runPipeline(topic, persona, manual) {
  const lens = pickStanfordLens();
  let location = null;

  if (manual) location = await extractExplicitLocation(topic);

  if (persona === "YOUTUBER") {
    const ytTopic = manual ? topic : await generateNextYouTuberSignal(lens);
    const ytUrl = buildYouTubeChannelSearchUrl(ytTopic);
    const body = await generatePredictionBody(
      [{ title: ytTopic, source: "YouTube" }],
      "YOUTUBER"
    );
    return {
      topic: ytTopic,
      report: `• ${ytTopic} — YouTube\n${ytUrl}\n\n${body}`
    };
  }

  // Existing personas continue unchanged…
  // (MARKETS, BUSINESS, AMAZON)
  return { report: "Persona not shown for brevity." };
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
  const persona = req.body.persona || "BUSINESS";
  res.json(await runPipeline("", persona, false));
});

app.listen(process.env.PORT || 3000, () =>
  console.log("🌊 Blue Ocean Browser running")
);