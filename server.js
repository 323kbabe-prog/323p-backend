//////////////////////////////////////////////////////////////
//  server.js — Multi-Origin Final Engine (Identity + Bullet List Mode)
//  Supports: Blue Ocean · NPC · Persona · 24 Billy
//  Features:
//   • Smart rewrite engine (1–2 sentences)
//   • SERP-powered thought generator
//   • Identity-based paragraph (4–6 sentences)
//   • Bullet list directions (Option A format)
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

console.log("🚀 FINAL ENGINE STARTING…");
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
  for (const c of LOC) if (t.includes(c.toLowerCase())) return c;
  return null;
}

const genders = ["Female","Male","Nonbinary"];
const races = ["Asian","Black","White","Latino","Middle Eastern","Mixed"];
const ages = [...Array.from({length:32}, (_,i) => i+18)];
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)] }

//////////////////////////////////////////////////////////////
// IDENTITY MAJORS
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

const SHARES_FILE = "/data/shares.json";
if (!fs.existsSync("/data")) fs.mkdirSync("/data");

function readShares(){
  try { return JSON.parse(fs.readFileSync(SHARES_FILE, "utf8")); }
  catch { return {}; }
}
function writeShares(data){
  fs.writeFileSync(SHARES_FILE, JSON.stringify(data, null, 2));
}

app.post("/api/share", (req,res)=>{
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

app.get("/api/share/:id", (req,res)=>{
  const all = readShares();
  const s = all[req.params.id];
  if (!s) return res.status(404).json([]);
  res.json(s.personas || []);
});

app.get("/s/:id", (req,res)=>{
  const all = readShares();
  const s = all[req.params.id];
  if (!s) return res.redirect("https://blueoceanbrowser.com");

  const redirectURL = ORIGIN_MAP[s.origin] || ORIGIN_MAP.blue;

  res.send(`
    <!doctype html><html><head><meta charset="utf-8"/>
    <script>
      sessionStorage.setItem("sharedId","${req.params.id}");
      setTimeout(()=> {
        window.location.href = "${redirectURL}?query=" + encodeURIComponent("${s.query||""}");
      }, 500);
    </script>
    </head><body></body></html>
  `);
});

//////////////////////////////////////////////////////////////
// SMART REWRITE ENGINE — 1–2 Sentence Output
//////////////////////////////////////////////////////////////

app.post("/api/rewrite", async (req,res)=>{
  let { query } = req.body;
  query = (query || "").trim();
  if (!query) return res.json({ rewritten:"" });

  const prompt = `
Rewrite the user input into a clean, strategic business direction.
Rules:
- EXACTLY 1–2 sentences.
- Don’t use the word “business.”
- No quoting the user.
- No unnecessary details.
- Preserve intent without expanding scope.
User Input: ${query}
Rewritten:
  `;

  try{
    const out = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      messages:[{role:"user",content:prompt}],
      temperature:0.25
    });

    let rewritten = out.choices[0].message.content.trim();
    rewritten = rewritten.replace(/["“”‘’]/g, "");

    let s = rewritten.split(".").filter(x=>x.trim());
    if (s.length > 2)
      rewritten = s.slice(0,2).join(". ") + ".";

    res.json({ rewritten });

  }catch(err){
    res.json({ rewritten:query });
  }
});

//////////////////////////////////////////////////////////////
// NPC ENGINE + SERP + 3-LAYER THOUGHT + BULLET LIST MODE
//////////////////////////////////////////////////////////////

const httpServer = createServer(app);
const io = new Server(httpServer, { cors:{origin:"*"} });

io.on("connection", socket=>{
  console.log("Client connected:", socket.id);

  socket.on("personaSearch", async rewrittenQuery=>{
    try{
      const location = extractLocation(rewrittenQuery);

      ////////////////////////////////////////////////////////
      //  SERP Query Builder
      ////////////////////////////////////////////////////////
      const serpQuery = rewrittenQuery
        .split(" ")
        .filter(w => w.length > 2)
        .slice(0, 6)
        .join(" ");

      let serpContext = "No verified data.";
      if (SERP_KEY) {
        try{
          const url = `https://serpapi.com/search.json?q=${
            encodeURIComponent(serpQuery+" market trends 2025")
          }&num=5&api_key=${SERP_KEY}`;

          const r = await fetch(url);
          const j = await r.json();

          const titles = (j.organic_results || [])
            .map(x => x.title)
            .filter(Boolean)
            .slice(0,3)
            .join(" | ");

          if (titles) serpContext = titles;

        }catch(err){
          console.log("SERP ERROR:", err.message);
        }
      }

      ////////////////////////////////////////////////////////

      const CAT_ORDER = ["A","B","C","D","E","A","B","C","D","E"];

      for (let i=0; i<10; i++){
        const cat = CAT_ORDER[i];
        const major = pick(PROF[cat]);
        const demo = {
          gender: pick(genders),
          race: pick(races),
          age: pick(ages)
        };

        ////////////////////////////////////////////////////////
        //  PROMPT — Identity Paragraph + Bullet List (Option A)
        ////////////////////////////////////////////////////////

        const fullPrompt = `
You are a ${demo.gender}, ${demo.race}, age ${demo.age}, trained in ${major}.
Write a single paragraph (1 sentences) analyzing the rewritten direction:
"${rewrittenQuery}" (do NOT quote it).

Use the worldview and methodology of ${major}.
Naturally integrate insights inspired by: "${serpContext}" — but never mention where they came from.
Use language with very strong niche professional terms.

Include one comment.
Tone: reflective, analytical, grounded.
Do NOT mention online trends, search results, SERP, or web activity.
Provide only the paragraph.

After the paragraph, produce EXACTLY 4 bullet points using this format:
Key directions to consider:
- direction 1
- direction 2
- direction 3
- direction 4

The directions must:
- be niche to the identity field (${major})
- be relevant to inferred subject from the rewritten direction
- NOT be generic
- be actionable and strategic
        `;

        const ai = await openai.chat.completions.create({
          model:"gpt-4o-mini",
          messages:[{role:"user",content:fullPrompt}],
          temperature:0.85
        });

        const fullThought = ai.choices[0].message.content.trim();

        ////////////////////////////////////////////////////////
        // Identity-Niche Hashtags
        ////////////////////////////////////////////////////////

        const majorKeyword = major.split(" ")[0];
        const serpKeywords = serpContext.split(" ").slice(0,3);
        const queryKeywords = rewrittenQuery.split(" ").slice(0,3);

        const hashtags = [
          `#${majorKeyword}Insight`,
          `#${majorKeyword}Strategy`,
          ...serpKeywords.map(k => "#" + k.replace(/[^a-zA-Z]/g,"")),
          ...queryKeywords.map(k => "#" + k.replace(/[^a-zA-Z]/g,""))
        ].slice(0,5);

        const persona = {
          major,
          gender: demo.gender,
          race: demo.race,
          age: demo.age,
          thought: fullThought,
          serpContext,
          hashtags,
          category: cat
        };
        
// Append location as hashtag if found
if (location) {
  const locTag = location.replace(/\s+/g, "").toLowerCase();
  if (!persona.hashtags.includes(locTag)) {
    persona.hashtags.push(locTag);   // e.g. "nyc"
  }
}

        socket.emit("personaChunk", persona);
      }

      socket.emit("personaDone");

    }catch(err){
      console.error("ENGINE ERROR:", err);
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
  try{ return JSON.parse(fs.readFileSync(VIEW_FILE,"utf8")); }
  catch{ return {total:0}; }
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
httpServer.listen(PORT, ()=>console.log("🔥 Final Engine running on", PORT));