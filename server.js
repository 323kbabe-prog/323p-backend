//////////////////////////////////////////////////////////////
//  server.js — Rain Man Business Engine (Final Version C)
//  News-Only SERP Signal Mode
//  Supports: Blue Ocean · NPC · Persona · 24 Billy
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
// APP + OPENAI + SERP INIT
//////////////////////////////////////////////////////////////

const app = express();
app.use(cors({ origin:"*" }));
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
const SERP_KEY = process.env.SERPAPI_KEY || null;

console.log("🚀 Final Rain Man Business Engine Started");
console.log("OpenAI:", !!process.env.OPENAI_API_KEY);
console.log("SERP Active:", !!SERP_KEY);

//////////////////////////////////////////////////////////////
// HELPERS
//////////////////////////////////////////////////////////////

function extractLocation(text){
  const LOC = [
    "USA","United States","America","LA","Los Angeles","NYC","New York",
    "Miami","Chicago","Texas","Florida","Seattle","San Francisco",
    "Tokyo","Paris","London","Berlin","Seoul","Taipei","Singapore"
  ];
  const t = text.toLowerCase();
  return LOC.find(c => t.includes(c.toLowerCase())) || null;
}

function pick(arr){
  return arr[Math.floor(Math.random()*arr.length)];
}

//////////////////////////////////////////////////////////////
// IDENTITY POOLS
//////////////////////////////////////////////////////////////

const genders=["Female","Male","Nonbinary"];
const races=["Asian","Black","White","Latino","Middle Eastern","Mixed"];
const ages=[...Array.from({length:32},(_,i)=>i+18)];

const PROF={
  A:["Human Biology","Psychology","Sociology","Public Health","Bioengineering"],
  B:["Political Science","Public Policy","International Relations","Ethics in Society","Science, Technology & Society"],
  C:["Computer Science","Mechanical Engineering","Electrical Engineering","Symbolic Systems","Aeronautics & Astronautics"],
  D:["Economics","Management Science & Engineering","Data Science","Mathematical & Computational Science","Statistics"],
  E:["Art Practice","Communication","Film & Media Studies","Linguistics","Music"]
};

//////////////////////////////////////////////////////////////
// SHARE SYSTEM
//////////////////////////////////////////////////////////////

const ORIGIN_MAP={
  blue:"https://blueoceanbrowser.com",
  npc:"https://npcbrowser.com",
  persona:"https://personabrowser.com",
  billy:"https://24billybrowser.com"
};

const SHARES_FILE="/data/shares.json";
if(!fs.existsSync("/data")) fs.mkdirSync("/data");

function readShares(){
  try{ return JSON.parse(fs.readFileSync(SHARES_FILE,"utf8")); }
  catch{ return {}; }
}

function writeShares(v){
  fs.writeFileSync(SHARES_FILE, JSON.stringify(v,null,2));
}

app.post("/api/share",(req,res)=>{
  const all=readShares();
  const id=Math.random().toString(36).substring(2,8);

  all[id]={
    personas:req.body.personas || [],
    query:req.body.query || "",
    origin:req.body.origin || "blue"
  };

  writeShares(all);
  res.json({ shortId:id });
});

app.get("/api/share/:id",(req,res)=>{
  const all=readShares();
  const s=all[req.params.id];
  if(!s) return res.status(404).json([]);
  res.json(s.personas || []);
});

app.get("/s/:id",(req,res)=>{
  const all=readShares();
  const s=all[req.params.id];
  if(!s) return res.redirect("https://blueoceanbrowser.com");
  const redirectURL = ORIGIN_MAP[s.origin] || ORIGIN_MAP.blue;

  res.send(`
    <!doctype html><html><head><meta charset='utf-8'/>
    <script>
      sessionStorage.setItem("sharedId","${req.params.id}");
      setTimeout(()=>{
        window.location.href="${redirectURL}?query="+encodeURIComponent("${s.query||""}");
      },400);
    </script>
    </head><body></body></html>
  `);
});

//////////////////////////////////////////////////////////////
// BLOCK 2 — EXECUTIVE REWRITE ENGINE
//////////////////////////////////////////////////////////////

app.post("/api/rewrite", async(req,res)=>{
  let { query } = req.body;
  query=(query||"").trim();
  if(!query) return res.json({ rewritten:"" });

  const prompt=`
Rewrite the user's text into a direct business strategy instruction.
Rules:
- EXACTLY 1 sentence.
- No quotes.
- No emotional words.
- No metaphors.
- Must sound like senior executive direction.
- Must increase clarity and business actionability.
Input: ${query}
Rewritten:
  `;

  try{
    const out = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      messages:[{role:"user",content:prompt}],
      temperature:0.2
    });

    let rewritten = out.choices[0].message.content.trim()
      .replace(/["“”‘’]/g,"");

    // Prevent breaking abbreviations like U.S.A. by trimming only final dots
rewritten = rewritten.replace(/\s*\.+$/, "") + ".";

    res.json({ rewritten });

  }catch(err){
    console.log("Rewrite Error:",err);
    res.json({ rewritten:query });
  }
});

//////////////////////////////////////////////////////////////
// BLOCK 3 — RAIN MAN BUSINESS THOUGHT ENGINE (NEWS ONLY)
//////////////////////////////////////////////////////////////

const httpServer = createServer(app);
const io = new Server(httpServer,{ cors:{origin:"*"} });

io.on("connection", socket => {

socket.on("personaSearch", async rewrittenQuery => {
try{

  const location = extractLocation(rewrittenQuery);
  const CAT_ORDER=["A","B","C","D","E","A","B","C","D","E"];

  for (let i=0; i<10; i++){

    const cat   = CAT_ORDER[i];
    const major = pick(PROF[cat]);
    const demo  = {
      gender:pick(genders),
      race:pick(races),
      age:pick(ages)
    };

    //-------------------------------------------------------------
    // NEWS-ONLY SERP SEARCH BASED ON MAJOR
    //-------------------------------------------------------------
    const serpQuery = `${major} business news ${new Date().getFullYear()}`;

    let serpContext = "No verified data.";

    if(SERP_KEY){
      try{
        const url = `https://serpapi.com/search.json?q=${
          encodeURIComponent(serpQuery)
        }&tbm=nws&num=5&api_key=${SERP_KEY}`;

        const r = await fetch(url);
        const j = await r.json();

        const titles = (j.news_results || [])
          .map(x => x.title)
          .filter(Boolean)
          .slice(0,5)
          .join(" | ");

        if(titles) serpContext = titles;

      }catch(e){
        console.log("SERP NEWS FAIL:", e.message);
      }
    }

    //-------------------------------------------------------------
    // NUMBER EXTRACTION (all numeric patterns)
    //-------------------------------------------------------------
    const serpNumbers = [
      ...(serpContext.match(/[0-9]+(\.[0-9]+)?%/g) || []),
      ...(serpContext.match(/[0-9]+(\.[0-9]+)?/g) || []),
      ...(serpContext.match(/\b[0-9]+(\.[0-9]+)?\s*million\b/gi) || []),
      ...(serpContext.match(/\b[0-9]+(\.[0-9]+)?\s*billion\b/gi) || [])
    ];
    const numList = serpNumbers.join(", ") || "none";

    //-------------------------------------------------------------
    // RAIN MAN BUSINESS PROMPT
    //-------------------------------------------------------------
    const fullPrompt = `
You are a ${demo.gender}, ${demo.race}, age ${demo.age}, trained in ${major}.
Speak in clipped business steps. No emotion. No metaphor. No abstraction.
Use only ${major} vocabulary.

Forbidden: rewritten-direction words, SERP context words.

Allowed numbers: ${numList}

ONE PARAGRAPH.

Sentence 1:
- MUST start with “I will”
- MUST be a ${major}-logic business action
- MUST reflect the category of "${rewrittenQuery}" without using its words
- MUST include at least one of these numbers: ${numList}

Sentence 2: short factual statement (no “I will”)
Sentence 3: short factual statement (no “I will”)

Then:
- continuous “I will” business-method steps
- must include numbers naturally
- must include: “I noted one instance once.”

After that paragraph, output EXACTLY four bullets:

Key directions to consider:
- direction 1
- direction 2
- direction 3
- direction 4

Bullets must be ${major}-specific, clipped, procedural.
Return plain text only.
    `;

    //-------------------------------------------------------------
    // CALL OPENAI
    //-------------------------------------------------------------
    const ai = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      messages:[{role:"user",content:fullPrompt}],
      temperature:0.55
    });

    const fullThought = ai.choices[0].message.content.trim();

    //-------------------------------------------------------------
    // NAME EXTRACTION (Rewritten only)
    //-------------------------------------------------------------
    const tokens = rewrittenQuery.split(/\s+/);
    let properChunks = [];

    for (let j=0; j<tokens.length-1; j++){
      const w1=tokens[j], w2=tokens[j+1];
      if (/^[A-Z][a-zA-Z]+$/.test(w1) && /^[A-Z][a-zA-Z]+$/.test(w2)){
        properChunks.push(w1 + w2);
      }
    }

    const singles = tokens.filter(w => /^[A-Z][a-zA-Z]+$/.test(w));
    if(singles.length===1) properChunks.push(singles[0]);

    const nameTags = properChunks.map(n => "#" + n);

    //-------------------------------------------------------------
    // HASHTAGS
    //-------------------------------------------------------------
    const majorKeyword = major.split(" ")[0];
    const serpWords = serpContext.split(" ").slice(0,2);
    const qWords = rewrittenQuery.split(" ").slice(0,2);

    const hashtags = [
      `#${majorKeyword}Mode`,
      `#${majorKeyword}Logic`,
      ...nameTags,
      ...serpWords.map(w => "#" + w.replace(/[^a-zA-Z]/g,"")),
      ...qWords.map(w => "#" + w.replace(/[^a-zA-Z]/g,""))
    ].slice(0,7);

    if(location){
      hashtags.push("#"+location.replace(/\s+/g,""));
    }

    //-------------------------------------------------------------
    // EMIT CARD
    //-------------------------------------------------------------
    socket.emit("personaChunk",{
      major,
      gender:demo.gender,
      race:demo.race,
      age:demo.age,
      thought:fullThought,
      serpContext,
      hashtags,
      category:cat
    });

  } // end loop

  socket.emit("personaDone");

}catch(err){
  console.log("ENGINE ERROR:",err);
  socket.emit("personaError","Engine failed");
}

}); // END personaSearch

}); // END connection

//////////////////////////////////////////////////////////////
// BLOCK 4 — VIEWS + STATIC + START
//////////////////////////////////////////////////////////////

const VIEW_FILE="/data/views.json";

function readViews(){
  try{ return JSON.parse(fs.readFileSync(VIEW_FILE,"utf8")); }
  catch{ return { total:0 }; }
}

function writeViews(v){
  fs.writeFileSync(VIEW_FILE, JSON.stringify(v,null,2));
}

app.get("/api/views",(req,res)=>{
  const v = readViews();
  v.total++;
  writeViews(v);
  res.json({ total:v.total });
});

app.use(express.static(path.join(__dirname,"public")));

//////////////////////////////////////////////////////////////
// SERVER START
//////////////////////////////////////////////////////////////

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT,()=>{
  console.log("🔥 Final Rain Man Business Engine running on", PORT);
});