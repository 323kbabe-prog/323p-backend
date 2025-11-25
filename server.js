//////////////////////////////////////////////////////////////
//  server.js — Multi-Origin Agentic Engine (Render Version)
//  FINAL PATCHED EDITION — 100% READY FOR DEPLOYMENT
//
//  Fixes included:
//  ✔ SERP keyword extraction (works with long rewrites)
//  ✔ cleanedQuery bug fixed
//  ✔ thought generator produces 7-sentence expert identity story
//  ✔ SERP trends injected into thought
//  ✔ share link auto-loads full card list
//  ✔ multi-origin routing (blue, npc, persona, billy)
//  ✔ stable JSON parsing
//  ✔ no crashes, no undefined values
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

//////////////////////////////////////////////////////////////
// SETUP
//////////////////////////////////////////////////////////////

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const SERP_KEY = process.env.SERPAPI_KEY || null;

console.log("🚀 Multi-Origin Engine starting on Render…");
console.log("OpenAI key:", !!process.env.OPENAI_API_KEY);
console.log("SERP key:", !!SERP_KEY);

//////////////////////////////////////////////////////////////
// HELPERS
//////////////////////////////////////////////////////////////

function safeJSON(str) {
  if (!str || typeof str !== "string") return null;
  try { return JSON.parse(str); } catch {}
  try {
    const m = str.match(/\{[\s\S]*?\}/);
    if (m) return JSON.parse(m[0]);
  } catch {}
  return null;
}

function extractLocation(text) {
  const LOC = [
    "LA","Los Angeles","NYC","New York","Tokyo","Paris","London",
    "Berlin","Seoul","Busan","Taipei","Singapore","San Francisco",
    "Chicago","Miami","Toronto","Seattle"
  ];
  const lower = text.toLowerCase();
  for (const c of LOC) {
    if (lower.includes(c.toLowerCase())) return c;
  }
  return null;
}

const genders=["Female","Male","Nonbinary"];
const races=["Asian","Black","White","Latino","Middle Eastern","Mixed"];
const ages=[...Array.from({length:32},(_,i)=>i+18)];
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)] }

//////////////////////////////////////////////////////////////
// MAJORS (IDENTITIES)
//////////////////////////////////////////////////////////////

const PROF = {
  A: ["Human Biology","Psychology","Sociology","Public Health","Bioengineering"],
  B: ["Political Science","Public Policy","International Relations","Ethics in Society","Science, Technology & Society"],
  C: ["Computer Science","Mechanical Engineering","Electrical Engineering","Symbolic Systems","Aeronautics & Astronautics"],
  D: ["Economics","Management Science & Engineering","Data Science","Mathematical & Computational Science","Statistics"],
  E: ["Art Practice","Communication","Film & Media Studies","Linguistics","Music"]
};

//////////////////////////////////////////////////////////////
// SHARE SYSTEM (Render-compatible)
//////////////////////////////////////////////////////////////

const ORIGIN_MAP = {
  blue:"https://blueoceanbrowser.com",
  npc:"https://npcbrowser.com",
  persona:"https://personabrowser.com",
  billy:"https://24billybrowser.com"
};

const SHARES_FILE = "/data/shares.json";
if (!fs.existsSync("/data")) fs.mkdirSync("/data");

function readShares(){ try{return JSON.parse(fs.readFileSync(SHARES_FILE,"utf8"))}catch{return{}} }
function writeShares(obj){ fs.writeFileSync(SHARES_FILE,JSON.stringify(obj,null,2)); }

app.post("/api/share",(req,res)=>{
  const all = readShares();
  const id  = Math.random().toString(36).substring(2,8);
  all[id] = {
    personas: req.body.personas || [],
    query:    req.body.query    || "",
    origin:   req.body.origin   || "blue"
  };
  writeShares(all);
  res.json({ shortId:id });
});

app.get("/api/share/:id",(req,res)=>{
  const all = readShares();
  const s   = all[req.params.id];
  if (!s) return res.status(404).json([]);
  res.json(s.personas || []);
});

app.get("/s/:id",(req,res)=>{
  const all = readShares();
  const s   = all[req.params.id];
  if (!s) return res.redirect("https://blueoceanbrowser.com");

  const redirectURL = ORIGIN_MAP[s.origin] || ORIGIN_MAP.blue;

  res.send(`
  <!doctype html>
  <html><head><meta charset="utf-8"/>
  <script>
    sessionStorage.setItem("sharedId","${req.params.id}");
    setTimeout(()=>{
      window.location.href="${redirectURL}?query="+encodeURIComponent("${s.query||""}");
    },600);
  </script>
  </head><body></body></html>
  `);
});

//////////////////////////////////////////////////////////////
// SMART REWRITE ENGINE
//////////////////////////////////////////////////////////////

app.post("/api/rewrite", async (req,res)=>{
  let { query } = req.body;
  query = (query || "").trim();
  if (!query) return res.json({ rewritten:"" });

  const prompt = `
Rewrite into a professional business direction.
No quotes. No disclaimers.
If nonsense → salvage meaning.
Input: ${query}
Rewritten:
  `;

  try{
    const out = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      messages:[{role:"user",content:prompt}],
      temperature:0.2
    });

    let rewritten = out.choices[0].message.content.trim();
    rewritten = rewritten.replace(/["“”‘’]/g,"");

    if (rewritten.length < 3) return res.json({rewritten:""});
    res.json({rewritten});
  }catch(err){
    console.error("Rewrite error:",err);
    res.json({rewritten:""});
  }
});

//////////////////////////////////////////////////////////////
// MAIN ENGINE — THOUGHT GENERATOR + SERP TRENDS
//////////////////////////////////////////////////////////////

const httpServer = createServer(app);
const io = new Server(httpServer,{cors:{origin:"*"}});

io.on("connection", socket => {
  console.log("Client:", socket.id);

  socket.on("personaSearch", async rewrittenQuery=>{
    try{
      //////////////////////////////////////////////////////////////
      // 1) Extract SERP keywords
      //////////////////////////////////////////////////////////////
      const cleanedQuery =
        rewrittenQuery
          .split(" ")
          .filter(w=>w.length>2)
          .slice(0,6)
          .join(" ") +
        " market trends 2025";

      //////////////////////////////////////////////////////////////
      // 2) SERP request
      //////////////////////////////////////////////////////////////
      let serpContext = "No verified web data.";
      if (SERP_KEY){
        try{
          const url = `https://serpapi.com/search.json?q=${encodeURIComponent(cleanedQuery)}&num=5&api_key=${SERP_KEY}`;
          const r   = await fetch(url);
          const j   = await r.json();
          const titles = (j.organic_results||[])
            .map(x=>x.title)
            .filter(Boolean)
            .slice(0,3);
          if (titles.length) serpContext = titles.join(" | ");
        }catch(err){
          console.log("SERP fail:",err);
        }
      }

      //////////////////////////////////////////////////////////////
      // 3) Loop 10 personas
      //////////////////////////////////////////////////////////////
      const CAT_ORDER=["A","B","C","D","E","A","B","C","D","E"];

      for (let i=0;i<10;i++){
        const cat   = CAT_ORDER[i];
        const major = pick(PROF[cat]);
        const demo  = {
          gender: pick(genders),
          race:   pick(races),
          age:    pick(ages)
        };

        //////////////////////////////////////////////////////////////
        // 4) Generate FULL thought (7 sentences)
        //////////////////////////////////////////////////////////////
        const thoughtPrompt = `
You are a ${demo.gender}, ${demo.race}, age ${demo.age}, trained in ${major}.
Do NOT quote the user text.
Use the rewritten direction indirectly: "${rewrittenQuery}".
Use real SERP trend data: "${serpContext}".

Write EXACTLY 7 sentences including:
1) identity-based viewpoint from ${major}
2) indirect reference to user direction
3) SERP data integrated naturally
4) field-specific reasoning
5) behavioral or psychological observation
6) a personal experience sentence
7) a short “trend story” influenced by SERP data

Professional tone, reflective, analytic.
Paragraph only.
        `;

        const ai = await openai.chat.completions.create({
          model:"gpt-4o-mini",
          messages:[{role:"user",content:thoughtPrompt}],
          temperature:0.82
        });

        const finalThought = ai.choices[0].message.content.trim();

        //////////////////////////////////////////////////////////////
        // 5) Emit persona
        //////////////////////////////////////////////////////////////
        socket.emit("personaChunk",{
          major,
          gender: demo.gender,
          race:   demo.race,
          age:    demo.age,
          thought: finalThought,
          hashtags:["insight","trend","analysis"],
          serpContext,
          category:cat
        });
      }

      socket.emit("personaDone");

    }catch(err){
      console.error("ENGINE ERROR:",err);
      socket.emit("personaError","Engine failure.");
    }
  });

  socket.on("disconnect",()=>console.log("Client left:",socket.id));
});

//////////////////////////////////////////////////////////////
// VIEWS + STATIC
//////////////////////////////////////////////////////////////

const VIEW_FILE="/data/views.json";
function readViews(){
  try{return JSON.parse(fs.readFileSync(VIEW_FILE,"utf8"));}catch{return{total:0}}
}
function writeViews(v){
  try{fs.writeFileSync(VIEW_FILE,JSON.stringify(v,null,2));}catch{}
}

app.get("/api/views",(req,res)=>{
  const v=readViews();
  v.total++;
  writeViews(v);
  res.json({total:v.total});
});

app.use(express.static(path.join(__dirname,"public")));

//////////////////////////////////////////////////////////////
// START SERVER
//////////////////////////////////////////////////////////////

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT,()=>console.log("🔥 Final Engine running on port",PORT));