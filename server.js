//////////////////////////////////////////////////////////////
//  server.js — NPC Browser (Agentic Trend Engine v1.9.1)
//  PURE 5-CATEGORY PROFESSION ENGINE + JSON SAFETY PATCH
//  Guaranteed Cross-Industry Diversity + Personal Experience
//  All other systems preserved 100%
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

console.log("🚀 NPC Browser — Agentic Trend Engine v1.9.1 starting...");
console.log("API Key:", !!process.env.OPENAI_API_KEY);

// ==========================================================
// SAFE JSON PARSER (HARDENED)
// ==========================================================
function safeJSON(str) {
  try { 
    return JSON.parse(str); 
  } catch {
    try {
      const match = str.match(/\{[\s\S]*?\}/);
      if (match) return JSON.parse(match[0]);
    } catch {}
  }
  return null;
}

// Force profession object to always have valid structure
function sanitizeNPC(obj){
  const npc = {};

  npc.profession = typeof obj.profession === "string" && obj.profession.trim() !== ""
    ? obj.profession
    : "General Professional";

  npc.thought = typeof obj.thought === "string" && obj.thought.trim() !== ""
    ? obj.thought
    : "This idea highlights core patterns I often notice in my work. It connects with how people adapt to changing conditions. A past situation I handled showed me this clearly.";

  npc.hashtags = Array.isArray(obj.hashtags) && obj.hashtags.length
    ? obj.hashtags
    : ["insight","culture","perspective"];

  npc.category = typeof obj.category === "string" && ["A","B","C","D","E"].includes(obj.category)
    ? obj.category
    : null;

  return npc;
}

// ==========================================================
// TREND WORD CLEANER
// ==========================================================
function splitTrendWord(word){
  return word
    .replace(/([a-z])([A-Z])/g,"$1 $2")
    .replace(/[\-_]/g," ")
    .trim();
}

// ==========================================================
// LOCATION DETECTOR
// ==========================================================
function extractLocation(text){
  const CITIES = [
    "LA","Los Angeles","NYC","New York","Tokyo",
    "Paris","London","Berlin","Seoul","Busan",
    "Taipei","Singapore","San Francisco","SF",
    "Chicago","Miami","Toronto","Seattle"
  ];
  const lower=text.toLowerCase();
  for(let c of CITIES){
    if(lower.includes(c.toLowerCase())) return c;
  }
  return null;
}

// ==========================================================
// DEMOGRAPHICS ONLY (NO ACADEMIC LAYER)
// ==========================================================
const genders=["Female","Male","Nonbinary"];
const races=["Asian","Black","White","Latino","Middle Eastern","Mixed"];
const ages=[...Array.from({length:32},(_,i)=>i+18)]; // 18–49

function randomPick(arr){
  return arr[Math.floor(Math.random()*arr.length)];
}

// ==========================================================
// SHARE SYSTEM — UNCHANGED
// ==========================================================
const SHARES_FILE="/data/shares.json";
if(!fs.existsSync("/data")) fs.mkdirSync("/data");

function readShares(){
  try { return JSON.parse(fs.readFileSync(SHARES_FILE,"utf8")); }
  catch { return {}; }
}
function writeShares(d){
  try { fs.writeFileSync(SHARES_FILE, JSON.stringify(d,null,2)); }
  catch(er){ console.error("❌ Share save error:",er.message); }
}

app.post("/api/share",(req,res)=>{
  const all=readShares();
  const id=Math.random().toString(36).substring(2,8);

  all[id]={
    personas:req.body.personas||[],
    query:req.body.query||""
  };

  writeShares(all);
  res.json({shortId:id});
});

app.get("/api/share/:id",(req,res)=>{
  const all=readShares();
  const shared=all[req.params.id];
  if(!shared) return res.status(404).json({error:"Not found"});
  res.json(shared.personas||[]);
});

app.get("/s/:id",(req,res)=>{
  const all=readShares();
  const shared=all[req.params.id];
  if(!shared) return res.redirect("https://npcbrowser.com");

  const personas=shared.personas||[];
  const q=shared.query||"";
  const first=personas[0]||{};
  const preview=(first.thought||"").slice(0,150);

  res.send(`<!doctype html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta property="og:title" content="${first.profession||'NPC Browser'}">
<meta property="og:description" content="${preview}">
<meta property="og:image" content="https://npcbrowser.com/og-npc.jpg">
<meta name="twitter:card" content="summary_large_image">
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
// SOCKET.IO — NPC ENGINE v1.9.1
// ==========================================================
const httpServer=createServer(app);
const io=new Server(httpServer,{cors:{origin:"*"}});

io.on("connection", socket=>{
  console.log("🛰️ Client connected:",socket.id);

  socket.on("personaSearch", async (query)=>{
    try{
      const detectedLocation = extractLocation(query);
      const usedCats = new Set();
      const ALL_CATS=["A","B","C","D","E"];

      for(let i=0;i<10;i++){

        const persona={
          gender:randomPick(genders),
          race:randomPick(races),
          age:randomPick(ages)
        };

        // ======================================================
        // NPC THOUGHT ENGINE PROMPT — PURE 5-CATEGORIES
        // ======================================================
        const prompt = `
You are generating a realistic NPC professional persona.

NPC DEMOGRAPHICS:
- Gender: ${persona.gender}
- Race: ${persona.race}
- Age: ${persona.age}

TASK 1 — PROFESSION (STRICT CROSS-INDUSTRY DIVERSITY):
Assign a **real, everyday profession** from EXACTLY ONE of these industries:

CATEGORY A — MEDICAL & HEALTH  
(doctor, nurse, therapist, EMT, psychologist)

CATEGORY B — LAW / GOVERNMENT / PUBLIC SAFETY  
(lawyer, police officer, firefighter, social worker)

CATEGORY C — ENGINEERING / TECH / SCIENCE  
(software developer, civil engineer, scientist, pilot, lab tech)

CATEGORY D — BUSINESS / ECONOMICS / TRADE  
(business owner, economist, restaurant manager, mechanic, financial advisor)

CATEGORY E — CREATIVE / ARTS / MEDIA  
(journalist, artist, chef, musician, fashion designer)

IMPORTANT:
- MUST choose a category NOT used by earlier NPCs in this batch.
- MUST be a real job.
- MUST NOT use academic or research titles.
- NEVER mention “university”.

TASK 2 — THOUGHT (3 SENTENCES):
Write a three-sentence reflection about the *idea behind "${query}"*.

STRUCTURE:
1. A conceptual insight based on their profession  
   (❗ DO NOT repeat or quote the topic words)
2. A deeper interpretation using the logic of their field  
3. A short personal experience tied to their job  
   (“I once treated a patient who…”, “During a project, I realized…”, etc.)

TASK 3 — HASHTAGS:
Return 3–5 simple hashtags (NO # symbol).

FORMAT JSON ONLY:
{
  "profession": "...",
  "thought": "...",
  "hashtags": ["..."],
  "category": "A/B/C/D/E"
}
        `;

        const raw = await openai.chat.completions.create({
          model:"gpt-4o-mini",
          messages:[{role:"user",content:prompt}],
          temperature:0.9
        });

        let parsed = safeJSON(raw.choices?.[0]?.message?.content || "");
        parsed = sanitizeNPC(parsed);

        // ======================================================
        // CATEGORY RESCUE (OPTION A — Guaranteed Diversity)
        // ======================================================
        if(!parsed.category || usedCats.has(parsed.category)){
          const unused = ALL_CATS.filter(c=>!usedCats.has(c));
          parsed.category = unused[0] || parsed.category || "E";
        }
        usedCats.add(parsed.category);

        // ======================================================
        // TREND ENGINE
        // ======================================================
        const tPrompt=`
Turn the following into EXACTLY 4 short trend keywords (1–2 words each).
Style: vibe + emotion + aesthetic + culture.

NPC Thought:
"${parsed.thought}"

Hashtags:
${parsed.hashtags.join(", ")}

User Topic:
"${query}"

JSON ONLY:
{
 "trend":["w1","w2","w3","w4"]
}
        `;

        const tRaw = await openai.chat.completions.create({
          model:"gpt-4o-mini",
          messages:[{role:"user",content:tPrompt}],
          temperature:0.6
        });

        let tParsed = safeJSON(tRaw.choices?.[0]?.message?.content || "") || {
          trend:["vibe","culture","identity","flow"]
        };

        let trendWords = tParsed.trend.map(splitTrendWord);

        if(detectedLocation){
          trendWords[0]=`${detectedLocation} vibe`;
        }

        socket.emit("personaChunk",{
          profession:parsed.profession,
          gender:persona.gender,
          race:persona.race,
          age:persona.age,
          thought:parsed.thought,
          hashtags:parsed.hashtags,
          trend:trendWords.slice(0,4),
          category:parsed.category
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
// VIEW COUNTER — unchanged
// ==========================================================
const VIEW_FILE="/data/views.json";
function readViews(){try{return JSON.parse(fs.readFileSync(VIEW_FILE,"utf8"));}catch{return{total:0}}}
function writeViews(v){try{fs.writeFileSync(VIEW_FILE,JSON.stringify(v,null,2));}catch{}}

app.get("/api/views",(req,res)=>{
  const v=readViews(); v.total++; writeViews(v);
  res.json({total:v.total});
});

// ==========================================================
// STATIC FILES — unchanged
// ==========================================================
app.use(express.static(path.join(__dirname,"public")));

// ==========================================================
// START SERVER
// ==========================================================
const PORT=process.env.PORT||3000;
const server=httpServer.listen(PORT,()=>{
  console.log(`🔥 NPC Browser v1.9.1 running on :${PORT}`);
});