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

  // Only add location in manual mode and when location exists
  if (manual && location) {
    params.set("location", location);
  }

  return base + params.toString();
}

// ⭐ X — YouTube video link builder (SINGLE video only)
function buildYouTubeChannelSearchUrl(videoUrl) {
  return videoUrl;
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
// Entity no-repeat memory (per persona)
// ------------------------------------------------------------
const AMAZON_TOPIC_MEMORY = [];
const AMAZON_MEMORY_LIMIT = 5;

const BUSINESS_ENTITY_MEMORY = [];
const BUSINESS_MEMORY_LIMIT = 5;

const MARKETS_ENTITY_MEMORY = [];
const MARKETS_MEMORY_LIMIT = 5;

// ⭐ X — YouTuber memory
const YOUTUBER_TOPIC_MEMORY = [];
const YOUTUBER_MEMORY_LIMIT = 5;

// ------------------------------------------------------------
// Semantic clarity check
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
// MARKETS — rewrite theme using lens (+ location)
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
// MARKETS — Google Finance signal
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
// MARKETS — extract company name
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
// AMAZON — topic generation using lens (+ location)
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
with strong near-term consumer buying interest
that is culturally, climate, or regulation relevant
to the geographic context if provided.

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
// AMAZON — fetch product
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
// BUSINESS — job title via lens (+ location)
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
// YOUTUBER — normalize most popular YouTube video (last 2 weeks)
// ------------------------------------------------------------
async function fetchYouTubeVideoList(rawInput, location, limit = 5) {
  if (!SERP_KEY || !rawInput) return [];

  const locationHint = location ? `${location} ` : "";
  const query = `${locationHint}${rawInput} site:youtube.com/watch`;

  try {
    const url =
      "https://serpapi.com/search.json?" +
      `q=${encodeURIComponent(query)}` +
      `&tbs=qdr:w2` +
      `&num=${limit}` +
      `&api_key=${SERP_KEY}`;

    const r = await fetch(url);
    const j = await r.json();

    return (j.organic_results || [])
      .filter(v =>
        v.link &&
        v.link.includes("watch?v=") &&
        !/\/@|\/c\/|\/user\/|\/playlist/i.test(v.link)
      )
      .slice(0, limit)
      .map(v => ({
        title: v.title
          .replace(/[-–|].*$/, "")
          .replace(/\(.*?\)/g, "")
          .trim(),
        link: v.link
      }));

  } catch {
    return [];
  }
}

// ⭐ X — YouTuber signal generator
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
- Neutral, analytical phrasing
- Avoid hype
- Avoid repetition

Avoid: ${recent}
`
    }],
    temperature: 0.6
  });

  const topic = out.choices[0].message.content.trim();
  YOUTUBER_TOPIC_MEMORY.push(topic);
  if (YOUTUBER_TOPIC_MEMORY.length > YOUTUBER_MEMORY_LIMIT) {
    YOUTUBER_TOPIC_MEMORY.shift();
  }
  return topic;
}

// ------------------------------------------------------------
// BUSINESS — LinkedIn SERP
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
// 6-month future date label
// ------------------------------------------------------------
function sixMonthDateLabel() {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
}

// ------------------------------------------------------------
// BODY GENERATION (Option A applied safely)
// ------------------------------------------------------------
async function generatePredictionBody(sources, persona, location) {
  const signalText = sources.map(s => `• ${s.title} — ${s.source}`).join("\n");
  let personaInstruction = "";

if (persona === "AMAZON") {
  personaInstruction = `
You are an AI product-use analyst.

If a geographic context is provided, you MUST:
- Explain why this forecast is relevant to that location
- Connect local climate, environment, or lifestyle factors
  to the product’s usage or demand
- Do this in one clear sentence early in the analysis

Then continue with broader climate, culture,
and regulatory reasoning as appropriate.

If no location is provided, write globally.
`;
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
// CORE PIPELINE
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

    const company = await extractCompanyNameFromTitle(signal.title);
    MARKETS_ENTITY_MEMORY.push(company);
    if (MARKETS_ENTITY_MEMORY.length > MARKETS_MEMORY_LIMIT) MARKETS_ENTITY_MEMORY.shift();

    const body = await generatePredictionBody(
      [{ title: signal.title, source: "Reuters" }],
      "MARKETS",
      null
    );

    return {
      topic: company,
      report: `Current Signals\n• ${signal.title} — Google News\n${signal.link}\n\n${body}`
    };
  }

  if (persona === "BUSINESS") {
    const jobTitle = await generateNextJobTitle(lens, location);
    BUSINESS_ENTITY_MEMORY.push(jobTitle);
    if (BUSINESS_ENTITY_MEMORY.length > BUSINESS_MEMORY_LIMIT) BUSINESS_ENTITY_MEMORY.shift();

    const job = await fetchSingleLinkedInJob(jobTitle);
if (!job) return { report: "No hiring signal found." };

const body = await generatePredictionBody(
  [{ title: jobTitle, source: "LinkedIn" }],
  "BUSINESS",
  null
);

// 🔹 NEW: location-aware LinkedIn URL
const linkedinUrl = buildLinkedInJobUrl(jobTitle, location, manual);

return {
  topic: jobTitle,
  report: `• ${jobTitle} — LinkedIn\n${linkedinUrl}\n\n${body}`
};
  }

// ⭐ X — YouTuber persona
if (persona === "YOUTUBER") {

  // 1. Get supporting video list
  const videos = await fetchYouTubeVideoList(
    manual && topic ? topic : await generateNextYouTuberSignal(lens),
    location,
    5
  );

  if (!videos.length) {
    return { report: "No YouTube videos found." };
  }

  // 2. Use the TOP video as the signal title
  const primaryTitle = videos[0].title;

  // 3. Build foresight body (FULL format)
  const body = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
${youtuberForesightInstruction()}

Verified content signals:
${videos.map(v => `• ${v.title}`).join("\n")}

START WITH THIS LINE EXACTLY:
Reality · ${sixMonthDateLabel()}

Write a 6-month foresight.

Rules:
- EXACTLY 5 short paragraphs
- Neutral, analytical tone
- Creator-focused (what to talk about)
- No markdown

Then write this section header exactly:
If this prediction is correct, what works:

Then write EXACTLY 3 short sentences.
`
    }],
    temperature: 0.3
  });

  // 4. Append YouTube evidence list ONCE
  const evidenceList = videos
    .map(v => `${v.title}\n${v.link}`)
    .join("\n\n");

  return {
    topic: primaryTitle,
    report:
      `• ${primaryTitle} — YouTube\n\n` +
      body.choices[0].message.content.trim() +
      `\n\nSupporting YouTube examples:\n${evidenceList}`
  };
}
  
// ------------------------------------------------------------
// YOUTUBER — manual-mode content insight rewrite (NO foresight)
// ------------------------------------------------------------
function youtuberForesightInstruction() {
  return `
You are writing for a YouTube creator.

Explain:
- What angles a YouTuber can talk about on this topic
- Why audiences are responding now
- What themes, emotions, or formats are emerging
- How creators can position their content over the next 6 months

Do NOT:
- Explain the platform itself
- Mention algorithms explicitly
- Mention YouTube as a company
`;
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
  const seed = persona === "MARKETS" ? "AI infrastructure" : "";
  res.json(await runPipeline(seed, persona, false));
});

// ------------------------------------------------------------
app.listen(process.env.PORT || 3000, () =>
  console.log("🌊 Blue Ocean Browser running")
);

