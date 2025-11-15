//////////////////////////////////////////////////////////////
//  server.js — NPC Browser (Super Agentic Trend Engine v1.8)
//  TRUE CROSS-INDUSTRY DIVERSITY (5 CATEGORY SYSTEM)
//  Professional Thought + Personal Experience + No Topic Repeat
//  All system functions preserved (Share, Auto-search, Trends)
//////////////////////////////////////////////////////////////

const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const OpenAI = require("openai");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

console.log("🚀 NPC Browser — Agentic Trend Engine v1.8 starting...");
console.log("API Key:", !!process.env.OPENAI_API_KEY);

// ==========================================================
// SAFE JSON PARSER
// ==========================================================
function safeJSON(str) {
  try { return JSON.parse(str); }
  catch {
    try {
      const match = str.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch {}
  }
  return null;
}

// ==========================================================
// TREND WORD CLEANER
// ==========================================================
function splitTrendWord(word){
  return word
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[\-_]/g, " ")
    .trim();
}

// ==========================================================
// LOCATION DETECTOR
// ==========================================================
function extractLocation(text){
  const LOCATIONS = [
    "LA","Los Angeles","NYC","New York","Tokyo",
    "Paris","London","Berlin","Seoul","Busan",
    "Taipei","Singapore","San Francisco","SF",
    "Chicago","Miami","Toronto","Seattle"
  ];
  const lower = text.toLowerCase();
  for (let loc of LOCATIONS){
    if(lower.includes(loc.toLowerCase())){
      return loc;
    }
  }
  return null;
}

// ==========================================================
// DEMOGRAPHICS & DISCIPLINES (used only for personality flavor)
// ==========================================================
const genders=["Female","Male","Nonbinary"];
const races=["Asian","Black","White","Latino","Middle Eastern","Mixed"];
const ages=[...Array.from({length:32},(_,i)=>i+18)];  // 18–49

const fields = [
  "Psychology","Sociology","Computer Science","Economics",
  "Philosophy","Human Biology","Symbolic Systems","Political Science",
  "Mechanical Engineering","Art & Theory","Anthropology","Linguistics",
  "Earth Systems","Media Studies","Cognitive Science"
];

function pickUnique(arr, count){
  const copy=[...arr];
  const out=[];
  while(out.length<count && copy.length){
    const idx=Math.floor(Math.random()*copy.length);
    out.push(copy.splice(idx,1)[0]);
  }
  return out;
}

// ==========================================================
// SHARE SYSTEM (unchanged)
// ==========================================================
const SHARES_FILE = "/data/shares.json";
if (!fs.existsSync("/data")) fs.mkdirSync("/data");

function readShares(){
  try { return JSON.parse(fs.readFileSync(SHARES_FILE,"utf8")); }
  catch { return {}; }
}
function writeShares(data){
  try { fs.writeFileSync(SHARES_FILE, JSON.stringify(data,null,2)); }
  catch(err){ console.error("❌ Share save error:",err.message); }
}

app.post("/api/share",(req,res)=>{
  const all = readShares();
  const id = Math.random().toString(36).substring(2,8);

  all[id] = {
    personas: req.body.personas || [],
    query: req.body.query || ""
  };

  writeShares(all);
  res.json({ shortId:id });
});

app.get("/api/share/:id",(req,res)=>{
  const all = readShares();
  const shared = all[req.params.id];
  if(!shared) return res.status(404).json({error:"Not found"});
  res.json(shared.personas || []);
});

app.get("/s/:id",(req,res)=>{
  const all = readShares();
  const shared = all[req.params.id];
  if(!shared) return res.redirect("https://npcbrowser.com");

  const personas=shared.personas||[];
  const originalQuery=shared.query||"";

  const first=personas[0]||{};
  const preview=(first.thought||"").slice(0,150);

  res.send(`<!doctype html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta property="og:title" content="${first.profession || 'NPC Browser'}">
<meta property="og:description" content="${preview}">
<meta property="og:image" content="https://npcbrowser.com/og-npc.jpg">
<meta name="twitter:card" content="summary_large_image">
<title>NPC Share</title>
<script>
sessionStorage.setItem("sharedId","${req.params.id}");
setTimeout(()=>{
  window.location.href =
    "https://npcbrowser.com?query=" + encodeURIComponent("${originalQuery}");
}, 900);
</script>
</head><body></body></html>`);
});

// ==========================================================
// SOCKET.IO — NPC GENERATION ENGINE v1.8
// ==========================================================
const httpServer=createServer(app);
const io=new Server(httpServer,{cors:{origin:"*"}});

io.on("connection", socket=>{
  console.log("🛰️ Client connected:", socket.id);

  socket.on("personaSearch", async query=>{
    try {
      const selectedFields = pickUnique(fields,10);
      const detectedLocation = extractLocation(query);

      // Track used categories to enforce diversity
      const usedCategories = new Set();

      for(let i=0;i<10;i++){

        const persona = {
          persona:{
            gender:genders[Math.floor(Math.random()*genders.length)],
            race:races[Math.floor(Math.random()*races.length)],
            age:ages[Math.floor(Math.random()*ages.length)],
            identity:selectedFields[i]
          },
          profession:"",
          thought:"",
          hashtags:[],
          trend:[]
        };

        // ======================================================
        // NPC THOUGHT ENGINE v1.8 — CROSS-INDUSTRY RULES
        // ======================================================
        const thoughtPrompt = `
You are generating a realistic professional persona.

NPC DEMOGRAPHICS:
- Gender: ${persona.persona.gender}
- Race: ${persona.persona.race}
- Age: ${persona.persona.age}

NPC BACKGROUND:
"${persona.persona.identity}"

TASK 1 — Profession (STRICT 5-CATEGORY SYSTEM):

Assign this NPC a **real profession** from EXACTLY ONE of these 5 industries:

CATEGORY A — MEDICAL & HEALTH  
(doctor, nurse, therapist, clinician, psychologist, EMT, physical therapist, etc.)

CATEGORY B — LAW / GOVERNMENT / PUBLIC SAFETY  
(lawyer, police officer, firefighter, judge’s clerk, social worker, immigration officer, etc.)

CATEGORY C — ENGINEERING / TECH / SCIENCE  
(software developer, civil engineer, mechanical engineer, data scientist, pilot, lab technologist, etc.)

CATEGORY D — BUSINESS / ECONOMICS / TRADE  
(business owner, mechanic, economist, financial advisor, restaurant manager, supply chain manager, etc.)

CATEGORY E — CREATIVE / ARTS / MEDIA  
(journalist, artist, chef, musician, fashion designer, filmmaker, designer, etc.)

RULES:
- MUST choose a profession from a category **NOT yet used** by other NPCs in this batch.
- MUST be a totally REAL job someone could have.
- MUST NOT use academic-sounding roles (“researcher”, “analyst”, “specialist” unless normal).
- NEVER mention “major” or “Stanford”.

TASK 2 — Thought (3 SENTENCES):

Write a **three-sentence reflection** about the *idea behind "${query}"*.

STRUCTURE:
1. Conceptual reflection based on their profession  
   (DO NOT repeat or quote the topic words)
2. Deeper professional interpretation  
3. A short personal experience related to their job  
   (“I once had a patient who…”,  
    “During a case last year…”,  
    “In a project I led…”,  
    “A class I taught revealed…”)

RULES:
- DO NOT describe the topic.  
- DO NOT repeat the topic phrase.  
- Tone must be intelligent, grounded, and realistic.

TASK 3 — Hashtags:
Return 3–5 simple hashtags (NO # symbol).

OUTPUT JSON:
{
  "profession": "Real profession",
  "thought": "Three-sentence reflection ending with a personal experience",
  "hashtags": ["word1","word2","word3"],
  "category": "A/B/C/D/E"
}
        `;

        const resp = await openai.chat.completions.create({
          model:"gpt-4o-mini",
          messages:[{role:"user",content:thoughtPrompt}],
          temperature:0.85
        });

        const parsed = safeJSON(resp.choices?.[0]?.message?.content || "") || {
          profession:"Teacher",
          thought:"This idea reveals how people create meaning in ordinary routines. It reflects deeper patterns underlying behavior. A class I taught once made this unexpectedly clear.",
          hashtags:["culture","pattern"],
          category:"E"
        };

        // Enforce UNIQUE category
        if (usedCategories.has(parsed.category)) {
          // If duplicate category returned, fall back to assigning a missing category
          const allCats = ["A","B","C","D","E"];
          const unused = allCats.filter(c => !usedCategories.has(c));
          parsed.category = unused[0] || parsed.category;
        }

        usedCategories.add(parsed.category);

        persona.profession = parsed.profession;
        persona.thought = parsed.thought;
        persona.hashtags = parsed.hashtags;

        // ======================================================
        // TREND ENGINE (unchanged)
        // ======================================================
        const trendPrompt=`
Turn the following into EXACTLY 4 short TREND KEYWORDS (1–2 words each).
Style: vibe + emotion + aesthetic + culture.

NPC Thought:
"${persona.thought}"

Hashtags:
${persona.hashtags.join(", ")}

User Topic:
"${query}"

JSON ONLY:
{
 "trend":["w1","w2","w3","w4"]
}
        `;

        const tResp = await openai.chat.completions.create({
          model:"gpt-4o-mini",
          messages:[{role:"user",content:trendPrompt}],
          temperature:0.6
        });

        let trendParsed = safeJSON(tResp.choices?.[0]?.message?.content || "") || {
          trend:["vibe","culture","identity","flow"]
        };

        let trendWords = trendParsed.trend.map(splitTrendWord);

        // location override
        if (detectedLocation){
          trendWords[0] = `${detectedLocation} vibe`;
        }

        persona.trend = trendWords.slice(0,4);

        socket.emit("personaChunk", persona);
      }

      socket.emit("personaDone");

    } catch(err){
      console.error("❌ NPC Engine Error:", err);
      socket.emit("personaError","NPC system error");
    }
  });

  socket.on("disconnect",()=>console.log("❌ Client disconnected:",socket.id));
});

// ==========================================================
// VIEW COUNTER (unchanged)
/////////////////////////////////////////////////////////////
const VIEW_FILE="/data/views.json";
function readViews(){try{return JSON.parse(fs.readFileSync(VIEW_FILE,"utf8"));}catch{return{total:0}}}
function writeViews(v){try{fs.writeFileSync(VIEW_FILE,JSON.stringify(v,null,2));}catch{}}

app.get("/api/views",(req,res)=>{
  const v=readViews(); v.total++; writeViews(v);
  res.json({total:v.total});
});

// ==========================================================
// STATIC FILES
/////////////////////////////////////////////////////////////
app.use(express.static(path.join(__dirname,"public")));

// ==========================================================
// START SERVER
/////////////////////////////////////////////////////////////
const PORT=process.env.PORT||3000;
httpServer.listen(PORT,()=>{
  console.log(`🔥 NPC Browser v1.8 running on :${PORT}`);
});