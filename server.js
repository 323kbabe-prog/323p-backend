//////////////////////////////////////////////////////////////
// AMAZON-ONLY AI FORESIGHT ENGINE
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

//////////////////////////////////////////////////////////////
// UTILITIES
//////////////////////////////////////////////////////////////
function sixMonthDateLabel() {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toLocaleDateString("en-US", {
    year:"numeric",
    month:"long",
    day:"numeric"
  });
}

async function fetchSingleAmazonProduct(query) {
  if (!SERP_KEY || !query) return null;
  const q = `${query} site:amazon.com/dp OR site:amazon.com/gp/product`;
  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(q)}&num=5&api_key=${SERP_KEY}`;
  const r = await fetch(url);
  const j = await r.json();
  return (j.organic_results || []).find(
    x => x.link?.includes("/dp/") || x.link?.includes("/gp/product")
  );
}

async function generatePredictionBody(title) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role:"user",
      content: `
Verified Amazon product:
"${title}"
START WITH THIS LINE EXACTLY:
2×-AI Engine — Real-Time AI Foresight
Reality · ${sixMonthDateLabel()}
Write EXACTLY 5 short paragraphs forecasting
how demand, positioning, or usage may evolve
over the next six months.
Then write:
If this prediction is correct, what works:
Then EXACTLY 3 short sentences.
`
    }],
    temperature:0.3
  });
  return out.choices[0].message.content.trim();
}

//////////////////////////////////////////////////////////////
// AMAZON ENGINE
//////////////////////////////////////////////////////////////
async function runAmazon(topic) {
  const product = await fetchSingleAmazonProduct(topic);
  if (!product) {
    return { report: "No Amazon product found." };
  }
  const body = await generatePredictionBody(product.title);
  return {
    report:
      `• ${product.title} — Amazon\n` +
      `${product.link}\n\n` +
      body
  };
}

//////////////////////////////////////////////////////////////
// ROUTES
//////////////////////////////////////////////////////////////
app.post("/run", async (req, res) => {
  try {
    const { topic = "" } = req.body;
    const result = await runAmazon(topic);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ report: "Amazon run failed." });
  }
});

app.post("/next", async (req, res) => {
  try {
    const result = await runAmazon("");
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ report: "Amazon auto failed." });
  }
});

//////////////////////////////////////////////////////////////
// SERVER
//////////////////////////////////////////////////////////////
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🟦 Amazon AI Foresight running on port ${PORT}`);
});