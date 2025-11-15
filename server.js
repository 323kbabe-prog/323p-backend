//////////////////////////////////////////////////////////////
//  server.js — NPC Browser (Super Agentic Trend Engine v2.4)
//  Features:
//   • 5 real-world profession categories (A–E)
//   • Unique category per NPC
//   • Strong topic-awareness
//   • Subtle micro-emotions (professional tone)
//   • Optional SERP API (auto fallback if no key)
//   • Location-aware trend override
//   • JSON safety + output limits
//   • All v1.6 backend systems preserved
//////////////////////////////////////////////////////////////

const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const OpenAI = require("openai");
const cors = require("cors");
const fs = require("fs");
const fetch = require("node-fetch"); // For SERP API

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const SERP_KEY = process.env.SERPAPI_KEY || null;

console.log("🚀 NPC Browser — Agentic Trend Engine v2.4 starting...");
console.log("API Key OK:", !!process.env.OPENAI_API_KEY);
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

function sanitizeNPC(obj){
  return {
    profession: obj?.profession?.trim?.() || "Professional",
    thought: obj?.thought?.trim?.() ||
      "This idea reflects shifts professionals often track closely. It shapes decisions across multiple systems. A moment from my experience showed how quickly these pressures escalate.",
    hashtags: Array.isArray(obj?.hashtags) && obj.hashtags.length
      ? obj.hashtags
      : ["signal","culture","perspective"],
    category: ["A","B","C","D","E"].includes(obj?.category)
      ? obj.category
      : null
  };
}

// ==========================================================
// HELPERS
// ==========================================================
function splitTrendWord(word){
  return word
    .replace(/([a-z])([A-Z])/g,"$1 $2")
    .replace(/[\-_]/g," ")
    .trim();
}

function extractLocation(text){
  const LOC = [
    "LA","Los Angeles","NYC","New York","Tokyo",
    "Paris","London","Berlin","Seoul","Busan",
    "Taipei","Singapore","San Francisco","SF",
    "Chicago","Miami","Toronto","Seattle"
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
// SHARE SYSTEM (unchanged)
// ==========================================================
const SHARES_FILE="/data/shares.json";
if(!fs.existsSync("/data")) fs.mkdirSync("/data");

function readShares(){
  try { return JSON.parse(fs.readFileSync(SHARES_FILE,"utf8")); }
  catch { return {}; }
}

function writeShares(d){
  try { fs.writeFileSync(SHARES_FILE, JSON.stringify(d,null,2)); }
  catch(err){ console.error("❌ Share save error:", err.message); }
}

app.post("/api/share",(req,res)=>{
  const all = readShares();
  const id = Math.random().toString(36).substring(2,8);
  all[id] = {
    personas:req.body.personas || [],
    query:req.body.query || ""
  };
  writeShares(all);
  res.json({ shortId:id });
});

app.get("/api/share/:id",(req,res)=>{
  const all = readShares();
  const entry = all[req.params.id];
  if(!entry) return res.status(404).json({error:"Not found"});
  res.json(entry.personas || []);
});

app.get("/s/:id",(req,res)=>{
  const all = readShares();
  const entry = all[req.params.id];
  if(!entry) return res.redirect("https://npcbrowser.com");

  const personas = entry.personas || [];
  const originalQuery = entry.query || "";

  const first = personas[0] || {};
  const preview = (first.thought || "").slice(0,150);

  res.send(`<!doctype html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta property="og:title" content="${first.profession || 'NPC Browser'}">
<meta property="og:description" content="${preview}">
<meta property="og:image" content="https://npcbrowser.com/og-npc.jpg">
<title>NPC Share</title>
<script>
sessionStorage.setItem("sharedId","${req.params.id}");
setTimeout(()=>{
  window.location.href="https://npcbrowser.com?query=" + encodeURIComponent("${originalQuery}");
},900);
</script>
</head><body></body></html>`);
});

// ==========================================================
// NPC ENGINE v2.4 — Topic-aware + Micro-emotion + Optional SERP
// ==========================================================
const httpServer = createServer(app);
const io = new Server(httpServer,{cors:{origin:"*"}});

io.on("connection", socket=>{
  console.log("🛰️ Client connected:", socket.id);

  socket.on("personaSearch", async query=>{
    try {
      const detectedLocation = extractLocation(query);

      let serpContext = "No verified web data.";
      if(SERP_KEY){
        try {
          const serpURL =
            `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=5&api_key=${SERP_KEY}`;
          const serpRes = await fetch(serpURL);
          const serpJson = await serpRes.json();

          const titles = (serpJson.organic_results || [])
            .map(r => r.title)
            .filter(Boolean)
            .slice(0,3);

          if(titles.length){
            serpContext = titles.join(" | ");
          }
        } catch {
          serpContext = "External sources unavailable.";
        }
      }

      const usedCats = new Set();
      const CATS = ["A","B","C","D","E"];

      for(let i=0;i<10;i++){

        const demo = {
          gender: pick(genders),
          race: pick(races),
          age: pick(ages)
        };

        // ======================================================
        // NPC THOUGHT ENGINE v2.4 (STRONG TOPIC-AWARENESS)
        // ======================================================
        const prompt = `
Generate a professional NPC.

DEMOGRAPHICS:
Gender: ${demo.gender}
Race: ${demo.race}
Age: ${demo.age}

EXTERNAL WEB CONTEXT:
"${serpContext}"

TASK 1 — PROFESSION (5 Categories):
A — Medical & Health
B — Law / Government / Public Safety
C — Engineering / Tech / Science
D — Business / Trade / Economics
E — Creative / Arts / Media

RULES:
- MUST choose a category not used yet in this batch.
- Profession must be real and < 50 chars.

TASK 2 — TOPIC-AWARE THOUGHT (3 sentences, < 320 chars):
Respond to the scenario implied by: "${query}"
WITHOUT repeating the exact topic words.

• Sentence 1 → interpret the scenario through the NPC’s profession  
• Sentence 2 → deeper structural implications  
• Sentence 3 → subtle micro-emotion + personal experience  
  (professional tone, no emotional labels)

TASK 3 — Hashtags:
Return 3–5 simple tags (no #).

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

        if(!parsed.category || usedCats.has(parsed.category)){
          const unused = CATS.filter(c=>!usedCats.has(c));
          parsed.category = unused[0] || parsed.category || "E";
        }
        usedCats.add(parsed.category);

        // ======================================================
        // TREND ENGINE
        // ======================================================
        const tPrompt = `
Turn this into EXACTLY 4 short trend keywords:

"${parsed.thought}"

JSON ONLY:
{"trend":["t1","t2","t3","t4"]}
        `;

        const tRaw = await openai.chat.completions.create({
          model:"gpt-4o-mini",
          messages:[{role:"user",content:tPrompt}],
          temperature:0.6
        });

        let trendParsed = safeJSON(tRaw.choices?.[0]?.message?.content || "") || {
          trend:["vibe","culture","signal","flow"]
        };

        let trendWords = trendParsed.trend.map(splitTrendWord);

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
      console.error("❌ NPC Engine Error:", err);
      socket.emit("personaError","NPC system error");
    }
  });

  socket.on("disconnect",()=>console.log("❌ Client disconnected:", socket.id));
});

// ==========================================================
// VIEW COUNTER
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
  console.log(`🔥 NPC Browser v2.4 running on :${PORT}`);
});