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
// X — USER QUERY REWRITE LAYER (NEW, SHARED, PRE-PERSONA)
// ------------------------------------------------------------
async function rewriteUserQuery(input) {
  if (!input || typeof input !== "string") return null;

  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
If the text below contains NO real human words, reply ONLY: NONE.

Otherwise:
- extract real meaningful words
- correct misspellings
- remove questions, commands, and emotions
- rewrite into a short, world-observable topic (2–6 words)

Text:
"${input}"

Reply ONLY with the rewritten topic or NONE.
`
    }],
    temperature: 0
  });

  const result = out.choices[0].message.content.trim();
  if (result === "NONE") return null;
  return result;
}

// ------------------------------------------------------------
// EXISTING SEMANTIC CLARITY GATE (UNCHANGED)
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
// MARKETS — Reuters anchor (UNCHANGED)
// ------------------------------------------------------------
const MARKETS_SIGNAL_SOURCE = {
  name: "Reuters",
  url: "https://www.reuters.com"
};

// ------------------------------------------------------------
// Stanford lenses + no-repeat memory (UNCHANGED)
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
// (ALL OTHER FUNCTIONS UNCHANGED)
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

// ------------------------------------------------------------
// ROUTES (ONLY X APPLIED HERE)
// ------------------------------------------------------------
app.post("/run", async (req, res) => {
  const { topic = "", persona = "BUSINESS" } = req.body;

  // X — user-query rewrite happens FIRST
  const rewritten = await rewriteUserQuery(topic);
  if (!rewritten) {
    return res.json({ report: "No observable signal found." });
  }

  // Existing semantic gate remains
  if (!(await isClearTopic(rewritten))) {
    return res.json({ report: "No observable signal found." });
  }

  const result = await runPipeline(rewritten, persona);
  result.topic = rewritten;
  res.json(result);
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