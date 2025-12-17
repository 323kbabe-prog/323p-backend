//////////////////////////////////////////////////////////////
// Blue Ocean Foresight Engine — FINAL SERVER
// • Signal-driven foresight
// • SERP news grounding
// • Six-month outlook
// • Date placed BELOW sources
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
// Helpers
// ------------------------------------------------------------

// Six-month future date (Month Year)
function getSixMonthDateLabel() {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
}

// Extract top 3–5 SERP news results
async function fetchSerpNews(topic) {
  if (!SERP_KEY) throw new Error("SERP key missing");

  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(
    topic
  )}&tbm=nws&num=5&api_key=${SERP_KEY}`;

  const r = await fetch(url);
  const j = await r.json();

  const results = (j.news_results || []).slice(0, 5);

  if (results.length < 3) {
    throw new Error("Insufficient SERP sources");
  }

  return results.map(r => ({
    title: r.title,
    source: r.source,
    link: r.link
  }));
}

// ------------------------------------------------------------
// Main foresight endpoint
// ------------------------------------------------------------
app.post("/run", async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic) return res.status(400).json({ error: "Missing topic" });

    // 1. Fetch SERP signals
    const news = await fetchSerpNews(topic);

    const sourceLines = news.map(
      n => `• ${n.title} — ${n.source} (recent)`
    );

    const sourceLinks = news.map(n => n.link);

    // 2. Generate six-month narrative
    const prompt = `
You are a foresight analyst.

Based ONLY on the following real-world news signals, write a grounded,
non-speculative six-month outlook.

Rules:
- No dates
- No headlines
- No mention of sources
- No hype
- Calm, analytical tone
- 3–5 short paragraphs
- Medium-term (six months)

Signals:
${sourceLines.join("\n")}
`;

    const ai = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4
    });

    const storyText = ai.choices[0].message.content.trim();

    // 3. Assemble final report (PLAIN TEXT)
    const report = `
Current Signals (Ranked by Business Impact)
${sourceLines.join("\n")}
${sourceLinks.join("\n")}

${getSixMonthDateLabel()}

${storyText}
`.trim();

    // 4. Return
    res.json({ report });

  } catch (err) {
    console.error("Foresight Error:", err.message);
    res.status(500).json({
      error: "Unable to generate foresight report"
    });
  }
});

// ------------------------------------------------------------
// Start server
// ------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🌊 Blue Ocean Foresight Engine running on port", PORT);
});