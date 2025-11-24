//////////////////////////////////////////////////////////////
//  server.js — Multi-Origin Share System + Agentic Engine
//  Fully supports: Blue Ocean, NPC, Persona, 24 Billy
//  Smart Rewrite: detects nonsense, cleans typos, and intelligently
//  recovers intent so the system ALWAYS produces useful search results.
//
//  NPC Engine v2.8 unchanged.
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

console.log("🚀 Multi-Origin Engine starting...");
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
// HELPERS
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

const genders = ["Female","Male","Nonbinary"];
const races = ["Asian","Black","White","Latino","Middle Eastern","Mixed"];
const ages = [...Array.from({length:32},(_,i)=>i+18)];
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)] }

//////////////////////////////////////////////////////////////
// MAJORS
//////////////////////////////////////////////////////////////
const PROF = {
  A: ["Human Biology","Psychology","Sociology","Public Health","Bioengineering"],
  B: ["Political Science","Public Policy","International Relations","Ethics in Society","Science, Technology & Society"],
  C: ["Computer Science","Mechanical Engineering","Electrical Engineering","Symbolic Systems","Aeronautics & Astronautics"],
  D: ["Economics","Management Science & Engineering","Data Science","Mathematical & Computational Science","Statistics"],
  E: ["Art Practice","Communication","Film & Media Studies","Linguistics","Music"]
};

//////////////////////////////////////////////////////////////
// SHARE SYSTEM
//////////////////////////////////////////////////////////////
const ORIGIN_MAP = {
  blue:   "https://blueoceanbrowser.com",
  npc:    "https://npcbrowser.com",
  persona:"https://personabrowser.com",
  billy:  "https://24billybrowser.com",
};

const SHARES_FILE = "/data/shares.json";
if(!fs.existsSync("/data")) fs.mkdirSync("/data");

function readShares(){ try{return JSON.parse(fs.readFileSync(SHARES_FILE,"utf8"))}catch{return{}} }
function writeShares(d){ fs.writeFileSync(SHARES_FILE,JSON.stringify(d,null,2)); }

app.post("/api/share",(req,res)=>{
  const all = readShares();
  const id = Math.random().toString(36).substring(2,8);
  all[id] = {
    personas: req.body.personas||[],
    query: req.body.query||"",
    origin: req.body.origin||"npc"
  };
  writeShares(all);
  res.json({ shortId:id });
});

app.get("/api/share/:id",(req,res)=>{
  const all = readShares();
  const s   = all[req.params.id];
  if(!s) return res.status(404).json([]);
  res.json(s.personas||[]);
});

app.get("/s/:id",(req,res)=>{
  const all = readShares();
  const s   = all[req.params.id];
  if(!s) return res.redirect("https://npcbrowser.com");

  const redirectURL = ORIGIN_MAP[s.origin] || ORIGIN_MAP.npc;

  res.send(`
  <!doctype html><html><head>
    <meta charset="utf-8"/>
    <script>
      sessionStorage.setItem("sharedId","${req.params.id}");
      setTimeout(()=>{ 
        window.location.href="${redirectURL}?query="+encodeURIComponent("${s.query||""}");
      },900);
    </script>
  </head><body></body></html>
  `);
});

//////////////////////////////////////////////////////////////
// SMART REWRITE ENGINE (NEW UPGRADE)
// - Cleans typos
// - Removes nonsense
// - Attempts recovery (semantic rewrite)
// - Returns "" if fully unusable
//////////////////////////////////////////////////////////////
app.post("/api/rewrite", async (req, res) => {
  let { query } = req.body;
  query = (query||"").trim();

  // Hard detect garbage BEFORE calling OpenAI
  const onlySymbols = /^[^a-zA-Z0-9]+$/.test(query);
  const repeated    = /(.)\1{6,}/.test(query);
  const tooShort    = query.length < 2;
  const garbage     = /[@#$%^&*()_+=<>?]{4,}/.test(query);

  if (onlySymbols || repeated || tooShort || garbage) {
    return res.json({ rewritten:"" });
  }

  // Attempt rewrite with OpenAI
  const prompt = `
Rewrite this into a clean, meaningful business direction.
If the input is nonsense, salvage meaning based on nearest human intent.
If impossible to salvage → return nothing.
No quotes.
Input: ${query}
Rewritten:
  `;

  try {
    const completion = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      messages:[{role:"user",content:prompt}],
      temperature:0.2
    });

    let out = completion.choices[0].message.content.trim();

    // clean
    out = out.replace(/["“”‘’]/g,"").trim();

    // If still nonsense → return blank
    if (
      out.length < 3 ||
      out.toLowerCase().includes("not clear") ||
      out.toLowerCase().includes("unclear") ||
      out.toLowerCase().includes("please provide")
    ) {
      return res.json({ rewritten:"" });
    }

    res.json({ rewritten: out });

  } catch (err) {
    console.error("Rewrite error",err);
    res.json({ rewritten: query });
  }
});

//////////////////////////////////////////////////////////////
// NPC ENGINE (v2.8 unchanged)
//////////////////////////////////////////////////////////////
const httpServer = createServer(app);
const io = new Server(httpServer,{cors:{origin:"*"}});

io.on("connection", socket=>{
  console.log("Client connected:",socket.id);

  socket.on("personaSearch", async query=>{
    try {
      const location = extractLocation(query);

      let serpContext = "No verified web data.";
      if(SERP_KEY){
        try{
          const r = await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=5&api_key=${SERP_KEY}`);
          const j = await r.json();
          const titles = (j.organic_results||[]).map(x=>x.title).filter(Boolean).slice(0,3);
          if(titles.length) serpContext = titles.join(" | ");
        } catch {}
      }

      const CAT_ORDER=["A","B","C","D","E","A","B","C","D","E"];

      for(let i=0;i<10;i++){
        const cat   = CAT_ORDER[i];
        const major = pick(PROF[cat]);
        const demo  = { gender:pick(genders), race:pick(races), age:pick(ages) };

        const prompt = `
        Generate NPC viewpoint.
        DEMO: ${demo.gender},${demo.race},${demo.age}
        MAJOR: "${major}"
        WEB CONTEXT: "${serpContext}"

        JSON ONLY:
        {"major":"${major}","thought":"...","hashtags":["..."],"category":"${cat}"}
        `;

        const raw = await openai.chat.completions.create({
          model:"gpt-4o-mini",
          messages:[{role:"user",content:prompt}],
          temperature:0.9
        });

        let parsed = safeJSON(raw.choices?.[0]?.message?.content)||{};
        parsed = sanitizeNPC(parsed);

        // trend
        const tPrompt=`
        4 keywords only:
        "${parsed.thought}"
        JSON ONLY:{"trend":["t1","t2","t3","t4"]}
        `;

        const tRaw = await openai.chat.completions.create({
          model:"gpt-4o-mini",
          messages:[{role:"user",content:tPrompt}],
          temperature:0.6
        });

        let tParsed = safeJSON(tRaw.choices?.[0]?.message?.content)||{
          trend:["vibe","culture","flow","signal"]
        };

        let trendWords = tParsed.trend.map(splitTrendWord);
        if(location) trendWords[0] = `${location} vibe`;

        socket.emit("personaChunk",{
          major,
          gender: demo.gender,
          race: demo.race,
          age:   demo.age,
          thought:  parsed.thought,
          hashtags: parsed.hashtags,
          trend: trendWords,
          category: cat
        });
      }

      socket.emit("personaDone");
    } catch(err){
      console.error("NPC Engine Error",err);
      socket.emit("personaError","Engine error");
    }
  });

  socket.on("disconnect",()=>console.log("Client left:",socket.id));
});

//////////////////////////////////////////////////////////////
// VIEWS
//////////////////////////////////////////////////////////////
const VIEW_FILE = "/data/views.json";
function readViews(){ try{return JSON.parse(fs.readFileSync(VIEW_FILE,"utf8"))}catch{return{total:0}} }
function writeViews(v){ try{fs.writeFileSync(VIEW_FILE,JSON.stringify(v,null,2))}catch{} }

app.get("/api/views",(req,res)=>{
  const v=readViews(); v.total++; writeViews(v);
  res.json({total:v.total});
});

//////////////////////////////////////////////////////////////
// STATIC
//////////////////////////////////////////////////////////////
app.use(express.static(path.join(__dirname,"public")));

//////////////////////////////////////////////////////////////
// START SERVER
//////////////////////////////////////////////////////////////
const PORT = process.env.PORT||3000;
httpServer.listen(PORT,()=>console.log("🔥 Multi-Origin Engine running on port:",PORT));