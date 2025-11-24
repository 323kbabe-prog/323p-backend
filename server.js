//////////////////////////////////////////////////////////////
//  server.js — Multi-Origin Share System + Agentic Engine
//  Fully supports: Blue Ocean, NPC, Persona, 24 Billy
//  Easily expandable for future browsers.
//  NPC Engine v2.8 remains unchanged.
//  Share system upgraded to multi-origin.
//  Production-ready.
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

console.log("🚀 NPC/BlueOcean/Persona/Billy Engine starting...");
console.log("OpenAI OK:", !!process.env.OPENAI_API_KEY);
console.log("SERP API Enabled:", !!SERP_KEY);

//////////////////////////////////////////////////////////////
// SAFE JSON PARSER
//////////////////////////////////////////////////////////////
function safeJSON(str){
  if(!str || typeof str !== "string") return null;
  try { return JSON.parse(str); } catch {}
  try {
    const m = str.match(/\{[\s\S]*?\}/);
    if(m) return JSON.parse(m[0]);
  } catch {}
  return null;
}

//////////////////////////////////////////////////////////////
// SANITIZER
//////////////////////////////////////////////////////////////
function sanitizeNPC(obj){
  return {
    major: obj?.major?.trim?.() || "Academic Field",
    thought: obj?.thought?.trim?.() ||
      "This idea reflects pressures embedded in academic systems.",
    hashtags: Array.isArray(obj?.hashtags) && obj.hashtags.length
      ? obj.hashtags
      : ["perspective","signal","culture"],
    category: ["A","B","C","D","E"].includes(obj?.category)
      ? obj.category
      : null
  };
}

//////////////////////////////////////////////////////////////
// RANDOM HELPERS
//////////////////////////////////////////////////////////////
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

//////////////////////////////////////////////////////////////
// STANFORD MAJOR POOLS
//////////////////////////////////////////////////////////////
const PROF = {
  A: ["Human Biology","Psychology","Sociology","Public Health","Bioengineering"],
  B: ["Political Science","Public Policy","International Relations","Ethics in Society","Science, Technology & Society"],
  C: ["Computer Science","Mechanical Engineering","Electrical Engineering","Symbolic Systems","Aeronautics & Astronautics"],
  D: ["Economics","Management Science & Engineering","Data Science","Mathematical & Computational Science","Statistics"],
  E: ["Art Practice","Communication","Film & Media Studies","Linguistics","Music"]
};

//////////////////////////////////////////////////////////////
// SHARE SYSTEM — Multi-Origin
//////////////////////////////////////////////////////////////

const ORIGIN_MAP = {
  blue:   "https://blueoceanbrowser.com",
  npc:    "https://npcbrowser.com",
  persona:"https://personabrowser.com",
  billy:  "https://24billybrowser.com"
};

const SHARES_FILE = "/data/shares.json";
if(!fs.existsSync("/data")) fs.mkdirSync("/data");

function readShares(){ try{return JSON.parse(fs.readFileSync(SHARES_FILE,"utf8"))}catch{return{}} }
function writeShares(d){ fs.writeFileSync(SHARES_FILE,JSON.stringify(d,null,2)); }

// Save shared personas
app.post("/api/share",(req,res)=>{
  const all = readShares();
  const id = Math.random().toString(36).substring(2,8);

  all[id] = {
    personas: req.body.personas || [],
    query: req.body.query || "",
    origin: req.body.origin || "npc"
  };

  writeShares(all);
  res.json({ shortId:id });
});

// Shared link loader
app.get("/s/:id",(req,res)=>{
  const all = readShares();
  const s = all[req.params.id];

  if(!s) return res.redirect("https://npcbrowser.com");

  const q = s.query || "";
  const o = s.origin || "npc";
  const redirectURL = ORIGIN_MAP[o] || ORIGIN_MAP.npc;

  res.send(`
    <!doctype html>
    <html><head><meta charset="utf-8"/>
    <script>
      sessionStorage.setItem("sharedId","${req.params.id}");
      setTimeout(()=>{
        window.location.href="${redirectURL}?query="+encodeURIComponent("${q}");
      },900);
    </script>
    </head><body></body></html>
  `);
});

//////////////////////////////////////////////////////////////
// BLUE OCEAN REWRITE ENGINE (UPDATED — FIXES TYPOS)
//////////////////////////////////////////////////////////////
app.post("/api/rewrite", async (req, res) => {
  const { query } = req.body;

  const prompt = `
You are a professional rewriting assistant.

FIRST:
- Fix all typos
- Fix spelling mistakes
- Fix broken or incomplete words
- Fix repeated letters or accidental keyboard errors
- Fix punctuation and grammar
- Preserve the meaning

THEN:
- Rewrite the corrected text into a clear business direction
- One sentence only
- No new information
- Remove all quotation marks

User Input:
${query}

Corrected + rewritten (no quotes):
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role:"user", content: prompt }],
      temperature: 0.2
    });

    let rewritten = completion.choices[0].message.content.trim();
    rewritten = rewritten.replace(/["“”‘’]/g,"");

    res.json({ rewritten });

  } catch (err) {
    console.error("❌ Rewrite Engine Error:", err);
    res.json({ rewritten: query });
  }
});

//////////////////////////////////////////////////////////////
// NPC ENGINE v2.8 (unchanged)
//////////////////////////////////////////////////////////////
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

DEMOGRAPHICS: ${demo.gender}, ${demo.race}, ${demo.age}
CATEGORY: ${cat}
MAJOR: "${major}"
WEB CONTEXT: "${serpContext}"

JSON ONLY:
{ "major":"${major}", "thought":"...", "hashtags":["..."], "category":"${cat}" }
        `;

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

//////////////////////////////////////////////////////////////
// VIEW COUNTER
//////////////////////////////////////////////////////////////
const VIEW_FILE = "/data/views.json";
function readViews(){ try{return JSON.parse(fs.readFileSync(VIEW_FILE,"utf8"));}catch{return{total:0}} }
function writeViews(v){ try{fs.writeFileSync(VIEW_FILE,JSON.stringify(v,null,2))}catch{} }

app.get("/api/views",(req,res)=>{
  const v = readViews(); v.total++; writeViews(v);
  res.json({total:v.total});
});

//////////////////////////////////////////////////////////////
// STATIC FILES
//////////////////////////////////////////////////////////////
app.use(express.static(path.join(__dirname,"public")));

//////////////////////////////////////////////////////////////
// START SERVER
//////////////////////////////////////////////////////////////
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT,()=>{
  console.log(`🔥 Multi-Origin Engine running on :${PORT}`);
});