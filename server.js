//////////////////////////////////////////////////////////////
//  Rain Man Business Engine — FULL FINAL VERSION (Option A)
//  • AI Rewrite Engine
//  • AI Location Extractor (OpenAI)
//  • SERP NEWS Engine
//  • 10-NPC Rain Man Business Generator
//  • Share System w/ Cross-Origin Redirect
//  • View Counter
//  • Static Hosting
//////////////////////////////////////////////////////////////

const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const OpenAI = require("openai");
const cors = require("cors");
const fs = require("fs");
const fetch = require("node-fetch");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const SERP_KEY = process.env.SERPAPI_KEY || null;

console.log("🚀 Rain Man Business Engine Started");
console.log("SERP Active:", !!SERP_KEY);

//////////////////////////////////////////////////////////////
// AI LOCATION EXTRACTOR (Option A — AI Powered)
//////////////////////////////////////////////////////////////

async function extractLocationAI(text, openai) {
  if (!text || text.trim().length < 2) return null;

  const prompt = `
Extract the most likely geographic location mentioned in this sentence.
Rules:
- Return ONLY the location name.
- Must be a real city, region, state, or country.
- If multiple appear, return the smallest/specific (city > region > nation).
- If no valid location exists, output NONE.
Input: ${text}
Output:
`;

  try {
    const out = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.0
    });

    let loc = out.choices[0].message.content.trim();

    if (!loc || loc.toUpperCase() === "NONE") return null;

    return loc.replace(/\s+/g, ""); // Hashtag-friendly: "New York" → "NewYork"
  } catch (err) {
    console.log("AI-Location Error:", err);
    return null;
  }
}

//////////////////////////////////////////////////////////////
// Identity Pools (Gender / Race / Age / Stanford Majors)
//////////////////////////////////////////////////////////////

const genders = ["Female", "Male", "Nonbinary"];
const races = ["Asian", "Black", "White", "Latino", "Middle Eastern", "Mixed"];
const ages = [...Array.from({ length: 32 }, (_, i) => i + 18)];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const PROF = {
  A: ["Human Biology", "Psychology", "Sociology", "Public Health", "Bioengineering"],
  B: ["Political Science", "Public Policy", "International Relations", "Ethics in Society", "Science, Technology & Society"],
  C: ["Computer Science", "Mechanical Engineering", "Electrical Engineering", "Symbolic Systems", "Aeronautics & Astronautics"],
  D: ["Economics", "Management Science & Engineering", "Data Science", "Mathematical & Computational Science", "Statistics"],
  E: ["Art Practice", "Communication", "Film & Media Studies", "Linguistics", "Music"]
};

//////////////////////////////////////////////////////////////
// Share System (Supports multi-domain browser family)
//////////////////////////////////////////////////////////////

const ORIGIN_MAP = {
  blue:  "https://blueoceanbrowser.com",
  npc:   "https://npcbrowser.com",
  persona:"https://personabrowser.com",
  billy: "https://24billybrowser.com"
};

const SHARES_FILE = "/data/shares.json";
if (!fs.existsSync("/data")) fs.mkdirSync("/data");

function readShares() {
  try { return JSON.parse(fs.readFileSync(SHARES_FILE, "utf8")); }
  catch { return {}; }
}

function writeShares(v) {
  fs.writeFileSync(SHARES_FILE, JSON.stringify(v, null, 2));
}

// POST /api/share
app.post("/api/share", (req, res) => {
  const all = readShares();
  const id = Math.random().toString(36).substring(2, 8);

  all[id] = {
    personas: req.body.personas || [],
    query: req.body.query || "",
    origin: req.body.origin || "blue"
  };

  writeShares(all);
  res.json({ shortId: id });
});

// GET /api/share/:id
app.get("/api/share/:id", (req, res) => {
  const all = readShares();
  const s = all[req.params.id];
  if (!s) return res.status(404).json([]);
  res.json(s.personas || []);
});

// Redirect to correct browser
app.get("/s/:id", (req, res) => {
  const all = readShares();
  const s = all[req.params.id];

  if (!s) return res.redirect("https://blueoceanbrowser.com");

  const redirectURL = ORIGIN_MAP[s.origin] || ORIGIN_MAP.blue;

  res.send(`
    <!doctype html><html><head><meta charset="utf-8"/>
    <script>
      sessionStorage.setItem("sharedId","${req.params.id}");
      setTimeout(()=>{
        window.location.href="${redirectURL}?query="+encodeURIComponent("${s.query||""}");
      },400);
    </script>
    </head><body></body></html>
  `);
});

//////////////////////////////////////////////////////////////
// INPUT VALIDATION — Strong Nonsense Detector (NEW VERSION)
//////////////////////////////////////////////////////////////

app.post("/api/validate", async (req, res) => {
  const text = (req.body.text || "").trim();

  // 🔒 RULE 1: auto-fail empty or 1–2 chars
  if (text.length < 3) {
    return res.json({ valid: false });
  }

  // 🔒 RULE 2: auto-fail one meaningless word
  if (text.split(/\s+/).length === 1) {
    const word = text.toLowerCase();
    const englishLike = /^[a-zA-Z]+$/.test(word);

    // If just letters but not a meaningful word, block it
    if (word.length < 4 || !englishLike) {
      return res.json({ valid: false });
    }
  }

  // 🔒 RULE 3: use AI to classify meaning
  const prompt = `
Determine if this user input is meaningful or nonsense.
Follow STRICT rules:

Return ONLY one word:
VALID or NONSENSE

NONSENSE = 
- single letter ("b", "x", "q")
- two letters
- one word with no clear intent
- gibberish, random characters
- no verbs, no actionable meaning
- spam or unrelated symbols

VALID = 
- has intent
- has verbs or clear meaning
- resembles a real command or question

User input:
"${text}"

Output:
`;

  try {
    const out = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0
    });

    const raw = out.choices[0].message.content.trim().toUpperCase();
    const valid = raw === "VALID";

    res.json({ valid });

  } catch (err) {
    // fail-open fallback
    res.json({ valid: true });
  }
});

//////////////////////////////////////////////////////////////
// Executive Rewrite Engine
//////////////////////////////////////////////////////////////

app.post("/api/rewrite", async (req, res) => {
  let { query } = req.body;
  query = (query || "").trim();

  if (!query) return res.json({ rewritten: "" });

  const prompt = `
Rewrite the user's text into a single sharp business strategy directive.
Rules:
- EXACTLY 1 sentence.
- No quoting.
- No emotion.
- No metaphors.
- No filler.
- Must sound like senior executive instruction.
Input: ${query}
Rewritten:
`;

  try {
    const out = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    });

    let rewritten = out.choices[0].message.content
      .replace(/["“”‘’]/g, "")
      .trim();

    rewritten = rewritten.split(".")[0] + ".";

    res.json({ rewritten });

  } catch (err) {
    console.log("Rewrite Error:", err);
    res.json({ rewritten: query });
  }
});

//////////////////////////////////////////////////////////////
// AI CLARITY SCORE — Backend Protected Version
//////////////////////////////////////////////////////////////

app.post("/api/score", async (req, res) => {
  const raw = req.body.text || "";

  const prompt = `
Rate the user's input ONLY on clarity, focus, and business-readiness.
Rules:
- Return ONLY a number from 1 to 100.
- No explanation.
User input:
"${raw}"
`;

  try {
    const out = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.0
    });

    const score = (out.choices[0].message.content || "").trim();
    res.json({ score });

  } catch (err) {
    console.log("Score Engine Error:", err);
    res.json({ score: "-" });
  }
});
//////////////////////////////////////////////////////////////
// AI SUGGESTION ENGINE — Explains Score (NEW)
//////////////////////////////////////////////////////////////
app.post("/api/suggest", async (req, res) => {
  const { raw, rewritten, score } = req.body;

  const prompt = `
You are an AI communication coach.

The user wrote:
"${raw}"

The system rewrote it as:
"${rewritten}"

The clarity score was: ${score}/100

Give EXACTLY 3 bullet-point suggestions that explain:
- why the user's score is what it is
- how to improve their command
- what they should change next time

RULES:
- Output ONLY the three bullet points.
- No intro.
- No summary.
- Each bullet must start with "• "
- Each bullet must be one sentence.
`;

  try {
    const out = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4
    });

    const suggestions = out.choices[0].message.content.trim();
    res.json({ suggestions });

  } catch (err) {
    console.log("Suggestion Engine Error:", err);
    res.json({ suggestions: "• Unable to generate suggestions right now.\n• Try rewriting your command and testing again.\n• The AI will provide guidance once available." });
  }
});
//////////////////////////////////////////////////////////////
// Rain Man Business Generator — 10 Personas
//////////////////////////////////////////////////////////////

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

io.on("connection", socket => {

  socket.on("personaSearch", async rewrittenQuery => {
    try {

      //------------------------------------------------------
      // AI Location Extraction
      //------------------------------------------------------
      const location = await extractLocationAI(rewrittenQuery, openai);

      const CAT_ORDER = ["A","B","C","D","E"]; 

      for (let i = 0; i < 5; i++) {

        const cat   = CAT_ORDER[i];
        const major = pick(PROF[cat]);
        const demo  = {
          gender: pick(genders),
          race: pick(races),
          age: pick(ages)
        };

        //------------------------------------------------------
        // SERP NEWS Context
        //------------------------------------------------------
        const serpQuery = `${major} business news ${new Date().getFullYear()}`;

        let serpContext = "No verified data.";

        if (SERP_KEY) {
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
        }

        //------------------------------------------------------
        // Extract numbers for Rain Man logic
        //------------------------------------------------------
        const serpNumbers = [
          ...(serpContext.match(/[0-9]+(\.[0-9]+)?%/g) || []),
          ...(serpContext.match(/[0-9]+(\.[0-9]+)?/g) || []),
          ...(serpContext.match(/\b[0-9]+(\.[0-9]+)?\s*million\b/gi) || []),
          ...(serpContext.match(/\b[0-9]+(\.[0-9]+)?\s*billion\b/gi) || [])
        ];

        const numList = serpNumbers.join(", ") || "none";

        let serpBulletItems = [];
        if (serpContext && serpContext !== "No verified data.") {
          serpBulletItems = serpContext.split(" | ")
            .map(line => line.trim())
            .filter(Boolean);
        }

        //------------------------------------------------------
        // FULL RAIN MAN PROMPT
        //------------------------------------------------------
        const fullPrompt = `
You are a ${demo.gender}, ${demo.race}, age ${demo.age}, trained in ${major}.
Mode: clipped Rain Man business logic. No metaphor. No emotion.

Numbers allowed: ${numList}
6-8 more "You will" statements including the anecdote.

After the paragraph, output:

Key directions to consider:
- direction 1
- direction 2
- direction 3
- direction 4

then, output:
SERP insights:
${serpBulletItems.map(x => `- ${x}`).join("\n")}
`;
        //------------------------------------------------------
        // CALL OPENAI FOR THOUGHT
        //------------------------------------------------------
        const ai = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: fullPrompt }],
          temperature: 0.55
        });

        const fullThought = ai.choices[0].message.content.trim();

        //------------------------------------------------------
// HASHTAGS (4 total) — Full Major + Location-Aware
//------------------------------------------------------
const majorKeyword = "#" + major.replace(/[^A-Za-z0-9]/g, "");
let hashtags = [majorKeyword];

const humanLocation = location
  ? location.replace(/([A-Z])/g, " $1").trim()
  : "";

const hashPrompt = `
Generate exactly 3 business-style hashtags based on this rewritten query:

"${rewrittenQuery}"

If a location is provided, integrate it meaningfully:
Examples:
- #NewYorkTech
- #LosAngelesBusiness
- #TokyoInnovation
- #ParisStartups

Rules:
- EXACTLY 3 hashtags
- ONLY hashtags
- No emojis
- No metaphors
- 1–3 words per hashtag
- Make location contextual (if provided)

Location: ${humanLocation || "NONE"}
`;

try {
  const aiHash = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: hashPrompt }],
    temperature: 0.35
  });

  const raw = aiHash.choices[0].message.content.trim();

  const aiTags = raw
    .split(/\s+/)
    .filter(t => t.startsWith("#"))
    .map(t => t.replace(/[^#A-Za-z0-9]/g, ""))
    .filter(Boolean);

  hashtags.push(...aiTags);

} catch (err) {
  console.log("AI hashtag error:", err);
}

// Remove duplicates + limit to 4
hashtags = [...new Set(hashtags)].slice(0, 4);

        //------------------------------------------------------
        // EMIT NPC CARD
        //------------------------------------------------------
        socket.emit("personaChunk", {
          major,
          gender: demo.gender,
          race: demo.race,
          age: demo.age,
          thought: fullThought,
          serpContext,
          hashtags,
          category: cat
        });

      } // END FOR LOOP

      socket.emit("personaDone");

    } catch (err) {
      console.log("RainMan Engine Error:", err);
      socket.emit("personaError", "Internal error.");
    }
  });
});

//////////////////////////////////////////////////////////////
// VIEW COUNTER
//////////////////////////////////////////////////////////////

const VIEW_FILE = "/data/views.json";

function readViews() {
  try { return JSON.parse(fs.readFileSync(VIEW_FILE, "utf8")); }
  catch { return { total: 0 }; }
}

function writeViews(v) {
  fs.writeFileSync(VIEW_FILE, JSON.stringify(v, null, 2));
}

app.get("/api/views", (req, res) => {
  const v = readViews();

  // ⭐ FIXED START DATE
  v.start = "2025-11-11";

  // Increase total views
  v.total++;

  writeViews(v);

  res.json({
    total: v.total,
    start: v.start,
    today: new Date().toISOString().split("T")[0]
  });
});

// READ-ONLY — does NOT increase count
app.get("/api/views/read", (req, res) => {
  const v = readViews();
  res.json({
    total: v.total,
    start: v.start || "2025-11-11",
    today: new Date().toISOString().split("T")[0]
  });
});
//////////////////////////////////////////////////////////////
// ENTER COUNTER (Hit Enter Count)
//////////////////////////////////////////////////////////////

const ENTER_FILE = "/data/enter.json";

function readEnter() {
  try { return JSON.parse(fs.readFileSync(ENTER_FILE, "utf8")); }
  catch { return { total: 0 }; }
}

function writeEnter(v) {
  fs.writeFileSync(ENTER_FILE, JSON.stringify(v, null, 2));
}

// Return current total
app.get("/api/enter", (req, res) => {
  const c = readEnter();
  res.json({ total: c.total });
});

// Increment total
app.post("/api/enter", (req, res) => {
  const c = readEnter();
  c.total++;
  writeEnter(c);
  res.json({ total: c.total });
});

//////////////////////////////////////////////////////////////
// STATIC SERVE + START SERVER
//////////////////////////////////////////////////////////////

app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log("🔥 Final Rain Man Business Engine running on", PORT);
});
