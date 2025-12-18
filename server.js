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

// Match your working reference
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
// Angle-aware SERP modifier
// ------------------------------------------------------------
function angleSerpModifier(angleLabel) {
  const MAP = {
    "Workforce & Hiring": "hiring workforce jobs layoffs",
    "Education & Skills": "education skills training certification",
    "Policy & Regulation": "government policy regulation labor law",
    "Corporate Strategy": "corporate strategy investment productivity",
    "Market Structure": "industry market competition ecosystem"
  };
  return MAP[angleLabel] || "";
}

// ------------------------------------------------------------
// Semantic clarity check
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
// SERP-doable rewrite
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
// SERP NEWS (ANGLE-AWARE)
// ------------------------------------------------------------
async function fetchSerpSources(rewrittenTopic, angleLabel) {
  let sources = [];
  if (!SERP_KEY) return sources;

  const year = new Date().getFullYear();
  const modifier = angleSerpModifier(angleLabel);
  const serpQuery = `${rewrittenTopic} ${modifier} business news ${year}`;

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
// Rank signals by business impact
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
// Generate foresight (HARD ANGLES)
// ------------------------------------------------------------
async function generatePrediction(topic, sources, angleLabel) {
  const signalText = sources.map(s =>
    `• ${s.title} — ${s.source}`
  ).join("\n");

  const ANGLE_RULES = {
    "Workforce & Hiring": `
You may discuss:
- Hiring patterns
- Job roles
- Workforce restructuring
- Entry-level vs senior roles

You must NOT discuss:
- Education systems
- Government policy
- Corporate investment strategy
`,
    "Education & Skills": `
You may discuss:
- Skills demand
- Training, certificates, education
- Reskilling and upskilling

You must NOT discuss:
- Hiring numbers
- Unemployment rates
- Government regulation
`,
    "Policy & Regulation": `
You may discuss:
- Government policy
- Regulation
- Labor law
- Immigration rules

You must NOT discuss:
- Individual job roles
- Corporate hiring strategy
- Education programs
`,
    "Corporate Strategy": `
You may discuss:
- Company decisions
- Investment
- Cost cutting
- AI adoption strategy

You must NOT discuss:
- Worker sentiment
- Education systems
- Public policy
`,
    "Market Structure": `
You may discuss:
- Industry shifts
- Market concentration
- Vendor ecosystems
- Competitive dynamics

You must NOT discuss:
- Individual job seekers
- Education pathways
- Company HR policies
`
  };

  const angleInstruction =
    angleLabel && ANGLE_RULES[angleLabel]
      ? `Perspective Rules:\n${ANGLE_RULES[angleLabel]}`
      : "";

  const prompt = `
You are an AI foresight analyst.

Topic:
${topic}

Perspective:
${angleLabel || "General"}

Recent high-impact business news:
${signalText}

Task:
Write a realistic six-month outlook that is clearly derived
from these signals.

${angleInstruction}

Rules:
- Reference concrete developments from the news
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
  // 🚫 HARD NO-CACHE HEADERS (FINAL FIX)
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0"
  });

  const topic = (req.body.topic || "").trim();
  const angleLabel = req.body.angleLabel || "";

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
    const rawSources = await fetchSerpSources(rewritten, angleLabel);

    if (rawSources.length < 3) {
      return res.json({
        report:
          "Fewer than three verified business news sources were found for this topic. Please try a more specific or timely query."
      });
    }

    const ranked = await rankSignalsByImpact(rawSources);
    const finalSources = ranked.slice(0, 5);

    const prediction = await generatePrediction(
      topic,
      finalSources,
      angleLabel
    );

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
  console.log("🌊 Blue Ocean Browser (SERP-doable, final) running on port", PORT);
});