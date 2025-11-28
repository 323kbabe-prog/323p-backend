//////////////////////////////////////////////////////////////
//  server.js — Multi-Origin Final Engine (RAIN MAN MODE)
//  Supports: Blue Ocean · NPC · Persona · 24 Billy
//
//  FEATURES:
//   • Smart rewrite engine (1–2 sentences, literal mode)
//   • SERP-powered Rain-Man-style thought generator
//   • Extracts ONLY numbers from SERP
//   • Procedural "I will" paragraph + Rain-Man bullets
//   • Identity-based personas
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

const app = express();
app.use(cors({ origin:"*" }));
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
const SERP_KEY = process.env.SERPAPI_KEY || null;

console.log("🚀 RAIN MAN ENGINE STARTING…");
console.log("OpenAI:", !!process.env.OPENAI_API_KEY);
console.log("SERP:", !!SERP_KEY);

//////////////////////////////////////////////////////////////
// HELPERS
//////////////////////////////////////////////////////////////

function safeJSON(str){
  if(!str) return null;
  try { return JSON.parse(str); } catch{}
  try {
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

const SHARES_FILE = "/data/shares.json";
if(!fs.existsSync("/data")) fs.mkdirSync("/data");

function readShares(){
  try { return JSON.parse(fs.readFileSync(SHARES_FILE,"utf8")); }
  catch { return {}; }
}

function writeShares(v){
  fs.writeFileSync(SHARES_FILE, JSON.stringify(v,null,2));
}

app.post("/api/share",(req,res)=>{
  const all = readShares();
  const id  = Math.random().toString(36).substring(2,8);

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
    <!doctype html>
    <html><head><meta charset="utf-8"/>
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
// SMART REWRITE ENGINE — STRICT LITERAL MODE
//////////////////////////////////////////////////////////////

app.post("/api/rewrite", async(req,res)=>{
  let { query } = req.body;
  query = (query||"").trim();
  if(!query) return res.json({ rewritten:"" });

  const prompt = `
Rewrite the user's text into ONE literal sentence.
Do NOT add interpretation.
Do NOT change tone.
Do NOT make it strategic, emotional, or business-like.
ONE sentence only.
No quoting.
User Input: ${query}
Rewritten:
  `;

  try{
    const out = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      messages:[{ role:"user", content:prompt }],
      temperature:0.25
    });

    let rewritten = out.choices[0].message.content.trim()
      .replace(/["“”‘’]/g,"");

    const s = rewritten.split(".").filter(x=>x.trim());
    if(s.length > 1)
      rewritten = s[0] + ".";

    res.json({ rewritten });

  }catch(err){
    console.log("Rewrite ERROR:",err);
    res.json({ rewritten:query });
  }
});

//////////////////////////////////////////////////////////////
// MAIN ENGINE — RAIN MAN THOUGHT ENGINE
//////////////////////////////////////////////////////////////

const httpServer = createServer(app);
const io = new Server(httpServer,{ cors:{origin:"*"} });

io.on("connection", socket=>{

  socket.on("personaSearch", async rewrittenQuery=>{
    try{

      const location = extractLocation(rewrittenQuery);

      ////////////////////////////////////////////////////////
      // SERP FETCH
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
          const r   = await fetch(url);
          const j   = await r.json();

          const titles = (j.organic_results||[])
            .map(x=>x.title)
            .filter(Boolean)
            .slice(0,3)
            .join(" | ");

          if(titles) serpContext = titles;

        }catch(e){
          console.log("SERP FAIL:",e.message);
        }
      }

      // ⭐ Extract ONLY numbers from SERP text
      const serpNumbers = serpContext.match(/\d+/g) || [];

      ////////////////////////////////////////////////////////

      const CAT_ORDER=["A","B","C","D","E","A","B","C","D","E"];

      for(let i=0;i<10;i++){

        const cat   = CAT_ORDER[i];
        const major = pick(PROF[cat]);
        const demo  = {
          gender:pick(genders),
          race:pick(races),
          age:pick(ages)
        };

        ////////////////////////////////////////////////////////
        // RAIN MAN THOUGHT PROMPT — FINAL VERSION
        ////////////////////////////////////////////////////////

        const fullPrompt = `
You are a ${demo.gender}, ${demo.race}, age ${demo.age}, trained in ${major}.

Your communication style MUST follow a Rain Man–like cognitive pattern:
- literal, clipped, flat  
- precise short statements  
- no metaphors  
- no abstractions  
- no figurative language  
- no emotional tone  
- procedural steps  
- numeric references allowed  
- do not interpret  

Use only vocabulary from the field of ${major}.  
NEVER use vocabulary from the rewritten direction.  
NEVER use vocabulary from this external text: "${serpContext}".  
Write as if you have never seen the user's query.

You MAY use numbers extracted from external text: ${serpNumbers.join(", ") || "none"}.  
Use numbers literally, without stating where they came from.

Include **one very tiny anecdote** in literal form:
“I observed one case.”  
“I counted one sample.”  
“I noted one instance.”

Write **one paragraph** starting with three strict sentences:

1) First sentence MUST begin with “I will”  
   and must restate a field-specific action loosely inspired by the general *category* of ${rewrittenQuery}  
   but without using any vocabulary from it.  
   You MAY include one of these numbers literally: ${serpNumbers.join(", ") || "none"}.

2) Second sentence = short literal factual sentence with NO “I will”.

3) Third sentence = short literal factual sentence with NO “I will”.

Then continue the paragraph with multiple “I will” sentences written as field routines,  
using ${major} methodology, optionally inserting numbers literally.  
Do NOT describe where numbers came from.

After the paragraph, output EXACTLY 4 bullet points:

Key directions to consider:
- direction 1
- direction 2
- direction 3
- direction 4

Rules for the directions:
- must be niche to ${major}
- must be literal Rain Man style
- must be procedural steps
- may include numbers literally
- no metaphors
- no references to query or SERP  

Return plain text only.
        `;

        ////////////////////////////////////////////////////////

        const ai = await openai.chat.completions.create({
          model:"gpt-4o-mini",
          messages:[ {role:"user",content:fullPrompt} ],
          temperature:0.55
        });

        const fullThought = ai.choices[0].message.content.trim();

        ////////////////////////////////////////////////////////
        // HASHTAGS
        ////////////////////////////////////////////////////////

        const majorKeyword = major.split(" ")[0];
        const serpWords    = serpContext.split(" ").slice(0,2);
        const qWords       = rewrittenQuery.split(" ").slice(0,2);

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

      } // END LOOP

      socket.emit("personaDone");

    }catch(err){
      console.error("ENGINE ERROR:",err);
      socket.emit("personaError","Engine failed");
    }
  });

  socket.on("disconnect",()=>console.log("Client left:",socket.id));
});

//////////////////////////////////////////////////////////////
// VIEWS + STATIC
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
httpServer.listen(PORT,()=>console.log("🔥 Final Rain Man Engine running on",PORT));