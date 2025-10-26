// server.js — AI-Native Persona Browser (Streaming Edition + SSL Validation + Cache + Stable CORS/WebSocket)
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

// ✅ Set correct CORS for your GoDaddy domain
app.use(cors({
  origin: ["https://1ai323.ai"],   // replace with your real domain
  methods: ["GET", "POST"],
  credentials: true
}));

app.use(express.json());

console.log("🚀 Starting AI-Native Persona Browser backend (Streaming Edition + Cache + Stable WebSocket)...");
console.log("OPENAI_API_KEY:", !!process.env.OPENAI_API_KEY);
console.log("SERPAPI_KEY:", !!process.env.SERPAPI_KEY);

if (!fs.existsSync("/data")) fs.mkdirSync("/data");

app.use(express.static(path.join(__dirname, "public")));
app.use("/aidrop", express.static(path.join(__dirname, "public/aidrop")));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ["https://1ai323.ai"], // must match frontend
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ["websocket", "polling"]
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------------- Persona Pool ---------------- */
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

/* ---------------- View Counter ---------------- */
const VIEW_FILE = path.join("/data","views.json");
function loadViews(){ try{return JSON.parse(fs.readFileSync(VIEW_FILE,"utf8"));}catch{return{total:0};} }
function saveViews(v){ fs.writeFileSync(VIEW_FILE,JSON.stringify(v,null,2)); }
app.get("/api/views",(req,res)=>{
  const v=loadViews(); v.total++; saveViews(v); res.json({total:v.total});
});

/* ---------------- Persona Cache ---------------- */
const CACHE_FILE = path.join("/data", "personas.json");
function loadCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")); }
  catch { return []; }
}
function saveCache(data) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
}

/* ---------------- Socket.io Streaming ---------------- */
io.on("connection", socket => {
  console.log("🛰️ Client connected:", socket.id);

  socket.on("personaSearch", async query => {
    console.log(`🌐 Streaming live personas for: "${query}"`);

    // ✅ Check cache first
    const cache = loadCache();
    const cached = cache.find(e => e.query.toLowerCase() === query.toLowerCase());
    if (cached) {
      console.log(`⚡ Serving cached personas for "${query}"`);
      cached.personas.forEach(p => socket.emit("personaChunk", p));
      socket.emit("personaDone");
      return;
    }

    try {
      /* ---- Fetch Live Context (SerpAPI or fallback) ---- */
      let linkPool = [];
      try {
        const serp = await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=5&api_key=${process.env.SERPAPI_KEY}`);
        const serpData = await serp.json();
        linkPool = (serpData.organic_results || [])
          .map(r=>r.link)
          .filter(l=>l && l.startsWith("https://"))
          .slice(0,5);
        const checks = await Promise.all(linkPool.map(validateHttpsLink));
        linkPool = linkPool.filter((_,i)=>checks[i]);
      } catch(e){ console.warn("⚠️ SerpAPI issue:",e.message); }

      const context = linkPool.join(", ") || "No verified links.";

      /* ---- GPT Streaming Prompt ---- */
      const prompt = `
You are an AI persona generator connected to live web data.

Use this context about "${query}" but do not repeat it literally.
Generate one persona at a time as valid JSON, for example:
{"persona":"${randomPersona()}","thought":"short first-person note","hashtags":["tag1","tag2","tag3"],"link":"https://example.com"}
After each, append the marker <NEXT>.
Generate exactly 10 distinct personas, each as a valid JSON object separated by <NEXT>.
Do not stop until all 10 are produced.
Context: ${context}
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        stream: true,
        temperature: 0.6,
        messages: [
          { role:"system", content:"Output only JSON objects separated by <NEXT>" },
          { role:"user", content:prompt }
        ]
      });

      let buffer = "";
const personas = [];

for await (const chunk of completion) {
  const text = chunk.choices?.[0]?.delta?.content || "";
  buffer += text;

  if (buffer.includes("<NEXT>")) {
    const parts = buffer.split("<NEXT>");
    const personaText = parts.shift();
    buffer = parts.join("<NEXT>");
    try {
      const persona = JSON.parse(personaText.trim());
      socket.emit("personaChunk", persona);
      personas.push(persona);

      // 🧠 Update cache live after each persona
      const cache = loadCache();
      let entry = cache.find(e => e.query.toLowerCase() === query.toLowerCase());
      if (!entry) {
        entry = { query, timestamp: new Date().toISOString(), personas: [] };
        cache.push(entry);
      }
      entry.personas = personas; // overwrite each time so it stays complete
      saveCache(cache);
      console.log(`💾 Cache updated (${personas.length}) for "${query}"`);
    } catch { /* skip partials */ }
  }
}
      // 🔄 Flush any leftover JSON after stream end
if (buffer.trim().length > 0) {
  try {
    const persona = JSON.parse(buffer.trim());
    socket.emit("personaChunk", persona);
    personas.push(persona);
    console.log("🧩 Flushed final persona from buffer");
  } catch { /* ignore partial fragments */ }
}


// ✅ Ensure cache includes all 10 after stream complete
if (personas.length > 0) {
  try {
    const cache = loadCache();
    let entry = cache.find(e => e.query.toLowerCase() === query.toLowerCase());
    if (!entry) {
      entry = { query, timestamp: new Date().toISOString(), personas };
      cache.push(entry);
    } else {
      entry.personas = personas;
    }
    saveCache(cache);
    console.log(`✅ Final cache complete (${personas.length}) for "${query}"`);
  } catch (e) {
    console.warn("⚠️ Failed to finalize cache:", e.message);
  }
}

      // ✅ Save to cache after full generation
      if (personas.length > 0) {
        try {
          const cache = loadCache();
          cache.push({ query, timestamp: new Date().toISOString(), personas });
          saveCache(cache);
          console.log(`💾 Cached ${personas.length} personas for "${query}"`);
        } catch (e) {
          console.warn("⚠️ Failed to save cache:", e.message);
        }
      }

      socket.emit("personaDone");
    } catch (err) {
      console.error("❌ Streaming error:", err);
      socket.emit("personaError", err.message);
    }
  });
});

/* ---------------- Start Server ---------------- */
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`✅ AI-Native Persona Browser (Streaming + Cache + Stable WebSocket) running on :${PORT}`);
});
