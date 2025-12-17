//////////////////////////////////////////////////////////////
// Blue Ocean Browser — FINAL SERP-DOABLE FORESIGHT SERVER
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
// Utility — relative freshness label (still used for sources)
// ------------------------------------------------------------
function relativeTime(dateStr) {
  if (!dateStr) return "recent";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "recent";
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diff <= 1) return "today";
  if (diff <= 7) return `${diff} days ago`;
  return "recent";
}

// ------------------------------------------------------------
// Step 2 — Semantic clarity check
// ------------------------------------------------------------
async function isClearTopic(topic) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Is the following text a meaningful topic or question that a human would ask?
Reply ONLY YES or NO.

"${topic}"
`
    }],
    temperature: 0
  });
  return out.choices[0].message.content.trim() === "YES";
}

// ------------------------------------------------------------
// Step 3 — SERP-doable rewrite
// ------------------------------------------------------------
async function rewriteForSerp(topic) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Rewrite the following topic into a short,
NEWS-DOABLE business headline phrase.

Rules:
- Real-world action
- Business / workforce / policy framing
- Verbs preferred
- 5–8 words
- Neutral
- NO future tense

Input:
"${topic}"
`
    }],
    temperature: 0
  });
  return out.choices[0].message.content.trim();
}

// ------------------------------------------------------------
// Step 4 — Fetch SERP News
// ------------------------------------------------------------
async function fetchSerpSources(rewrittenTopic) {
  let sources = [];
  if (!SERP_KEY) return sources;

  const year = new Date().getFullYear();
  const serpQuery = `${rewrittenTopic} business news ${year}`;

  try {
    const url = `https://serpapi.com/search.json?q=${
      encodeURIComponent(serpQuery)
    }&tbm=nws&num=8&api_key=${SERP_KEY}`;

    const r = await fetch(url);
    const j = await r.json();

    sources = (j.news_results || [])
      .filter(Boolean)
      .map(x => ({
        title: x.title || "",
        source: x.source || "Unknown",
        link: x.link || "",
        date: x.date || "",
        snippet: x.snippet || ""
      }));

  } catch (e) {
    console.log("SERP NEWS FAIL:", e.message);
  }

  return sources;
}

// ------------------------------------------------------------
// Step 5 — Rank signals (still internal)
// ------------------------------------------------------------
async function rankSignalsByImpact(sources) {
  if (!sources.length) return sources;

  const list = sources.map(
    (s, i) => `${i + 1}. ${s.title} — ${s.source}`
  ).join("\n");

  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Rank these headlines by BUSINESS IMPACT over six months.
Return ONLY numbers in order.

${list}
`
    }],
    temperature: 0
  });

  const order = out.choices[0].message.content
    .match(/\d+/g)
    ?.map(n => parseInt(n, 10) - 1) || [];

  const ranked = [];
  order.forEach(i => sources[i] && ranked.push(sources[i]));
  return ranked.length ? ranked : sources;
}

// ------------------------------------------------------------
// Step 6 — Generate FUTURE STORY (KEY CHANGE)
// ------------------------------------------------------------
async function generateFutureStory(topic, sources) {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);

  const dateLabel = d.toLocaleString("en-US", {
    month: "long",
    year: "numeric"
  });

  const hiddenContext = sources.map(s =>
    `• ${s.title} — ${s.source}`
  ).join("\n");

  const prompt = `
Date: ${dateLabel}

You are not analyzing the future.
You are speaking from this date as if six months have already passed.

Do NOT explain how this future was predicted.
Do NOT mention trends, signals, data, forecasts, or analysis.

Write in present tense only.

This is a calm, realistic narrative report.
It should feel like a documentary voiceover or lived experience.

Describe:
- What feels normal now
- How people talk about this topic
- How work, habits, or decisions have quietly changed
- What no longer feels surprising

Topic:
${topic}

(Background context — DO NOT mention explicitly)
${hiddenContext}

Begin the story naturally.
`;

  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "You are a future narrator telling lived reality, not an analyst."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.7
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
    const rawSources = await fetchSerpSources(rewritten);

    if (rawSources.length < 3) {
      return res.json({
        report:
          "Not enough verified business activity was found for this topic. Try a more specific or timely query."
      });
    }

    const ranked = await rankSignalsByImpact(rawSources);
    const finalSources = ranked.slice(0, 5);

    const story = await generateFutureStory(topic, finalSources);

    // Visible report (sources stay factual, story stays immersive)
    let reportText = "Reference Activity\n";
    finalSources.forEach(s => {
      reportText += `• ${s.title} — ${s.source} (${relativeTime(s.date)})\n`;
      if (s.link) reportText += `  ${s.link}\n`;
    });

    reportText += "\n";
    reportText += story;

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
  console.log("🌊 Blue Ocean Browser (SERP-doable, future-story mode) running on port", PORT);
});