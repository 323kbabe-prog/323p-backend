//////////////////////////////////////////////////////////////
// server.js — Multi-Origin Final Engine
// Supports: Blue Ocean · NPC · Persona · 24 Billy
//
// FEATURES:
// • Smart rewrite engine (1–2 sentences)
// • Full SERP-powered 3-sentence thought engine
// • AI-generated hashtags (platform-safe, 3–6 tokens)
// • 4-platform search uses ONLY hashtags
// • Persona identities (major, gender, race, age)
// • Multi-origin share + auto-search on open
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

console.log("🚀 FINAL ENGINE STARTING…");
console.log("OpenAI OK:", !!process.env.OPENAI_API_KEY);
console.log("SERP OK:", !!SERP_KEY);

//////////////////////////////////////////////////////////////
// HELPERS
//////////////////////////////////////////////////////////////

function safeJSON(str){
  if (!str) return null;
  try{ return JSON.parse(str); }catch{}
  try{
    const m = str.match(/\{[\s\S]*?\}/);
    if(m) return JSON.parse(m[0]);
  }catch{}
  return null;
}

function pick(arr){
  return arr[Math.floor(Math.random() * arr.length)];
}

const genders = ["Female","Male","Nonbinary"];
const races = ["Asian","Black","White","Latino","Middle Eastern","Mixed"];
const ages = [...Array.from({length:32},(_,i)=>i+18)];

//////////////////////////////////////////////////////////////
// MAJORS (IDENTITY POOL)
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
  billy:  "https://24billybrowser.com"
};

const SHARES_FILE="/data/shares.json";
if(!fs.existsSync("/data")) fs.mkdirSync("/data");

function readShares(){ try{return JSON.parse(fs.readFileSync(SHARES_FILE,"utf8"))}catch{return{}} }
function writeShares(d){ fs.writeFileSync(SHARES_FILE,JSON.stringify(d,null,2)); }

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
  if(!s) return res.status(404).json([]);
  res.json(s.personas || []);
});

app.get("/s/:id",(req,res)=>{
  const all = readShares();
  const s   = all[req.params.id];

  if(!s) return res.redirect("https://blueoceanbrowser.com");

  const redirectURL = ORIGIN_MAP[s.origin] || ORIGIN_MAP.blue;

  res.send(`
    <!doctype html><html><head><meta charset="utf-8"/>
    <script>
      sessionStorage.setItem("sharedId","${req.params.id}");
      setTimeout(()=>{
        window.location.href="${redirectURL}?query="+encodeURIComponent("${s.query || ""}");
      },500);
    </script>
    </head><body></body></html>
  `);
});

//////////////////////////////////////////////////////////////
// REWRITE ENGINE (1–2 sentences max)
//////////////////////////////////////////////////////////////

app.post("/api/rewrite", async (req,res)=>{
  let { query } = req.body;
  query = (query||"").trim();
  if(!query) return res.json({ rewritten:"" });

  const prompt = `
Rewrite into a clear 1–2 sentence strategic direction.
Do NOT quote the user.
Do NOT expand beyond original meaning.
Output only the rewritten text.
User: ${query}
Rewritten:
  `;

  try{
    const out = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      messages:[{role:"user",content:prompt}],
      temperature:0.25
    });

    let rewritten = out.choices[0].message.content.trim();
    rewritten = rewritten.replace(/["“”‘’]/g,"");

    const sentences = rewritten.split(".").filter(s=>s.trim());
    if (sentences.length > 2){
      rewritten = sentences.slice(0,2).join(". ") + ".";
    }

    res.json({ rewritten });

  }catch(err){
    console.log("Rewrite error:",err);
    res.json({ rewritten:query });
  }
});

//////////////////////////////////////////////////////////////
// MAIN ENGINE — SERP + 3-sentence thought + AI hashtags
//////////////////////////////////////////////////////////////

const httpServer = createServer(app);
const io         = new Server(httpServer,{ cors:{origin:"*"} });

io.on("connection", socket=>{
  console.log("Client connected:",socket.id);

  socket.on("personaSearch", async rewrittenQuery=>{
    try{
      ////////////////////////////////////////////////////////////
      // SERP FETCH
      ////////////////////////////////////////////////////////////

      const serpQuery = rewrittenQuery
        .split(" ")
        .filter(w=>w.length>2)
        .slice(0,6)
        .join(" ");

      let serpContext = "";
      if(SERP_KEY){
        try{
          const url = `https://serpapi.com/search.json?q=${encodeURIComponent(serpQuery)}&num=5&api_key=${SERP_KEY}`;
          const r   = await fetch(url);
          const j   = await r.json();

          const titles = (j.organic_results || [])
            .map(x=>x.title)
            .filter(Boolean)
            .slice(0,2)
            .join(" | ");

          serpContext = titles || "";
        }catch(err){
          console.log("SERP FAIL:",err.message);
        }
      }

      ////////////////////////////////////////////////////////////

      const CAT_ORDER = ["A","B","C","D","E","A","B","C","D","E"];

      for(let i=0;i<10;i++){
        const cat   = CAT_ORDER[i];
        const major = pick(PROF[cat]);
        const demo  = { gender:pick(genders), race:pick(races), age:pick(ages) };

        ////////////////////////////////////////////////////////////
        // FINAL 3-SENTENCE THOUGHT ENGINE
        ////////////////////////////////////////////////////////////

        const fullPrompt = `
You are a ${demo.gender}, ${demo.race}, age ${demo.age}, trained in ${major}.
Write a single paragraph of **3 sentences** analyzing the user's direction
WITHOUT quoting it:

Direction: ${rewrittenQuery}

Use:
• Your professional worldview (from ${major})
• Insights loosely inspired by: "${serpContext}"
  (but do NOT mention data, SERP, trends, or search)
• One small personal anecdote
• Tone: reflective, analytical, grounded

Also generate **3–6 short platform-friendly hashtags**:
• one word or two-word fused tokens
• no spaces, no punctuation
• must relate to your thought + identity + subject
Return JSON only:
{
"thought":"...",
"hashtags":["...","..."]
}
        `;

        const ai = await openai.chat.completions.create({
          model:"gpt-4o-mini",
          messages:[{role:"user",content:fullPrompt}],
          temperature:0.85
        });

        const parsed = safeJSON(ai.choices[0].message.content) || {};
        const finalThought = parsed.thought || "";
        const finalTags    = parsed.hashtags || [];

        ////////////////////////////////////////////////////////////

        const persona = {
          major,
          gender:demo.gender,
          race:demo.race,
          age:demo.age,
          thought:finalThought,
          hashtags:finalTags,
          serpContext,
          category:cat
        };

        socket.emit("personaChunk",persona);
      }

      socket.emit("personaDone");

    }catch(err){
      console.error("ENGINE ERROR:",err);
      socket.emit("personaError","Engine error");
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
  const v = readViews();
  v.total++;
  writeViews(v);
  res.json({total:v.total});
});

app.use(express.static(path.join(__dirname,"public")));

//////////////////////////////////////////////////////////////
// START SERVER
//////////////////////////////////////////////////////////////

const PORT = process.env.PORT||3000;
httpServer.listen(PORT,()=>console.log("🔥 Final Engine running on:",PORT));