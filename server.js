//////////////////////////////////////////////////////////////
// Blue Ocean Browser — SERP-Aware Foresight Server (FINAL)
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

const SERP_KEY = process.env.SERP_KEY;

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
Is the following text a meaningful topic or question that a human would ask?
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
// Step 3 — Background rewrite (SERP-aware, news tone)
// ------------------------------------------------------------
async function rewriteForSerp(topic) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: `
Rewrite the following input into a concise,
news-searchable business topic suitable for querying
recent articles.

Rules:
- Neutral, journalistic tone
- Business / policy / workforce focus
- Remove conversational phrasing
- ONE short phrase only
- Do NOT add opinions

Input:
"${topic}"
`
      }
    ],
    temperature: 0
  });

  return out.choices[0].message.content.trim();
}

// ------------------------------------------------------------
// Step 4 — SERP NEWS Context (MANDATORY, Multi-Query Cascade)
// ------------------------------------------------------------
async function fetchSerpSources(rewrittenTopic) {
  if (!SERP_KEY) {
    throw new Error("SERP_KEY is missing");
  }

  const year = new Date().getFullYear();

  const queries = [
    `${rewrittenTopic} business news ${year}`,
    `${rewrittenTopic} hiring policy regulation investment`,
    `artificial intelligence workforce company government`
  ];

  for (const q of queries) {
    try {
      const url = `https://serpapi.com/search.json?q=${
        encodeURIComponent(q)
      }&tbm=nws&num=5&api_key=${SERP_KEY}`;

      const r = await fetch(url);
      const j = await r.json();

      const sources = (j.news_results || [])
        .filter(Boolean)
        .slice(0, 5)
        .map(x => ({
          title: x.title || "",
          source: x.source || "Unknown",
          snippet: x.snippet || ""
        }));

      if (sources.length > 0) {
        console.log("SERP HIT QUERY:", q);
        return sources;
      }

    } catch (e) {
      console.log("SERP QUERY FAIL:", q, e.message);
    }
  }

  return [];
}

// ------------------------------------------------------------
// Step 5 + 6 — Generate foresight USING SOURCES ONLY
// ------------------------------------------------------------
async function generatePrediction(topic, sources) {
  const sourceBlock = sources.map(s =>
    `• ${s.title} — ${s.source}${s.snippet ? `: ${s.snippet}` : ""}`
  ).join("\n");

  const prompt = `
You are an AI foresight analyst.

User topic:
${topic}

Verified recent business news (past 7 days):
${sourceBlock}

Task:
Write a realistic six-month outlook that is directly
derived from the news signals above.

Rules:
- Base reasoning strictly on the sources
- Reference concrete developments from the news
- Do NOT invent facts beyond the sources
- No hype, no certainty claims
- Neutral, analytical tone
- 3–5 short paragraphs
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
    // Background rewrite (SERP-aware)
    const rewrittenTopic = await rewriteForSerp(topic);

    // Mandatory SERP
    const sources = await fetchSerpSources(rewrittenTopic);

    if (!sources.length) {
      return res.json({
        report:
          "No verified recent business news was found for this topic. Please try a more specific or timely query."
      });
    }

    const prediction = await generatePrediction(topic, sources);

    // Build final visible report
    let reportText = "Current Signals (Business News)\n";
    sources.forEach(s => {
      reportText += `• ${s.title} — ${s.source}\n`;
    });

    reportText += "\nSix-Month Outlook\n";
    reportText += prediction;

    res.json({ report: reportText });

  } catch (err) {
    console.error("RUN ERROR:", err.message);
    res.json({
      report: "Unable to retrieve verified news sources at this time."
    });
  }
});

// ------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🌊 Blue Ocean Browser (SERP-aware, source-grounded) running on", PORT);
});