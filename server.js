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
// Stanford lenses + no-repeat memory
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
// Semantic clarity gate — MANUAL INPUT ONLY
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
// (ALL EXISTING PIPELINE FUNCTIONS UNCHANGED)
// rewriteMarketTheme
// fetchMarketSignal
// extractCompanyNameFromTitle
// generateNextAmazonTopic
// fetchSingleAmazonProduct
// generateNextJobTitle
// fetchSingleLinkedInJob
// sixMonthDateLabel
// generatePredictionBody
// runPipeline
// ------------------------------------------------------------


// ============================================================
// ROUTES — CLEAN SEPARATION
// ============================================================

/**
 * AUTO SEARCH
 * - system driven
 * - no user input
 * - NEVER validated
 */
app.post("/auto", async (req, res) => {
  const persona = req.body.persona || "BUSINESS";
  const seed = persona === "MARKETS" ? "AI infrastructure" : "";
  res.json(await runPipeline(seed, persona));
});

/**
 * MANUAL SEARCH
 * - user driven
 * - validated
 * - never auto-triggered
 */
app.post("/run", async (req, res) => {
  const { topic, persona = "BUSINESS" } = req.body;

  if (!topic || !topic.trim()) {
    return res.json({ report: "No topic provided." });
  }

  if (!(await isClearTopic(topic))) {
    return res.json({ report: "Invalid topic." });
  }

  res.json(await runPipeline(topic.trim(), persona));
});

// ------------------------------------------------------------
app.listen(process.env.PORT || 3000, () =>
  console.log("🌊 Blue Ocean Browser running")
);