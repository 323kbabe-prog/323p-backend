//////////////////////////////////////////////////////////////
//  server.js — NPC Browser (Agentic Trend Engine v1.9)
//  PURE PROFESSION ENGINE (5 INDUSTRIES, NO ACADEMIC LAYER)
//  Real professions + Personal Experience + No Topic Repeat
//  All other systems preserved
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

console.log("🚀 NPC Browser — Agentic Trend Engine v1.9 starting...");
console.log("API Key:", !!process.env.OPENAI_API_KEY);

// ==========================================================
// SAFE JSON PARSER
// ==========================================================
function safeJSON(str) {
  try { return JSON.parse(str); }
  catch {
    try {
      const m = str.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
    } catch {}
  }
  return null;
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
// DEMOGRAPHICS ONLY (NO ACADEMIC LAYER ANYMORE)
// ==========================================================
const genders=["Female","Male","Nonbinary"];
const races=["Asian","Black","White","Latino","Middle Eastern","Mixed"];
const ages=[...Array.from({length:32},(_,i)=>i+18)]; // 18–49

// ==========================================================
// SHARE SYSTEM
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
// SOCKET.IO — MAIN NPC ENGINE v1.9
// ==========================================================
const httpServer=createServer(app);
const io=new Server(httpServer,{cors:{origin:"*"}});

io.on("connection",socket=>{
  console.log("🛰️ Client:",socket.id);

  socket.on("personaSearch", async (query)=>{
    try{
      const detectedLocation = extractLocation(query);

      // Track used categories to enforce BIG diversity
      const usedCats = new Set();

      // 5 industry categories (locked)
      const ALL_CATEGORIES = ["A","B","C","D","E"];

      // 10 NPCs
      for(let i=0;i<10;i++){

        // demographic identity
        const persona={
          gender:genders[Math.floor(Math.random()*genders.length)],
          race:races[Math.floor(Math.random()*races.length)],
          age:ages[Math.floor(Math.random()*ages.length)]
        };

        // ======================================================
        // NPC THOUGHT ENGINE v1.9 (NO ACADEMICS)
        // ======================================================
        const thoughtPrompt = `
You are generating a realistic NPC professional persona.

NPC DEMOGRAPHICS:
- Gender: ${persona.gender}
- Race: ${persona.race}
- Age: ${persona.age}

TASK 1 — PROFESSION (5 INDUSTRY SYSTEM):

Assign a **real-world profession** to this NPC from EXACTLY ONE of these industries:

CATEGORY A — MEDICAL & HEALTH  
(doctor, nurse, therapist, clinician, EMT, psychologist, etc.)

CATEGORY B — LAW / GOVERNMENT / PUBLIC SAFETY  
(lawyer, police officer, firefighter, social worker, judge’s clerk, etc.)

CATEGORY C — ENGINEERING / TECH / SCIENCE  
(software developer, civil engineer, scientist, pilot, mechanic, lab tech, etc.)

CATEGORY D — BUSINESS / ECONOMICS / TRADE  
(business owner, economist, restaurant manager, supply chain lead, auto technician, etc.)

CATEGORY E — CREATIVE / ARTS / MEDIA  
(journalist, artist, chef, musician, fashion designer, photographer, etc.)

IMPORTANT RULES:
- MUST choose a category **not already used** by previous NPCs in this batch.
- MUST be a real job that exists.
- MUST NOT repeat job patterns (no clustering like “___ analyst”).
- NEVER mention “major” or “university”.

TASK 2 — THOUGHT (3 SENTENCES):
Write a **three-sentence reflection** about the *idea behind "${query}"*.

STRUCTURE:
1. Conceptual insight from their profession  
   (❗ DO NOT repeat or quote the topic words)
2. Deeper interpretation based on their professional thinking  
3. Short personal experience tied to the job  
   (“I once treated a patient who…”,  
    “A case I handled showed me…”,  
    “During a project, I noticed…”,  
    “A customer I worked with taught me…”)

RULES:
- DO NOT describe the topic directly.
- DO NOT repeat the topic phrase.
- Tone must feel realistic and grounded.

TASK 3 — HASHTAGS:
Return 3–5 simple hashtags (NO # symbol).

FORMAT JSON ONLY:
{
  "profession": "Real job title",
  "thought": "3-sentence reflection ending with a personal experience",
  "hashtags": ["w1","w2","w3"],
  "category": "A/B/C/D/E"
}
        `;

        const resp = await openai.chat.completions.create({
          model:"gpt-4o-mini",
          messages:[{role:"user",content:thoughtPrompt}],
          temperature:0.9
        });

        let parsed = safeJSON(resp.choices?.[0]?.message?.content || "");

        // fallback
        if(!parsed){
          parsed={
            profession:"Teacher",
            thought:"This idea highlights how people relate to ordinary routines. It shows deeper behavioral patterns. A class discussion last year reminded me how strongly these patterns shape identity.",
            hashtags:["culture","daily"],
            category:"E"
          };
        }

        // ENFORCE CATEGORY UNIQUENESS
        if(usedCats.has(parsed.category)){
          const unused = ALL_CATEGORIES.filter(c=>!usedCats.has(c));
          parsed.category = unused[0] || parsed.category;
        }

        usedCats.add(parsed.category);

        // ======================================================
        // TREND ENGINE (unchanged)
        // ======================================================
        const trendPrompt=`
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

        const tResp=await openai.chat.completions.create({
          model:"gpt-4o-mini",
          messages:[{role:"user",content:trendPrompt}],
          temperature:0.6
        });

        let tParsed = safeJSON(tResp.choices?.[0]?.message?.content || "") || {
          trend:["vibe","culture","identity","flow"]
        };

        let trendWords = tParsed.trend.map(splitTrendWord);

        if(detectedLocation){
          trendWords[0]=`${detectedLocation} vibe`;
        }

        // final persona object
        const finalNPC={
          profession:parsed.profession,
          gender:persona.gender,
          race:persona.race,
          age:persona.age,
          thought:parsed.thought,
          hashtags:parsed.hashtags,
          trend:trendWords.slice(0,4),
          category:parsed.category
        };

        socket.emit("personaChunk", finalNPC);
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
// VIEW COUNTER (unchanged)
// ==========================================================
const VIEW_FILE="/data/views.json";
function readViews(){try{return JSON.parse(fs.readFileSync(VIEW_FILE,"utf8"));}catch{return{total:0}}}
function writeViews(v){try{fs.writeFileSync(VIEW_FILE,JSON.stringify(v,null,2));}catch{}}

app.get("/api/views",(req,res)=>{
  const v=readViews(); v.total++; writeViews(v);
  res.json({total:v.total});
});

// ==========================================================
// STATIC FILES
// ==========================================================
app.use(express.static(path.join(__dirname,"public")));

// ==========================================================
// START SERVER
// ==========================================================
const PORT=process.env.PORT||3000;
const server=httpServer.listen(PORT,()=>{
  console.log(`🔥 NPC Browser v1.9 running on :${PORT}`);
});