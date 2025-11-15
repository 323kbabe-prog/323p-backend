//////////////////////////////////////////////////////////////
//  server.js — NPC Browser (Super Agentic Trend Engine v1.7)
//  NPC Update: Ultra-Diverse Real Professions + No Topic Repeat
//  + Personal Experience + ALL SYSTEMS PRESERVED
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

console.log("🚀 NPC Browser — Agentic Trend Engine v1.7 starting...");
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
    "Chicago","Miami","Toronto"
  ];
  const lower = text.toLowerCase();
  for (let loc of LOCATIONS){
    if(lower.includes(loc.toLowerCase().replace(".",""))){
      return loc.replace(".","");
    }
  }
  return null;
}

// ==========================================================
// DEMOGRAPHICS & ACADEMIC FIELDS (Used only for personality variation)
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
// SHARE SYSTEM (UNCHANGED)
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
// SOCKET.IO — MAIN NPC GENERATOR (v1.7)
// ==========================================================
const httpServer=createServer(app);
const io=new Server(httpServer,{cors:{origin:"*"}});

io.on("connection", socket=>{
  console.log("🛰️ Client connected:", socket.id);

  socket.on("personaSearch", async query=>{
    try {
      const selectedFields = pickUnique(fields,10);
      const detectedLocation = extractLocation(query);

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
        // NPC THOUGHT ENGINE v1.7
        // ======================================================
        const thoughtPrompt = `
You are generating a highly realistic professional perspective.

NPC DEMOGRAPHICS:
- Gender: ${persona.persona.gender}
- Race: ${persona.persona.race}
- Age: ${persona.persona.age}

NPC ACADEMIC BACKGROUND:
"${persona.persona.identity}"

TASK 1 — Profession (CRITICAL DIVERSITY RULE):
Create a **real-world profession** for this NPC that:
- is a job someone in everyday life could realistically have,
- belongs to a **different industry** than the other NPCs,
- avoids similar patterns (no repeated templates like “___ analyst”, “___ researcher”),
- does NOT mention “major” or “Stanford”.

Allowed industries include:
medicine, law, engineering, education, arts, trades, journalism,
transportation, public safety, finance, therapy, architecture, design,
software development, social work, hospitality, business, science, etc.

Examples (do NOT copy): doctor, nurse, lawyer, teacher, engineer,
chef, electrician, journalist, pilot, therapist, architect, accountant,
software developer, firefighter, fashion designer.

TASK 2 — Thought:
Write a **3-sentence reflection** about the *idea behind "${query}"*.

STRUCTURE:
1. Sentence 1 → A conceptual reflection from their professional worldview  
   (DO NOT repeat the topic words directly)
2. Sentence 2 → Deeper interpretation using the logic of their field  
3. Sentence 3 → A short personal experience (e.g.,  
   “Last year I handled a case where…”,  
   “I once had a patient who…”,  
   “During a project, I saw…”,  
   “A class I taught revealed this to me…”)

Rules:
- DO NOT describe the topic directly.
- DO NOT repeat the topic phrase.
- Tone must be realistic, professional, and grounded.

TASK 3 — Hashtags:
Return 3–5 simple, trend-friendly hashtags (NO # symbol).

JSON ONLY:
{
  "profession": "Real profession",
  "thought": "Three-sentence reflection ending with a personal experience",
  "hashtags": ["word1","word2","word3"]
}
        `;

        const resp = await openai.chat.completions.create({
          model:"gpt-4o-mini",
          messages:[{role:"user",content:thoughtPrompt}],
          temperature:0.85
        });

        const parsed = safeJSON(resp.choices?.[00000]?.message?.content || "") || {
          profession:"Teacher",
          thought:"This idea reveals how people organize meaning in their daily routines. Different life stages influence how individuals internalize these moments. A class discussion I led last year showed me how deeply this can shape someone’s outlook.",
          hashtags:["culture","pattern"]
        };

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
// VIEW COUNTER (UNCHANGED)
/////////////////////////////////////////////////////////////
const VIEW_FILE="/data/views.json";
function readViews(){try{return JSON.parse(fs.readFileSync(VIEW_FILE,"utf8"));}catch{return{total:0}}}
function writeViews(v){try{fs.writeFileSync(VIEW_FILE,JSON.stringify(v,null,2));}catch{}}

app.get("/api/views",(req,res)=>{
  const v=readViews(); v.total++; writeViews(v);
  res.json({total:v.total});
});

// ==========================================================
// STATIC FILES (UNCHANGED)
/////////////////////////////////////////////////////////////
app.use(express.static(path.join(__dirname,"public")));

// ==========================================================
// START SERVER
/////////////////////////////////////////////////////////////
const PORT=process.env.PORT||3000;
httpServer.listen(PORT,()=>{
  console.log(`🔥 NPC Browser v1.7 running on :${PORT}`);
});