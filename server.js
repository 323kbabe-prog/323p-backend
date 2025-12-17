//////////////////////////////////////////////////////////////
// Blue Ocean Browser — SERP-Sourced Foresight Server
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

const SERP_KEY = process.env.SERP_KEY || null;

// ------------------------------------------------------------
// Step 2 — Semantic clarity check (reject nonsense)
// ------------------------------------------------------------
async function isClearTopic(topic) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: `
Is the following text a meaningful topic or question a human would ask?
Reply ONLY YES or NO.

"${topic}"
`
      }
    ],
    temperature: 0
  });

  return out.choices[0].message.content.trim() === "YES";
}

// ------------------------------------------------------------
// Step 4 — Fetch SERP sources (Google News, last ~7 days)
// ------------------------------------------------------------
async function fetchSerpSources(topic) {
  if (!SERP_KEY) return [];

  try {
    const url =
      `https://serpapi.com/search.json?engine=google_news&q=${encodeURIComponent(topic)}&api_key=${SERP_KEY}`;

    const res = await fetch(url);
    const data = await res.json();

    if (!data.news_results || !Array.isArray(data.news_results)) {
      return [];
    }

    return data.news_results.slice(0, 5).map(n => ({
      title: n.title || "",
      source: n.source || "Unknown",
      snippet: n.snippet || ""
    }));

  } catch (err) {
    console.error("SERP ERROR:", err);
    return [];
  }
}

// ------------------------------------------------------------
// Step 5 + 6 — Generate foresight using SERP sources
// ------------------------------------------------------------
async function generatePrediction(topic, sources) {
  const sourceBlock = sources.length
    ? sources.map(s =>
        `• ${s.title} — ${s.source}${s.snippet ? `: ${s.snippet}` : ""}`
      ).join("\n")
    : "No strong recent sources were found. Use general market context.";

  const prompt = `
You are an AI foresight analyst.

Topic:
${topic}

Recent real-world sources (past 7 days):
${sourceBlock}

Task:
1. Identify the key signals implied by the sources above.
2. Then write a realistic six-month outlook that clearly builds on those signals.

Rules:
- Explicitly reference developments from the sources
- Do not invent facts beyond the sources
- No hype, no certainty claims
- Neutral, analytical tone
- 3–5 short paragraphs total
- Write for general readers
`;

  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4
  });

  return out.choices[0].message.content.trim();
}

// ------------------------------------------------------------
// MAIN /run ENDPOINT
// ------------------------------------------------------------
app.post("/run", async (req, res) => {
  const topic = (req.body.topic || "").trim();

  // Basic length guard
  if (topic.length < 3) {
    return res.json({
      report: "Please enter a clearer topic."
    });
  }

  // Semantic validation
  try {
    const ok = await isClearTopic(topic);
    if (!ok) {
      return res.json({
        report: "That doesn’t look like a meaningful topic. Try a short phrase or question."
      });
    }
  } catch {
    return res.json({
      report: "Unable to validate the topic at this time."
    });
  }

  try {
    const sources = await fetchSerpSources(topic);
    const prediction = await generatePrediction(topic, sources);

    // Build visible report
    let reportText = "";

    if (sources.length) {
      reportText += "Current Signals (Past 7 Days)\n";
      sources.forEach(s => {
        reportText += `• ${s.title} — ${s.source}\n`;
      });
      reportText += "\n";
    } else {
      reportText += "Current Signals\n• No strong recent news signals were found.\n\n";
    }

    reportText += "Six-Month Outlook\n";
    reportText += prediction;

    res.json({ report: reportText });

  } catch (err) {
    console.error("RUN ERROR:", err);
    res.json({
      report: "The system is temporarily unavailable."
    });
  }
});

// ------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🌊 Blue Ocean Browser (SERP-sourced) running on port", PORT);
});