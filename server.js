//////////////////////////////////////////////////////////////
// STANFORD ACADEMIC FORESIGHT ENGINE
// Example domain locked to AMAZON COSMETIC / BEAUTY PRODUCTS
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
app.options("*", cors());

// Health check
app.get("/", (req, res) => {
  res.status(200).send("Stanford × Amazon Beauty Foresight is running.");
});

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
// STANFORD MAJORS (PERSONA POOL)
//////////////////////////////////////////////////////////////
const STANFORD_MAJORS = [
  "Computer Science",
  "Psychology",
  "Economics",
  "Sociology",
  "Political Science",
  "Symbolic Systems",
  "Statistics",
  "Design",
  "Communication",
  "Education",
  "Philosophy",
  "Law",
  "Biomedical Engineering",
  "Environmental Science"
];

function pickStanfordMajor() {
  return STANFORD_MAJORS[
    Math.floor(Math.random() * STANFORD_MAJORS.length)
  ];
}

//////////////////////////////////////////////////////////////
// DATE
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
// AMAZON BEAUTY EXAMPLE (HARD-LOCKED DOMAIN)
//////////////////////////////////////////////////////////////
async function fetchAmazonBeautyProduct(query) {
  if (!SERP_KEY || !query) return null;

  const beautyQuery = `
    ${query}
    (cosmetic OR beauty OR skincare OR makeup OR haircare)
    site:amazon.com/dp OR site:amazon.com/gp/product
  `;

  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(beautyQuery)}&num=8&api_key=${SERP_KEY}`;
  const r = await fetch(url);
  const j = await r.json();

  return (j.organic_results || []).find(
    x =>
      x.link?.includes("/dp/") ||
      x.link?.includes("/gp/product")
  );
}

//////////////////////////////////////////////////////////////
// AUTO MODE — BEAUTY PRODUCT EXAMPLE GENERATOR
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
- Beauty / skincare / makeup / haircare ONLY
- Product name only
- Must include brand
- No explanation
- No punctuation
`
    }],
    temperature: 0.7
  });

  return out.choices[0].message.content.trim();
}

//////////////////////////////////////////////////////////////
// STANFORD OFFICIAL YOUTUBE VIDEO FETCH
//////////////////////////////////////////////////////////////
async function fetchStanfordYouTubeVideo(major) {
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
// STANFORD REPORT GENERATOR (UNIFIED)
//////////////////////////////////////////////////////////////
async function generateStanfordReport({
  beautyExample,
  major,
  video
}) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
You are thinking as a Stanford University professor
with a background in ${major}.

Official Stanford lecture reference:
"${video.title}"

The following is a real Amazon cosmetic / beauty product:
"${beautyExample}"

START WITH THIS LINE EXACTLY:
2×-AI Engine — Stanford Academic Foresight
Reality · ${sixMonthDateLabel()}

Task:
- Use the Stanford lecture as authoritative grounding
- Use the beauty product as a real-world example
- Explain concepts clearly
- Teach how experts think
- Project why this way of thinking matters over the next six months

Rules:
- Academic, teaching-first tone
- No hype
- No platform analysis
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
// UNIFIED PIPELINE (AUTO & MANUAL SHARE THIS)
//////////////////////////////////////////////////////////////
async function runUnifiedPipeline(exampleInput) {
  const major = pickStanfordMajor();
  const video = await fetchStanfordYouTubeVideo(major);

  if (!video) {
    return { report: "No Stanford University video found." };
  }

  const product = await fetchAmazonBeautyProduct(exampleInput);
  if (!product) {
    return { report: "No Amazon cosmetic or beauty product found." };
  }

  const body = await generateStanfordReport({
    beautyExample: product.title,
    major,
    video
  });

  return {
    report:
      `• ${major} — Stanford University\n` +
      `${video.link}\n\n` +
      body
  };
}

//////////////////////////////////////////////////////////////
// ROUTES
//////////////////////////////////////////////////////////////

// MANUAL MODE — USER PROVIDES BEAUTY EXAMPLE
app.post("/run", async (req, res) => {
  try {
    const { topic = "" } = req.body;
    const result = await runUnifiedPipeline(topic);
    res.json(result);
  } catch (e) {
    console.error("RUN ERROR:", e);
    res.status(500).json({ report: "Stanford run failed." });
  }
});

// AUTO MODE — AI PROVIDES BEAUTY EXAMPLE
app.post("/next", async (req, res) => {
  try {
    const example = await generateBeautyExample();
    const result = await runUnifiedPipeline(example);
    res.json(result);
  } catch (e) {
    console.error("NEXT ERROR:", e);
    res.status(500).json({ report: "Stanford auto failed." });
  }
});

//////////////////////////////////////////////////////////////
// SERVER START
//////////////////////////////////////////////////////////////
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🎓 Stanford × Amazon Beauty Foresight running on port ${PORT}`);
});