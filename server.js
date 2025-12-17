//////////////////////////////////////////////////////////////
// Blue Ocean Browser — Reference-Aligned Foresight Server
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
// Step 2 — Semantic clarity check
// ------------------------------------------------------------
async function isClearTopic(topic) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Is the following text a meaningful topic or question a human would ask?
Reply ONLY YES or NO.

"${topic}"
`
    }],
    temperature: 0
  });
  return out.choices[0].message.content.trim() === "YES";
}

// ------------------------------------------------------------
// Step 3 — Background rewrite (news-searchable)
// ------------------------------------------------------------
async function rewriteForSerp(topic) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Rewrite the input into a short, business-news-searchable phrase.
Rules:
- Neutral
- No opinion
- 3–6 words
- Suitable for Google News headlines

Input:
"${topic}"
`
    }],
    temperature: 0
  });
  return out.choices[0].message.content.trim();
}

// ------------------------------------------------------------
// SERP NEWS Context — SAME AS WORKING REFERENCE
// ------------------------------------------------------------
async function fetchSerpContext(rewrittenTopic) {
  let serpContext = "No verified data.";

  if (!SERP_KEY) return serpContext;

  const serpQuery = `${rewrittenTopic} business news ${new Date().getFullYear()}`;

  try {
    const url = `https://serpapi.com/search.json?q=${
      encodeURIComponent(serpQuery)
    }&tbm=nws&num=5&api_key=${SERP_KEY}`;

    const r = await fetch(url);
    const j = await r.json();

    const titles = (j.news_results || [])
      .map(x => x.title)
      .filter(Boolean)
      .slice(0, 5)
      .join(" | ");

    if (titles) serpContext = titles;

  } catch (e) {
    console.log("SERP NEWS FAIL:", e.message);
  }

  return serpContext;
}

// ------------------------------------------------------------
// Step 4 — Foresight generation (grounded, tolerant)
// ------------------------------------------------------------
async function generateForesight(topic, serpContext) {
  const prompt = `
You are an AI foresight analyst.

Topic:
${topic}

Recent business news signals:
${serpContext}

Task:
Write a realistic six-month outlook that reflects
what the news signals suggest.

Rules:
- Use the news signals as grounding
- If signals are thin, be cautious, not generic
- No hype, no certainty
- 3–5 short paragraphs
- Neutral, analytical tone
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

  if (topic.length < 3) {
    return res.json({ report: "Please enter a clearer topic." });
  }

  const ok = await isClearTopic(topic);
  if (!ok) {
    return res.json({
      report: "That doesn’t look like a meaningful topic. Try a short phrase or question."
    });
  }

  try {
    const rewritten = await rewriteForSerp(topic);
    const serpContext = await fetchSerpContext(rewritten);
    const report = await generateForesight(topic, serpContext);

    let reportText = "Current Signals (Business News)\n";
    reportText += serpContext === "No verified data."
      ? "• No strong recent headlines were detected.\n\n"
      : serpContext.split(" | ").map(x => `• ${x}`).join("\n") + "\n\n";

    reportText += "Six-Month Outlook\n";
    reportText += report;

    res.json({ report: reportText });

  } catch (err) {
    console.log("RUN ERROR:", err);
    res.json({
      report: "The system is temporarily unavailable."
    });
  }
});

// ------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🌊 Blue Ocean Browser (reference-aligned) running on", PORT);
});