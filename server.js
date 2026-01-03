//////////////////////////////////////////////////////////////
// AMAZON-ONLY AI FORESIGHT ENGINE
// Blue Ocean Browser
//////////////////////////////////////////////////////////////

const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const OpenAI = require("openai");

//////////////////////////////////////////////////////////////
// APP BOOTSTRAP
//////////////////////////////////////////////////////////////
const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// ✅ IMPORTANT: handle CORS preflight (fixes OPTIONS 502)
app.options("*", cors());

// ✅ IMPORTANT: root health check (fixes GET / 502)
app.get("/", (req, res) => {
  res.status(200).send("Amazon AI Foresight is running.");
});

//////////////////////////////////////////////////////////////
// OPENAI CLIENT
//////////////////////////////////////////////////////////////
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

//////////////////////////////////////////////////////////////
// EXTERNAL API KEYS
//////////////////////////////////////////////////////////////
const SERP_KEY = process.env.SERPAPI_KEY || null;

//////////////////////////////////////////////////////////////
// UTILITIES
//////////////////////////////////////////////////////////////
function sixMonthDateLabel() {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

//////////////////////////////////////////////////////////////
// AMAZON SERP FETCH
//////////////////////////////////////////////////////////////
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

//////////////////////////////////////////////////////////////
// AUTO MODE — AMAZON PRODUCT SEED (CRITICAL)
//////////////////////////////////////////////////////////////
async function generateNextAmazonQuery() {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Generate ONE real cosmetic or beauty product
commonly sold on Amazon.

Rules:
- Product name only
- Must be specific (brand + product)
- No explanation
- No punctuation
`
    }],
    temperature: 0.7
  });

  return out.choices[0].message.content.trim();
}

//////////////////////////////////////////////////////////////
// AMAZON FORESIGHT GENERATOR
//////////////////////////////////////////////////////////////
async function generateAmazonPrediction(productTitle) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Verified Amazon product:
"${productTitle}"

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
    temperature: 0.3
  });

  return out.choices[0].message.content.trim();
}

//////////////////////////////////////////////////////////////
// AMAZON ENGINE (SINGLE PATH)
//////////////////////////////////////////////////////////////
async function runAmazon(topic) {
  const product = await fetchSingleAmazonProduct(topic);

  if (!product) {
    return { report: "No Amazon product found." };
  }

  const body = await generateAmazonPrediction(product.title);

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

// MANUAL SEARCH
app.post("/run", async (req, res) => {
  try {
    const { topic = "" } = req.body;
    const result = await runAmazon(topic);
    res.json(result);
  } catch (e) {
    console.error("RUN ERROR:", e);
    res.status(500).json({ report: "Amazon run failed." });
  }
});

// AUTO MODE (FIXED)
app.post("/next", async (req, res) => {
  try {
    const seed = await generateNextAmazonQuery();
    const result = await runAmazon(seed);
    res.json(result);
  } catch (e) {
    console.error("NEXT ERROR:", e);
    res.status(500).json({ report: "Amazon auto failed." });
  }
});

//////////////////////////////////////////////////////////////
// SERVER START (RENDER READY)
//////////////////////////////////////////////////////////////
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🟦 Amazon AI Foresight running on port ${PORT}`);
});