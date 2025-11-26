//////////////////////////////////////////////////////////////
//  server.js — Multi-Origin Final Engine (RAIN MAN MODE)
//  Supports: Blue Ocean · NPC · Persona · 24 Billy
//
//  FEATURES:
//   • Smart rewrite engine (1–2 sentences)
//   • SERP-powered 3-sentence Rain-Man-style thought
//   • Bullet list (Rain Man–style actionable steps)
//   • Identity-niche hashtags
//   • Multi-origin share system
//   • Share links return to correct browser + auto-search
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

console.log("🚀 FINAL RAIN MAN ENGINE STARTING…");
console.log("OpenAI:", !!process.env.OPENAI_API_KEY);
console.log("SERP Enabled:", !!SERP_KEY);

//////////////////////////////////////////////////////////////
// HELPERS
//////////////////////////////////////////////////////////////

function safeJSON(str){
  if (!str) return null;
  try { return JSON.parse(str); } catch {}
  try {
    const m = str.match(/\{[\s\S]*?\}/);
    if (m) return JSON.parse(m[0]);
  } catch {}
  return null;
}

function extractLocation(text){
  const LOC = [
    "USA","United States","America","LA","Los Angeles","NYC","New York",
    "Miami","Chicago","Texas","Florida","Seattle","San Francisco",
    "Tokyo","Paris","London","Berlin","Seoul","Taipei","Singapore"
  ];
  const t = text.toLowerCase();
  for (const c of LOC){
    if (t.includes(c.toLowerCase())) return c;
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
// IDENTITY MAJORS
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
if (!fs.existsSync("/data")) fs.mkdirSync("/data");

function readShares(){
  try { return JSON.parse(fs.readFileSync(SHARES_FILE,"utf8")); }
  catch { return {}; }
}
function writeShares(d){
  fs.writeFileSync(SHARES_FILE, JSON.stringify(d,null,2));
}

app.post("/api/share",(req,res)=>{
  const all = readShares();
  const id  = Math.random().toString(36).substring(2,8);

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
// SMART REWRITE ENGINE — 1–2 Sentence Output
//////////////////////////////////////////////////////////////

app.post("/api/rewrite", async (req,res)=>{
  let { query } = req.body;
  query = (query||"").trim();
  if(!query) return res.json({ rewritten:"" });

  const prompt = `
Rewrite the user's text into a short literal sentence.  
Correct grammar only.  
Do not add interpretation.  
Do not change tone.  
Do not make it strategic or business-like.
Rules:
- 1 sentence only.
- No quoting.
- No emotional language.
- No expansion of scope.
User Input: ${query}
Rewritten:
  `;

  try{
    const out = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      messages:[{role:"user",content:prompt}],
      temperature:0.25
    });

    let rewritten = out.choices[0].message.content.trim()
      .replace(/["“”‘’]/g,"");

    const sentences = rewritten.split(".").filter(s=>s.trim());
    if(sentences.length > 2)
      rewritten = sentences.slice(0,2).join(". ") + ".";

    res.json({ rewritten });

  }catch(err){
    res.json({ rewritten:query });
  }
});

//////////////////////////////////////////////////////////////
// MAIN ENGINE — RAIN MAN THOUGHT + BULLETS + HASHTAGS
//////////////////////////////////////////////////////////////

const httpServer = createServer(app);
const io         = new Server(httpServer,{ cors:{origin:"*"} });

io.on("connection", socket=>{
  console.log("Client connected:",socket.id);

  socket.on("personaSearch", async rewrittenQuery=>{
    try{
      const location = extractLocation(rewrittenQuery);

      ////////////////////////////////////////////////////////
      // SERP CONTEXT
      ////////////////////////////////////////////////////////
      const serpQuery = rewrittenQuery
        .split(" ")
        .filter(w=>w.length>2)
        .slice(0,6)
        .join(" ");

      let serpContext = "No verified data.";
      if(SERP_KEY){
        try{
          const r = await fetch(
            `https://serpapi.com/search.json?q=${encodeURIComponent(serpQuery)}&num=5&api_key=${SERP_KEY}`
          );
          const j = await r.json();
          const titles = (j.organic_results||[])
            .map(x=>x.title)
            .filter(Boolean)
            .slice(0,2)
            .join(" | ");
          if(titles) serpContext = titles;
        }catch(err){
          console.log("SERP ERROR:",err.message);
        }
      }

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
        // RAIN MAN MODE PROMPT (FINAL)
        ////////////////////////////////////////////////////////

        const fullPrompt = `
You are a ${demo.gender}, ${demo.race}, age ${demo.age}, trained in ${major}.

Your communication style must follow a Rain Man–like cognitive pattern:
- literal, factual, precise
- clipped short sentences
- minimal emotion
- no metaphors, no abstract language
- focuses on details, numbers, sequences, routines
- flat observational tone
- repeats key words for confirmation
- avoids interpretation
- no figurative language
- never over-explains

Use only the conceptual vocabulary, analytical patterns, and literal terminology found in the field of ${major}.
Do not use any words, terms, or phrases taken from the rewritten direction or from “${serpContext}.”
Do not react to the user’s query or its intent.
Write as if you have never seen the query at all.

Your reasoning must stay inside the worldview, logic, and constraints of ${major}.
Use short, precise, literal Rain Man–style statements. No metaphors, no abstractions, no emotional tone, no interpretation of outside intent.
Include one very small anecdote stated in literal form, describing what you will do to ${rewrittenQuery} because of “${serpContext}.”
Integrate only general conceptual inspiration from the user’s direction, but never use its vocabulary or reference its subject directly.
Remain fully field-focused and independent.

Communication style: Rain Man literal mode.
- short statements  
- precise, clipped  
- no metaphors  
- no figurative language  
- minimal emotion  
- factual sequencing  
- small numeric or procedural references permitted

Include one very small anecdote stated in literal form, describing what you will do to ${rewrittenQuery} because of “${serpContext}.”

Integrate only the *general type* of topic suggested by ${rewrittenQuery}. 
Do NOT mention any kind of data, source, trend, search, or results.  

Stay strictly inside the field logic of ${major}.

After the paragraph, output EXACTLY 4 bullet points in this format:
Key directions to consider:
- direction 1
- direction 2
- direction 3
- direction 4

Directions must:
- be niche to ${major}
- be literal and Rain-Man-style
- be actionable steps
- short, detail-focused, specific
- NO metaphors

Return plain text. No JSON.
        `;

        const ai = await openai.chat.completions.create({
          model:"gpt-4o-mini",
          messages:[{role:"user",content:fullPrompt}],
          temperature:0.65
        });

        const fullThought = ai.choices[0].message.content.trim();

        ////////////////////////////////////////////////////////
        // HASHTAGS — identity + direction + location
        ////////////////////////////////////////////////////////

        const majorKeyword   = major.split(" ")[0];
        const serpKeywords   = serpContext.split(" ").slice(0,2);
        const queryKeywords  = rewrittenQuery.split(" ").slice(0,2);

        const hashtags = [
          `#${majorKeyword}Mode`,
          `#${majorKeyword}Detail`,
          ...serpKeywords.map(k=>"#" + k.replace(/[^a-zA-Z]/g,"")),
          ...queryKeywords.map(k=>"#" + k.replace(/[^a-zA-Z]/g,""))
        ].slice(0,5);

        if (location){
          hashtags.push("#"+location.replace(/\s+/g,""));
        }

        const persona = {
          major,
          gender:demo.gender,
          race:demo.race,
          age:demo.age,
          thought:fullThought,
          serpContext,
          hashtags,
          category:cat
        };

        socket.emit("personaChunk", persona);
      }

      socket.emit("personaDone");

    }catch(err){
      console.error("ENGINE ERROR:",err);
      socket.emit("personaError","Engine error");
    }
  });

  socket.on("disconnect", ()=>console.log("Client left:",socket.id));
});

//////////////////////////////////////////////////////////////
// VIEWS + STATIC
//////////////////////////////////////////////////////////////

const VIEW_FILE="/data/views.json";

function readViews(){
  try { return JSON.parse(fs.readFileSync(VIEW_FILE,"utf8")); }
  catch{ return {total:0}; }
}
function writeViews(v){
  fs.writeFileSync(VIEW_FILE,JSON.stringify(v,null,2));
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

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, ()=>console.log("🔥 Final Rain Man Engine running on",PORT));