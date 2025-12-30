//////////////////////////////////////////////////////////////
// Blue Ocean Browser — REAL AI GD-J + 8-BALL + AMAZON (STATELESS)
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
// Utilities — URLs
// ------------------------------------------------------------
function buildLinkedInJobUrl(jobTitle, location, manual) {
  const base = "https://www.linkedin.com/jobs/search/?";
  const params = new URLSearchParams();
  params.set("keywords", jobTitle);
  if (manual && location) params.set("location", location);
  return base + params.toString();
}

// ------------------------------------------------------------
// Utilities — Dates
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
// Utilities — Text / Shape Validators
// ------------------------------------------------------------
function isLikelyArtistOrGroupName(query) {
  if (!query) return false;

  const q = query.trim();

  // ❌ Block generic music concepts
  if (/\b(music|songs|genre|playlist|beats|mix|album|lyrics)\b/i.test(q)) {
    return false;
  }

  // ✅ Allow artist / group name shapes
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
// Utilities — Relevance Scoring
// ------------------------------------------------------------
function isRelevantToQuery(query, title) {
  const q = query.toLowerCase();
  const t = title.toLowerCase();

  const keywords = q.split(/\s+/).filter(w => w.length > 3);
  return keywords.some(word => t.includes(word));
}

// ------------------------------------------------------------
// GUARDS — User-Facing Copy
// ------------------------------------------------------------
const GUARD_COPY = {
  BUSINESS: "I don’t want this. I realize I should search for a job or a company.",
  AMAZON: "I don’t want this. I realize I should search for a cosmetic or a beauty product.",
  MARKETS: "I don’t want this. I realize I should search for a market or a company.",
  YOUTUBER: "I don’t want this. I realize I should search for an artist or a group."
};

// ------------------------------------------------------------
// GUARDS — Manual Mode Law
// ------------------------------------------------------------
async function runManualGuard({
  persona,
  topic,
  rawTopic,
  isValidEntityForPersona
}) {
  // 🔒 YOUTUBER — artist / group names ONLY
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

  // 🔒 OTHER PERSONAS — SERP + intent
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
// GUARDS — Auto Mode Law
// ------------------------------------------------------------
function runAutoGuard() {
  // Auto mode is NEVER blocked
  return { blocked: false };
}

//////////////////////////////////////////////////////////////
// CHUNK 4 — PERSONA ENGINES (4 BOXES)
// Execution only. No guards. No routing. No normalization.
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
// CHUNK 5 — PIPELINE ORCHESTRATOR
// Decides flow. Calls guards. Dispatches persona engines.
// No I/O. No Express. No OpenAI prompts here.
//////////////////////////////////////////////////////////////

async function runPipeline({
  topic,
  rawTopic,
  persona,
  manual,
  helpers
}) {
  const {
    pickStanfordLens,
    extractExplicitLocation,

    // guards
    isValidEntityForPersona,
    isLikelyArtistOrGroupName,
    intentMatchesPersona,
    GUARD_COPY,

    // engines
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
     SERP REALITY CHECK
     - YOUTUBER uses rawTopic
     - Others use normalized topic
  -------------------------------------------------------- */
  const serpQuery =
    persona === "YOUTUBER" ? rawTopic : topic;

  const isValid = await isValidEntityForPersona(
    serpQuery,
    persona
  );

  /* --------------------------------------------------------
     MANUAL MODE — HARD LAW
  -------------------------------------------------------- */
  if (manual) {

    // YOUTUBER: artist / group ONLY
    if (persona === "YOUTUBER") {
      if (!isValid || !isLikelyArtistOrGroupName(rawTopic)) {
        return {
          guard: "fallback",
          message: GUARD_COPY.YOUTUBER
        };
      }
    }

    // ALL OTHER PERSONAS
    else {
      if (!isValid || !intentMatchesPersona(topic, persona)) {
        return {
          guard: "fallback",
          message: GUARD_COPY[persona]
        };
      }
    }
  }

  /* --------------------------------------------------------
     PERSONA DISPATCH
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
      return {
        report: "Unknown persona."
      };
  }
}

//////////////////////////////////////////////////////////////
// CHUNK 6 — ROUTES (I/O ONLY)
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

    // ❌ NEVER normalize YouTUBER input
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

    // AUTO MODE clarity gate only
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