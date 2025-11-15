//////////////////////////////////////////////////////////////
//  server.js — NPC Browser (Super Agentic Trend Engine v2.5)
//  Built on v1.6 stable backend
//  Additions:
//   • STRICT 5-category profession pools (5 per category)
//   • Guaranteed A→B→C→D→E rotation for 10 NPCs
//   • Strong topic-awareness
//   • Professional subtle micro-emotion
//   • Personal experience tail sentence
//   • Optional SERP API (fallback if missing)
//   • Location-aware trend override
//   • All backend features preserved
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

console.log("🚀 NPC Browser — Agentic Trend Engine v2.6 starting...");
console.log("OpenAI OK:", !!process.env.OPENAI_API_KEY);
console.log("SERP API Enabled:", !!SERP_KEY);

// ==========================================================
// SAFE JSON PARSER
// ==========================================================
function safeJSON(str){
  if(!str || typeof str !== "string") return null;
  try { return JSON.parse(str); } catch {}
  try {
    const m=str.match(/\{[\s\S]*?\}/);
    if(m) return JSON.parse(m[0]);
  } catch {}
  return null;
}

// sanitization ensures no empty NPC fields EVER
function sanitizeNPC(obj){
  return {
    profession: obj?.profession?.trim?.() || "Professional",
    thought: obj?.thought?.trim?.() ||
      "This idea reflects pressures professionals often sense beneath the surface. It shapes how decisions unfold across multiple systems. A moment from my work once revealed how quickly such dynamics intensify.",
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
  return w
    .replace(/([a-z])([A-Z])/g,"$1 $2")
    .replace(/[\-_]/g," ")
    .trim();
}

function extractLocation(text){
  const LOC=[
    "LA","Los Angeles","NYC","New York","Tokyo","Paris","London",
    "Berlin","Seoul","Busan","Taipei","Singapore","San Francisco",
    "SF","Chicago","Miami","Toronto","Seattle"
  ];

  const l=text.toLowerCase();
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
// STRICT MAJOR POOLS (A4 MIXED LEVELS, 5 PER CATEGORY)
// ==========================================================
const PROF = {
  A: [ // Health, Behavior & Human Systems
    "Human Biology",
    "Psychology",
    "Sociology",
    "Public Health",
    "Bioengineering"
  ],
  B: [ // Law, Policy & Society
    "Political Science",
    "Public Policy",
    "International Relations",
    "Ethics in Society",
    "Science, Technology & Society"
  ],
  C: [ // Engineering & Computational Sciences
    "Computer Science",
    "Mechanical Engineering",
    "Electrical Engineering",
    "Symbolic Systems",
    "Aeronautics & Astronautics"
  ],
  D: [ // Business, Economics & Data
    "Economics",
    "Management Science & Engineering",
    "Data Science",
    "Mathematical & Computational Science",
    "Statistics"
  ],
  E: [ // Arts, Media, Humanities & Design
    "Art Practice",
    "Communication",
    "Film & Media Studies",
    "Linguistics",
    "Music"
  ]
};

// ==========================================================
// SHARE SYSTEM (unchanged)
// ==========================================================
const SHARES_FILE="/data/shares.json";
if(!fs.existsSync("/data")) fs.mkdirSync("/data");

function readShares(){ try{return JSON.parse(fs.readFileSync(SHARES_FILE,"utf8"));}catch{return{}}}
function writeShares(d){ fs.writeFileSync(SHARES_FILE,JSON.stringify(d,null,2)); }

app.post("/api/share",(req,res)=>{
  const all=readShares();
  const id=Math.random().toString(36).substring(2,8);
  all[id]={ personas:req.body.personas||[], query:req.body.query||"" };
  writeShares(all);
  res.json({ shortId:id });
});

app.get("/api/share/:id",(req,res)=>{
  const all=readShares();
  const s=all[req.params.id];
  if(!s) return res.status(404).json({error:"Not found"});
  res.json(s.personas||[]);
});

app.get("/s/:id",(req,res)=>{
  const all=readShares();
  const s=all[req.params.id];
  if(!s) return res.redirect("https://npcbrowser.com");

  const p=s.personas||[];
  const q=s.query||"";
  const first=p[0]||{};
  const preview=(first.thought||"").slice(0,150);

  res.send(`<!doctype html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta property="og:title" content="${first.profession||'NPC Browser'}">
<meta property="og:description" content="${preview}">
<meta property="og:image" content="https://npcbrowser.com/og-npc.jpg">
<title>NPC Share</title>
<script>
sessionStorage.setItem("sharedId","${req.params.id}");
setTimeout(()=>{ 
 window.location.href="https://npcbrowser.com?query="+encodeURIComponent("${q}");
},900);
</script>
</head><body></body></html>`);
});

// ==========================================================
// NPC ENGINE v2.5
// ==========================================================
const httpServer = createServer(app);
const io = new Server(httpServer,{cors:{origin:"*"}});

io.on("connection", socket=>{
  console.log("🛰️ Client connected:", socket.id);

  socket.on("personaSearch", async query=>{
    try {
      const location = extractLocation(query);

      // ------------------------------------------------------
      // Optional SERP Web Signal
      // ------------------------------------------------------
      let serpContext = "No verified web data.";
      if(SERP_KEY){
        try{
          const url=`https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=5&api_key=${SERP_KEY}`;
          const r=await fetch(url);
          const j=await r.json();
          const titles=(j.organic_results||[])
            .map(r=>r.title)
            .filter(Boolean)
            .slice(0,3);
          if(titles.length) serpContext=titles.join(" | ");
        }catch{
          serpContext="External sources unavailable.";
        }
      }

      // CATEGORY ROTATION: A → B → C → D → E → repeat
      const CAT_ORDER=["A","B","C","D","E","A","B","C","D","E"];

      for(let i=0;i<10;i++){

        const cat = CAT_ORDER[i];                      // Category assignment
        const profession = pick(PROF[cat]);            // STRICT pool selection

        const demo = {
          gender: pick(genders),
          race: pick(races),
          age: pick(ages)
        };

        // ------------------------------------------------------
        // STRONG TOPIC-AWARE + SUBTLE MICRO-EMOTION THOUGHT ENGINE
        // ------------------------------------------------------
        const prompt = `
Generate an NPC viewpoint.

DEMOGRAPHICS:
${demo.gender}, ${demo.race}, ${demo.age}

CATEGORY: ${cat}
CHOSEN PROFESSION (MUST USE): "${profession}"

WEB CONTEXT:
"${serpContext}"

TASK — Thought (3 sentences, < 420 chars, ALL influenced by the web context):
Use the provided WEB CONTEXT to enrich every part of the analysis.  
Do NOT repeat the exact topic words.

SENTENCE RULES:
1) Connect the situation to the NPC’s academic worldview  
   — Opening must feel distinct each time  
   — Subtly reference patterns implied by the WEB CONTEXT  
   — No template phrasing

2) Describe deeper structural, behavioral, policy, or systemic implications  
   — Use inferences drawn from the WEB CONTEXT (not direct quotes)  
   — Explain why the situation might matter or how it could evolve

3) Provide a brief, concrete personal moment from their academic or applied experience  
   — The example MUST align with the WEB CONTEXT’s themes  
   — Include a subtle professional micro-emotion (no emotional labels)

HASHTAGS:
Return 3–5 simple tags (no #).

JSON ONLY:
{
 "profession":"${profession}",
 "thought":"...",
 "hashtags":["..."],
 "category":"${cat}"
}
        `;

        const raw = await openai.chat.completions.create({
          model:"gpt-4o-mini",
          messages:[{role:"user",content:prompt}],
          temperature:0.9
        });

        let parsed = safeJSON(raw.choices?.[0]?.message?.content || "");
        parsed = sanitizeNPC(parsed);

        // ------------------------------------------------------
        // TREND ENGINE
        // ------------------------------------------------------
        const tPrompt=`
Turn this text into EXACTLY 4 short trend keywords:

"${parsed.thought}"

JSON ONLY:
{"trend":["t1","t2","t3","t4"]}
        `;

        const tRaw=await openai.chat.completions.create({
          model:"gpt-4o-mini",
          messages:[{role:"user",content:tPrompt}],
          temperature:0.6
        });

        let tParsed=safeJSON(tRaw.choices?.[0]?.message?.content||"")||{
          trend:["vibe","culture","flow","signal"]
        };

        let trendWords=tParsed.trend.map(splitTrendWord);

        if(location){
          trendWords[0]=`${location} vibe`;
        }

        // ------------------------------------------------------
        // SEND FINAL NPC (profession FIXED, NEVER EMPTY)
        // ------------------------------------------------------
        socket.emit("personaChunk",{
          profession,
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
//////////////////////////////////////////////////////////////
const VIEW_FILE="/data/views.json";
function readViews(){ try{return JSON.parse(fs.readFileSync(VIEW_FILE,"utf8"));}catch{return{total:0}} }
function writeViews(v){ try{fs.writeFileSync(VIEW_FILE,JSON.stringify(v,null,2));}catch{} }

app.get("/api/views",(req,res)=>{
  const v=readViews(); v.total++; writeViews(v);
  res.json({total:v.total});
});

// ==========================================================
// STATIC FILES
//////////////////////////////////////////////////////////////
app.use(express.static(path.join(__dirname,"public")));

// ==========================================================
// START SERVER
//////////////////////////////////////////////////////////////
const PORT=process.env.PORT||3000;
httpServer.listen(PORT,()=>{
  console.log(`🔥 NPC Browser v2.7 running on :${PORT}`);
});