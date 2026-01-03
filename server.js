//////////////////////////////////////////////////////////////
// STANFORD UNIVERSITY AI FORESIGHT ENGINE
// Blue Ocean Browser
//////////////////////////////////////////////////////////////

const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const OpenAI = require("openai");

//////////////////////////////////////////////////////////////
// APP BOOTSTRAP
//////////////////////////////////////////////////////////////
const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());
app.options("*", cors());

app.get("/", (req, res) => {
  res.status(200).send("Stanford AI Foresight is running.");
});

//////////////////////////////////////////////////////////////
// OPENAI CLIENT
//////////////////////////////////////////////////////////////
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

//////////////////////////////////////////////////////////////
// SERP API
//////////////////////////////////////////////////////////////
const SERP_KEY = process.env.SERPAPI_KEY || null;

//////////////////////////////////////////////////////////////
// STANFORD MAJORS (PERSONA POOL)
//////////////////////////////////////////////////////////////
const STANFORD_MAJORS = [
  "Computer Science",
  "Economics",
  "Psychology",
  "Sociology",
  "Political Science",
  "Symbolic Systems",
  "Statistics",
  "Design",
  "Communication",
  "Education",
  "Philosophy",
  "Law",
  "Biomedical Engineering",
  "Environmental Science"
];

function pickStanfordMajor() {
  return STANFORD_MAJORS[
    Math.floor(Math.random() * STANFORD_MAJORS.length)
  ];
}

//////////////////////////////////////////////////////////////
// FETCH OFFICIAL STANFORD YOUTUBE VIDEO
//////////////////////////////////////////////////////////////
async function fetchStanfordYouTubeVideo(major) {
  if (!SERP_KEY) return null;

  const q = `Stanford University ${major} site:youtube.com/watch`;
  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(q)}&num=10&api_key=${SERP_KEY}`;

  const r = await fetch(url);
  const j = await r.json();

  return (j.organic_results || []).find(v =>
    v.link?.includes("youtube.com/watch")
  );
}

//////////////////////////////////////////////////////////////
// DATE
//////////////////////////////////////////////////////////////
function sixMonthDateLabel() {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

//////////////////////////////////////////////////////////////
// REPORT GENERATOR
//////////////////////////////////////////////////////////////
async function generateStanfordReport({
  userInput,
  major,
  video
}) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
You are thinking as a Stanford University professor
with a background in ${major}.

Official Stanford lecture reference:
"${video.title}"

The user searched this as an example:
"${userInput}"

START WITH THIS LINE EXACTLY:
2×-AI Engine — Stanford Academic Foresight
Reality · ${sixMonthDateLabel()}

Task:
- Use the Stanford video as authoritative grounding
- Treat the user input as a real-world example
- Explain how this example connects to ideas from the lecture
- Teach the concept clearly
- Then project how this thinking may matter over the next six months

Rules:
- Educational tone
- No hype
- No platform analysis
- EXACTLY 5 short paragraphs

Then write:
If this way of thinking is correct, what works:

Then EXACTLY 3 short sentences.
`
    }],
    temperature: 0.3
  });

  return out.choices[0].message.content.trim();
}

//////////////////////////////////////////////////////////////
// PIPELINE
//////////////////////////////////////////////////////////////
async function runStanfordEngine(input) {
  const major = pickStanfordMajor();
  const video = await fetchStanfordYouTubeVideo(major);

  if (!video) {
    return { report: "No Stanford video found." };
  }

  const body = await generateStanfordReport({
    userInput: input,
    major,
    video
  });

  return {
    report:
      `• ${major} — Stanford University\n` +
      `${video.link}\n\n` +
      body
  };
}

//////////////////////////////////////////////////////////////
// ROUTES
//////////////////////////////////////////////////////////////
app.post("/run", async (req, res) => {
  try {
    const { topic = "" } = req.body;
    const result = await runStanfordEngine(topic);
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ report: "Stanford run failed." });
  }
});

app.post("/next", async (req, res) => {
  try {
    const result = await runStanfordEngine("A real-world example");
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ report: "Stanford auto failed." });
  }
});

//////////////////////////////////////////////////////////////
// SERVER
//////////////////////////////////////////////////////////////
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🎓 Stanford AI Foresight running on port ${PORT}`);
});