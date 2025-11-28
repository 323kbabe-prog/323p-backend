//////////////////////////////////////////////////////////////
//  server.js — Rain Man Business Engine (NEWS MODE — FINAL)
//
//  Supports:
//   • Blue Ocean Browser
//   • NPC Browser
//   • Persona Browser
//   • 24 Billy Browser
//
//  FEATURES:
//   • Executive rewrite engine (business 1-sentence direction)
//   • SERP → NEWS ONLY (tbm=nws)
//   • Extract all numbers (%, decimals, years, millions)
//   • Rain-Man-style thought generator (news-number–driven)
//   • One tiny anecdote
//   • Procedural “I will…” chain
//   • 4 Rain-Man business action bullets
//   • Identity-niche personas
//   • Multi-origin share + auto-load
//////////////////////////////////////////////////////////////

const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const OpenAI = require("openai");
const cors = require("cors");
const fs = require("fs");
const fetch = require("node-fetch");

const app    = express();
app.use(cors({ origin:"*" }));
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const SERP_KEY = process.env.SERPAPI_KEY || null;

console.log("🚀 Rain Man Business Engine — NEWS MODE STARTED");
console.log("OpenAI:", !!process.env.OPENAI_API_KEY);
console.log("SERP News Mode:", !!SERP_KEY);

//////////////////////////////////////////////////////////////
// HELPERS
//////////////////////////////////////////////////////////////

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
  return arr[Math.floor(Math.random() * arr.length)];
}

const genders=["Female","Male","Nonbinary"];
const races=["Asian","Black","White","Latino","Middle Eastern","Mixed"];
const ages=[...Array.from({length:32},(_,i)=>i+18)];

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
if(!fs.existsSync(SHARES_FILE)) fs.writeFileSync(SHARES_FILE,"{}");

function readShares(){
  try { return JSON.parse(fs.readFileSync(SHARES_FILE,"utf8")); }
  catch { return {}; }
}
function writeShares(d){
  fs.writeFileSync(SHARES_FILE, JSON.stringify(d,null,2));
}

app.post("/api/share",(req,res)=>{
  const all = readShares();
  const id = Math.random().toString(36).substring(2,8);

  all[id] = {
    personas:req.body.personas || [],
    query:req.body.query || "",
    origin:req.body.origin || "blue"
  };

  writeShares(all);
  res.json({ shortId:id });
});

app.get("/api/share/:id",(req,res)=>{
  const all = readShares();
  const s = all[req.params.id];
  if(!s) return res.status(404).json([]);
  res.json(s.personas || []);
});

app.get("/s/:id",(req,res)=>{
  const all = readShares();
  const s = all[req.params.id];
  if(!s) return res.redirect("https://blueoceanbrowser.com");

  const redirectURL = ORIGIN_MAP[s.origin] || ORIGIN_MAP.blue;

  res.send(`
    <!doctype html><html><head><meta charset="utf-8"/>
    <script>
      sessionStorage.setItem("sharedId","${req.params.id}");
      setTimeout(()=>{
        window.location.href="${redirectURL}?query="+encodeURIComponent("${s.query||""}");
      },400);
    </script></head><body></body></html>
  `);
});

//////////////////////////////////////////////////////////////
// EXECUTIVE REWRITE ENGINE — 1 Sentence Business Strategy
//////////////////////////////////////////////////////////////

app.post("/api/rewrite", async(req,res)=>{
  let { query } = req.body;
  query = (query||"").trim();
  if(!query) return res.json({ rewritten:"" });

  const prompt = `
Rewrite the user's text into a sharp, executive business strategic direction.
Rules:
- Exactly 1 sentence.
- No quoting the user.
- No emotion.
- No metaphors.
- Must sound like corporate strategic guidance.
- Strengthen intent into an actionable step.

User Input: ${query}
Rewritten:
`;

  try{
    const out = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      messages:[{role:"user",content:prompt}],
      temperature:0.15
    });

    let rewritten = out.choices[0].message.content.trim()
      .replace(/["“”]/g,"");

    rewritten = rewritten.split(".")[0] + ".";

    res.json({ rewritten });

  }catch(err){
    console.log("Rewrite ERROR:",err);
    res.json({ rewritten:query });
  }
});

//////////////////////////////////////////////////////////////
// MAIN ENGINE — RAIN MAN THOUGHT ENGINE (NEWS MODE)
//////////////////////////////////////////////////////////////

const httpServer = createServer(app);
const io = new Server(httpServer,{ cors:{origin:"*"} });

io.on("connection",socket=>{

socket.on("personaSearch", async rewrittenQuery=>{
try{

  const location = extractLocation(rewrittenQuery);

  ////////////////////////////////////////////////////////
  // SERP NEWS FETCH ONLY (tbm=nws)
  ////////////////////////////////////////////////////////

  const serpQuery = rewrittenQuery
    .split(" ")
    .filter(w=>w.length>2)
    .join(" ");

  let serpNews = "No verified news.";

  if(SERP_KEY){
    try{
      const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(
        serpQuery
      )}&tbm=nws&num=5&api_key=${SERP_KEY}`;

      const r = await fetch(url);
      const j = await r.json();

      const headlines = (j.news_results || [])
        .map(n=>n.title)
        .filter(Boolean)
        .slice(0,3)
        .join(" | ");

      if(headlines) serpNews = headlines;

    }catch(e){
      console.log("NEWS SERP FAIL:",e.message);
    }
  }

  // extract all numbers (%, decimals, millions, billions, years)
  const serpNumbers = serpNews.match(/[0-9]+(\.[0-9]+)?%?|[0-9]+(?:\.[0-9]+)?\s*million|[0-9]{4}/gi) || [];


  ////////////////////////////////////////////////////////
  // PERSONA LOOP
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
// RAIN MAN BUSINESS PARAGRAPH — NEWS NUMBERS
//////////////////////////////////////////////////////////////

const fullPrompt = `
You are a ${demo.gender}, ${demo.race}, age ${demo.age}, trained in ${major}.
You must speak in Rain Man business mode:
- clipped
- factual
- numeric when possible
- procedural
- no metaphors
- no emotion
- no interpretation
- no abstract language
- field terminology only

You may use these numbers directly: ${serpNumbers.join(", ")||"none"}  
Do NOT say where numbers came from.  
Do NOT use vocabulary from the rewritten direction: "${rewrittenQuery}"
Do NOT use vocabulary from the news itself: "${serpNews}"
Do NOT mention “news”, “search”, “trend”, “metric”, “data”, “result”.

STRUCTURE:

Write ONE SINGLE PARAGRAPH (not two) following this order:

1) **Sentence 1** → MUST start with "I will" and MUST include at least one number from above.  
   It must be a ${major}-logic action inspired by the *category* of the rewritten direction  
   WITHOUT using any words from the rewritten direction itself.

2) **Sentence 2** → short factual statement (no “I will”).

3) **Sentence 3** → another short factual statement (no “I will”).

4) Continue the SAME PARAGRAPH with a long chain of **I will** procedural business steps  
   containing numbers such as millions, percents, or years  
   formatted in plain text, without explanation.

5) Include exactly one tiny anecdote inside this same paragraph  
   (“I observed one case once.”)

After the paragraph, output:

Key directions to consider:
- direction 1
- direction 2
- direction 3
- direction 4

All directions must:
- be niche to ${major}
- be procedural
- be clipped
- optionally contain numbers
- no metaphors

Return plain text.
`;


//////////////////////////////////////////////////////////////
// CALL OPENAI — GENERATE THOUGHT
//////////////////////////////////////////////////////////////

const ai = await openai.chat.completions.create({
  model:"gpt-4o-mini",
  messages:[{role:"user",content:fullPrompt}],
  temperature:0.45
});

const fullThought = ai.choices[0].message.content.trim();

//////////////////////////////////////////////////////////////
// HASHTAGS
//////////////////////////////////////////////////////////////

const majorKeyword = major.split(" ")[0];
const serpWords = serpNews.split(" ").slice(0,2);
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
  serpNumbers,
  serpNews,
  hashtags,
  category:cat
});

} // end persona loop

socket.emit("personaDone");


}catch(err){
  console.log("ENGINE ERROR:",err);
  socket.emit("personaError","Engine failed");
}

});


//////////////////////////////////////////////////////////////
// VIEWS
//////////////////////////////////////////////////////////////

const VIEW_FILE="/data/views.json";
if(!fs.existsSync(VIEW_FILE)) fs.writeFileSync(VIEW_FILE,'{"total":0}');

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
// START SERVER
//////////////////////////////////////////////////////////////

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT,()=>{
  console.log("🔥 Final Rain Man Business Engine (NEWS MODE) running on",PORT);
});