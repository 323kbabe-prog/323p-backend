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
// USER QUERY REWRITE LAYER (NEW, SHARED)
// ------------------------------------------------------------
async function rewriteUserQuery(input) {
  if (!input || typeof input !== "string") return null;

  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
If the text contains NO real human words, reply ONLY: NONE.
Otherwise:
- extract meaningful real words
- correct misspellings
- remove questions / commands
- rewrite as a short, world-observable topic (2–6 words)

Text:
"${input}"

Reply ONLY with the rewritten topic or NONE.
`
    }],
    temperature: 0
  });

  const t = out.choices[0].message.content.trim();
  return t === "NONE" ? null : t;
}

// ------------------------------------------------------------
// SEMANTIC GATE (MODIFIED: tolerant)
// ------------------------------------------------------------
async function isClearTopic(topic) {
  if (!topic) return false;
  return true; // only gibberish is rejected earlier
}

// ------------------------------------------------------------
// (ALL EXISTING PIPELINE CODE BELOW IS UNCHANGED)
// MARKETS / BUSINESS / AMAZON LOGIC
// Stanford lenses
// Memories
// runPipeline()
// ------------------------------------------------------------

// ---------------- ROUTES ----------------

app.post("/run", async (req, res) => {
  const { topic = "", persona = "BUSINESS" } = req.body;

  const rewritten = await rewriteUserQuery(topic);
  if (!rewritten) {
    return res.json({ report: "No observable signal found." });
  }

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

app.listen(process.env.PORT || 3000, () =>
  console.log("🌊 Blue Ocean Browser running")
);