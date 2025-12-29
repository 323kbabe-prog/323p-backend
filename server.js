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

function buildLinkedInJobUrl(jobTitle, location, manual) {
  const base = "https://www.linkedin.com/jobs/search/?";
  const params = new URLSearchParams();
  params.set("keywords", jobTitle);
  if (manual && location) params.set("location", location);
  return base + params.toString();
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

// 🔹 Stanford lens → Stanford YouTube channel query
function lensToStanfordYouTubeQuery(lens) {
  const MAP = {
    "Psychology": "Stanford University psychology",
    "Sociology": "Stanford sociology",
    "Economics": "Stanford economics",
    "Communication": "Stanford communication",
    "Design": "Stanford d.school",
    "Political Science": "Stanford political science",
    "International Relations": "Stanford FSI",
    "Statistics": "Stanford statistics",
    "Computer Science": "Stanford computer science",
    "Law": "Stanford law",
    "Education": "Stanford education",
    "Biology": "Stanford biology",
    "Environmental Science": "Stanford woods institute",
    "Philosophy": "Stanford philosophy"
  };

  return MAP[lens] || "Stanford University";
}

  
// ------------------------------------------------------------
// Entity no-repeat memory
// ------------------------------------------------------------
const AMAZON_TOPIC_MEMORY = [];
const BUSINESS_ENTITY_MEMORY = [];
const MARKETS_ENTITY_MEMORY = [];
const YOUTUBER_TOPIC_MEMORY = [];

const MEMORY_LIMIT = 5;

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

Reply YES or NO.

Text:
"${topic}"
`
    }],
    temperature: 0
  });
  return out.choices[0].message.content.trim() === "YES";
}

// ------------------------------------------------------------
// Date helpers
// ------------------------------------------------------------
function sixMonthDateLabel() {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
}

function presentDateLabel() {
  return new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
}

// ------------------------------------------------------------
// Explicit location extraction (manual, non-YOUTUBER only)
// ------------------------------------------------------------
async function extractExplicitLocation(text) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Does this text explicitly mention a geographic location?
If YES, extract ONLY the location.
If NO, reply NO.

Text:
"${text}"
`
    }],
    temperature: 0
  });

  const r = out.choices[0].message.content.trim();
  return r === "NO" ? null : r;
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
3–7 words. No tickers. No prices.

Input: "${input}"
`
    }],
    temperature: 0.2
  });
  return out.choices[0].message.content.trim();
}

// ------------------------------------------------------------
// MARKETS — fetch signal
// ------------------------------------------------------------
async function fetchMarketSignal(theme) {
  if (!SERP_KEY) return null;
  try {
    const url = `https://serpapi.com/search.json?tbm=nws&q=${encodeURIComponent(theme)}&num=5&api_key=${SERP_KEY}`;
    const r = await fetch(url);
    const j = await r.json();
    return (j.news_results || [])[0] || null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------
// MARKETS — extract company
// ------------------------------------------------------------
async function extractCompanyNameFromTitle(title) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `Extract the primary company name only:\n"${title}"`
    }],
    temperature: 0
  });
  return out.choices[0].message.content.trim() || "Unknown";
}

// ------------------------------------------------------------
// AMAZON — topic + product
// ------------------------------------------------------------
async function generateNextAmazonTopic(lens, location) {
  const avoid = AMAZON_TOPIC_MEMORY.join(", ");
  const locationLine = location ? `Geographic context: ${location}` : "";
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Academic lens: ${lens}
${locationLine}

Choose ONE real cosmetics product or beauty category.
4–8 words. Buyer mindset.

Avoid: ${avoid}
`
    }],
    temperature: 0.7
  });

  const topic = out.choices[0].message.content.trim();
  AMAZON_TOPIC_MEMORY.push(topic);
  if (AMAZON_TOPIC_MEMORY.length > MEMORY_LIMIT) AMAZON_TOPIC_MEMORY.shift();
  return topic;
}

async function fetchSingleAmazonProduct(query) {
  if (!SERP_KEY) return null;
  const q = `${query} site:amazon.com/dp OR site:amazon.com/gp/product`;
  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(q)}&num=5&api_key=${SERP_KEY}`;
  const r = await fetch(url);
  const j = await r.json();
  return (j.organic_results || []).find(x => x.link?.includes("/dp/") || x.link?.includes("/gp/product"));
}

// ------------------------------------------------------------
// BUSINESS — job title + listing
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

Generate ONE real AI job title companies are recruiting for.
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
  return (j.organic_results || []).find(x => x.link?.includes("linkedin.com/jobs"));
}

// ------------------------------------------------------------
// YOUTUBER — normalize single real video
// ------------------------------------------------------------
async function normalizeYouTubeSearchIntent(rawInput) {
  if (!SERP_KEY || !rawInput) return rawInput;

  const query = `${rawInput} site:youtube.com/watch`;

  try {
    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&tbs=qdr:w2&num=20&api_key=${SERP_KEY}`;
    const r = await fetch(url);
    const j = await r.json();

    const v = (j.organic_results || []).find(x =>
      x.link?.includes("watch?v=") &&
      !/\/@|\/c\/|\/user\/|\/playlist/i.test(x.link)
    );

    if (!v) return rawInput;

    return {
      title: v.title.replace(/[-–|].*$/, "").replace(/\(.*?\)/g, "").trim(),
      link: v.link
    };
  } catch {
    return rawInput;
  }
}

// ------------------------------------------------------------
// BODY — AUTO foresight
// ------------------------------------------------------------
async function generatePredictionBody(sources, persona) {
  const signalText = sources.map(s => `• ${s.title} — ${s.source}`).join("\n");

  const personaInstruction = {
    AMAZON: "You are an AI product-use analyst.",
    BUSINESS: "You are an AI labor-market foresight analyst.",
    MARKETS: "You are an AI market signal analyst."
  }[persona] || "";

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

Write a 6-month foresight analysis based on the signal above.

Rules:
- Focus only on the subject provided
- Do NOT assume music or entertainment
- Do NOT mention pop culture unless explicitly present
- EXACTLY 5 short paragraphs

Then write:
If this prediction is correct, what works:

Then EXACTLY 3 short sentences.
`
    }],
    temperature: 0.3
  });

  return out.choices[0].message.content.trim();
}

// ------------------------------------------------------------
// BODY — YOUTUBER manual full report
// ------------------------------------------------------------
async function generateYouTubeManualFullReport(videoTitle, lens) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Academic lens: ${lens}

The reasoning must reflect institutional academic understanding,
as found on official university (.edu) sources.

The following YouTube content is a stable signal
of the present environment.

Video title:
"${videoTitle}"

START WITH THIS LINE EXACTLY:
Reality · ${sixMonthDateLabel()}

Write a full analytical report explaining
what kind of system this content confirms.

Rules:
- EXACTLY 5 short paragraphs
- No future tense
- No prediction language
- No creators
- No platform mechanics

Then write:
Then write:
If this reading is correct, what works:

Leave ONE blank line, then write EXACTLY 3 short sentences.
`
    }],
    temperature: 0.3
  });

  return out.choices[0].message.content.trim();
}

async function fetchRealPopEntity() {
  if (!SERP_KEY) return null;

  try {
    const queries = [
      "2025 pop hit official",
      "new pop song 2025 official",
      "trending pop artist 2025",
      "viral pop music official",
      "current pop chart song official"
    ];

    const q = queries[Math.floor(Math.random() * queries.length)];

    const url =
      "https://serpapi.com/search.json?" +
      "engine=youtube" +
      `&search_query=${encodeURIComponent(q)}` +
      "&tbs=qdr:m" +        // 🔑 last month
      "&num=10" +
      `&api_key=${SERP_KEY}`;

    const r = await fetch(url);
    const j = await r.json();

    const v = (j.video_results || []).find(x => x.title);

    if (!v) return null;

    return v.title
      .replace(/\(.*?\)/g, "")
      .replace(/official|mv|music video|lyrics/gi, "")
      .trim();

  } catch {
    return null;
  }
}
// ------------------------------------------------------------
// SERP REALITY CHECK — persona aware
// ------------------------------------------------------------
async function isValidEntityForPersona(query, persona) {
  if (!SERP_KEY || !query) return false;

  let url;

  switch (persona) {
    case "YOUTUBER":
      url = `https://serpapi.com/search.json?engine=youtube&search_query=${encodeURIComponent(query)}&num=5&api_key=${SERP_KEY}`;
      break;

    case "MARKETS":
      url = `https://serpapi.com/search.json?tbm=nws&q=${encodeURIComponent(query)}&num=5&api_key=${SERP_KEY}`;
      break;

    case "AMAZON":
      url = `https://serpapi.com/search.json?q=${encodeURIComponent(query + " site:amazon.com")}&num=5&api_key=${SERP_KEY}`;
      break;

    case "BUSINESS":
      url = `https://serpapi.com/search.json?q=${encodeURIComponent(query + " site:linkedin.com/jobs")}&num=5&api_key=${SERP_KEY}`;
      break;

    default:
      return false;
  }

  const r = await fetch(url);
  const j = await r.json();

  return Boolean(
    (j.video_results && j.video_results.length) ||
    (j.news_results && j.news_results.length) ||
    (j.organic_results && j.organic_results.length)
  );
}

function getFallbackHint(persona) {
  switch (persona) {
    case "MARKETS":  return "real company or market signal";
    case "AMAZON":   return "cosmetics or beauty product";
    case "BUSINESS": return "real job role or company";
    case "YOUTUBER": return "pop song artist or group";
    default:         return "something relevant";
  }
}
// ------------------------------------------------------------
// CORE PIPELINE
// ------------------------------------------------------------
async function runPipeline(topic, persona, manual) {
  const lens = pickStanfordLens();

  const isValid = await isValidEntityForPersona(topic, persona);

  let guard = "ok";
  let fallbackHint = null;

  if (!isValid) {
    guard = "fallback";
    fallbackHint = getFallbackHint(persona);

    // AUTO MODE ONLY → substitute
    if (!manual) {
      if (persona === "BUSINESS") {
        topic = await generateNextJobTitle(lens);
      } else if (persona === "AMAZON") {
        topic = await generateNextAmazonTopic(lens);
      } else if (persona === "MARKETS") {
        topic = "AI infrastructure";
      } else if (persona === "YOUTUBER") {
        topic = await fetchRealPopEntity();
      }
    }
    // MANUAL MODE → do nothing (frontend rewrite)
  }

  // =========================
  // PERSONA PIPELINES
  // =========================

  if (persona === "BUSINESS") {
    const location = await extractExplicitLocation(topic);
    const jobTitle = await generateNextJobTitle(lens, location);
    const job = await fetchSingleLinkedInJob(jobTitle);

    if (!job) {
      return { guard, fallbackHint, topic, report: "No hiring signal found." };
    }

    const body = await generatePredictionBody(
      [{ title: jobTitle, source: "LinkedIn" }],
      "BUSINESS"
    );

    return {
      guard,
      fallbackHint,
      topic: jobTitle,
      report: `• ${jobTitle} — LinkedIn\n${buildLinkedInJobUrl(jobTitle, location, manual)}\n\n${body}`
    };
  }

  if (persona === "YOUTUBER") {
    const channelQuery = lensToStanfordYouTubeQuery(lens);
    const ytSignal = await normalizeYouTubeSearchIntent(
      `${channelQuery} site:youtube.com/watch`
    );

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: `...` }],
      temperature: 0.3
    });

    return {
      guard,
      fallbackHint,
      topic,
      report: `• ${lens} perspective — Stanford University (YouTube)\n${ytSignal?.link || ""}\n\n${completion.choices[0].message.content}`
    };
  }

  if (persona === "MARKETS") {
    ...
  }

  if (persona === "AMAZON") {
    ...
  }
}

  // ⬇️ EVERYTHING BELOW STAYS EXACTLY AS YOU WROTE IT
  
  
  let location = null;

  // ✅ LOCATION-AWARE for BUSINESS (LinkedIn)
  if (persona === "BUSINESS") {
    location = await extractExplicitLocation(topic);
  }

  if (persona === "YOUTUBER") {

  const channelQuery = lensToStanfordYouTubeQuery(lens);

  const ytSignal = await normalizeYouTubeSearchIntent(
    `${channelQuery} site:youtube.com/watch`
  );

  const popContext = topic;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Stanford academic lens: ${lens}

Primary subject (real-world example):
"${popContext}"

Analytical framework (academic explanation):
"${channelQuery}"

Task:
Write a 6-month cultural analysis of the pop subject above.

Rules:
- The pop song / artist / group is the MAIN focus
- Refer to the pop song / artist / group by name throughout
- Use the Stanford framework ONLY to explain why this pop behavior exists
- Frame the pop subject as a real-world case study of the Stanford concept
- Do NOT analyze the Stanford video itself
- Do NOT rename or shift focus away from the pop subject
- Do NOT generalize to the entire music industry
- Do NOT discuss unrelated platforms or genres
- EXACTLY 5 short paragraphs

Then write:
If this reading is correct, what works:

Then EXACTLY 3 short sentences.
`
    }],
    temperature: 0.3
  });

  const body = completion.choices[0].message.content;

  return {
  guard,
  fallbackHint,
  topic: topic,
  report:
    `• ${lens} perspective — Stanford University (YouTube)\n` +
    `${ytSignal?.link || "No link found"}\n\n` +
    body
};
}

  if (persona === "BUSINESS") {
    const jobTitle = await generateNextJobTitle(lens, location);
    const job = await fetchSingleLinkedInJob(jobTitle);
    if (!job) {
  return {
    guard,
    fallbackHint,
    topic,
    report: "No hiring signal found."
  };
}

    const body = await generatePredictionBody(
      [{ title: jobTitle, source: "LinkedIn" }],
      "BUSINESS"
    );

    return {
  guard,
  fallbackHint,
  topic: jobTitle,
  report: `• ${jobTitle} — LinkedIn\n${buildLinkedInJobUrl(jobTitle, location, manual)}\n\n${body}`
};
  }

if (persona === "MARKETS") {
  const theme = await rewriteMarketTheme(topic, lens, location);
  const signal = await fetchMarketSignal(theme);
  if (!signal) {
  return {
    guard,
    fallbackHint,
    topic,
    report: "No market signal found."
  };
}

  const company = await extractCompanyNameFromTitle(signal.title);
  MARKETS_ENTITY_MEMORY.push(company);
  if (MARKETS_ENTITY_MEMORY.length > MEMORY_LIMIT) {
    MARKETS_ENTITY_MEMORY.shift();
  }

  const body = await generatePredictionBody(
    [{ title: signal.title, source: "Reuters" }],
    "MARKETS"
  );

  return {
  guard,
  fallbackHint,
  topic: company,
  report: `• ${signal.title} — Google News\n${signal.link}\n\n${body}`
};
}

  const amazonTopic = await generateNextAmazonTopic(lens, location);
  const product = await fetchSingleAmazonProduct(amazonTopic);
 if (!product) {
  return {
    guard,
    fallbackHint,
    topic,
    report: "No product found."
  };
}

  const body = await generatePredictionBody(
    [{ title: product.title, source: "Amazon" }],
    "AMAZON"
  );

 return {
  guard,
  fallbackHint,
  topic: product.title,
  report: `• ${product.title} — Amazon\n${product.link}\n\n${body}`
};
}

function isRelevantToQuery(query, title) {
  const q = query.toLowerCase();
  const t = title.toLowerCase();

  const keywords = q.split(/\s+/).filter(w => w.length > 3);
  return keywords.some(word => t.includes(word));
}

// ------------------------------------------------------------
// ROUTES
// ------------------------------------------------------------
app.post("/run", async (req, res) => {
  let { topic = "", persona = "BUSINESS", manual = false } = req.body;

  // 🔹 AI topic normalization layer (LOCATION-AWARE)
  const normalized = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
You are a query-normalization AI.

Rules:
- Rewrite the input into a clean, search-ready phrase
- Preserve original intent
- Make location explicit if present
- Do NOT add new topics
- Output ONE short phrase only

Input:
"${topic}"

Output:
`
    }],
    temperature: 0
  });

  topic = normalized.choices[0].message.content.trim();

  // 🔹 Semantic clarity check (unchanged)
  if (persona !== "BUSINESS" && !(await isClearTopic(topic))) {
    return res.json({ report: "Invalid topic." });
  }

  // 🔹 Continue pipeline
  res.json(await runPipeline(topic, persona, manual));
});

// ------------------------------------------------------------
// AUTO MODE — NEXT
// ------------------------------------------------------------
app.post("/next", async (req, res) => {
  try {
    const persona = req.body.persona || "BUSINESS";

    // Seed is intentionally light — pipeline decides content
    const seed =
      persona === "MARKETS" ? "AI infrastructure" :
      persona === "AMAZON"  ? "" :
      persona === "YOUTUBER"? "" :
      "";

    const result = await runPipeline(seed, persona, false);
    res.json(result);

  } catch (e) {
    console.error("NEXT ERROR:", e);
    res.status(500).json({ report: "Auto mode failed." });
  }
});

app.get("/", (req, res) => {
  res.status(200).send("Blue Ocean Browser backend is running.");
});

// ------------------------------------------------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🌊 Blue Ocean Browser running on port", PORT);
});