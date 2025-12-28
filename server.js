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

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

function sixMonthDateLabel() {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

// ------------------------------------------------------------
// YOUTUBER — foresight instruction (MUST be above runPipeline)
// ------------------------------------------------------------
function youtuberForesightInstruction() {
  return `
You are writing for a YouTube creator.

Explain:
- What angles a creator can talk about on this topic
- Why audiences are responding right now
- What emotions, aesthetics, or formats are resonating
- How a creator should frame content over the next 6 months

Do NOT:
- Explain the platform itself
- Mention algorithms explicitly
- Mention YouTube as a company
`;
}

// ------------------------------------------------------------
// STANFORD LENSES
// ------------------------------------------------------------
const STANFORD_MAJORS = [
  "Computer Science","Economics","Management Science and Engineering",
  "Political Science","Psychology","Sociology","Symbolic Systems",
  "Statistics","Electrical Engineering","Biomedical Engineering",
  "Biology","Environmental Science","International Relations",
  "Communication","Design","Education","Philosophy","Law"
];

let LAST_LENS = "";
function pickStanfordLens() {
  const pool = STANFORD_MAJORS.filter(m => m !== LAST_LENS);
  const lens = pool[Math.floor(Math.random() * pool.length)];
  LAST_LENS = lens;
  return lens;
}

// ------------------------------------------------------------
// YOUTUBER — fetch real videos (supporting evidence)
// ------------------------------------------------------------
async function fetchYouTubeVideoList(query, location, limit = 5) {
  if (!SERP_KEY || !query) return [];

  const q = `${location ? location + " " : ""}${query} site:youtube.com/watch`;

  try {
    const url =
      "https://serpapi.com/search.json?" +
      `q=${encodeURIComponent(q)}` +
      `&tbs=qdr:w2` +
      `&num=${limit}` +
      `&api_key=${SERP_KEY}`;

    const r = await fetch(url);
    const j = await r.json();

    return (j.organic_results || [])
      .filter(v => v.link && v.link.includes("watch?v="))
      .slice(0, limit)
      .map(v => ({
        title: v.title.replace(/[-–|].*$/, "").trim(),
        link: v.link
      }));
  } catch {
    return [];
  }
}

// ------------------------------------------------------------
// CORE PIPELINE
// ------------------------------------------------------------
async function runPipeline(topic, persona, manual) {
  const lens = pickStanfordLens();

  // ---------------- YOUTUBER ----------------
  if (persona === "YOUTUBER") {

    const videos = await fetchYouTubeVideoList(
      topic || "trending videos",
      null,
      5
    );

    if (!videos.length) {
      return { report: "No YouTube videos found." };
    }

    const primaryTitle = videos[0].title;

    const foresight = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `
${youtuberForesightInstruction()}

Verified content signals:
${videos.map(v => `• ${v.title}`).join("\n")}

START WITH THIS LINE EXACTLY:
Reality · ${sixMonthDateLabel()}

Write a 6-month foresight.

Rules:
- EXACTLY 5 short paragraphs
- Neutral, analytical tone
- Creator-focused
- No markdown

Then write this section header exactly:
If this prediction is correct, what works:

Then write EXACTLY 3 short sentences.
`
      }],
      temperature: 0.3
    });

    const evidence = videos
      .map(v => `${v.title}\n${v.link}`)
      .join("\n\n");

    return {
      topic: primaryTitle,
      report:
        `• ${primaryTitle} — YouTube\n\n` +
        foresight.choices[0].message.content.trim() +
        `\n\nSupporting YouTube examples:\n${evidence}`
    };
  }

  // ---------------- DEFAULT ----------------
  return { report: "Persona not implemented." };
}

// ------------------------------------------------------------
// ROUTES
// ------------------------------------------------------------
app.post("/run", async (req, res) => {
  const { topic = "", persona = "YOUTUBER", manual = false } = req.body;
  res.json(await runPipeline(topic, persona, manual));
});

app.post("/next", async (req, res) => {
  const persona = req.body.persona || "YOUTUBER";
  res.json(await runPipeline("", persona, false));
});

// ------------------------------------------------------------
app.listen(process.env.PORT || 3000, () =>
  console.log("🌊 Blue Ocean Browser running")
);