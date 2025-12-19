//////////////////////////////////////////////////////////////
// Blue Ocean Browser — BUSINESS (GD-J) + AMAZON (A Wang)
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
   STEP 2 — Rewrite into SERP-doable headline
------------------------------------------------------------ */
async function rewriteForSerp(topic) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Rewrite the following topic into a short,
NEWS-DOABLE business headline phrase.

Rules:
- 5–8 words
- Neutral, factual tone
- Business / industry framing
- Implies real-world change
- No opinions
- No future tense

Input:
"${topic}"

Output:
`
    }],
    temperature: 0
  });
  return out.choices[0].message.content.trim();
}

/* ------------------------------------------------------------
   STEP 3 — Fetch SERP Sources (PERSONA-AWARE)
------------------------------------------------------------ */
async function fetchSerpSources(rewrittenTopic, persona = "BUSINESS") {
  if (!SERP_KEY) return [];

  const year = new Date().getFullYear();

  let query;
  if (persona === "AMAZON") {
    query = `
site:amazon.com
OR site:sellercentral.amazon.com
OR site:aboutamazon.com
OR site:advertising.amazon.com
${rewrittenTopic}
    `;
  } else {
    query = `${rewrittenTopic} business news ${year}`;
  }

  try {
    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&tbm=nws&num=10&api_key=${SERP_KEY}`;
    const r = await fetch(url);
    const j = await r.json();

    return (j.news_results || []).map(x => ({
      title: x.title || "",
      source: x.source || "Unknown",
      link: x.link || "",
      date: x.date || "",
      snippet: x.snippet || ""
    }));
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------
   STEP 4 — Rank signals by business impact
------------------------------------------------------------ */
async function rankSignalsByImpact(sources) {
  if (sources.length < 2) return sources;

  const list = sources.map(
    (s, i) => `${i + 1}. ${s.title} — ${s.source}`
  ).join("\n");

  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
Rank the following headlines by expected BUSINESS IMPACT
over the next 3–6 months.
Return ONLY the ordered list of numbers.

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

/* ------------------------------------------------------------
   STEP 5 — Generate foresight (UNCHANGED)
------------------------------------------------------------ */
async function generatePrediction(topic, sources) {
  const signalText = sources.map(s =>
    `• ${s.title} — ${s.source}`
  ).join("\n");

  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
You are an AI foresight system.

Topic:
${topic}

Verified business signals:
${signalText}

Task:
1) State what the business reality WILL look like
   six months from now.
2) Then state what BREAKS if this forecast is wrong.

Rules (STRICT):
- Use direct future statements
- No hedging
- No hype
- Write as if six months already passed
`
    }],
    temperature: 0.3
  });

  return out.choices[0].message.content.trim();
}

/* ------------------------------------------------------------
   PERSONA TOPIC DECIDERS
------------------------------------------------------------ */
async function generateNextTopicGDJ(lastTopic = "") {
  return (await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
You are GD-J (BUSINESS persona).
Generate ONE AI business foresight topic.
Avoid repeating: "${lastTopic}"
Output ONLY the topic text.
`
    }],
    temperature: 0.6
  })).choices[0].message.content.trim();
}

async function generateNextTopicAWang(lastTopic = "") {
  return (await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
You are A Wang (AMAZON persona).

Focus:
- pricing & cost structure
- consumer behavior
- fashion as demand signal
- execution efficiency

Generate ONE Amazon-commerce-focused topic
for the next 3 months.
Avoid repeating: "${lastTopic}"
Output ONLY the topic text.
`
    }],
    temperature: 0.6
  })).choices[0].message.content.trim();
}

/* ------------------------------------------------------------
   CORE PIPELINE
------------------------------------------------------------ */
async function runPipeline(topic, persona) {
  const rewritten = await rewriteForSerp(topic);
  const rawSources = await fetchSerpSources(rewritten, persona);

  if (rawSources.length < 3) {
    return { report: "Fewer than three verified sources found." };
  }

  const ranked = await rankSignalsByImpact(rawSources);
  const finalSources = ranked.slice(0, 10);
  const prediction = await generatePrediction(topic, finalSources);

  let reportText = "Current Signals (Ranked by Impact Level)\n";
  finalSources.forEach(s => {
    reportText += `• ${s.title} — ${s.source} (${relativeTime(s.date)})\n`;
    if (s.link) reportText += `  ${s.link}\n`;
  });

  reportText += "\nSix-Month Outlook\n";
  reportText += prediction;

  return { report: reportText };
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

  const result = await runPipeline(topic, persona);
  res.json(result);
});

/* ------------------------------------------------------------
   /next
------------------------------------------------------------ */
app.post("/next", async (req, res) => {
  const lastTopic = (req.body.lastTopic || "").trim();
  const persona = req.body.persona || "BUSINESS";

  const nextTopic =
    persona === "AMAZON"
      ? await generateNextTopicAWang(lastTopic)
      : await generateNextTopicGDJ(lastTopic);

  if (!(await isClearTopic(nextTopic))) {
    return res.json({ report: "Persona failed to generate topic." });
  }

  const result = await runPipeline(nextTopic, persona);
  res.json({ topic: nextTopic, report: result.report });
});

/* ------------------------------------------------------------
   START SERVER
------------------------------------------------------------ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🌊 Blue Ocean Browser — BUSINESS & AMAZON running on port", PORT);
});