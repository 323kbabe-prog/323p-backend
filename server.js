//////////////////////////////////////////////////////////////
//  server.js — Rain Man Business Engine (Final Version C)
//  News-Only SERP Signal Mode
//  Supports: Blue Ocean · NPC · Persona · 24 Billy
//
//  FEATURES:
//   • Executive rewrite engine (1-sentence business direction)
//   • SERP → NEWS RESULTS ONLY (Top Stories)
//   • Extract numbers: 1.2, 48, 2025, 3 million, 12%, etc.
//   • Rain-Man Business paragraph (one block)
//   • Tiny anecdote
//   • Procedural “I will” chain with numbers
//   • 4 Rain-Man business bullet directions
//   • Identity-niche hashtags
//   • Share system + auto-load
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
app.use(cors({ origin:"*" }));
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
const SERP_KEY = process.env.SERPAPI_KEY || null;

console.log("🚀 Rain Man Business Engine Started");
console.log("OpenAI:", !!process.env.OPENAI_API_KEY);
console.log("SERP:", !!SERP_KEY);

//////////////////////////////////////////////////////////////
// HELPERS
//////////////////////////////////////////////////////////////

function safeJSON(str){
  if(!str) return null;
  try { return JSON.parse(str); } catch{}
  try {
    const m=str.match(/\{[\s\S]*?\}/);
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
  const low=text.toLowerCase();
  for(const c of LOC){
    if(low.includes(c.toLowerCase())) return c;
  }
  return null;
}

function pick(arr){
  return arr[Math.floor(Math.random()*arr.length)];
}

const genders=["Female","Male","Nonbinary"];
const races=["Asian","Black","White","Latino","Middle Eastern","Mixed"];
const ages=[...Array.from({length:32},(_,i)=>i+18)];

//////////////////////////////////////////////////////////////
// MAJORS
//////////////////////////////////////////////////////////////

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
  try{return JSON.parse(fs.readFileSync(SHARES_FILE,"utf8"));}
  catch{return{};}
}

function writeShares(v){
  fs.writeFileSync(SHARES_FILE,JSON.stringify(v,null,2));
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
  const redirectURL=ORIGIN_MAP[s.origin] || ORIGIN_MAP.blue;

  res.send(`
    <!doctype html><html><head><meta charset="utf-8"/>
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
// EXECUTIVE REWRITE ENGINE
//////////////////////////////////////////////////////////////

app.post("/api/rewrite", async(req,res)=>{
  let { query } = req.body;
  query=(query||"").trim();
  if(!query) return res.json({ rewritten:"" });

  const prompt=`
Rewrite the user's text into a single concise business strategy directive.
Rules:
- EXACTLY 1 sentence.
- No quoting.
- No emotion.
- No metaphors.
- Clear executive direction.
- Strengthen intent, increase clarity, remove personal detail.

User Input: ${query}
Rewritten:
  `;

  try{
    const out=await openai.chat.completions.create({
      model:"gpt-4o-mini",
      messages:[{role:"user",content:prompt}],
      temperature:0.2
    });

    let rewritten=out.choices[0].message.content.trim()
      .replace(/["“”‘’]/g,"");

    rewritten=rewritten.split(".")[0] + ".";

    res.json({ rewritten });

  }catch(err){
    console.log("Rewrite ERROR:",err);
    res.json({ rewritten:query });
  }
});

//////////////////////////////////////////////////////////////
// MAIN ENGINE — RAIN MAN BUSINESS THOUGHT ENGINE
//////////////////////////////////////////////////////////////

const httpServer = createServer(app);
const io = new Server(httpServer, { cors:{origin:"*"} });

io.on("connection", socket => {

socket.on("personaSearch", async rewrittenQuery => {
try{

  const location = extractLocation(rewrittenQuery);

  ////////////////////////////////////////////////////////
  // SERP NEWS FETCH + NUMBER EXTRACTION
  ////////////////////////////////////////////////////////

  const serpQuery = `${major} latest news ${new Date().getFullYear()}`;
    .split(" ")
    .filter(w => w.length > 2)
    .slice(0, 6)
    .join(" ");

  let serpContext = "No verified data.";

  if (SERP_KEY) {
    try {
      const url = `https://serpapi.com/search.json?q=${encodeURIComponent(
        serpQuery
      )}&tbm=nws&num=5&api_key=${SERP_KEY}`;

      const r = await fetch(url);
      const j = await r.json();

      const titles = (j.news_results || [])
        .map(x => x.title)
        .filter(Boolean)
        .slice(0, 5)
        .join(" | ");

      if (titles) serpContext = titles;

    } catch (e) {
      console.log("SERP NEWS FAIL:", e.message);
    }
  }

  // extract ALL numeric tokens (digits, decimals, % , million, billion)
  const serpNumbers = [
    ...(serpContext.match(/[0-9]+(\.[0-9]+)?%/g) || []),        // percents
    ...(serpContext.match(/[0-9]+(\.[0-9]+)?/g) || []),         // decimals + ints
    ...(serpContext.match(/\b[0-9]+(\.[0-9]+)?\s*million\b/gi) || []),
    ...(serpContext.match(/\b[0-9]+(\.[0-9]+)?\s*billion\b/gi) || [])
  ];

  ////////////////////////////////////////////////////////
  // GENERATE 10 PERSONAS
  ////////////////////////////////////////////////////////

  const CAT_ORDER=["A","B","C","D","E","A","B","C","D","E"];

  for(let i=0;i<10;i++){

    const cat   = CAT_ORDER[i];
    const major = pick(PROF[cat]);
    const demo  = {
      gender: pick(genders),
      race: pick(races),
      age: pick(ages)
    };

//////////////////////////////////////////////////////////////
// RAIN MAN THOUGHT PROMPT — FINAL VERSION C
//////////////////////////////////////////////////////////////

const fullPrompt = `
You are a ${demo.gender}, ${demo.race}, age ${demo.age}, trained in ${major}.

COMMUNICATION RULES:
- Short statements
- Factual steps
- Business-like sequencing
- No metaphors
- No emotion
- No abstraction
- No figurative language
- Numbers may appear, but must not be explained
- Only vocabulary from ${major} is allowed
- Never use vocabulary from the rewritten direction
- Never use vocabulary from this external text: "${serpContext}"
- Never reference “query”, “user”, “online”, “trend”, “search”, “data”, “metric”, “result”

ALLOWED:
Numbers extracted from external context: ${serpNumbers.join(", ") || "none"}

ONE PARAGRAPH ONLY.

STRUCTURE MUST FOLLOW:

Sentence 1:
- MUST begin with “I will”
- MUST describe a ${major}-logic business action
- MUST loosely reflect the *category* of "${rewrittenQuery}" without using its words
- MUST include at least one number from: ${serpNumbers.join(", ") || "none"}

Sentence 2:
- Short factual sentence (no “I will”).

Sentence 3:
- Another short factual sentence (no “I will”).

Then:
- A continuous chain of “I will” statements 
- All strictly inside ${major} business logic
- Steps, actions, sequences
- Must incorporate numbers naturally (not explained)
- Must include one tiny anecdote: “I noted one instance once.”

After the paragraph, output EXACTLY four bullets:

Key directions to consider:
- direction 1
- direction 2
- direction 3
- direction 4

Bullet rules:
- Must be procedural business steps
- Must be inside ${major}
- Must use numbers only if relevant
- Must not reference query or SERP
Return plain text only.
`;

//////////////////////////////////////////////////////////////
// CALL OPENAI FOR THOUGHT
//////////////////////////////////////////////////////////////

const ai = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages:[ { role:"user", content: fullPrompt } ],
  temperature: 0.55
});

const fullThought = ai.choices[0].message.content.trim();

//////////////////////////////////////////////////////////////
// HASHTAGS
//////////////////////////////////////////////////////////////

const majorKeyword = major.split(" ")[0];
const serpWords = serpContext.split(" ").slice(0, 2);
const qWords = rewrittenQuery.split(" ").slice(0, 2);

const hashtags = [
  `#${majorKeyword}Mode`,
  `#${majorKeyword}Logic`,
  ...serpWords.map(w => "#" + w.replace(/[^a-zA-Z]/g,"")),
  ...qWords.map(w => "#" + w.replace(/[^a-zA-Z]/g,""))
].slice(0,5);

if(location){
  hashtags.push("#" + location.replace(/\s+/g,""));
}

socket.emit("personaChunk",{
  major,
  gender: demo.gender,
  race: demo.race,
  age: demo.age,
  thought: fullThought,
  serpContext,
  hashtags,
  category: cat
});

} // END LOOP

socket.emit("personaDone");

} catch(err){
  console.log("ENGINE ERROR:",err);
  socket.emit("personaError","Engine failed");
}

}); // END personaSearch

}); // END connection

//////////////////////////////////////////////////////////////
// VIEWS + STATIC
//////////////////////////////////////////////////////////////

const VIEW_FILE = "/data/views.json";

function readViews(){
  try {
    return JSON.parse(fs.readFileSync(VIEW_FILE,"utf8"));
  } catch {
    return { total:0 };
  }
}

function writeViews(v){
  fs.writeFileSync(VIEW_FILE, JSON.stringify(v,null,2));
}

app.get("/api/views", (req,res)=>{
  const v = readViews();
  v.total++;
  writeViews(v);
  res.json({ total:v.total });
});

//////////////////////////////////////////////////////////////
// STATIC FRONTEND SERVE
//////////////////////////////////////////////////////////////

app.use(express.static(path.join(__dirname,"public")));

//////////////////////////////////////////////////////////////
// SERVER START
//////////////////////////////////////////////////////////////

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, ()=>{
  console.log("🔥 Final Rain Man Business Engine running on", PORT);
});