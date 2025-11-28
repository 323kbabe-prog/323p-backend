//////////////////////////////////////////////////////////////
//  server.js — Rain Man Business Engine (Final Version D)
//
//  FEATURES:
//   • Executive rewrite engine (1-sentence business strategy)
//   • SERP → full phrase extraction + numeric extraction
//   • Rain-Man-style unified paragraph using phrases + numbers
//   • One tiny anecdote
//   • Procedural “I will” chain
//   • 4 Rain-Man business bullet steps
//   • Identity persona rotation
//   • Multi-origin share system
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

console.log("🚀 Rain Man Business Engine Started");
console.log("OpenAI:", !!process.env.OPENAI_API_KEY);
console.log("SERP Enabled:", !!SERP_KEY);

//////////////////////////////////////////////////////////////
// HELPERS
//////////////////////////////////////////////////////////////

function safeJSON(str){
  if(!str) return null;
  try{ return JSON.parse(str); }catch(e){}
  try{
    const m = str.match(/\{[\s\S]*?\}/);
    if(m) return JSON.parse(m[0]);
  }catch{}
  return null;
}

function extractLocation(text){
  const LOC = [
    "USA","United States","America","LA","Los Angeles","NYC","New York",
    "Miami","Chicago","Texas","Florida","Seattle","San Francisco",
    "Tokyo","Paris","London","Berlin","Seoul","Taipei","Singapore"
  ];

  const low = text.toLowerCase();
  for(const c of LOC){
    if(low.includes(c.toLowerCase())) return c;
  }
  return null;
}

function pick(arr){
  return arr[Math.floor(Math.random()*arr.length)];
}

const genders = ["Female","Male","Nonbinary"];
const races   = ["Asian","Black","White","Latino","Middle Eastern","Mixed"];
const ages    = [...Array.from({length:32},(_,i)=>i+18)];

//////////////////////////////////////////////////////////////
// MAJORS
//////////////////////////////////////////////////////////////

const PROF = {
  A:["Human Biology","Psychology","Sociology","Public Health","Bioengineering"],
  B:["Political Science","Public Policy","International Relations","Ethics in Society","Science, Technology & Society"],
  C:["Computer Science","Mechanical Engineering","Electrical Engineering","Symbolic Systems","Aeronautics & Astronautics"],
  D:["Economics","Management Science & Engineering","Data Science","Mathematical & Computational Science","Statistics"],
  E:["Art Practice","Communication","Film & Media Studies","Linguistics","Music"]
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

function readShares(){
  try{return JSON.parse(fs.readFileSync(SHARES_FILE,"utf8"));}
  catch{return{};}
}
function writeShares(v){
  fs.writeFileSync(SHARES_FILE, JSON.stringify(v,null,2));
}

app.post("/api/share",(req,res)=>{
  const all=readShares();
  const id=Math.random().toString(36).substring(2,8);

  all[id]={
    personas:req.body.personas||[],
    query:req.body.query||"",
    origin:req.body.origin||"blue"
  };

  writeShares(all);
  res.json({ shortId:id });
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
  if(!s) return res.redirect("https://blueoceanbrowser.com");

  const redirectURL = ORIGIN_MAP[s.origin] || ORIGIN_MAP.blue;

  res.send(`
    <!doctype html><html><head><meta charset="utf-8" />
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
// EXECUTIVE REWRITE ENGINE — BUSINESS STRATEGY MODE
//////////////////////////////////////////////////////////////

app.post("/api/rewrite", async(req,res)=>{
  let { query } = req.body;
  query = (query||"").trim();
  if(!query) return res.json({ rewritten:"" });

  const prompt = `
Rewrite the user's text into a sharp business strategic direction.
Rules:
- EXACTLY 1 sentence.
- No quoting the user.
- No emotion.
- No metaphors.
- Sound like executive corporate strategy.
- Strengthen clarity, focus, and direction.
- Remove personal details.

User Input: ${query}
Rewritten:
`;

  try{
    const out = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      messages:[{role:"user",content:prompt}],
      temperature:0.2
    });

    let rewritten = out.choices[0].message.content.trim()
      .replace(/["“”‘’]/g,'');

    rewritten = rewritten.split(".")[0] + ".";

    res.json({ rewritten });
  }catch(e){
    res.json({ rewritten:query });
  }
});

//////////////////////////////////////////////////////////////
// MAIN ENGINE — RAIN MAN BUSINESS THOUGHT ENGINE
//////////////////////////////////////////////////////////////

const httpServer=createServer(app);
const io=new Server(httpServer,{ cors:{origin:"*"} });

io.on("connection",socket=>{

socket.on("personaSearch", async rewrittenQuery=>{
try{

  const location = extractLocation(rewrittenQuery);

  ////////////////////////////////////////////////////////
  // SERP FETCH + FULL PHRASE + NUMBER EXTRACTION
  ////////////////////////////////////////////////////////

  const serpQuery = rewrittenQuery
    .split(" ")
    .filter(w=>w.length>2)
    .slice(0,6)
    .join(" ");

  let serpContext = "No verified data.";

  if(SERP_KEY){
    try{
      const url = `https://serpapi.com/search.json?q=${encodeURIComponent(serpQuery)}&num=5&api_key=${SERP_KEY}`;
      const r=await fetch(url);
      const j=await r.json();

      const titles=(j.organic_results||[])
        .map(x=>x.title)
        .filter(Boolean)
        .slice(0,3)
        .join(" | ");

      if(titles) serpContext=titles;

    }catch(e){}
  }

  // Extract decimals, percents, integers
  const serpNumbers = serpContext.match(/[0-9]+(\.[0-9]+)?%?/g) || [];

  ////////////////////////////////////////////////////////

  const CAT_ORDER=["A","B","C","D","E","A","B","C","D","E"];

  for(let i=0;i<10;i++){

    const cat = CAT_ORDER[i];
    const major = pick(PROF[cat]);
    const demo = {
      gender:pick(genders),
      race:pick(races),
      age:pick(ages)
    };

//////////////////////////////////////////////////////////////
// FINAL VERSION D — RAIN MAN BUSINESS PROMPT
//////////////////////////////////////////////////////////////

const fullPrompt = `
You are a ${demo.gender}, ${demo.race}, age ${demo.age}, trained in ${major}.

STYLE RULES:
- short statements
- flat business tone
- repetitive
- no emotion
- no metaphor
- no figurative language
- no abstraction
- no interpretation
- field vocabulary only

ALLOWED:
- You may repeat full SERP phrases:
  "${serpContext}"
- You may repeat these numbers:
  ${serpNumbers.join(", ") || "none"}

FORBIDDEN:
- no vocabulary from rewritten direction
- do not mention “user”, “query”, “search”, “data”, “trend”, “metric”, “result”

Write ONE unified paragraph that begins with:

1) A sentence that starts with “I will”,  
   uses ${major} field logic,  
   loosely corresponds to the category of "${rewrittenQuery}" without using any of its words,  
   and MUST include a SERP number and MUST include a SERP phrase from: "${serpContext}"

2) A short business factual sentence repeating one SERP number.

3) A short business factual sentence repeating one SERP phrase.

Continue the SAME paragraph with:
- many “I will” procedural business steps  
- each step MUST include a SERP number OR a SERP phrase  
- include one tiny anecdote (“I observed one case once.”)

Then output EXACTLY:

Key directions to consider:
- direction 1
- direction 2
- direction 3
- direction 4

Each direction:
- must be niche to ${major}
- must be short procedural commands
- must include a SERP number OR SERP phrase
- Rain Man style
`;

//////////////////////////////////////////////////////////////
// CALL OPENAI
//////////////////////////////////////////////////////////////

const ai = await openai.chat.completions.create({
  model:"gpt-4o-mini",
  messages:[{role:"user",content:fullPrompt}],
  temperature:0.50
});

const fullThought = ai.choices[0].message.content.trim();

//////////////////////////////////////////////////////////////
// HASHTAGS
//////////////////////////////////////////////////////////////

const majorKeyword=major.split(" ")[0];
const serpWords = serpContext.split(" ").slice(0,2);
const qWords = rewrittenQuery.split(" ").slice(0,2);

const hashtags = [
  `#${majorKeyword}Mode`,
  `#${majorKeyword}Logic`,
  ...serpWords.map(w=>"#"+w.replace(/[^a-zA-Z]/g,"")),
  ...qWords.map(w=>"#"+w.replace(/[^a-zA-Z]/g,""))
].slice(0,5);

if(location){
  hashtags.push("#"+location.replace(/\s+/g,""));
}

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
  socket.emit("personaError","Engine failed");
}
});

});

//////////////////////////////////////////////////////////////
// VIEWS
//////////////////////////////////////////////////////////////

const VIEW_FILE="/data/views.json";

function readViews(){
  try { return JSON.parse(fs.readFileSync(VIEW_FILE,"utf8")); }
  catch { return { total:0 }; }
}
function writeViews(v){
  fs.writeFileSync(VIEW_FILE, JSON.stringify(v,null,2));
}

app.get("/api/views",(req,res)=>{
  const v=readViews();
  v.total++;
  writeViews(v);
  res.json({ total:v.total });
});

app.use(express.static(path.join(__dirname,"public")));

//////////////////////////////////////////////////////////////
// START SERVER
//////////////////////////////////////////////////////////////

const PORT=process.env.PORT||3000;
httpServer.listen(PORT,()=>console.log("🔥 Final Rain Man Business Engine running on",PORT));