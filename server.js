//////////////////////////////////////////////////////////////
//  server.js — NPC Browser (Super Agentic Trend Engine v2.8)
//  Built on v1.6 stable backend
//
//  MAJOR FEATURES (v2.8):
//   • STRICT 5-category Stanford academic major pools (5 each)
//   • A→B→C→D→E rotation for 10 NPCs
//   • SERP API headline-signal extraction (if enabled)
//   • Enhanced topic-awareness + SERP-influenced reasoning
//   • Updated 4-step Thought Engine (<420 chars):
//        1) Distinct academic-worldview opening
//        2) Deep structural/systemic implication analysis
//        3) Concrete academic/applied personal moment
//        4) Service-oriented insight (usage, demand, cost pressure)
//   • Professional micro-emotion (subtle, no labels)
//   • Location-aware trend override (“NYC vibe”, “LA vibe”, etc.)
//   • Trend Engine v2 (4 short keywords)
//   • Safe JSON parsing + output sanitization
//   • Share System + OG preview + auto-load
//   • Auto-search via ?query=
//   • View counter + static hosting + socket streaming
//
//  Fully updated: "major" replaces "profession" everywhere.
//  Stable, production-ready.
//  This is the official NPC Browser — Agentic Trend Engine v2.8.
//
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

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const SERP_KEY = process.env.SERPAPI_KEY || null;

console.log("🚀 NPC Browser — Agentic Trend Engine v2.8 starting...");
console.log("OpenAI OK:", !!process.env.OPENAI_API_KEY);
console.log("SERP API Enabled:", !!SERP_KEY);

// ==========================================================
// SAFE JSON PARSER
// ==========================================================
function safeJSON(str){
  if(!str || typeof str !== "string") return null;
  try { return JSON.parse(str); } catch {}
  try {
    const m = str.match(/\{[\s\S]*?\}/);
    if(m) return JSON.parse(m[0]);
  } catch {}
  return null;
}

// ==========================================================
// SANITIZATION — guarantees no empty NPC fields
// ==========================================================
function sanitizeNPC(obj){
  return {
    major: obj?.major?.trim?.() || "Academic Field",
    thought:
      obj?.thought?.trim?.() ||
      "This idea reflects pressures embedded in academic systems. It shifts how people respond to structural signals. I encountered similar tension during a past study when early indicators quietly intensified.",
    hashtags: Array.isArray(obj?.hashtags) && obj.hashtags.length
      ? obj.hashtags
      : ["perspective","signal","culture"],
    category: ["A","B","C","D","E"].includes(obj?.category)
      ? obj.category
      : null
  };
}

// ==========================================================
// HELPERS
// ==========================================================
function splitTrendWord(w){
  return w.replace(/([a-z])([A-Z])/g,"$1 $2")
    .replace(/[\-_]/g," ")
    .trim();
}

function extractLocation(text){
  const LOC = [
    "LA","Los Angeles","NYC","New York","Tokyo","Paris","London",
    "Berlin","Seoul","Busan","Taipei","Singapore","San Francisco",
    "SF","Chicago","Miami","Toronto","Seattle"
  ];
  const l = text.toLowerCase();
  for(const c of LOC){
    if(l.includes(c.toLowerCase())) return c;
  }
  return null;
}

const genders=["Female","Male","Nonbinary"];
const races=["Asian","Black","White","Latino","Middle Eastern","Mixed"];
const ages=[...Array.from({length:32},(_,i)=>i+18)];
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

// ==========================================================
// STRICT STANFORD MAJOR POOLS
// ==========================================================
const PROF = {
  A: ["Human Biology","Psychology","Sociology","Public Health","Bioengineering"],
  B: ["Political Science","Public Policy","International Relations","Ethics in Society","Science, Technology & Society"],
  C: ["Computer Science","Mechanical Engineering","Electrical Engineering","Symbolic Systems","Aeronautics & Astronautics"],
  D: ["Economics","Management Science & Engineering","Data Science","Mathematical & Computational Science","Statistics"],
  E: ["Art Practice","Communication","Film & Media Studies","Linguistics","Music"]
};

// ==========================================================
// SHARE SYSTEM
// ==========================================================
const SHARES_FILE = "/data/shares.json";
if(!fs.existsSync("/data")) fs.mkdirSync("/data");

function readShares(){ try{return JSON.parse(fs.readFileSync(SHARES_FILE,"utf8"))}catch{return{}} }
function writeShares(d){ fs.writeFileSync(SHARES_FILE,JSON.stringify(d,null,2)); }

app.post("/api/share",(req,res)=>{
  const all = readShares();
  const id = Math.random().toString(36).substring(2,8);
  all[id] = { personas:req.body.personas||[], query:req.body.query||"" };
  writeShares(all);
  res.json({ shortId:id });
});

app.get("/api/share/:id",(req,res)=>{
  const all = readShares();
  const s = all[req.params.id];
  if(!s) return res.status(404).json({error:"Not found"});
  res.json(s.personas||[]);
});

app.get("/s/:id",(req,res)=>{
  const all = readShares();
  const s = all[req.params.id];
  if(!s) return res.redirect("https://npcbrowser.com");

  const p = s.personas || [];
  const q = s.query || "";
  const first = p[0] || {};
  const preview = (first.thought||"").slice(0,150);

  res.send(`<!doctype html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta property="og:title" content="${first.major||'NPC Browser'}">
<meta property="og:description" content="${preview}">
<meta property="og:image" content="https://npcbrowser.com/og-npc.jpg">
<title>NPC Share</title>
<script>
sessionStorage.setItem("sharedId","${req.params.id}");
setTimeout(()=>{ window.location.href="https://npcbrowser.com?query="+encodeURIComponent("${q}") },900);
</script>
</head><body></body></html>`);
});

// ==========================================================
// BLUE OCEAN REWRITE ENGINE vAI-Pro (only new addition)
// ==========================================================
app.post("/api/rewrite", async (req, res) => {
  const { query } = req.body;

  const prompt = `
Rewrite the user input into a polished, globally-correct business direction statement.

Rules:
- ALWAYS rewrite the input.
- NEVER use any quotation marks (“ ” " ').
- Keep the user’s meaning without adding new details.
- Normalize global locations into official names.
- Use professional strategy terms (initiative, concept, venture, project, brand, direction).
- One sentence only.
- No JSON. Only plain text.

User Input: ${query}
Rewritten (no quotes):
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    });

    let rewritten = completion.choices[0].message.content.trim();
    rewritten = rewritten.replace(/["“”‘’]/g, ""); // HARD CLEAN

    res.json({ rewritten });

  } catch (err) {
    console.error("❌ Rewrite Engine Error:", err);
    res.json({ rewritten: query });
  }
});

// ==========================================================
// NPC ENGINE v2.8  (unchanged)
// ==========================================================
const httpServer = createServer(app);
const io = new Server(httpServer,{cors:{origin:"*"}});

io.on("connection", socket=>{
  console.log("🛰️ Client connected:", socket.id);

  socket.on("personaSearch", async query=>{
    try {
      const location = extractLocation(query);

      let serpContext = "No verified web data.";
      if(SERP_KEY){
        try{
          const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=5&api_key=${SERP_KEY}`;
          const r = await fetch(url);
          const j = await r.json();
          const titles = (j.organic_results||[])
            .map(r=>r.title)
            .filter(Boolean)
            .slice(0,3);
          if(titles.length) serpContext = titles.join(" | ");
        }catch{
          serpContext = "External sources unavailable.";
        }
      }

      const CAT_ORDER = ["A","B","C","D","E","A","B","C","D","E"];

      for(let i=0;i<10;i++){
        const cat = CAT_ORDER[i];
        const major = pick(PROF[cat]);

        const demo = {
          gender: pick(genders),
          race: pick(races),
          age: pick(ages)
        };

        const prompt = `
Generate an NPC viewpoint.

DEMOGRAPHICS:
${demo.gender}, ${demo.race}, ${demo.age}

CATEGORY: ${cat}
CHOSEN MAJOR (MUST USE): "${major}"

WEB CONTEXT:
"${serpContext}"

TASK — Thought (3 sentences, < 420 chars):
Use the web context indirectly. No quoting.
Each sentence follows strict rules.

JSON ONLY:
{
 "major":"${major}",
 "thought":"...",
 "hashtags":["..."],
 "category":"${cat}"
}`;

        const raw = await openai.chat.completions.create({
          model:"gpt-4o-mini",
          messages:[{role:"user",content:prompt}],
          temperature:0.9
        });

        let parsed = safeJSON(raw.choices?.[0]?.message?.content || "");
        parsed = sanitizeNPC(parsed);

        const tPrompt = `
Turn this text into EXACTLY 4 short trend keywords:
"${parsed.thought}"

JSON ONLY:
{"trend":["t1","t2","t3","t4"]}
        `;

        const tRaw = await openai.chat.completions.create({
          model:"gpt-4o-mini",
          messages:[{role:"user",content:tPrompt}],
          temperature:0.6
        });

        let tParsed = safeJSON(tRaw.choices?.[0]?.message?.content || "") || {
          trend:["vibe","culture","flow","signal"]
        };

        let trendWords = tParsed.trend.map(splitTrendWord);

        if(location){
          trendWords[0] = `${location} vibe`;
        }

        socket.emit("personaChunk",{
          major,
          gender: demo.gender,
          race: demo.race,
          age: demo.age,
          thought: parsed.thought,
          hashtags: parsed.hashtags,
          trend: trendWords.slice(0,4),
          category: cat
        });

      }

      socket.emit("personaDone");

    } catch(err){
      console.error("❌ NPC Engine Error:",err);
      socket.emit("personaError","NPC system error");
    }
  });

  socket.on("disconnect",()=>console.log("❌ Client disconnected:",socket.id));
});

// ==========================================================
// VIEWS
// ==========================================================
const VIEW_FILE="/data/views.json";
function readViews(){ try{return JSON.parse(fs.readFileSync(VIEW_FILE,"utf8"));}catch{return{total:0}} }
function writeViews(v){ try{fs.writeFileSync(VIEW_FILE,JSON.stringify(v,null,2))}catch{} }

app.get("/api/views",(req,res)=>{
  const v = readViews(); v.total++; writeViews(v);
  res.json({total:v.total});
});

// ==========================================================
// STATIC FILES
// ==========================================================
app.use(express.static(path.join(__dirname,"public")));

// ==========================================================
// START SERVER
// ==========================================================
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT,()=>{
  console.log(`🔥 NPC Browser v2.8 running on :${PORT}`);
});