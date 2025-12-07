//////////////////////////////////////////////////////////////
//  Rain Man Business Engine — FINAL VERSION + Suggest Engine
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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const SERP_KEY = process.env.SERPAPI_KEY || null;

console.log("🚀 Rain Man Business Engine Started");
console.log("SERP Active:", !!SERP_KEY);

//////////////////////////////////////////////////////////////
// AI LOCATION EXTRACTOR
//////////////////////////////////////////////////////////////

async function extractLocationAI(text, openai) {
  if (!text || text.trim().length < 2) return null;

  const prompt = `
Extract the most likely geographic location mentioned in this sentence.
Rules:
- Return ONLY the location name.
- Must be real.
- If multiple appear, return the smallest/specific.
- If no valid location exists: NONE.
Input: ${text}
Output:
`;

  try {
    const out = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages:[{role:"user",content:prompt}],
      temperature: 0
    });

    let loc = out.choices[0].message.content.trim();
    if (!loc || loc.toUpperCase() === "NONE") return null;

    return loc.replace(/\s+/g, "");
  } catch {
    return null;
  }
}

//////////////////////////////////////////////////////////////
// Identity Pools
//////////////////////////////////////////////////////////////

const genders = ["Female","Male","Nonbinary"];
const races   = ["Asian","Black","White","Latino","Middle Eastern","Mixed"];
const ages    = [...Array.from({length:32},(_,i)=>i+18)];

function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

const PROF = {
  A: ["Human Biology","Psychology","Sociology","Public Health","Bioengineering"],
  B: ["Political Science","Public Policy","International Relations","Ethics in Society","Science, Technology & Society"],
  C: ["Computer Science","Mechanical Engineering","Electrical Engineering","Symbolic Systems","Aeronautics & Astronautics"],
  D: ["Economics","Management Science & Engineering","Data Science","Mathematical & Computational Science","Statistics"],
  E: ["Art Practice","Communication","Film & Media Studies","Linguistics","Music"]
};

//////////////////////////////////////////////////////////////
// Share System
//////////////////////////////////////////////////////////////

const ORIGIN_MAP = {
  blue: "https://blueoceanbrowser.com",
  npc: "https://npcbrowser.com",
  persona: "https://personabrowser.com",
  billy: "https://24billybrowser.com"
};

const SHARES_FILE = "/data/shares.json";
if(!fs.existsSync("/data")) fs.mkdirSync("/data");

function readShares(){
  try{ return JSON.parse(fs.readFileSync(SHARES_FILE,"utf8")); }
  catch{ return {}; }
}

function writeShares(v){
  fs.writeFileSync(SHARES_FILE, JSON.stringify(v,null,2));
}

app.post("/api/share",(req,res)=>{
  const all = readShares();
  const id = Math.random().toString(36).substring(2,8);

  all[id] = {
    personas: req.body.personas || [],
    query: req.body.query || "",
    origin: req.body.origin || "blue"
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
// Strong Nonsense Detector
//////////////////////////////////////////////////////////////

app.post("/api/validate", async (req,res)=>{
  const text = (req.body.text||"").trim();

  if(text.length < 3) return res.json({ valid:false });

  if(text.split(/\s+/).length === 1){
    if(text.length < 4) return res.json({ valid:false });
  }

  const prompt = `
Classify text as VALID or NONSENSE.

NONSENSE = very short, unclear, random, one-word with no meaning.
VALID = has intent or meaning.

Input: "${text}"
Output:
`;

  try {
    const out = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      messages:[{role:"user",content:prompt}],
      temperature:0
    });

    const raw = out.choices[0].message.content.trim().toUpperCase();
    res.json({ valid: raw === "VALID" });

  } catch {
    res.json({ valid:true });
  }
});

//////////////////////////////////////////////////////////////
// Rewrite Engine
//////////////////////////////////////////////////////////////

app.post("/api/rewrite", async (req,res)=>{
  let {query} = req.body;
  query = (query||"").trim();
  if(!query) return res.json({ rewritten:"" });

  const prompt = `
Rewrite the user's text into one senior executive directive.
1 sentence. No emotion. No metaphors.
Input: ${query}
Rewritten:
`;

  try{
    const out = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      messages:[{role:"user",content:prompt}],
      temperature:0.2
    });

    let rewritten = out.choices[0].message.content
      .replace(/["“”‘’]/g,"")
      .trim();

    rewritten = rewritten.split(".")[0] + ".";
    res.json({ rewritten });

  }catch{
    res.json({ rewritten:query });
  }
});

//////////////////////////////////////////////////////////////
// Score Engine
//////////////////////////////////////////////////////////////

app.post("/api/score", async (req,res)=>{
  const raw = req.body.text || "";

  const prompt = `
Rate clarity and business focus from 1-100.
Return ONLY the number.
Input: "${raw}"
`;

  try{
    const out = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      messages:[{role:"user",content:prompt}],
      temperature:0
    });

    const score = out.choices[0].message.content.trim();
    res.json({ score });

  }catch{
    res.json({ score:"-" });
  }
});

//////////////////////////////////////////////////////////////
// ⭐ NEW Suggestion Engine
//////////////////////////////////////////////////////////////

app.post("/api/suggest", async (req,res)=>{
  const raw = req.body.raw || "";
  const rewritten = req.body.rewritten || "";
  const score = req.body.score || "";

  const prompt = `
Explain WHY the user received score ${score}.
Return EXACTLY 3 bullet points.
Tone: helpful, not critical.

Focus on:
- clarity
- missing context
- missing objective
- confusing structure
- weak verbs
- lack of specificity

User: "${raw}"
Rewrite: "${rewritten}"

Output:
- point 1
- point 2
- point 3
`;

  try{
    const out = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      messages:[{role:"user",content:prompt}],
      temperature:0.2
    });

    res.json({ suggestions: out.choices[0].message.content.trim() });

  }catch{
    res.json({ suggestions:"- Unable to generate suggestions." });
  }
});

//////////////////////////////////////////////////////////////
// Persona Generator (5 Cards)
//////////////////////////////////////////////////////////////

const httpServer = createServer(app);
const io = new Server(httpServer,{ cors:{origin:"*"} });

io.on("connection",socket=>{
  socket.on("personaSearch", async rewrittenQuery => {

    try {
      const location = await extractLocationAI(rewrittenQuery, openai);
      const CAT_ORDER = ["A","B","C","D","E"];

      for(let i=0;i<5;i++){
        const cat = CAT_ORDER[i];
        const major = pick(PROF[cat]);
        const demo = {
          gender: pick(genders),
          race: pick(races),
          age: pick(ages)
        };

        const serpQuery = `${major} business news ${new Date().getFullYear()}`;
        let serpContext = "No verified data.";

        if(SERP_KEY){
          try{
            const url = `https://serpapi.com/search.json?q=${encodeURIComponent(serpQuery)}&tbm=nws&num=5&api_key=${SERP_KEY}`;
            const r = await fetch(url);
            const j = await r.json();
            const titles = (j.news_results||[])
              .map(x=>x.title)
              .filter(Boolean)
              .slice(0,5)
              .join(" | ");
            if(titles) serpContext = titles;
          }catch{}
        }

        const serpNumbers = (serpContext.match(/[0-9]+/g) || []);
        const numList = serpNumbers.join(", ") || "none";

        const serpBulletItems =
          serpContext==="No verified data."
          ? []
          : serpContext.split(" | ").map(x=>x.trim());

        const fullPrompt = `
You are a ${demo.gender}, ${demo.race}, ${demo.age}, expert in ${major}.
Mode: clipped Rain Man logic.

Numbers allowed: ${numList}

Provide:
1 paragraph + 6 “You will …” statements
+ 4 key directions
+ SERP insights

SERP:
${serpBulletItems.map(x=>"- "+x).join("\n")}
`;

        const ai = await openai.chat.completions.create({
          model:"gpt-4o-mini",
          messages:[{role:"user",content:fullPrompt}],
          temperature:0.55
        });

        const fullThought = ai.choices[0].message.content.trim();

        const majorKeyword = "#" + major.replace(/[^A-Za-z0-9]/g,"");
        let hashtags = [majorKeyword];

        const humanLocation = location ? location.replace(/([A-Z])/g," $1").trim() : "";

        const hashPrompt = `
Generate 3 professional hashtags based on:
"${rewrittenQuery}"
Location:${humanLocation||"NONE"}
Rules: ONLY hashtags
`;

        try{
          const aiHash = await openai.chat.completions.create({
            model:"gpt-4o-mini",
            messages:[{role:"user",content:hashPrompt}],
            temperature:0.35
          });

          const raw = aiHash.choices[0].message.content.trim();
          const aiTags = raw.split(/\s+/).filter(x=>x.startsWith("#"));
          hashtags.push(...aiTags);

        }catch{}

        hashtags = [...new Set(hashtags)].slice(0,4);

        socket.emit("personaChunk",{
          major,
          gender: demo.gender,
          race: demo.race,
          age: demo.age,
          thought: fullThought,
          serpContext,
          hashtags,
          category:cat
        });
      }

      socket.emit("personaDone");

    } catch (err){
      socket.emit("personaError","Internal error.");
    }
  });
});

//////////////////////////////////////////////////////////////
// VIEW COUNTER
//////////////////////////////////////////////////////////////

const VIEW_FILE = "/data/views.json";

function readViews(){
  try{ return JSON.parse(fs.readFileSync(VIEW_FILE,"utf8")); }
  catch{ return { total:0 }; }
}

function writeViews(v){
  fs.writeFileSync(VIEW_FILE, JSON.stringify(v,null,2));
}

app.get("/api/views",(req,res)=>{
  const v = readViews();
  v.start = "2025-11-11";
  v.total++;
  writeViews(v);

  res.json({
    total:v.total,
    start:v.start,
    today:new Date().toISOString().split("T")[0]
  });
});

app.get("/api/views/read",(req,res)=>{
  const v = readViews();
  res.json({
    total:v.total,
    start:v.start||"2025-11-11",
    today:new Date().toISOString().split("T")[0]
  });
});

//////////////////////////////////////////////////////////////
// ENTER COUNTER
//////////////////////////////////////////////////////////////

const ENTER_FILE = "/data/enter.json";

function readEnter(){
  try{ return JSON.parse(fs.readFileSync(ENTER_FILE,"utf8")); }
  catch{ return { total:0 }; }
}

function writeEnter(v){
  fs.writeFileSync(ENTER_FILE, JSON.stringify(v,null,2));
}

app.get("/api/enter",(req,res)=>{
  const c = readEnter();
  res.json({ total:c.total });
});

app.post("/api/enter",(req,res)=>{
  const c = readEnter();
  c.total++;
  writeEnter(c);
  res.json({ total:c.total });
});

//////////////////////////////////////////////////////////////
// Static Serve + Start
//////////////////////////////////////////////////////////////

app.use(express.static(path.join(__dirname,"public")));

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT,()=>{
  console.log("🔥 Final Rain Man Business Engine running on", PORT);
});