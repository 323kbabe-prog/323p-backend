// server.js — AI-Native Persona Browser (Streaming Edition + Cached Results + SSL Validation)
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const OpenAI = require("openai");
const cors = require("cors");
const fs = require("fs");
const fetch = require("node-fetch");
const https = require("https");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

console.log("🚀 Starting AI-Native Persona Browser backend (Streaming + Cache)...");
console.log("OPENAI_API_KEY:", !!process.env.OPENAI_API_KEY);
if (!process.env.OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");

// ensure /data exists
if (!fs.existsSync("/data")) fs.mkdirSync("/data");

app.use(express.static(path.join(__dirname, "public")));
app.use("/aidrop", express.static(path.join(__dirname, "public/aidrop")));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------------- Persona Pools ---------------- */
const ethnicities = ["Korean","Black","White","Latina","Asian-American","Mixed"];
const vibes = [
  "AI founder","tech designer","digital artist","vlogger","streamer","trend forecaster",
  "AR creator","fashion engineer","metaverse curator","AI researcher","sound producer",
  "content strategist","neural-net stylist","startup intern","creative coder"
];
function randomPersona() {
  const ethnicity = ethnicities[Math.floor(Math.random()*ethnicities.length)];
  const vibe = vibes[Math.floor(Math.random()*vibes.length)];
  const first = ["Aiko","Marcus","Sofia","Ravi","Mina","David","Lila","Kenji","Isabella"];
  const last = ["Tanaka","Lee","Martinez","Singh","Park","Johnson","Patel","Kim","Garcia"];
  const name = `${first[Math.floor(Math.random()*first.length)]} ${last[Math.floor(Math.random()*last.length)]}`;
  return `${name}, ${ethnicity} ${vibe}`;
}

/* ---------------- SSL Validator ---------------- */
async function validateHttpsLink(url) {
  return new Promise(resolve=>{
    try {
      const req = https.request(url,{method:"HEAD",timeout:3000},res=>{
        if(res.statusCode>=200 && res.statusCode<400) resolve(true);
        else resolve(false);
      });
      req.on("error",()=>resolve(false));
      req.on("timeout",()=>{req.destroy();resolve(false);});
      req.end();
    } catch { resolve(false); }
  });
}

/* ---------------- File Utilities ---------------- */
const VIEW_FILE = path.join("/data","views.json");
const CACHE_FILE = path.join("/data","personas.json");

function loadViews(){ try{return JSON.parse(fs.readFileSync(VIEW_FILE,"utf8"));}catch{return{total:0};} }
function saveViews(v){ fs.writeFileSync(VIEW_FILE,JSON.stringify(v,null,2)); }

function loadCache(){ try{return JSON.parse(fs.readFileSync(CACHE_FILE,"utf8"));}catch{return[];} }
function saveCache(data){ fs.writeFileSync(CACHE_FILE,JSON.stringify(data,null,2)); }

/* ---------------- API: Views ---------------- */
app.get("/api/views",(req,res)=>{
  const v=loadViews(); v.total++; saveViews(v); res.json({total:v.total});
});

/* ---------------- API: Personas (cached) ---------------- */
app.get("/api/personas",(req,res)=>{
  res.json(loadCache().slice(-50).reverse());
});

/* ---------------- API: One Persona Query (for shared link preload) ---------------- */
app.get("/api/query/:query", (req,res)=>{
  const cache = loadCache();
  const found = cache.find(entry => entry.query.toLowerCase() === decodeURIComponent(req.params.query).toLowerCase());
  if (found) res.json(found.personas);
  else res.status(404).json({error:"not cached"});
});

/* ---------------- Socket.io Streaming ---------------- */
io.on("connection", socket => {
  console.log("🛰️ Client connected:", socket.id);

  socket.on("personaSearch", async query => {
    console.log(`🌐 personaSearch: "${query}"`);

    const cache = loadCache();
    const cachedEntry = cache.find(e => e.query.toLowerCase() === query.toLowerCase());

    // ✅ If cached, return saved personas immediately
    if (cachedEntry) {
      console.log(`⚡ Using cached results for "${query}"`);
      cachedEntry.personas.forEach(p => socket.emit("personaChunk", p));
      socket.emit("personaDone");
      return;
    }

    // Otherwise: generate new ones from OpenAI
    try {
      let linkPool = [];
      try {
        const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=5&api_key=${process.env.SERPAPI_KEY}`;
        const controller = new AbortController();
        const timeout = setTimeout(()=>controller.abort(),5000);
        const serp = await fetch(url,{signal:controller.signal});
        clearTimeout(timeout);
        const serpData = await serp.json();
        linkPool = (serpData.organic_results || [])
          .map(r=>r.link)
          .filter(l=>l && l.startsWith("https://"))
          .slice(0,5);
        const checks = await Promise.all(linkPool.map(validateHttpsLink));
        linkPool = linkPool.filter((_,i)=>checks[i]);
      } catch(e){ console.warn("⚠️ SerpAPI issue:",e.message); }

      const context = linkPool.join(", ") || "No verified links.";

      const prompt = `
You are an AI persona generator connected to live web data.
Use this context about "${query}" but do not repeat it literally.
Generate one persona at a time as valid JSON, for example:
{"persona":"${randomPersona()}","thought":"short first-person note","hashtags":["tag1","tag2","tag3"],"link":"https://example.com"}
After each, append the marker <NEXT>.
Generate up to 10 personas.
Context: ${context}
`;

      const completion = await openai.chat.completions.create({
        model:"gpt-4o-mini",
        stream:true,
        temperature:0.9,
        messages:[
          {role:"system",content:"Output only JSON objects separated by <NEXT>"},
          {role:"user",content:prompt}
        ]
      });

      let buffer="";
      const tryParse = txt => {try{return JSON.parse(txt);}catch{return null;}};
      const newPersonas=[];

      for await (const chunk of completion){
        const text=chunk.choices?.[0]?.delta?.content||"";
        buffer+=text;
        if(buffer.includes("<NEXT>")){
          const parts=buffer.split("<NEXT>");
          const personaText=parts.shift();
          buffer=parts.join("<NEXT>");
          const persona=tryParse(personaText.trim());
          if(persona){
            socket.emit("personaChunk",persona);
            newPersonas.push(persona);
          }
        }
      }

      // save to cache
      if(newPersonas.length>0){
        cache.push({
          query,
          timestamp:new Date().toISOString(),
          personas:newPersonas
        });
        saveCache(cache);
        console.log(`💾 Cached ${newPersonas.length} personas for "${query}"`);
      }

      socket.emit("personaDone");
    } catch (err){
      console.error("❌ Streaming error:",err);
      socket.emit("personaError",err.message);
    }
  });
});

/* ---------------- Start Server ---------------- */
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, ()=>{
  const existing = loadCache();
  console.log(`✅ AI-Native Persona Browser running on :${PORT}`);
  console.log(`📊 Cached topics: ${existing.length}`);
});
