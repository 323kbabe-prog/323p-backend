//////////////////////////////////////////////////////////////
//  server.js — NPC Browser (Super Agentic Trend Engine v1.1)
//  WITH FULL SHARE NPC SYSTEM (save, load, redirect)
// //////////////////////////////////////////////////////////

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

console.log("🚀 NPC Browser — Agentic Trend Engine + Share System starting...");
console.log("API Key Loaded:", !!process.env.OPENAI_API_KEY);

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
    .replace(/([0-9])([A-Za-z])/g, "$1 $2")
    .replace(/([A-Za-z])([0-9])/g, "$1 $2")
    .trim();
}

// ==========================================================
// LOCATION DETECTOR
// ==========================================================
function extractLocation(text){
  const LOCATIONS = [
    "LA","Los Angeles","NYC","New York","Tokyo","Osaka","Kyoto",
    "Paris","London","Berlin","Seoul","Busan","Taipei","Singapore",
    "San Francisco","SF","Chicago","Miami","Toronto"
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
// RANDOM DEMOGRAPHICS + RANDOM IDENTITY
// ==========================================================
const genders=["Female","Male","Nonbinary"];
const races=["Asian","Black","White","Latino","Middle Eastern","Mixed"];
const ages=[20,21,22,23,24,25];

const fields = [
  "Psychology","Sociology","Computer Science","Economics","Philosophy",
  "Human Biology","Symbolic Systems","Political Science",
  "Mechanical Engineering","Art & Theory","Anthropology",
  "Linguistics","Earth Systems","Media Studies","Cognitive Science"
];

function pickUnique(arr, count){
  const copy=[...arr];
  const selected=[];
  while(selected.length < count && copy.length > 0){
    const idx=Math.floor(Math.random()*copy.length);
    selected.push(copy.splice(idx,1)[0]);
  }
  return selected;
}

// ==========================================================
// SHARE NPC SYSTEM (SAVE + LOAD + REDIRECT)
// ==========================================================
const SHARES_FILE = "/data/shares.json";
if (!fs.existsSync("/data")) fs.mkdirSync("/data");

function readShares(){
  try { return JSON.parse(fs.readFileSync(SHARES_FILE,"utf8")); }
  catch { return {}; }
}
function writeShares(data){
  try { fs.writeFileSync(SHARES_FILE, JSON.stringify(data,null,2)); }
  catch(err){ console.error("❌ Could not save share:",err.message); }
}

// Save share
app.post("/api/share",(req,res)=>{
  const all = readShares();
  const id = Math.random().toString(36).substring(2,8);
  all[id] = req.body.personas || [];
  writeShares(all);
  res.json({ shortId:id });
});

// Load shared personas
app.get("/api/share/:id",(req,res)=>{
  const all = readShares();
  const out = all[req.params.id];
  if(!out) return res.status(404).json({error:"Not found"});
  res.json(out);
});

// Redirect for /s/:id
app.get("/s/:id",(req,res)=>{
  const all = readShares();
  const personas = all[req.params.id];
  if(!personas) return res.redirect("https://npcbrowser.com");

  const first = personas[0] || {};
  const preview = (first.thought || "").slice(0,150);

  res.send(`<!doctype html>
<html><head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta property="og:title" content="${first.persona?.identity || 'NPC Browser'}">
  <meta property="og:description" content="${preview}">
  <meta property="og:image" content="https://npcbrowser.com/og-npc.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <title>NPC Browser Share</title>
  <script>
    sessionStorage.setItem("sharedId","${req.params.id}");
    setTimeout(()=>{ window.location.href="https://npcbrowser.com"; }, 1200);
  </script>
</head><body></body></html>`);
});

// ==========================================================
// SOCKET.IO — 10 AGENTIC PERSONAS
// ==========================================================
const httpServer=createServer(app);
const io=new Server(httpServer,{cors:{origin:"*"}});

io.on("connection",socket=>{
  console.log("🛰️ Client connected:",socket.id);

  socket.on("personaSearch", async query=>{
    try{
      const selectedFields = pickUnique(fields,10);
      const detectedLocation = extractLocation(query);

      for(let i=0;i<10;i++){
        const persona={
          persona:{
            gender:genders[Math.floor(Math.random()*genders.length)],
            race:races[Math.floor(Math.random()*races.length)],
            age:ages[Math.floor(Math.random()*ages.length)],
            identity:selectedFields[i]
          },
          thought:"",
          hashtags:[],
          trend:[]
        };

        // THOUGHT + HASHTAGS
        const thoughtPrompt = `
IDENTITY:
${persona.persona.gender}, ${persona.persona.race}, ${persona.persona.age}, ${persona.persona.identity}

TOPIC: "${query}"

TASK:
1. Write 2–3 deep sentences (full agentic perspective).
2. Provide 3–5 hashtags (NO # symbols).
Return JSON:
{
 "thought":"...",
 "hashtags":["...","..."]
}
        `;

        const thoughtResp=await openai.chat.completions.create({
          model:"gpt-4o-mini",
          messages:[{role:"user",content:thoughtPrompt}],
          temperature:0.8
        });

        const parsedThought=safeJSON(thoughtResp.choices?.[0]?.message?.content||"") || {
          thought:"An NPC perspective emerges.",
          hashtags:["vibes","identity"]
        };

        persona.thought = parsedThought.thought;
        persona.hashtags = parsedThought.hashtags;

        // TREND ENGINE (AG4 Hybrid — 4 short words)
        const trendPrompt=`
Using this NPC thought:
"${persona.thought}"

And hashtags:
${persona.hashtags.join(", ")}

And user topic:
"${query}"

Produce EXACTLY 4 short TREND KEYWORDS (1–2 words each).
MUST reflect: vibe + emotion + aesthetic + culture.
NO punctuation. NO long words. NO academic terms.

Return JSON:
{
 "trend":["w1","w2","w3","w4"]
}
        `;

        const trendResp=await openai.chat.completions.create({
          model:"gpt-4o-mini",
          messages:[{role:"user",content:trendPrompt}],
          temperature:0.6
        });

        const parsedTrend=safeJSON(trendResp.choices?.[0]?.message?.content||"") ||
          { trend:["vibe","culture","identity","flow"] };

        let trendWords=parsedTrend.trend.map(w=>splitTrendWord(w));

        // Location override
        if(detectedLocation){
          trendWords[0] = `${detectedLocation} vibe`;
        }

        persona.trend = trendWords.slice(0,4);

        socket.emit("personaChunk",persona);
      }

      socket.emit("personaDone");

    } catch(err){
      console.error("❌ personaSearch error:",err);
      socket.emit("personaError","NPC system error");
    }
  });

  socket.on("disconnect",()=>console.log("❌ Client disconnected:",socket.id));
});

// ==========================================================
// VIEW COUNTER
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

// START SERVER
const PORT=process.env.PORT||3000;
httpServer.listen(PORT,()=>{
  console.log(`🔥 NPC Browser (Agentic Trend Engine + Share System) running on :${PORT}`);
});