//////////////////////////////////////////////////////////////
//  Rain Man Business Engine — Final Version B (Clean Build)
//  NEWS-ONLY SERP MODE + Full Number Extraction
//  Persona-Based SERP by Major
//  Executive Rewrite + Rain-Man Paragraph Engine
//////////////////////////////////////////////////////////////

const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const OpenAI = require("openai");
const cors = require("cors");
const fs = require("fs");
const fetch = require("node-fetch");

//////////////////////////////////////////////////////////////
// APP + OPENAI + SERP
//////////////////////////////////////////////////////////////

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SERP_KEY = process.env.SERPAPI_KEY || null;

console.log("🚀 Rain Man Business Engine Started");
console.log("SERP Active:", !!SERP_KEY);

//////////////////////////////////////////////////////////////
// HELPERS
//////////////////////////////////////////////////////////////

// AI-style location extraction (from rewrittenQuery)
function extractLocationAI(text) {
  if (!text) return null;

  const locWords = text.split(/\s+/).filter((w) => /^[A-Z][a-zA-Z]+$/.test(w));

  if (locWords.length >= 2) return locWords[0] + locWords[1]; // NewYorkCity, LosAngeles
  if (locWords.length === 1) return locWords[0];

  return null;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

//////////////////////////////////////////////////////////////
// IDENTITY POOLS
//////////////////////////////////////////////////////////////

const genders = ["Female", "Male", "Nonbinary"];
const races = ["Asian", "Black", "White", "Latino", "Middle Eastern", "Mixed"];
const ages = [...Array.from({ length: 32 }, (_, i) => i + 18)];

const PROF = {
  A: ["Human Biology", "Psychology", "Sociology", "Public Health", "Bioengineering"],
  B: ["Political Science", "Public Policy", "International Relations", "Ethics in Society", "Science, Technology & Society"],
  C: ["Computer Science", "Mechanical Engineering", "Electrical Engineering", "Symbolic Systems", "Aeronautics & Astronautics"],
  D: ["Economics", "Management Science & Engineering", "Data Science", "Mathematical & Computational Science", "Statistics"],
  E: ["Art Practice", "Communication", "Film & Media Studies", "Linguistics", "Music"],
};

//////////////////////////////////////////////////////////////
// SHARE SYSTEM
//////////////////////////////////////////////////////////////

const ORIGIN_MAP = {
  blue: "https://blueoceanbrowser.com",
  npc: "https://npcbrowser.com",
  persona: "https://personabrowser.com",
  billy: "https://24billybrowser.com",
};

const SHARES_FILE = "/data/shares.json";
if (!fs.existsSync("/data")) fs.mkdirSync("/data");

function readShares() {
  try {
    return JSON.parse(fs.readFileSync(SHARES_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeShares(v) {
  fs.writeFileSync(SHARES_FILE, JSON.stringify(v, null, 2));
}

app.post("/api/share", (req, res) => {
  const all = readShares();
  const id = Math.random().toString(36).substring(2, 8);

  all[id] = {
    personas: req.body.personas || [],
    query: req.body.query || "",
    origin: req.body.origin || "blue",
  };

  writeShares(all);
  res.json({ shortId: id });
});

app.get("/api/share/:id", (req, res) => {
  const all = readShares();
  const s = all[req.params.id];
  if (!s) return res.status(404).json([]);
  res.json(s.personas || []);
});

app.get("/s/:id", (req, res) => {
  const all = readShares();
  const s = all[req.params.id];
  if (!s) return res.redirect("https://blueoceanbrowser.com");

  const redirectURL = ORIGIN_MAP[s.origin] || ORIGIN_MAP.blue;

  res.send(`
    <!doctype html><html><head><meta charset='utf-8'/>
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
// EXECUTIVE REWRITE ENGINE — 1 Sentence Business Direction
//////////////////////////////////////////////////////////////

app.post("/api/rewrite", async (req, res) => {
  let { query } = req.body;
  query = (query || "").trim();
  if (!query) return res.json({ rewritten: "" });

  const prompt = `
Rewrite the user's text into ONE sharp executive business strategy sentence.

RULES:
- EXACTLY 1 sentence.
- No quoting the user.
- No emotion.
- No metaphors.
- No filler language.
- Must sound like senior-executive strategic direction.
- STAY FOCUSED on clarity & business action.
- PRESERVE ALL proper nouns (people, companies, cities, brands).
- DO NOT remove names such as: Taylor Swift, Elon Musk, Tesla, Amazon, New York, etc.
- Preserve any proper nouns exactly as they appear.
- Strengthen the intent, remove informal phrasing.

User Input: ${query}
Rewritten:
  `;

  try {
    const out = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    let rewritten = out.choices[0].message.content.replace(/["“”‘’]/g, "").trim();

    rewritten = rewritten.split(".")[0] + ".";

    res.json({ rewritten });
  } catch (err) {
    console.log("Rewrite ERROR:", err);
    res.json({ rewritten: query });
  }
});

//////////////////////////////////////////////////////////////
// MAIN ENGINE — Rain Man Business Thought Engine (NEWS ONLY)
//////////////////////////////////////////////////////////////

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  socket.on("personaSearch", async (rewrittenQuery) => {
    try {
      const location = extractLocationAI(rewrittenQuery);
      const CAT_ORDER = ["A", "B", "C", "D", "E", "A", "B", "C", "D", "E"];

      for (let i = 0; i < 10; i++) {
        const cat = CAT_ORDER[i];
        const major = pick(PROF[cat]);
        const demo = {
          gender: pick(genders),
          race: pick(races),
          age: pick(ages),
        };

        ////////////////////////////////////////////////////////
        // SERP NEWS FETCH — major-specific
        ////////////////////////////////////////////////////////

        const serpQuery = `${major} business news ${new Date().getFullYear()}`;
        let serpContext = "No verified data.";

        if (SERP_KEY) {
          try {
            const url = `https://serpapi.com/search.json?q=${encodeURIComponent(
              serpQuery
            )}&tbm=nws&num=5&api_key=${SERP_KEY}`;

            const r = await fetch(url);
            const j = await r.json();

            const titles = (j.news_results || [])
              .map((x) => x.title)
              .filter(Boolean)
              .slice(0, 5)
              .join(" | ");

            if (titles) serpContext = titles;
          } catch (e) {
            console.log("SERP NEWS FAIL:", e.message);
          }
        }

        ////////////////////////////////////////////////////////
        // NUMBER EXTRACTION — % , decimals , million , billion
        ////////////////////////////////////////////////////////

        const serpNumbers = [
          ...(serpContext.match(/[0-9]+(\.[0-9]+)?%/g) || []),
          ...(serpContext.match(/[0-9]+(\.[0-9]+)?/g) || []),
          ...(serpContext.match(/\b[0-9]+(\.[0-9]+)?\s*million\b/gi) || []),
          ...(serpContext.match(/\b[0-9]+(\.[0-9]+)?\s*billion\b/gi) || []),
        ];

        const numList = serpNumbers.join(", ") || "none";

        ////////////////////////////////////////////////////////
        // RAIN MAN PROMPT — Single Paragraph Only
        ////////////////////////////////////////////////////////

        const fullPrompt = `
You are a ${demo.gender}, ${demo.race}, age ${demo.age}, trained in ${major}.
Business reasoning only. No emotion. No metaphor. No abstraction.
Use only ${major} vocabulary. No words from rewritten direction. 
Do not use any wording from: "${serpContext}".

Allowed numeric values: ${numList}

Write ONE SINGLE PARAGRAPH:

Sentence 1:
- Begins with “I will”
- ${major}-logic business action
- Loosely reflects category of "${rewrittenQuery}" (no shared words)
- Includes at least one of: ${numList}

Sentence 2:
- Short factual sentence (no “I will”).

Sentence 3:
- Short factual sentence (no “I will”).

Then:
- 6–7 more “I will” statements
- All business procedural steps
- Use ${major} reasoning
- Incorporate numbers naturally (not explained)
- Include the anecdote: “I noted one instance once.”

After the paragraph, output EXACTLY four bullets:
Key directions to consider:
- direction 1
- direction 2
- direction 3
- direction 4

Bullets must be:
- procedural
- ${major}-specific
- clipped
- may use numbers
- NO reference to query or SERP.

Return plain text only.
`;

        ////////////////////////////////////////////////////////
        // CALL OPENAI — THOUGHT
        ////////////////////////////////////////////////////////

        const ai = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: fullPrompt }],
          temperature: 0.55,
        });

        const fullThought = ai.choices[0].message.content.trim();

        ////////////////////////////////////////////////////////
        // FINAL HASHTAG BUILDER — Major + Name + Location + Strategy
        ////////////////////////////////////////////////////////

        // 1. Major keyword
        const majorKeyword = major.split(" ")[0];
        let hashtags = [`#${majorKeyword}`];

        // 2. Proper names from rewrittenQuery (FULL NAME MERGE)
        const cleanedRewrite = rewrittenQuery.replace(/’s|\'s/g, "");
        const nameTokens = cleanedRewrite.split(/\s+/);

        let properNames = [];
        let block = [];

        for (let w of nameTokens) {
          if (/^[A-Z][a-zA-Z]+$/.test(w)) {
            block.push(w);
          } else {
            if (block.length > 0) {
              properNames.push(block.join("")); // Taylor Swift → TaylorSwift
              block = [];
            }
          }
        }
        if (block.length > 0) {
          properNames.push(block.join(""));
        }

        const nameTags = [...new Set(properNames)].map((n) => `#${n}`);

        if (nameTags.length > 0) {
          hashtags.push(nameTags[0]); // only first name
        }

        // 3. AI Location
        if (location) {
          hashtags.push(`#${location}`);
        }

        // 4. Business Strategy keyword from rewrittenQuery
        const BUSINESS_KEYWORDS = [
          "Strategy",
          "Marketing",
          "Brand",
          "Growth",
          "Segmentation",
          "Positioning",
          "Partnership",
          "Promotion",
          "Campaign",
          "Engagement",
          "Expansion",
          "Analytics",
          "Optimization",
          "Outreach",
          "Distribution",
          "Performance",
        ];

        let strategyTag = null;
        for (let word of cleanedRewrite.split(/\s+/)) {
          const clean = word.replace(/[^a-zA-Z]/g, "");
          if (BUSINESS_KEYWORDS.includes(clean)) {
            strategyTag = `#${clean}Strategy`;
            break;
          }
        }
        if (!strategyTag) {
          strategyTag = "#BusinessStrategy";
        }
        hashtags.push(strategyTag);

        // FINAL CLEANUP
        hashtags = hashtags.filter(Boolean);
        hashtags = [...new Set(hashtags)];
        hashtags = hashtags.slice(0, 4); // up to 4, may be fewer

        ////////////////////////////////////////////////////////
        // EMIT TO FRONTEND
        ////////////////////////////////////////////////////////

        socket.emit("personaChunk", {
          major,
          gender: demo.gender,
          race: demo.race,
          age: demo.age,
          thought: fullThought,
          serpContext,
          hashtags,
          category: cat,
        });
      }

      socket.emit("personaDone");
    } catch (err) {
      console.log("ENGINE ERROR:", err);
      socket.emit("personaError", "Engine failed");
    }
  });
});

//////////////////////////////////////////////////////////////
// VIEWS + STATIC
//////////////////////////////////////////////////////////////

const VIEW_FILE = "/data/views.json";

function readViews() {
  try {
    return JSON.parse(fs.readFileSync(VIEW_FILE, "utf8"));
  } catch {
    return { total: 0 };
  }
}

function writeViews(v) {
  fs.writeFileSync(VIEW_FILE, JSON.stringify(v, null, 2));
}

app.get("/api/views", (req, res) => {
  const v = readViews();
  v.total++;
  writeViews(v);
  res.json({ total: v.total });
});

app.use(express.static(path.join(__dirname, "public")));

//////////////////////////////////////////////////////////////
// START SERVER
//////////////////////////////////////////////////////////////

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log("🔥 Final Rain Man Business Engine running on", PORT);
});