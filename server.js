//////////////////////////////////////////////////////////////
// Blue Ocean Browser — FINAL SERP-DOABLE FORESIGHT SERVER
// • SERP-doable rewrite system
// • Business-signal grounded foresight
// • Auto mode filtered by SERP viability
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
// Utility — relative freshness label
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
// Step 2 — Semantic clarity check (reject nonsense)
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
// Step 3 — SERP-DOABLE rewrite (core gatekeeper)
// ------------------------------------------------------------
async function rewriteForSerp(topic) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Rewrite the following topic into a short,
NEWS-DOABLE business headline phrase that would
realistically appear in Google News.

Rules:
- Imply real-world action or change
- Business / workforce / policy framing
- Prefer verbs: expands, announces, launches, updates, cuts
- Implicitly reference institutions
- 5–8 words total
- Neutral, factual tone
- NO opinions
- NO future tense

Input:
"${topic}"

Output:
`
    }],
    temperature: 0
  });
  return out.choices[0].message.content.trim();
}

// ------------------------------------------------------------
// Step 4 — SERP NEWS (business-focused)
// ------------------------------------------------------------
async function fetchSerpSources(rewrittenTopic) {
  if (!SERP_KEY) return [];

  const year = new Date().getFullYear();
  const serpQuery = `${rewrittenTopic} business news ${year}`;

  try {
    const url = `https://serpapi.com/search.json?q=${
      encodeURIComponent(serpQuery)
    }&tbm=nws&num=8&api_key=${SERP_KEY}`;

    const r = await fetch(url);
    const j = await r.json();

    return (j.news_results || []).map(x => ({
      title: x.title || "",
      source: x.source || "Unknown",
      link: x.link || "",
      date: x.date || ""
    }));
  } catch (e) {
    console.log("SERP NEWS FAIL:", e.message);
    return [];
  }
}

// ------------------------------------------------------------
// Step 5 — Rank signals by business impact
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
Rank the following news headlines by expected BUSINESS IMPACT
over the next six months (highest impact first).
Return ONLY a list of numbers in order.

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
// Step 6 — Generate foresight
// ------------------------------------------------------------
async function generatePrediction(topic, sources) {
  const signalText = sources.map(
    s => `• ${s.title} — ${s.source}`
  ).join("\n");

  const prompt = `
You are an AI foresight analyst.

Topic:
${topic}

Recent high-impact business news:
${signalText}

Task:
Write a realistic six-month outlook derived from these signals.

Rules:
- Reference concrete developments from the news
- No hype
- No certainty claims
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
// 🔥 AUTO MODE — FILTERED, BUSINESS-VIABLE ONLY
// ------------------------------------------------------------
app.get("/auto", async (req, res) => {
  try {
    if (!SERP_KEY) {
      return res.status(500).json({ error: "SERP key missing" });
    }

    const trendUrl =
      `https://serpapi.com/search.json?engine=google_trends_trending_now&geo=US&api_key=${SERP_KEY}`;

    const r = await fetch(trendUrl);
    const j = await r.json();

    const trends = (j.trending_searches || [])
      .map(t => t.query)
      .filter(Boolean);

    for (const rawTopic of trends) {
      const rewritten = await rewriteForSerp(rawTopic);
      const sources = await fetchSerpSources(rewritten);

      // 🔒 SAME RULE AS /run
      if (sources.length >= 3) {
        return res.json({ topic: rewritten });
      }
    }

    return res.status(500).json({
      error: "No business-viable trending topics found"
    });

  } catch (err) {
    console.error("AUTO MODE ERROR:", err);
    res.status(500).json({ error: "Auto mode unavailable" });
  }
});

// ------------------------------------------------------------
// MAIN /run ENDPOINT (UNCHANGED BEHAVIOR)
// ------------------------------------------------------------
app.post("/run", async (req, res) => {
  const topic = (req.body.topic || "").trim();
  if (topic.length < 3) {
    return res.json({ report: "Please enter a clearer topic." });
  }

  const ok = await isClearTopic(topic);
  if (!ok) {
    return res.json({
      report: "That doesn’t look like a meaningful topic."
    });
  }

  try {
    const rewritten = await rewriteForSerp(topic);
    const rawSources = await fetchSerpSources(rewritten);

    if (rawSources.length < 3) {
      return res.json({
        report:
          "Fewer than three verified business news sources were found for this topic."
      });
    }

    const ranked = await rankSignalsByImpact(rawSources);
    const finalSources = ranked.slice(0, 5);
    const prediction = await generatePrediction(topic, finalSources);

    let reportText = "Current Signals (Ranked by Business Impact)\n";
    finalSources.forEach(s => {
      reportText += `• ${s.title} — ${s.source} (${relativeTime(s.date)})\n`;
      if (s.link) reportText += `  ${s.link}\n`;
    });

    reportText += "\nSix-Month Outlook\n";
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
  console.log("🌊 Blue Ocean Browser running on port", PORT);
});