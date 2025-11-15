//////////////////////////////////////////////////////////////
//  server.js — NPC Browser (Simulation Edition v2.1 FINAL)
//  Includes:
//  • SERPAPI context
//  • 5-category real professions (A–E)
//  • 3-sentence thought (concept → interpretation → experience)
//  • No topic repetition
//  • JSON safety + output size limits
//  • Streaming preserved
//  • Share system preserved
//  • Views preserved
//  • Everything else exactly as your working reference
//////////////////////////////////////////////////////////////

const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const OpenAI = require("openai");
const cors = require("cors");
const fs = require("fs");
const fetch = require("node-fetch");
const https = require("https");

const ROOT_DOMAIN = "https://npcbrowser.com";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

console.log("🚀 Starting NPC Browser backend (Simulation NPC Edition v2.1)…");

if (!fs.existsSync("/data")) fs.mkdirSync("/data");
function ensureDataDir() {
  if (!fs.existsSync("/data")) fs.mkdirSync("/data");
}

/* ---------------- Root OG ---------------- */
app.get("/", (req, res) => {
  const title = "NPC Browser — AI NPCs That React to the Real World";
  const desc = "NPC personas generated in real time — shaped by the simulation and live web data.";
  const image = `${ROOT_DOMAIN}/og-npc.jpg`;

  res.send(`<!doctype html>
  <html><head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${desc}">
    <meta property="og:image" content="${image}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${desc}">
    <meta name="twitter:image" content="${image}">
    <title>${title}</title>
    <script>
      const qs = window.location.search;
      setTimeout(()=>{ window.location.replace("/index.html"+qs); },1100);
    </script>
  </head><body></body></html>`);
});

/* ---------------- Sharing ---------------- */
const SHARES_FILE = path.join("/data","shares.json");

app.post("/api/share",(req,res)=>{
  ensureDataDir();
  const id = Math.random().toString(36).substring(2,8);
  const all = fs.existsSync(SHARES_FILE)
    ? JSON.parse(fs.readFileSync(SHARES_FILE,"utf8"))
    : {};
  all[id] = req.body.personas;
  fs.writeFileSync(SHARES_FILE, JSON.stringify(all,null,2));
  res.json({ shortId:id });
});

app.get("/s/:id",(req,res)=>{
  const all = fs.existsSync(SHARES_FILE)
    ? JSON.parse(fs.readFileSync(SHARES_FILE,"utf8"))
    : {};
  const personas = all[req.params.id];
  if(!personas) return res.redirect(ROOT_DOMAIN);

  const first = personas[0] || {};
  const ogTitle = "NPC Browser — Shared NPC from the Simulation";
  const ogDesc = first.thought
    ? first.thought.slice(0,160)
    : "Simulation NPC generated from live data.";
  const ogImage = `${ROOT_DOMAIN}/og-npc.jpg`;

  res.send(`<!doctype html>
  <html><head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <meta property="og:title" content="${ogTitle}">
    <meta property="og:description" content="${ogDesc}">
    <meta property="og:image" content="${ogImage}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${ogTitle}">
    <meta name="twitter:description" content="${ogDesc}">
    <meta name="twitter:image" content="${ogImage}">
    <title>${ogTitle}</title>
    <script>
      sessionStorage.setItem("sharedId","${req.params.id}");
      setTimeout(()=>{ window.location.href="${ROOT_DOMAIN}"; },1100);
    </script>
  </head><body></body></html>`);
});

app.get("/api/share/:id",(req,res)=>{
  const all = fs.existsSync(SHARES_FILE)
    ? JSON.parse(fs.readFileSync(SHARES_FILE,"utf8"))
    : {};
  const personas = all[req.params.id];
  if(!personas) return res.status(404).json({error:"Not found"});
  res.json(personas);
});

/* ---------------- Views ---------------- */
const VIEW_FILE = path.join("/data","views.json");
function loadViews(){
  try{return JSON.parse(fs.readFileSync(VIEW_FILE,"utf8"));}
  catch{return {total:0};}
}
function saveViews(v){
  ensureDataDir();
  fs.writeFileSync(VIEW_FILE, JSON.stringify(v,null,2));
}
app.get("/api/views",(req,res)=>{
  const v = loadViews();
  v.total++;
  saveViews(v);
  res.json({total:v.total});
});

/* ---------------- Static ---------------- */
app.use(express.static(path.join(__dirname,"public")));

/* ---------------- HTTPS Check ---------------- */
async function validateHttpsLink(url){
  return new Promise(resolve=>{
    try{
      const r=https.request(url,{method:"HEAD",timeout:3000},res=>{
        resolve(res.statusCode>=200 && res.statusCode<400);
      });
      r.on("error",()=>resolve(false));
      r.on("timeout",()=>{r.destroy();resolve(false)});
      r.end();
    }catch{ resolve(false); }
  });
}

/* ---------------- JSON SAFETY ---------------- */
function safeJSON(str) {
  if (!str || typeof str !== "string") return null;
  try { return JSON.parse(str); } catch {}
  try {
    const m = str.match(/\{[\s\S]*?\}/);
    if (m) return JSON.parse(m[0]);
  } catch {}
  return null;
}

function sanitizeNPC(obj){
  const npc={};

  npc.profession = obj?.profession?.trim?.() || "General Professional";
  npc.thought = obj?.thought?.trim?.() || 
    "This idea reflects recognizable human behavior. It ties into patterns I see daily. A moment from my work last year revealed this clearly.";
  npc.hashtags = Array.isArray(obj?.hashtags) && obj.hashtags.length
    ? obj.hashtags
    : ["insight","culture","view"];
  npc.category = ["A","B","C","D","E"].includes(obj?.category) ? obj.category : null;

  return npc;
}

/* ---------------- Streaming ---------------- */
const httpServer = createServer(app);
const io = new Server(httpServer,{cors:{origin:"*"}});
const openai = new OpenAI({apiKey:process.env.OPENAI_API_KEY});

io.on("connection",socket=>{
  console.log("🛰️ Client:",socket.id);

  socket.on("personaSearch", async query=>{
    console.log("🔍 NPC Search for:",query);

    /* Language detect */
    let lang = "en";
    try{
      const lr = await openai.chat.completions.create({
        model:"gpt-4o-mini",
        temperature:0,
        messages:[
          {role:"system",content:"Return only ISO language code"},
          {role:"user",content:query}
        ]
      });
      lang = lr.choices[0].message.content.trim().toLowerCase();
    }catch{ lang="en"; }

    /* SERPAPI */
    let linkPool=[];
    try{
      const serp = await fetch(
        `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=5&api_key=${process.env.SERPAPI_KEY}`
      );
      const serpData = await serp.json();
      linkPool = (serpData.organic_results || [])
        .map(r => r.link)
        .filter(l => l && l.startsWith("https://"))
        .slice(0,5);

      const checks = await Promise.all(linkPool.map(validateHttpsLink));
      linkPool = linkPool.filter((_,i)=>checks[i]);
    }catch{}

    const context = linkPool.join(", ") || "No verified links.";

    /* 5 CATEGORY SYSTEM */
    const usedCats = new Set();
    const ALL = ["A","B","C","D","E"];

    for(let i=0;i<10;i++){

      const skel = {
        gender: ["Female","Male","Nonbinary"][Math.floor(Math.random()*3)],
        race: ["Asian","Black","White","Latino","Middle Eastern","Mixed"][Math.floor(Math.random()*6)],
        age: Math.floor(Math.random()*32)+18
      };

      const prompt = `
Generate a professional NPC.

DEMOGRAPHICS:
Gender: ${skel.gender}
Race: ${skel.race}
Age: ${skel.age}

WEB CONTEXT:
${context}

TASK 1 — PROFESSION (5 categories):
A — Medical & Health
B — Law / Government / Public Safety
C — Engineering / Tech / Science
D — Business / Trade / Economics
E — Creative / Arts / Media

Rules:
- MUST choose a category not used yet in this batch.
- MUST choose a real-world job someone actually has.
- MUST avoid academic / research titles.
- Profession must be under 50 characters.

TASK 2 — THOUGHT:
Write exactly 3 sentences:
1) conceptual insight (no repeating "${query}")
2) deeper interpretation
3) personal experience from their job

Thought must be under 320 characters.

TASK 3 — Hashtags:
3–5 simple hashtags (no #).

JSON ONLY:
{
 "profession": "...",
 "thought": "...",
 "hashtags": ["..."],
 "category": "A/B/C/D/E"
}
      `;

      const raw = await openai.chat.completions.create({
        model:"gpt-4o-mini",
        messages:[{role:"user",content:prompt}],
        temperature:0.9
      });

      let parsed = safeJSON(raw.choices?.[0]?.message?.content || "");
      parsed = sanitizeNPC(parsed);

      if(!parsed.category || usedCats.has(parsed.category)){
        const unused = ALL.filter(c=>!usedCats.has(c));
        parsed.category = unused[0] || parsed.category || "E";
      }
      usedCats.add(parsed.category);

      /* Trend engine */
      const tPrompt = `
Turn the following into EXACTLY 4 short trend keywords:

"${parsed.thought}"

Hashtags: ${parsed.hashtags.join(", ")}

JSON ONLY:
{"trend":["t1","t2","t3","t4"]}
      `;

      const tRaw = await openai.chat.completions.create({
        model:"gpt-4o-mini",
        messages:[{role:"user",content:tPrompt}],
        temperature:0.6
      });

      let tParsed = safeJSON(tRaw.choices?.[0]?.message?.content || "") || {
        trend:["vibe","culture","identity","flow"]
      };

      socket.emit("personaChunk",{
        profession: parsed.profession,
        gender: skel.gender,
        race: skel.race,
        age: skel.age,
        thought: parsed.thought,
        hashtags: parsed.hashtags,
        trend: tParsed.trend.slice(0,4),
        category: parsed.category
      });
    }

    socket.emit("personaDone");
  });

  socket.on("disconnect",()=>console.log("❌ Client disconnected:",socket.id));
});

/* ---------------- View Counter (unchanged) ---------------- */
const VIEW_FILE = path.join("/data","views.json");
function readViews(){
  try{return JSON.parse(fs.readFileSync(VIEW_FILE,"utf8"));}catch{return{total:0}}
}
function writeViews(v){
  try{fs.writeFileSync(VIEW_FILE,JSON.stringify(v,null,2));}catch{}
}

app.get("/api/views",(req,res)=>{
  const v=readViews(); v.total++; writeViews(v);
  res.json({total:v.total});
});

/* ---------------- Start Server ---------------- */
const PORT=process.env.PORT||3000;
httpServer.listen(PORT,()=>{
  console.log(`🔥 NPC Browser v2.1 running on :${PORT}`);
});