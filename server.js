//////////////////////////////////////////////////////////////
// CHUNK-0 — BOOTSTRAP
//////////////////////////////////////////////////////////////

const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const OpenAI = require("openai");

// ------------------------------------------------------------
// App bootstrap
// ------------------------------------------------------------
const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// ------------------------------------------------------------
// OpenAI client (global)
// ------------------------------------------------------------
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ------------------------------------------------------------
// External API keys
// ------------------------------------------------------------
const SERP_KEY = process.env.SERPAPI_KEY || null;

//////////////////////////////////////////////////////////////
// CHUNK-1 — CONSTANTS & MEMORY
//////////////////////////////////////////////////////////////

// ------------------------------------------------------------
// External signal anchors (static)
// ------------------------------------------------------------
const MARKETS_SIGNAL_SOURCE = {
  name: "Reuters",
  url: "https://www.reuters.com"
};

// ------------------------------------------------------------
// Global constants
// ------------------------------------------------------------
const MEMORY_LIMIT = 5;

// ------------------------------------------------------------
// Entity no-repeat memory (stateful, in-memory)
// ------------------------------------------------------------
const AMAZON_TOPIC_MEMORY = [];
const BUSINESS_ENTITY_MEMORY = [];
const MARKETS_ENTITY_MEMORY = [];
const YOUTUBER_TOPIC_MEMORY = [];

// ------------------------------------------------------------
// Stanford academic lenses (rotation pool)
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

//////////////////////////////////////////////////////////////
// CHUNK-2 — PURE UTILITIES
//////////////////////////////////////////////////////////////

// ------------------------------------------------------------
// URL utilities
// ------------------------------------------------------------
function buildLinkedInJobUrl(jobTitle, location, manual) {
  const base = "https://www.linkedin.com/jobs/search/?";
  const params = new URLSearchParams();
  params.set("keywords", jobTitle);
  if (manual && location) params.set("location", location);
  return base + params.toString();
}

// ------------------------------------------------------------
// Date utilities
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

function presentDateLabel() {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

// ------------------------------------------------------------
// Stanford lens selector (no repetition)
// ------------------------------------------------------------
function pickStanfordLens() {
  const pool = STANFORD_MAJORS.filter(l => l !== LAST_LENS);
  const lens = pool[Math.floor(Math.random() * pool.length)];
  LAST_LENS = lens;
  return lens;
}

// ------------------------------------------------------------
// Stanford lens → official Stanford YouTube query
// ------------------------------------------------------------
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
// Text shape validators
// ------------------------------------------------------------
function isLikelyArtistOrGroupName(query) {
  if (!query) return false;

  const q = query.trim();

  // ❌ block generic music concepts
  if (/\b(music|songs|genre|playlist|beats|mix|album|lyrics)\b/i.test(q)) {
    return false;
  }

  // ✅ allow artist / group name shapes
  // Examples: BLACKPINK, Backstreet Boys, BTS, Ariana Grande
  return /^[A-Za-z0-9][A-Za-z0-9\s&.-]{1,40}$/.test(q);
}

function intentMatchesPersona(query, persona) {
  const q = query.trim().toLowerCase();

  const RULES = {
    BUSINESS: /\b(job|role|position|engineer|developer|manager|analyst|company|corp|inc|ltd)\b/,
    AMAZON: /\b(cosmetic|beauty|skincare|makeup|mascara|lipstick|foundation|serum|cream)\b/,
    MARKETS: /\b(ai|market|finance|stock|economy|investment|rates|company)\b/
  };

  return RULES[persona];
}

// ------------------------------------------------------------
// Relevance scoring (keyword overlap)
// ------------------------------------------------------------
function isRelevantToQuery(query, title) {
  const q = query.toLowerCase();
  const t = title.toLowerCase();

  const keywords = q.split(/\s+/).filter(w => w.length > 3);
  return keywords.some(word => t.includes(word));
}

//////////////////////////////////////////////////////////////
// CHUNK-2B — SERP & EXTRACTION UTILITIES (REQUIRED)
//////////////////////////////////////////////////////////////

// ------------------------------------------------------------
// Explicit location extraction (BUSINESS only)
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
// MARKETS helpers
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
    messages: [{
      role: "user",
      content: `Extract the primary company name only:\n"${title}"`
    }],
    temperature: 0
  });
  return out.choices[0].message.content.trim() || "Unknown";
}

// ------------------------------------------------------------
// AMAZON helpers
// ------------------------------------------------------------
async function fetchSingleAmazonProduct(query) {
  if (!SERP_KEY) return null;
  const q = `${query} site:amazon.com/dp OR site:amazon.com/gp/product`;
  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(q)}&num=5&api_key=${SERP_KEY}`;
  const r = await fetch(url);
  const j = await r.json();
  return (j.organic_results || []).find(
    x => x.link?.includes("/dp/") || x.link?.includes("/gp/product")
  );
}

// ------------------------------------------------------------
// BUSINESS helpers
// ------------------------------------------------------------
async function fetchSingleLinkedInJob(jobTitle) {
  if (!SERP_KEY) return null;
  const q = `${jobTitle} site:linkedin.com/jobs`;
  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(q)}&num=5&api_key=${SERP_KEY}`;
  const r = await fetch(url);
  const j = await r.json();
  return (j.organic_results || []).find(x =>
    x.link?.includes("linkedin.com/jobs")
  );
}

// ------------------------------------------------------------
// YOUTUBE helpers
// ------------------------------------------------------------
async function normalizeYouTubeSearchIntent(rawInput) {
  if (!SERP_KEY || !rawInput) return rawInput;

  const q = `${rawInput} site:youtube.com/watch`;
  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(q)}&num=10&api_key=${SERP_KEY}`;
  const r = await fetch(url);
  const j = await r.json();

  const v = (j.organic_results || []).find(x =>
    x.link?.includes("watch?v=")
  );

  if (!v) return rawInput;

  return { title: v.title, link: v.link };
}

// ------------------------------------------------------------
// SERP reality validator
// ------------------------------------------------------------
async function isValidEntityForPersona(query, persona) {
  if (!SERP_KEY || !query) return false;

  const map = {
    YOUTUBER: `engine=youtube&search_query=${encodeURIComponent(query)}`,
    MARKETS: `tbm=nws&q=${encodeURIComponent(query)}`,
    AMAZON: `q=${encodeURIComponent(query + " site:amazon.com")}`,
    BUSINESS: `q=${encodeURIComponent(query + " site:linkedin.com/jobs")}`
  };

  const url = `https://serpapi.com/search.json?${map[persona]}&num=5&api_key=${SERP_KEY}`;
  const r = await fetch(url);
  const j = await r.json();

  return Boolean(
    (j.video_results && j.video_results.length) ||
    (j.news_results && j.news_results.length) ||
    (j.organic_results && j.organic_results.length)
  );
}

// ------------------------------------------------------------
// GENERATORS
// ------------------------------------------------------------
async function generatePredictionBody(sources, persona) {
  const signalText = sources.map(s => `• ${s.title} — ${s.source}`).join("\n");

  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Verified real-world signal:
${signalText}

START WITH THIS LINE EXACTLY:
2×-AI Engine — Real-Time AI Foresight
Reality · ${sixMonthDateLabel()}

Write a 6-month foresight analysis.
EXACTLY 5 short paragraphs.

Then write:
If this prediction is correct, what works:

Then EXACTLY 3 short sentences.
`
    }],
    temperature: 0.3
  });

  return out.choices[0].message.content.trim();
}

async function generateBusinessPrediction(jobTitle) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Labor Market Signal — LinkedIn
"${jobTitle}"

Reality · ${sixMonthDateLabel()}

Write EXACTLY 5 short paragraphs.
Then EXACTLY 3 short sentences.
`
    }],
    temperature: 0.3
  });

  return out.choices[0].message.content.trim();
}

// ------------------------------------------------------------
// AUTO MODE CLARITY CHECK
// ------------------------------------------------------------
async function isClearTopic(topic) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `Is this intelligible human language?\n"${topic}"\nReply YES or NO.`
    }],
    temperature: 0
  });
  return out.choices[0].message.content.trim() === "YES";
}

//////////////////////////////////////////////////////////////
// CHUNK-2C — AUTO MODE JOB GENERATOR (REQUIRED)
//////////////////////////////////////////////////////////////

// ------------------------------------------------------------
// BUSINESS — auto job title generator (LinkedIn)
// Used ONLY in AUTO MODE
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

Generate ONE real AI-related job title
that companies are actively recruiting for on LinkedIn.

Rules:
- Job title only
- No explanation
- No company names
- No punctuation
`
    }],
    temperature: 0.7
  });

  return out.choices[0].message.content.trim();
}

//////////////////////////////////////////////////////////////
// CHUNK-2D — LINKEDIN PREDICTION GENERATOR (FINAL)
//////////////////////////////////////////////////////////////

async function generateBusinessPrediction(jobTitle) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
You are a labor-market foresight analyst.

The hiring signal comes from this job role:
"${jobTitle}"

START WITH THIS LINE EXACTLY:
Labor Market Signal — LinkedIn
Reality · ${sixMonthDateLabel()}

Write EXACTLY 5 short paragraphs analyzing
why this role exists and what it signals.

Do NOT:
- Mention AI engines or platforms
- Mention Stanford
- Mention predictions explicitly
- Mention companies by name

Then write EXACTLY this line:
If this prediction is correct, what works:

Then write EXACTLY 3 short sentences
describing practical actions for job seekers or employers.
`
    }],
    temperature: 0.3
  });

  return out.choices[0].message.content.trim();
}

//////////////////////////////////////////////////////////////
// CHUNK-3 — GUARDS (THE LAW)
////////////////////////////////////////////////////////////////

// ------------------------------------------------------------
// User-facing rejection copy (single source of truth)
// ------------------------------------------------------------
const GUARD_COPY = {
  BUSINESS: "I don’t want this. I realize I should search for a job or a company.",
  AMAZON: "I don’t want this. I realize I should search for a cosmetic or a beauty product.",
  MARKETS: "I don’t want this. I realize I should search for a market or a company.",
  YOUTUBER: "I don’t want this. I realize I should search for an artist or a group."
};

// ------------------------------------------------------------
// Manual Mode Guard — HARD LAW
// Applied ONLY when manual === true
// ------------------------------------------------------------
async function runManualGuard({
  persona,
  topic,
  rawTopic,
  isValidEntityForPersona
}) {
  // ----------------------------------------------------------
  // YOUTUBER — ONLY artist / group names
  // ----------------------------------------------------------
  if (persona === "YOUTUBER") {
    const valid = await isValidEntityForPersona(rawTopic, "YOUTUBER");

    if (!valid || !isLikelyArtistOrGroupName(rawTopic)) {
      return {
        blocked: true,
        message: GUARD_COPY.YOUTUBER
      };
    }

    return { blocked: false };
  }

  // ----------------------------------------------------------
  // ALL OTHER PERSONAS — SERP + intent
  // ----------------------------------------------------------
  const valid = await isValidEntityForPersona(topic, persona);

  if (!valid || !intentMatchesPersona(topic, persona)) {
    return {
      blocked: true,
      message: GUARD_COPY[persona]
    };
  }

  return { blocked: false };
}

// ------------------------------------------------------------
// Auto Mode Guard — SOFT LAW
// Auto mode is NEVER blocked
// ------------------------------------------------------------
function runAutoGuard() {
  return { blocked: false };
}

//////////////////////////////////////////////////////////////
// CHUNK-4 — PERSONA ENGINES (4 BOXES)
//////////////////////////////////////////////////////////////

/* ==========================================================
   YOUTUBER ENGINE — MUSIC (ARTIST / GROUP ONLY)
   ========================================================== */
async function runYouTuberEngine({
  topic,
  lens,
  helpers
}) {
  const {
    openai,
    normalizeYouTubeSearchIntent,
    lensToStanfordYouTubeQuery,
    sixMonthDateLabel
  } = helpers;

  const channelQuery = lensToStanfordYouTubeQuery(lens);

  const ytSignal = await normalizeYouTubeSearchIntent(
    `${channelQuery} site:youtube.com/watch`
  );

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Stanford academic lens: ${lens}

Primary subject (real-world example):
"${topic}"

Analytical framework:
"${channelQuery}"

START WITH THIS LINE EXACTLY:
2×-AI Engine — Real-Time AI Foresight
Reality · ${sixMonthDateLabel()}

Task:
Write a 6-month cultural analysis of the artist or group above.

Rules:
- Artist / group is the ONLY focus
- Refer to them by name throughout
- Do NOT analyze platforms
- Do NOT generalize the industry
- EXACTLY 5 short paragraphs

Then write exactly:
If this reading is correct, what works:

Then EXACTLY 3 short sentences.
`
    }],
    temperature: 0.3
  });

  return {
    topic,
    report:
      `• ${lens} perspective — Stanford University (YouTube)\n` +
      `${ytSignal?.link || "No link found"}\n\n` +
      completion.choices[0].message.content
  };
}


/* ==========================================================
   AMAZON ENGINE — PRODUCTS
   ========================================================== */
async function runAmazonEngine({
  topic,
  helpers
}) {
  const {
    fetchSingleAmazonProduct,
    generatePredictionBody
  } = helpers;

  const product = await fetchSingleAmazonProduct(topic);
  if (!product) {
    return { report: "No product found." };
  }

  const body = await generatePredictionBody(
    [{ title: product.title, source: "Amazon" }],
    "AMAZON"
  );

  return {
    topic: product.title,
    report:
      `• ${product.title} — Amazon\n` +
      `${product.link}\n\n` +
      body
  };
}


/* ==========================================================
   BUSINESS ENGINE — JOB SIGNALS
   ========================================================== */
async function runBusinessEngine({
  topic,
  location,
  helpers
}) {
  const {
    fetchSingleLinkedInJob,
    generateBusinessPrediction,
    buildLinkedInJobUrl
  } = helpers;

  const job = await fetchSingleLinkedInJob(topic);
  if (!job) {
    return { report: "No job found." };
  }

  const body = await generateBusinessPrediction(topic);

  return {
    topic,
    report:
      `• ${topic} — LinkedIn\n` +
      `${buildLinkedInJobUrl(topic, location, true)}\n\n` +
      body
  };
}


/* ==========================================================
   MARKETS ENGINE — NEWS SIGNALS
   ========================================================== */
async function runMarketsEngine({
  topic,
  lens,
  location,
  helpers
}) {
  const {
    rewriteMarketTheme,
    fetchMarketSignal,
    extractCompanyNameFromTitle,
    generatePredictionBody
  } = helpers;

  const theme = await rewriteMarketTheme(topic, lens, location);
  const signal = await fetchMarketSignal(theme);

  if (!signal) {
    return { report: "No market signal found." };
  }

  const company = await extractCompanyNameFromTitle(signal.title);

  const body = await generatePredictionBody(
    [{ title: signal.title, source: "Reuters" }],
    "MARKETS"
  );

  return {
    topic: company,
    report:
      `• ${signal.title} — Google News\n` +
      `${signal.link}\n\n` +
      body
  };
}

//////////////////////////////////////////////////////////////
// CHUNK-4B — HELPERS REGISTRY (CRITICAL)
// Single dependency injection object
// THIS FIXES AUTO MODE FAILURE
//////////////////////////////////////////////////////////////

const helpers = {
  // --------------------------------------------------------
  // Core runtime
  // --------------------------------------------------------
  openai,
  fetch,

  // --------------------------------------------------------
  // Utilities
  // --------------------------------------------------------
  buildLinkedInJobUrl,
  sixMonthDateLabel,
  presentDateLabel,
  pickStanfordLens,
  lensToStanfordYouTubeQuery,
  isLikelyArtistOrGroupName,
  intentMatchesPersona,
  isRelevantToQuery,

  // --------------------------------------------------------
  // Guards
  // --------------------------------------------------------
  GUARD_COPY,

  // --------------------------------------------------------
  // SERP + extraction helpers
  // --------------------------------------------------------
  extractExplicitLocation,
  rewriteMarketTheme,
  fetchMarketSignal,
  extractCompanyNameFromTitle,
  fetchSingleAmazonProduct,
  fetchSingleLinkedInJob,
  isValidEntityForPersona,

  // --------------------------------------------------------
  // Generators (🔥 AUTO MODE DEPENDS ON THESE)
  // --------------------------------------------------------
  generatePredictionBody,
  generateBusinessPrediction,
  generateNextJobTitle,        // ✅ REQUIRED — FIXES AUTO MODE
  normalizeYouTubeSearchIntent,

  // --------------------------------------------------------
  // Persona engines
  // --------------------------------------------------------
  runYouTuberEngine,
  runAmazonEngine,
  runBusinessEngine,
  runMarketsEngine
};

//////////////////////////////////////////////////////////////
// CHUNK-5 — PIPELINE ORCHESTRATOR
// Decides flow. Enforces guards ONLY in manual mode.
// Auto mode = GPT leads, SERP follows (original behavior).
//////////////////////////////////////////////////////////////

async function runPipeline({
  topic,
  rawTopic,
  persona,
  manual,
  helpers
}) {
  const {
    // lenses & helpers
    pickStanfordLens,
    extractExplicitLocation,

    // SERP + guards
    isValidEntityForPersona,
    isLikelyArtistOrGroupName,
    intentMatchesPersona,
    GUARD_COPY,

    // generators
    generateNextJobTitle,

    // persona engines
    runYouTuberEngine,
    runAmazonEngine,
    runBusinessEngine,
    runMarketsEngine
  } = helpers;

  const lens = pickStanfordLens();

  /* --------------------------------------------------------
     LOCATION (BUSINESS ONLY)
  -------------------------------------------------------- */
  let location = null;
  if (persona === "BUSINESS") {
    location = await extractExplicitLocation(topic);
  }

  /* --------------------------------------------------------
     AUTO MODE = NO GUARDS, NO SERP BLOCKS
     (THIS IS THE ORIGINAL BEHAVIOR)
  -------------------------------------------------------- */
  if (!manual) {
    switch (persona) {

      case "YOUTUBER":
        return await runYouTuberEngine({
          topic,
          lens,
          helpers
        });

      case "AMAZON":
        return await runAmazonEngine({
          topic,
          helpers
        });

      case "BUSINESS": {
        // 🔑 GPT generates the job title in AUTO mode
        const jobTitle = await generateNextJobTitle(lens, location);

        return await runBusinessEngine({
          topic: jobTitle,
          location,
          helpers
        });
      }

      case "MARKETS":
        return await runMarketsEngine({
          topic,
          lens,
          location,
          helpers
        });

      default:
        return { report: "Unknown persona." };
    }
  }

  /* --------------------------------------------------------
     MANUAL MODE = HARD LAW (STRICT)
  -------------------------------------------------------- */

  // SERP reality check
  const serpQuery =
    persona === "YOUTUBER" ? rawTopic : topic;

  const isValid = await isValidEntityForPersona(
    serpQuery,
    persona
  );

  // 🔒 YOUTUBER — ARTIST / GROUP ONLY
  if (persona === "YOUTUBER") {
    if (!isValid || !isLikelyArtistOrGroupName(rawTopic)) {
      return {
        guard: "fallback",
        message: GUARD_COPY.YOUTUBER
      };
    }
  }
  // 🔒 ALL OTHER PERSONAS
  else {
    if (!isValid || !intentMatchesPersona(topic, persona)) {
      return {
        guard: "fallback",
        message: GUARD_COPY[persona]
      };
    }
  }

  /* --------------------------------------------------------
     MANUAL MODE DISPATCH
  -------------------------------------------------------- */
  switch (persona) {

    case "YOUTUBER":
      return await runYouTuberEngine({
        topic,
        lens,
        helpers
      });

    case "AMAZON":
      return await runAmazonEngine({
        topic,
        helpers
      });

    case "BUSINESS":
      return await runBusinessEngine({
        topic,
        location,
        helpers
      });

    case "MARKETS":
      return await runMarketsEngine({
        topic,
        lens,
        location,
        helpers
      });

    default:
      return { report: "Unknown persona." };
  }
}

//////////////////////////////////////////////////////////////
// CHUNK-6 — ROUTES (I/O ONLY)
// Express endpoints. No logic.
// Calls pipeline orchestrator.
// Handles normalization boundary.
//////////////////////////////////////////////////////////////

/* ----------------------------------------------------------
   RUN — MANUAL / DIRECT INPUT
---------------------------------------------------------- */
app.post("/run", async (req, res) => {
  try {
    let {
      topic = "",
      persona = "BUSINESS",
      manual = false
    } = req.body;

    // 🔑 Preserve raw identity (critical for YOUTUBER)
    const rawTopic = topic;

    // ❌ NEVER normalize YOUTUBER input
    if (persona !== "YOUTUBER") {
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
    }

    // 🔒 AUTO MODE clarity gate only
    if (!manual && !(await isClearTopic(topic))) {
      return res.json({ report: "Invalid topic." });
    }

    const result = await runPipeline({
      topic,
      rawTopic,
      persona,
      manual,
      helpers
    });

    res.json(result);

  } catch (e) {
    console.error("RUN ERROR:", e);
    res.status(500).json({ report: "Run failed." });
  }
});

/* ----------------------------------------------------------
   NEXT — AUTO MODE (ALWAYS DELIVERS)
---------------------------------------------------------- */
app.post("/next", async (req, res) => {
  try {
    const persona = req.body.persona || "BUSINESS";

    // Minimal seed — engine decides content
    const seed =
      persona === "MARKETS" ? "AI infrastructure" :
      persona === "AMAZON"  ? "" :
      persona === "YOUTUBER"? "" :
      "";

    const result = await runPipeline({
      topic: seed,
      rawTopic: seed,
      persona,
      manual: false,
      helpers
    });

    res.json(result);

  } catch (e) {
    console.error("NEXT ERROR:", e);
    res.status(500).json({ report: "Auto mode failed." });
  }
});

//////////////////////////////////////////////////////////////
// SERVER START (REQUIRED FOR RENDER)
//////////////////////////////////////////////////////////////

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🌊 Blue Ocean Browser running on port ${PORT}`);
});