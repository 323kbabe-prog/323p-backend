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

// Keep last N Amazon topics to reduce repetition
const AMAZON_TOPIC_MEMORY = [];
const AMAZON_MEMORY_LIMIT = 5;

/* ------------------------------------------------------------
   Utility — relative freshness label
------------------------------------------------------------ */
function relativeTime(dateStr) {
  if (!dateStr) return "recent";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "recent";
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diff <= 1) return "today";
  if (diff <= 7) return `${diff} days ago`;
  return "recent";
}

/* ------------------------------------------------------------
   REAL STANFORD UNIVERSITY MAJORS (BUSINESS LENSES)
------------------------------------------------------------ */
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

function pickNextMajor(lastMajor = "") {
  const pool = STANFORD_MAJORS.filter(m => m !== lastMajor);
  return pool[Math.floor(Math.random() * pool.length)];
}

/* ------------------------------------------------------------
   STEP 1 — Semantic clarity check
------------------------------------------------------------ */
async function isClearTopic(topic) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Is the following text a meaningful topic or question
that a human would realistically search?
Reply ONLY YES or NO.

"${topic}"
`
    }],
    temperature: 0
  });
  return out.choices[0].message.content.trim() === "YES";
}

/* ------------------------------------------------------------
   AMAZON — A. Wang chooses WHAT TO BUY (unchanged)
------------------------------------------------------------ */
async function generateNextTopicAWang(lastTopic = "") {
  const recent = AMAZON_TOPIC_MEMORY.join(", ");

  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
You are A. Wang, an Amazon cosmetics buyer.

Choose ONE cosmetics category or product
that you would consider buying this season.

Avoid choosing anything similar to:
${recent || lastTopic}

Rules:
- Buyer mindset
- Practical, purchase-oriented
- Avoid repetition or near-duplicates
- 4–8 words

Output ONLY the topic.
`
    }],
    temperature: 0.7
  });

  const topic = out.choices[0].message.content.trim();

  // Update memory
  AMAZON_TOPIC_MEMORY.push(topic);
  if (AMAZON_TOPIC_MEMORY.length > AMAZON_MEMORY_LIMIT) {
    AMAZON_TOPIC_MEMORY.shift();
  }

  return topic;
}

/* ------------------------------------------------------------
   AMAZON — Find ONE Amazon product via Google
------------------------------------------------------------ */
async function fetchSingleAmazonProduct(query) {
  if (!SERP_KEY) return null;

  try {
    const q = `${query} site:amazon.com/dp OR site:amazon.com/gp/product`;
    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(q)}&num=5&api_key=${SERP_KEY}`;
    const r = await fetch(url);
    const j = await r.json();

    const product = (j.organic_results || []).find(
      x => x.link && (x.link.includes("/dp/") || x.link.includes("/gp/product/"))
    );

    if (!product) return null;

    return {
      title: product.title || "",
      link: product.link || "",
      source: "Amazon"
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------
   BUSINESS — Fetch ONE LinkedIn job (NEW)
------------------------------------------------------------ */
async function fetchSingleLinkedInJob(jobTitle) {
  if (!SERP_KEY) return null;

  try {
    const q = `${jobTitle} site:linkedin.com/jobs`;
    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(q)}&num=5&api_key=${SERP_KEY}`;
    const r = await fetch(url);
    const j = await r.json();

    const job = (j.organic_results || []).find(
      x => x.link && x.link.includes("linkedin.com/jobs")
    );

    if (!job) return null;

    return {
      title: job.title || jobTitle,
      link: job.link || "",
      source: "LinkedIn"
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------
   6-month future date label
------------------------------------------------------------ */
function sixMonthDateLabel() {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

/* ------------------------------------------------------------
   STEP 5 — Generate foresight BODY ONLY (unchanged)
------------------------------------------------------------ */
async function generatePredictionBody(sources, persona) {
  const signalText = sources.map(s => `• ${s.title} — ${s.source}`).join("\n");

  const personaPrompt =
    persona === "AMAZON"
      ? `
You are an AI product-use analyst.

Focus ONLY on the product itself, from a real user perspective.

Analyze:
- Why people use this product
- What problem it solves
- How people evaluate it before buying
- How daily or seasonal usage may change in the next six months
- What could cause user disappointment or abandonment

DO NOT discuss:
- business strategy
- brand competition
- pricing strategy
- market share
`
      : `
You are an AI labor-market foresight system.

Analyze:
- hiring intent
- labor demand
- organizational priorities
`;

  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
${personaPrompt}

Verified real-world signal:
${signalText}

Write ONLY:

Persona: ${persona}

Reality · ${sixMonthDateLabel()}:
Write EXACTLY 5 short paragraphs, in this order:

1. What is actually happening right now (grounded in signals)
2. Why users or organizations are behaving this way
3. How decisions are being made today
4. What is likely to shift over the next six months
5. What assumptions this prediction depends on

If This Prediction Is Wrong, What Breaks:
- 3 bullet points
`
    }],
    temperature: 0.3
  });

  return out.choices[0].message.content.trim();
}

async function generatePredictionBodySafe(sources, persona) {
  const text = await generatePredictionBody(sources, persona);

  if (!text.trimStart().startsWith(`Persona: ${persona}`)) {
    const retryText = await generatePredictionBody(sources, persona);

    if (!retryText.trimStart().startsWith(`Persona: ${persona}`)) {
      return "";
    }

    return retryText.replace(/^Persona:\s*\w+\s*/i, "");
  }

  return text.replace(/^Persona:\s*\w+\s*/i, "");
}
/* ------------------------------------------------------------
   2×-AI Engine TOPIC GENERATORS
------------------------------------------------------------ */
async function generateNextTopicGDJ(lastTopic = "", lastMajor = "") {
  const major = pickNextMajor(lastMajor);

  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
You are GD-J, a LinkedIn job-market advisor.

Academic lens:
${major} (Stanford University)

Generate ONE job title
that companies are likely hiring for in the next 3–6 months.

Rules:
- Use real job titles
- Avoid repeating: "${lastTopic}"
- Neutral, analytical tone
- Output ONLY the job title
`
    }],
    temperature: 0.7
  });

  return {
    topic: out.choices[0].message.content.trim(),
    major
  };
}

/* ------------------------------------------------------------
   CORE PIPELINE
------------------------------------------------------------ */
async function runPipeline(topic, persona) {

  // BUSINESS = LinkedIn Job Advisor
  if (persona === "BUSINESS") {
    const job = await fetchSingleLinkedInJob(topic);
    if (!job) return { report: "No LinkedIn job signals found." };

    const body = await generatePredictionBodySafe(
  [{ title: job.title, source: "LinkedIn" }],
  "BUSINESS"
);

    let report = "Current Signals (Ranked by Impact Level)\n";
    report += `• ${job.title} — LinkedIn\n`;
    report += `  ${job.link}\n`;

    return { report: report + "\n" + body };
  }

  // AMAZON (unchanged)
  const product = await fetchSingleAmazonProduct(topic);
  if (!product) return { report: "No Amazon product found for this topic." };

  const brand = product.title.split(" ")[0];
  
  const body = await generatePredictionBodySafe(
  [{ title: product.title, source: "Amazon" }],
  "AMAZON"
);

  let report = "Current Signals (Ranked by Impact Level)\n";
  report += `• ${product.title} — ${brand}\n`;
  report += `  ${product.link}\n`;

  return {
    topic: `${brand} ${topic}`,
    report: report + "\n" + body
  };
}

/* ------------------------------------------------------------
   /run
------------------------------------------------------------ */
app.post("/run", async (req, res) => {
  const topic = (req.body.topic || "").trim();
  const persona = req.body.persona || "BUSINESS";

  if (!(await isClearTopic(topic))) {
    return res.json({ report: "Invalid topic." });
  }

  res.json(await runPipeline(topic, persona));
});

/* ------------------------------------------------------------
   /next — 8-BALL
------------------------------------------------------------ */
app.post("/next", async (req, res) => {
  const persona = req.body.persona || "BUSINESS";
  const lastTopic = (req.body.lastTopic || "").trim();
  const lastMajor = (req.body.lastMajor || "").trim();

  if (persona === "BUSINESS") {
    const result = await generateNextTopicGDJ(lastTopic, lastMajor);
    const report = await runPipeline(result.topic, "BUSINESS");

    return res.json({
      topic: result.topic,
      major: result.major,
      report: report.report
    });
  }

  const topic = await generateNextTopicAWang(lastTopic);
  const report = await runPipeline(topic, "AMAZON");

  res.json({ topic: report.topic || topic, report: report.report });
});

/* ------------------------------------------------------------
   START SERVER
------------------------------------------------------------ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🌊 Blue Ocean Browser — GD-J + 8-BALL + AMAZON running on port", PORT);
});