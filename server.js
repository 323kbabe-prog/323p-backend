//////////////////////////////////////////////////////////////
// Blue Ocean Foresight Engine — FINAL SERVER (AUTO MODE)
// • SERP-doability rewrite layer
// • Google attention-driven topic selection
// • Six-month foresight (unchanged)
//////////////////////////////////////////////////////////////

const express = require("express");
const fetch = require("node-fetch");
const OpenAI = require("openai");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const SERP_KEY = process.env.SERPAPI_KEY;

// ------------------------------------------------------------
// SERP-DOABILITY REWRITE ENGINE (CORE)
// ------------------------------------------------------------
async function rewriteToSerpDoable(rawTopic) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Rewrite this raw search phrase into a SERP-doable,
news-aligned topic that can reliably retrieve
recent Google News results.

Rules:
- Neutral, professional
- No questions
- No hype
- Add institutional or business context
- 5–8 words
- News-search friendly

Raw phrase:
"${rawTopic}"

Output:
`
    }],
    temperature: 0
  });

  return out.choices[0].message.content.trim();
}

// ------------------------------------------------------------
// AUTO MODE — GET REAL GOOGLE SEARCH ATTENTION
// ------------------------------------------------------------
async function getAutoTopicFromSerp() {
  if (!SERP_KEY) throw new Error("SERP key missing");

  // Google Trends-style trending searches via SERP
  const url = `https://serpapi.com/search.json?engine=google_trends_trending_now&geo=US&api_key=${SERP_KEY}`;

  const r = await fetch(url);
  const j = await r.json();

  const trends = (j.trending_searches || [])
    .map(t => t.query)
    .filter(Boolean);

  if (!trends.length) {
    throw new Error("No trending searches found");
  }

  // Pick one high-attention search randomly
  const rawTopic = trends[Math.floor(Math.random() * trends.length)];

  // Rewrite to SERP-doable form
  return await rewriteToSerpDoable(rawTopic);
}

// ------------------------------------------------------------
// AUTO MODE ENDPOINT (NEW)
// ------------------------------------------------------------
app.get("/auto-topic", async (req, res) => {
  try {
    const topic = await getAutoTopicFromSerp();
    res.json({ topic });
  } catch (err) {
    console.error("Auto-topic error:", err.message);
    res.status(500).json({
      error: "Unable to generate auto topic"
    });
  }
});

// ------------------------------------------------------------
// SIX-MONTH FORESIGHT (UNCHANGED)
// ------------------------------------------------------------
app.post("/run", async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic) return res.status(400).json({ error: "Missing topic" });

    // Fetch SERP news
    const newsUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(
      topic
    )}&tbm=nws&num=5&api_key=${SERP_KEY}`;

    const r = await fetch(newsUrl);
    const j = await r.json();

    const results = (j.news_results || []).slice(0, 5);
    if (results.length < 3) {
      throw new Error("Insufficient SERP sources");
    }

    const sourceLines = results.map(
      n => `• ${n.title} — ${n.source} (recent)`
    );
    const sourceLinks = results.map(n => n.link);

    const prompt = `
You are a foresight analyst.

Based ONLY on the following real-world signals,
write a grounded six-month outlook.

Rules:
- No dates
- No headlines
- No mention of sources
- Calm, analytical tone
- 3–5 short paragraphs

Signals:
${sourceLines.join("\n")}
`;

    const ai = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4
    });

    const story = ai.choices[0].message.content.trim();

    const report = `
Current Signals (Ranked by Business Impact)
${sourceLines.join("\n")}
${sourceLinks.join("\n")}

${story}
`.trim();

    res.json({ report });

  } catch (err) {
    console.error("Run error:", err.message);
    res.status(500).json({
      error: "Unable to generate foresight report"
    });
  }
});

// ------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🌊 Blue Ocean Foresight Engine running on port", PORT);
});