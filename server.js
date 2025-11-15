//////////////////////////////////////////////////////////////
//  server.js — NPC Browser (Super Agentic Trend Engine v1.4)
//  NPC Update: Hybrid Professions + First-Person + No Topic Repetition
//  Full System Locked: Share, Auto-Search, Trend Engine, Streaming
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

console.log("🚀 NPC Browser — Agentic Trend Engine v1.4 starting...");
console.log("OPENAI_API_KEY loaded:", !!process.env.OPENAI_API_KEY);

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
// DEMOGRAPHICS & IDENTITIES
// ==========================================================
const genders=["Female","Male","Nonbinary"];
const races=["Asian","Black","White","Latino","Middle Eastern","Mixed"];
const ages=[18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49];

const fields = [
  "Psychology","Sociology","Computer Science","Economics",
  "Philosophy","Human Biology","Symbolic Systems","Political Science",
  "Mechanical Engineering","Art & Theory","Anthropology","Linguistics",
  "Earth Systems","Media Studies","Cognitive Science"
];

function pickUnique(arr, count){
  const copy=[...arr];
  const selected=[];
  while(selected.length < count && copy.length){
    const idx=Math.floor(Math.random()*copy.length);
    selected.push(copy.splice(idx,1)[0]);
  }
  return selected;
}

// ==========================================================
// SHARE NPC SYSTEM
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

// Save NPC Share
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

// Load NPC Share
app.get("/api/share/:id",(req,res)=>{
  const all = readShares();
  const shared = all[req.params.id];
  if(!shared) return res.status(404).json({error:"Not found"});
  res.json(shared.personas || []);
});

// Redirect With Query (Auto-search)
app.get("/s/:id",(req,res)=>{
  const all = readShares();
  const shared = all[req.params.id];
  if(!shared) return res.redirect("https://npcbrowser.com");

  const personas = shared.personas || [];
  const originalQuery = shared.query || "";

  const first = personas[0] || {};
  const preview = (first.thought || "").slice(0,150);

  res.send(`<!doctype html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta property="og:title" content="${first.profession || "NPC Browser"}">
<meta property="og:description" content="${preview}">
<meta property="og:image" content="https://npcbrowser.com/og-npc.jpg">
<meta name="twitter:card" content="summary_large_image">
<title>NPC Browser Share</title>
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
// SOCKET.IO — 10 NPCs (NO TOPIC REPEAT VERSION)
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
          profession:"",
          thought:"",
          hashtags:[],
          trend:[]
        };

        // ======================================================
        // NPC THOUGHT ENGINE — NO TOPIC REPEAT FIX
        // ======================================================
        const thoughtPrompt = `
You are generating a fully alive NPC persona.

DEMOGRAPHICS:
- Gender: ${persona.persona.gender}
- Race: ${persona.persona.race}
- Age: ${persona.persona.age}

ACADEMIC DISCIPLINE:
"${persona.persona.identity}"

TASK PART 1 — PROFESSION:
Create a REAL-WORLD HYBRID PROFESSION for this NPC by blending:
- their academic discipline
- a modern applied field (AI ethics, UX research, public health, legal policy, cognitive systems design, environmental consulting, social analytics, product strategy, behavioral science, media cognition, urban systems, etc.)
IMPORTANT:
- NEVER mention "major" or "Stanford".
- The profession must feel like a real job someone could have.

TASK PART 2 — FIRST-PERSON REFLECTION (VERY IMPORTANT):
Write a FIRST-PERSON reflection (2–3 sentences) about the *idea* behind "${query}".
Rules:
- DO NOT repeat the topic phrase directly.
- DO NOT describe the topic ("Seattle coffee is...").
- Speak in first person only ("I", "my", "to me").
- Reveal how YOU interpret or analyze the idea through your profession.
- Use moderately expressive tone (not emotional, not robotic).
- Make it intelligent, alive, reflective.
- Show personal reasoning or insight.

TASK PART 3 — HASHTAGS:
Output 3–5 simple, trend-friendly hashtags (NO # symbol).

RETURN JSON ONLY:
{
  "profession": "Hybrid profession",
  "thought": "First-person reflection without repeating the topic",
  "hashtags": ["word1","word2","word3"]
}
        `;

        const thoughtResp=await openai.chat.completions.create({
          model:"gpt-4o-mini",
          messages:[{role:"user",content:thoughtPrompt}],
          temperature:0.85
        });

        const parsed=safeJSON(thoughtResp.choices?.[0]?.message?.content||"") || {
          profession:"Cognitive Systems Analyst",
          thought:"I interpret this idea through patterns I study in my work.",
          hashtags:["identity","culture"]
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
NO punctuation. NO academic language.

NPC Thought:
"${persona.thought}"

Hashtags:
${persona.hashtags.join(", ")}

User Topic:
"${query}"

RETURN JSON ONLY:
{
 "trend":["w1","w2","w3","w4"]
}
        `;

        const trendResp=await openai.chat.completions.create({
          model:"gpt-4o-mini",
          messages:[{role:"user",content:trendPrompt}],
          temperature:0.6
        });

        let parsedTrend=safeJSON(trendResp.choices?.[0]?.message?.content||"") || {
          trend:["vibe","culture","identity","flow"]
        };

        let trendWords = parsedTrend.trend.map(w=>splitTrendWord(w));

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

// ==========================================================
// START SERVER
// ==========================================================
const PORT=process.env.PORT||3000;
httpServer.listen(PORT,()=>{
  console.log(`🔥 NPC Browser (Agentic NPC v1.4 — No Topic Repeat) running on :${PORT}`);
});