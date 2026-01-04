//////////////////////////////////////////////////////////////
// STANFORD × AMAZON BEAUTY FORESIGHT ENGINE
// FINAL DEPLOY-SAFE VERSION
//////////////////////////////////////////////////////////////

const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const OpenAI = require("openai");

//////////////////////////////////////////////////////////////
// APP BOOTSTRAP (ROOT FIRST — IMPORTANT FOR RENDER)
//////////////////////////////////////////////////////////////
const app = express();

// 🔴 MUST BE FIRST: Render health check
app.get("/", (req, res) => {
  res.status(200).send("OK");
});

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());
app.options("*", cors());

//////////////////////////////////////////////////////////////
// OPENAI CLIENT
//////////////////////////////////////////////////////////////
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

//////////////////////////////////////////////////////////////
// SERP API
//////////////////////////////////////////////////////////////
const SERP_KEY = process.env.SERPAPI_KEY || null;

//////////////////////////////////////////////////////////////
// DATE UTIL
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
// STANFORD MAJORS — NO REPEAT ROTATION
//////////////////////////////////////////////////////////////
const STANFORD_MAJORS = [
  "Psychology",
  "Economics",
  "Design",
  "Sociology",
  "Computer Science",
  "Statistics",
  "Symbolic Systems",
  "Communication",
  "Education",
  "Philosophy",
  "Law",
  "Environmental Science"
];

let majorPool = [...STANFORD_MAJORS];

function pickStanfordMajor() {
  if (majorPool.length === 0) {
    majorPool = [...STANFORD_MAJORS];
  }
  const index = Math.floor(Math.random() * majorPool.length);
  return majorPool.splice(index, 1)[0];
}

//////////////////////////////////////////////////////////////
// AMAZON PRODUCT MEMORY — NO REPEAT (LAST N)
//////////////////////////////////////////////////////////////
const AMAZON_MEMORY_LIMIT = 5;
const amazonMemory = [];

function rememberAmazon(title) {
  amazonMemory.unshift(title);
  if (amazonMemory.length > AMAZON_MEMORY_LIMIT) {
    amazonMemory.pop();
  }
}

//////////////////////////////////////////////////////////////
// AMAZON BEAUTY SEARCH (HARD-LOCKED DOMAIN)
//////////////////////////////////////////////////////////////
async function fetchAmazonBeautyProduct(query) {
  if (!SERP_KEY || !query) return null;

  const q = `
    ${query}
    (cosmetic OR beauty OR skincare OR makeup OR haircare)
    site:amazon.com/dp OR site:amazon.com/gp/product
  `;

  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(q)}&num=10&api_key=${SERP_KEY}`;
  const r = await fetch(url);
  const j = await r.json();

  return (j.organic_results || []).find(
    x =>
      (x.link?.includes("/dp/") || x.link?.includes("/gp/product")) &&
      !amazonMemory.includes(x.title)
  );
}

//////////////////////////////////////////////////////////////
// AUTO MODE — BEAUTY EXAMPLE GENERATOR
//////////////////////////////////////////////////////////////
async function generateBeautyExample() {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Generate ONE real cosmetic or beauty product
commonly sold on Amazon.

Rules:
- Beauty only
- Brand + product name
- No punctuation
- No explanation
`
    }],
    temperature: 0.7
  });

  return out.choices[0].message.content.trim();
}

//////////////////////////////////////////////////////////////
// STANFORD OFFICIAL YOUTUBE VIDEO
//////////////////////////////////////////////////////////////
async function fetchStanfordVideo(major) {
  if (!SERP_KEY) return null;

  const q = `Stanford University ${major} site:youtube.com/watch`;
  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(q)}&num=10&api_key=${SERP_KEY}`;
  const r = await fetch(url);
  const j = await r.json();

  return (j.organic_results || []).find(v =>
    v.link?.includes("youtube.com/watch")
  );
}

//////////////////////////////////////////////////////////////
// REPORT GENERATOR (LAYOUT LOCKED)
//////////////////////////////////////////////////////////////
async function generateReport({ major, videoTitle, productTitle }) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
You are teaching a Stanford University class
from the perspective of ${major}.

This is the material we are studying today:
"${productTitle}"

This product is not an example.
It is the primary object of study.

We are using the following official Stanford lecture
as the academic lens for interpretation:
"${videoTitle}"

START WITH THIS LINE EXACTLY:
2×-AI Engine — Stanford Academic Foresight
Reality · ${sixMonthDateLabel()}

Task:
- Treat the Amazon product as the central case material
- Explain why this product exists, how people use it, and what it signals
- Apply concepts implied by the Stanford lecture directly to this product
- Teach how an expert in ${major} would reason through this case
- Keep the focus on thinking, not judging or selling

Rules:
- Academic, calm, adult teaching tone
- No marketing language
- No product review language
- No calls to action
- EXACTLY 5 short paragraphs

Then write:
If this way of thinking is correct, what works:

Then EXACTLY 3 short sentences.
`
    }],
    temperature: 0.3
  });

  return out.choices[0].message.content.trim();
}

//////////////////////////////////////////////////////////////
// UNIFIED PIPELINE (AUTO = MANUAL)
//////////////////////////////////////////////////////////////
async function runPipeline(exampleInput) {
  const major = pickStanfordMajor();

  const stanfordVideo = await fetchStanfordVideo(major);
  if (!stanfordVideo) {
    return { report: "No Stanford University video found." };
  }

  const product = await fetchAmazonBeautyProduct(exampleInput);
  if (!product) {
    return { report: "No Amazon cosmetic or beauty product found." };
  }

  rememberAmazon(product.title);

  const body = await generateReport({
    major,
    videoTitle: stanfordVideo.title,
    productTitle: product.title
  });

  return {
    major,
    stanfordLink: stanfordVideo.link,
    amazonLink: product.link,
    report:
`• ${major} — Stanford University
${stanfordVideo.link}

Example reference:
${product.link}

${body}`
  };
}

//////////////////////////////////////////////////////////////
// ROUTES
//////////////////////////////////////////////////////////////
app.post("/run", async (req, res) => {
  try {
    const { topic = "" } = req.body;
    res.json(await runPipeline(topic));
  } catch (e) {
    console.error("RUN ERROR:", e);
    res.status(500).json({ report: "Run failed." });
  }
});

app.post("/next", async (_, res) => {
  try {
    const example = await generateBeautyExample();
    res.json(await runPipeline(example));
  } catch (e) {
    console.error("NEXT ERROR:", e);
    res.status(500).json({ report: "Auto failed." });
  }
});

//////////////////////////////////////////////////////////////
// SERVER START (RENDER READY)
//////////////////////////////////////////////////////////////
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🎓 Stanford × Amazon Beauty Foresight live");
});