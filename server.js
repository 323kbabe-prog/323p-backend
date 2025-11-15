// server.js — npcbrowser.com (NPC Simulation Edition + Reference Share System + Auto Query Forwarding)

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

console.log("🚀 NPC Browser backend starting…");
console.log("OPENAI_API_KEY:", !!process.env.OPENAI_API_KEY);
console.log("SERPAPI_KEY:", !!process.env.SERPAPI_KEY);

if (!fs.existsSync("/data")) fs.mkdirSync("/data");
function ensureDataDir() {
  if (!fs.existsSync("/data")) fs.mkdirSync("/data");
}

/* ------------------------------------
   Root OG Preview + Redirect
-------------------------------------- */
app.get("/", (req, res) => {
  const title = "NPC Browser — AI NPCs That React to the Real World";
  const desc = "NPC personas generated in real time — shaped by simulation pulses and live web data.";
  const image = `${ROOT_DOMAIN}/og-npc.jpg`;

  res.send(`<!doctype html>
  <html><head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${desc}">
    <meta property="og:image" content="${image}">
    <meta name="twitter:card" content="summary_large_image">
    <title>${title}</title>

    <script>
      const qs = window.location.search;
      setTimeout(()=>{ window.location.replace("/index.html"+qs); },1100);
    </script>
  </head><body></body></html>`);
});

/* ------------------------------------
   Share System (Reference Working Logic)
-------------------------------------- */
const SHARES_FILE = path.join("/data", "shares.json");

app.post("/api/share", (req, res) => {
  try {
    ensureDataDir();
    const id = Math.random().toString(36).substring(2,8);

    const all = fs.existsSync(SHARES_FILE)
      ? JSON.parse(fs.readFileSync(SHARES_FILE,"utf8"))
      : {};

    all[id] = req.body.personas;

    fs.writeFileSync(SHARES_FILE, JSON.stringify(all,null,2));
    res.json({ shortId:id });

  } catch (err) {
    console.error("❌ Share save failed:", err);
    res.status(500).json({ error:"Share failed" });
  }
});

/* ------------------------------------
   /s/:id → OG Preview + Query Forwarding + Redirect
-------------------------------------- */
app.get("/s/:id", (req,res)=>{
  const all = fs.existsSync(SHARES_FILE)
    ? JSON.parse(fs.readFileSync(SHARES_FILE,"utf8"))
    : {};

  const personas = all[req.params.id];
  if (!personas) return res.redirect(ROOT_DOMAIN);

  const first = personas[0] || {};

  const ogTitle = "NPC Browser — Shared NPC Simulation";
  const ogDesc = first.thought
    ? first.thought.slice(0,160)
    : "Simulation-generated NPC.";

  const ogImage = `${ROOT_DOMAIN}/og-npc.jpg`;

  res.send(`<!doctype html>
  <html><head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1.0">

    <meta property="og:title" content="${ogTitle}">
    <meta property="og:description" content="${ogDesc}">
    <meta property="og:image" content="${ogImage}">
    <meta name="twitter:card" content="summary_large_image">
    <title>${ogTitle}</title>

    <script>
      const qs = window.location.search;
      sessionStorage.setItem("sharedId","${req.params.id}");
      setTimeout(()=>{
        window.location.href = "${ROOT_DOMAIN}" + qs;
      },1100);
    </script>
  </head><body></body></html>`);
});

/* ------------------------------------
   Load Shared Personas
-------------------------------------- */
app.get("/api/share/:id", (req,res)=>{
  const all = fs.existsSync(SHARES_FILE)
    ? JSON.parse(fs.readFileSync(SHARES_FILE,"utf8"))
    : {};

  const personas = all[req.params.id];
  if (!personas) return res.status(404).json({ error:"Not found" });

  res.json(personas);
});

/* ------------------------------------
   View Counter
-------------------------------------- */
const VIEW_FILE = path.join("/data","views.json");
function loadViews(){
  try { return JSON.parse(fs.readFileSync(VIEW_FILE,"utf8")); }
  catch { return { total:0 }; }
}
function saveViews(v){
  ensureDataDir();
  fs.writeFileSync(VIEW_FILE, JSON.stringify(v,null,2));
}
app.get("/api/views",(req,res)=>{
  const v=loadViews();
  v.total++;
  saveViews(v);
  res.json({ total:v.total });
});

/* ------------------------------------
   Static Files
-------------------------------------- */
app.use(express.static(path.join(__dirname,"public")));

/* ------------------------------------
   HTTPS Validator
-------------------------------------- */
async function validateHttpsLink(url){
  return new Promise(resolve=>{
    try{
      const req = https.request(
        url,
        { method:"HEAD", timeout:3000 },
        res => resolve(res.statusCode >= 200 && res.statusCode < 400)
      );
      req.on("error",()=>resolve(false));
      req.on("timeout",()=>{ req.destroy(); resolve(false); });
      req.end();
    } catch { resolve(false); }
  });
}

/* ------------------------------------
   Streaming NPC Engine
-------------------------------------- */
const httpServer = createServer(app);
const io = new Server(httpServer,{ cors:{ origin:"*" } });
const openai = new OpenAI({ apiKey:process.env.OPENAI_API_KEY });

io.on("connection", socket=>{
  console.log("🛰️ Client connected:", socket.id);

  socket.on("personaSearch", async query=>{
    console.log("🔍 NPC Query:", query);

    /* Language detect */
    let lang = "en";
    try{
      const lr = await openai.chat.completions.create({
        model:"gpt-4o-mini",
        temperature:0,
        messages:[
          { role:"system", content:"Return only ISO language code" },
          { role:"user", content:query }
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

      linkPool = (serpData.organic_results||[])
        .map(r=>r.link)
        .filter(l=>l && l.startsWith("https://"))
        .slice(0,5);

      const checks = await Promise.all(linkPool.map(validateHttpsLink));
      linkPool = linkPool.filter((_,i)=>checks[i]);

    }catch(e){
      console.warn("SERPAPI issue:", e.message);
    }

    const context = linkPool.join(", ") || "No valid signals.";

    /* NPC Prompt */
    const prompt = `
You are NPC Browser — a simulation engine generating self-aware NPC personas from live web data.

For topic "${query}", generate exactly 10 NPC JSON objects separated by <NEXT>.
Each NPC must follow:

{
  "persona": {
    "gender": "Male/Female/Nonbinary",
    "race": "Asian/Black/White/Latino/etc.",
    "age": "18–49",
    "identity": "NPC role inside the simulation"
  },
  "thought": "First-person reflection from a self-aware NPC describing how '${query}' rewrote their behavior rules. Must mention simulation signals, memory rewrites, prior versions, or data pulses. Tie to real-world signals: ${context}. Include one memory injection.",
  "hashtags": ["#tag1","#tag2","#tag3"]
}

Rules:
- Calm, eerie, philosophical.
- No human names.
- Use simulation metaphors.
- Hashtags must begin with a single #.
- Language: ${lang}.
- Output ONLY JSON, separated by <NEXT>.
`;

    try{
      const completion = await openai.chat.completions.create({
        model:"gpt-4o-mini",
        stream:true,
        temperature:0.95,
        messages:[
          { role:"system",content:"Output JSON only, separated by <NEXT>" },
          { role:"user", content:prompt }
        ]
      });

      let buffer="";

      for await (const chunk of completion){
        const text = chunk.choices?.[0]?.delta?.content || "";
        buffer += text;

        if(buffer.includes("<NEXT>")){
          const parts = buffer.split("<NEXT>");
          for(let i=0;i<parts.length-1;i++){
            try{ socket.emit("personaChunk", JSON.parse(parts[i].trim())); }catch{}
          }
          buffer = parts[parts.length-1];
        }
      }

      if(buffer.trim()){
        try{ socket.emit("personaChunk", JSON.parse(buffer.trim())); }catch{}
      }

      socket.emit("personaDone");

    }catch(err){
      console.error("Streaming error:",err);
      socket.emit("personaError", err.message);
    }

  });
});

/* ------------------------------------
   Start Server
-------------------------------------- */
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, ()=> console.log(`✅ NPC Browser backend running on :${PORT}`));