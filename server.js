//////////////////////////////////////////////////////////////
//  server.js — Multi-Origin Thought Engine (FINAL VERSION)
//
//  Blue Ocean, NPC, Persona, 24 Billy are supported.
//  THOUGHT GENERATOR MOVED TO SERVER.
//  Now OpenAI produces:
//   • 7-sentence reflective thought
//   • identity-based reasoning
//   • serpContext integration
//   • indirect user-query influence
//   • unique persona voice per drop card
//   • personal experience sentence
//   • trend-signal story sentence
//
//  HTML now ONLY displays p.thought.
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

console.log("🚀 Final Multi-Origin Engine starting…");

//////////////////////////////////////////////////////////////
// HELPERS
//////////////////////////////////////////////////////////////

function safeJSON(str){
  if(!str || typeof str !== "string") return null;
  try{ return JSON.parse(str); }catch{}
  try{
    const m = str.match(/\{[\s\S]*?\}/);
    if(m) return JSON.parse(m[0]);
  }catch{}
  return null;
}

function extractLocation(text){
  const LOC = ["LA","Los Angeles","NYC","New York","Tokyo","Paris","London",
    "Berlin","Seoul","Busan","Taipei","Singapore","San Francisco",
    "SF","Chicago","Miami","Toronto","Seattle"];
  const t = text.toLowerCase();
  for(const c of LOC){
    if(t.includes(c.toLowerCase())) return c;
  }
  return null;
}

const genders=["Female","Male","Nonbinary"];
const races=["Asian","Black","White","Latino","Middle Eastern","Mixed"];
const ages=[...Array.from({length:32},(_,i)=>i+18)];
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)] }

//////////////////////////////////////////////////////////////
// ACADEMIC MAJORS (IDENTITIES)
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
  blue:"https://blueoceanbrowser.com",
  npc:"https://npcbrowser.com",
  persona:"https://personabrowser.com",
  billy:"https://24billybrowser.com"
};

const SHARES_FILE="/data/shares.json";
if(!fs.existsSync("/data")) fs.mkdirSync("/data");

function readShares(){ try{return JSON.parse(fs.readFileSync(SHARES_FILE,"utf8"))}catch{return{}} }
function writeShares(d){ fs.writeFileSync(SHARES_FILE,JSON.stringify(d,null,2)); }

app.post("/api/share",(req,res)=>{
  const all=readShares();
  const id=Math.random().toString(36).substring(2,8);
  all[id]={
    personas:req.body.personas||[],
    query:req.body.query||"",
    origin:req.body.origin||"npc"
  };
  writeShares(all);
  res.json({shortId:id});
});

app.get("/api/share/:id",(req,res)=>{
  const all=readShares();
  const s=all[req.params.id];
  if(!s) return res.status(404).json([]);
  res.json(s.personas||[]);
});

app.get("/s/:id",(req,res)=>{
  const all=readShares();
  const s=all[req.params.id];
  if(!s) return res.redirect("https://npcbrowser.com");
  const redirectURL=ORIGIN_MAP[s.origin] || ORIGIN_MAP.npc;
  res.send(`
    <!doctype html><html><head><meta charset="utf-8"/>
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
// SMART REWRITE ENGINE (unchanged)
//////////////////////////////////////////////////////////////

app.post("/api/rewrite", async (req,res)=>{
  let {query}=req.body;
  query=(query||"").trim();
  if(!query) return res.json({rewritten:""});

  const prompt=`
Rewrite into a meaningful business direction WITHOUT quoting the user.
If input is nonsense, salvage the closest possible human intention.
No quotes.
Input: ${query}
Rewritten:
  `;

  try{
    const out=await openai.chat.completions.create({
      model:"gpt-4o-mini",
      messages:[{role:"user",content:prompt}],
      temperature:0.2
    });

    let rewritten=out.choices[0].message.content.trim();
    rewritten=rewritten.replace(/["“”‘’]/g,"").trim();

    if(rewritten.length<3) return res.json({rewritten:""});
    res.json({rewritten});
  }catch{
    res.json({rewritten:query});
  }
});

//////////////////////////////////////////////////////////////
// NPC ENGINE + FULL THOUGHT GENERATOR (NEW)
//////////////////////////////////////////////////////////////

const httpServer=createServer(app);
const io=new Server(httpServer,{cors:{origin:"*"}});

io.on("connection", socket=>{
  console.log("Client:",socket.id);

  socket.on("personaSearch", async rewrittenQuery=>{
    try{
      const location = extractLocation(rewrittenQuery);

      // get SERP context
      let serpContext="No verified data.";
      if(process.env.SERPAPI_KEY){
        try{
          const url=`https://serpapi.com/search.json?q=${encodeURIComponent(rewrittenQuery)}&num=5&api_key=${SERP_KEY}`;
          const r=await fetch(url);
          const j=await r.json();
          const titles=(j.organic_results||[]).map(x=>x.title).slice(0,3);
          if(titles.length) serpContext=titles.join(" | ");
        }catch{}
      }

      const CAT_ORDER=["A","B","C","D","E","A","B","C","D","E"];

      for(let i=0;i<10;i++){
        const cat=CAT_ORDER[i];
        const major=pick(PROF[cat]);
        const demo={ gender:pick(genders), race:pick(races), age:pick(ages) };

        //////////////////////////////////////////////////////////////
        // NEW: FULL AI THOUGHT GENERATION HERE
        //////////////////////////////////////////////////////////////

        const fullPrompt = `
You are a ${demo.gender}, ${demo.race}, age ${demo.age}, trained in ${major}.
Use field-specific terminology, technical language, conceptual frameworks, 
and analytical patterns commonly used by experts in ${major}. 
Your reasoning MUST sound like someone who deeply understands ${major}, 
and should naturally incorporate discipline-specific keywords and mental models.

The user direction is: "${rewrittenQuery}" (DO NOT QUOTE IT).
You also have REAL search trend data: "${serpContext}".

Write a **7-sentence soft reflective analysis** that includes:

1) Identity-based interpretation (major-specific worldview)
2) Indirect reference to the rewritten direction (NO quoting)
3) Integration of SERP real trend data (weave it naturally)
4) Professional reasoning (strategic insight)
5) Behavioral or psychological observation (soft/refined)
6) A personal experience sentence (something you saw, learned, or witnessed)
7) A detailed “trend story” tied to SERP data, using at least one keyword from the rewritten direction if possible.

STRICT RULES:
- DO NOT quote the user search directly.
- DO NOT invent fake statistics.
- Tone: soft reflective, analytical, real-world grounded.
- Keep it realistic and professional.
Provide ONLY the paragraph, no JSON.
        `;

        const ai = await openai.chat.completions.create({
          model:"gpt-4o-mini",
          messages:[{role:"user",content:fullPrompt}],
          temperature:0.85
        });

        const finalThought = ai.choices[0].message.content.trim();

        //////////////////////////////////////////////////////////////

        // build persona object
        const persona = {
          major,
          gender: demo.gender,
          race: demo.race,
          age: demo.age,
          thought: finalThought,
          hashtags: ["insight","trend","analysis"], // can keep static or expand
          serpContext,
          category: cat
        };

        socket.emit("personaChunk", persona);
      }

      socket.emit("personaDone");

    }catch(err){
      console.error("ENGINE ERROR:",err);
      socket.emit("personaError","Engine error");
    }
  });

  socket.on("disconnect",()=>console.log("Left:",socket.id));
});

//////////////////////////////////////////////////////////////
// VIEWS + STATIC
//////////////////////////////////////////////////////////////

const VIEW_FILE="/data/views.json";
function readViews(){ try{return JSON.parse(fs.readFileSync(VIEW_FILE,"utf8"))}catch{return{total:0}} }
function writeViews(v){ try{fs.writeFileSync(VIEW_FILE,JSON.stringify(v,null,2))}catch{} }

app.get("/api/views",(req,res)=>{
  const v=readViews(); v.total++; writeViews(v);
  res.json({total:v.total});
});

app.use(express.static(path.join(__dirname,"public")));

//////////////////////////////////////////////////////////////
// START
//////////////////////////////////////////////////////////////

const PORT=process.env.PORT||3000;
httpServer.listen(PORT,()=>console.log("🔥 Final Multi-Origin Engine on:",PORT));