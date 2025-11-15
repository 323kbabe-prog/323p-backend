//////////////////////////////////////////////////////////////
//  server.js — NPC Browser (Agentic Trend Engine v2.0)
//  PURE 5-CATEGORY REAL PROFESSION ENGINE
//  3-Sentence Thought + Personal Experience + No Topic Repeat
//  Share System + Auto-Search + Trend Engine Fully Preserved
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

console.log("🚀 NPC Browser — Agentic Trend Engine v2.0 starting...");
console.log("API Key:", !!process.env.OPENAI_API_KEY);

//////////////////////////////////////////////////////////////
//  SAFETY JSON PARSER
//////////////////////////////////////////////////////////////
function safeJSON(str) {
  if (!str || typeof str !== "string") return null;

  try { return JSON.parse(str); } catch {}

  try {
    const match = str.match(/\{[\s\S]*?\}/);
    if (match) return JSON.parse(match[0]);
  } catch {}

  return null;
}

function sanitizeNPC(obj){
  const npc = {};

  npc.profession = typeof obj.profession === "string" && obj.profession.trim() !== ""
    ? obj.profession
    : "General Professional";

  npc.thought = typeof obj.thought === "string" && obj.thought.trim() !== ""
    ? obj.thought
    : "This idea highlights familiar behavior patterns. It shapes how people navigate daily situations. A moment from my work showed me this clearly.";

  npc.hashtags = Array.isArray(obj.hashtags) && obj.hashtags.length
    ? obj.hashtags
    : ["culture","insight","pattern"];

  npc.category = typeof obj.category === "string" &&
    ["A","B","C","D","E"].includes(obj.category)
      ? obj.category
      : null;

  return npc;
}

//////////////////////////////////////////////////////////////
//  UTILS
//////////////////////////////////////////////////////////////
function splitTrendWord(word){
  return word
    .replace(/([a-z])([A-Z])/g,"$1 $2")
    .replace(/[\-_]/g," ")
    .trim();
}

function extractLocation(text){
  const CITIES = [
    "LA","Los Angeles","NYC","New York","Tokyo",
    "Paris","London","Berlin","Seoul","Busan",
    "Taipei","Singapore","San Francisco","SF",
    "Chicago","Miami","Toronto","Seattle"
  ];
  const l=text.toLowerCase();
  for(let c of CITIES){
    if(l.includes(c.toLowerCase())) return c;
  }
  return null;
}

const genders=["Female","Male","Nonbinary"];
const races=["Asian","Black","White","Latino","Middle Eastern","Mixed"];
const ages=[...Array.from({length:32},(_,i)=>i+18)];

function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

//////////////////////////////////////////////////////////////
//  SHARE SYSTEM (unchanged)
//////////////////////////////////////////////////////////////
const SHARES_FILE="/data/shares.json";
if(!fs.existsSync("/data")) fs.mkdirSync("/data");

function readShares(){
  try { return JSON.parse(fs.readFileSync(SHARES_FILE,"utf8")); }
  catch { return {}; }
}

function writeShares(d){
  try { fs.writeFileSync(SHARES_FILE, JSON.stringify(d,null,2)); }
  catch(er){ console.error("❌ Cannot save share:",er.message); }
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
  const data=all[req.params.id];
  if(!data) return res.status(404).json({error:"Not found"});
  res.json(data.personas||[]);
});

app.get("/s/:id",(req,res)=>{
  const all=readShares();
  const shared=all[req.params.id];
  if(!shared) return res.redirect("https://npcbrowser.com");

  const first=shared.personas[0]||{};
  const preview=(first.thought||"").slice(0,150);

  res.send(`<!doctype html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta property="og:title" content="${first.profession||'NPC'}">
<meta property="og:description" content="${preview}">
<meta property="og:image" content="https://npcbrowser.com/og-npc.jpg">
<meta name="twitter:card" content="summary_large_image">
<title>NPC Share</title>
<script>
sessionStorage.setItem("sharedId","${req.params.id}");
setTimeout(()=>{
  window.location.href="https://npcbrowser.com?query="+encodeURIComponent("${shared.query}");
},900);
</script>
</head><body></body></html>`);
});

//////////////////////////////////////////////////////////////
//  NPC ENGINE (v2.0 — FINAL)
//////////////////////////////////////////////////////////////
const httpServer=createServer(app);
const io=new Server(httpServer,{cors:{origin:"*"}});

io.on("connection", socket=>{
  console.log("🛰️ Client connected:",socket.id);

  socket.on("personaSearch", async query=>{
    try{
      const detectedLocation = extractLocation(query);

      const usedCats = new Set();
      const ALL_CATS = ["A","B","C","D","E"];

      for(let i=0;i<10;i++){

        const demo = {
          gender: pick(genders),
          race: pick(races),
          age: pick(ages)
        };

        const prompt = `
You are generating a real professional NPC.

DEMOGRAPHICS:
- Gender: ${demo.gender}
- Race: ${demo.race}
- Age: ${demo.age}

TASK 1 — PROFESSION (PICK ONE CATEGORY):
A — Medical & Health
B — Law / Government / Public Safety
C — Engineering / Tech / Science
D — Business / Economics / Trade
E — Creative / Arts / Media

Rules:
- MUST pick a category NOT used by earlier NPCs.
- MUST assign a real, everyday profession someone actually has.
- MUST NOT use academic-style titles.
- NEVER mention “university”.

TASK 2 — THOUGHT:
Write **3 sentences** about the *idea behind "${query}"*:
1) conceptual insight from their profession  
2) deeper interpretation  
3) short personal experience

Rules:
- DO NOT repeat the topic words  
- DO NOT describe the topic directly  

TASK 3 — HASHTAGS:
Return 3–5 simple hashtags, no #.

JSON ONLY:
{
 "profession":"...",
 "thought":"...",
 "hashtags":["..."],
 "category":"A/B/C/D/E"
}
        `;

        const raw = await openai.chat.completions.create({
          model:"gpt-4o-mini",
          messages:[{role:"user",content:prompt}],
          temperature:0.9
        });

        let parsed = safeJSON(raw.choices?.[0]?.message?.content || "");
        parsed = sanitizeNPC(parsed);

        // Unique Category Rescue
        if(!parsed.category || usedCats.has(parsed.category)){
          const unused = ALL_CATS.filter(c=>!usedCats.has(c));
          parsed.category = unused[0] || parsed.category || "E";
        }
        usedCats.add(parsed.category);

        // TREND ENGINE (unchanged)
        const tPrompt = `
Turn the following into EXACTLY 4 short trend keywords:
Style: vibe + emotion + aesthetic + culture.

Thought:
"${parsed.thought}"

Hashtags:
${parsed.hashtags.join(", ")}

JSON ONLY:
{"trend":["w1","w2","w3","w4"]}
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
          trendWords[0] = `${detectedLocation} vibe`;
        }

        socket.emit("personaChunk",{
          profession: parsed.profession,
          gender: demo.gender,
          race: demo.race,
          age: demo.age,
          thought: parsed.thought,
          hashtags: parsed.hashtags,
          trend: trendWords.slice(0,4),
          category: parsed.category
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

//////////////////////////////////////////////////////////////
//  VIEW COUNTER (unchanged)
//////////////////////////////////////////////////////////////
const VIEW_FILE="/data/views.json";
function readViews(){try{return JSON.parse(fs.readFileSync(VIEW_FILE,"utf8"));}catch{return{total:0}}}
function writeViews(v){try{fs.writeFileSync(VIEW_FILE,JSON.stringify(v,null,2));}catch{}}

app.get("/api/views",(req,res)=>{
  const v=readViews(); v.total++; writeViews(v);
  res.json({total:v.total});
});

//////////////////////////////////////////////////////////////
//  STATIC FILES (unchanged)
//////////////////////////////////////////////////////////////
app.use(express.static(path.join(__dirname,"public")));

//////////////////////////////////////////////////////////////
//  START SERVER
//////////////////////////////////////////////////////////////
const PORT=process.env.PORT||3000;
httpServer.listen(PORT,()=>{
  console.log(`🔥 NPC Browser v2.0 running on :${PORT}`);
});