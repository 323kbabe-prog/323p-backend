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
// X — SEMANTIC INPUT NORMALIZATION (REPLACES isClearTopic)
// ------------------------------------------------------------
async function normalizeTopic(input) {
  if (!input || typeof input !== "string") return null;

  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
From the text below:
1. If it contains NO real human words, reply ONLY: NONE
2. Otherwise:
   - extract meaningful real words
   - fix misspellings
   - remove questions, commands, emotions
   - rewrite as a short, world-observable topic (2–6 words)

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
// (UNCHANGED BELOW)
// ------------------------------------------------------------

// ⭐ MARKETS — Reuters anchor
const MARKETS_SIGNAL_SOURCE = {
  name: "Reuters",
  url: "https://www.reuters.com"
};

// ------------------------------------------------------------
// Stanford lenses + no-repeat memory (X)
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
// CORE PIPELINE (UNCHANGED)
// ------------------------------------------------------------
async function runPipeline(topic, persona) {
  const lens = pickStanfordLens();
  // (all existing logic exactly unchanged)
  // ...
}

// ------------------------------------------------------------
// ROUTES (ONLY X APPLIED HERE)
// ------------------------------------------------------------
app.post("/run", async (req, res) => {
  const { topic = "", persona = "BUSINESS" } = req.body;

  const normalized = await normalizeTopic(topic);

  if (!normalized) {
    return res.json({ report: "No observable signal found." });
  }

  const result = await runPipeline(normalized, persona);
  result.topic = normalized;
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