// server.js — AI-Native Persona Browser (Streaming + SSL Validation + Drop Save Mode)
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

console.log("🚀  Starting AI-Native Persona Browser backend…");
console.log("OPENAI_API_KEY:", !!process.env.OPENAI_API_KEY);

if (!fs.existsSync("/data")) fs.mkdirSync("/data", { recursive: true });
app.use(express.static(path.join(__dirname, "public")));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------- Persona Pool ---------- */
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
  const last  = ["Tanaka","Lee","Martinez","Singh","Park","Johnson","Patel","Kim","Garcia"];
  return `${first[Math.floor(Math.random()*first.length)]} ${last[Math.floor(Math.random()*last.length)]}, ${ethnicity} ${vibe}`;
}

/* ---------- HTTPS Validator ---------- */
async function validateHttpsLink(url){
  return new Promise(resolve=>{
    try{
      const req=https.request(url,{method:"HEAD",timeout:3000},res=>{
        res.statusCode>=200&&res.statusCode<400?resolve(true):resolve(false);
      });
      req.on("error",()=>resolve(false));
      req.on("timeout",()=>{req.destroy();resolve(false);});
      req.end();
    }catch{resolve(false);}
  });
}

/* ---------- View Counter ---------- */
const VIEW_FILE=path.join("/data","views.json");
function loadViews(){try{return JSON.parse(fs.readFileSync(VIEW_FILE,"utf8"));}catch{return{total:0};}}
function saveViews(v){fs.writeFileSync(VIEW_FILE,JSON.stringify(v,null,2));}
app.get("/api/views",(req,res)=>{
  const v=loadViews();v.total++;saveViews(v);res.json({total:v.total});
});

/* ---------- Drop Save / Load ---------- */
const DROP_DIR=path.join("/data","drops");
if(!fs.existsSync(DROP_DIR))fs.mkdirSync(DROP_DIR,{recursive:true});

// Save
app.post("/api/save-drop",(req,res)=>{
  try{
    const id=Date.now().toString(36)+Math.random().toString(36).slice(2,8);
    const file=path.join(DROP_DIR,`${id}.json`);
    fs.writeFileSync(file,JSON.stringify(req.body,null,2));
    console.log(`💾  Saved drop: ${id}`);
    res.json({id});
  }catch(e){
    console.error("❌ Save drop error:",e);
    res.status(500).json({error:"failed to save drop"});
  }
});

// Load
app.get("/api/drop/:id",(req,res)=>{
  const file=path.join(DROP_DIR,`${req.params.id}.json`);
  if(!fs.existsSync(file))return res.status(404).json({error:"not found"});
  res.sendFile(file);
});

/* ---------- Streaming via Socket.io ---------- */
io.on("connection",socket=>{
  console.log("🛰️ Client connected:",socket.id);

  socket.on("personaSearch",async query=>{
    console.log(`🌐 Streaming personas for: "${query}"`);
    try{
      // Live context
      let links=[];
      try{
        const serp=await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=5&api_key=${process.env.SERPAPI_KEY}`);
        const data=await serp.json();
        links=(data.organic_results||[]).map(r=>r.link).filter(l=>l&&l.startsWith("https://")).slice(0,5);
        const ok=await Promise.all(links.map(validateHttpsLink));
        links=links.filter((_,i)=>ok[i]);
      }catch(e){console.warn("⚠️ SerpAPI:",e.message);}
      const ctx=links.join(", ")||"No verified links.";

      const prompt=`
You are an AI persona generator connected to live web data.
Use this context about "${query}" but do not repeat it literally.
Generate one persona at a time as valid JSON, for example:
{"persona":"${randomPersona()}","thought":"short first-person note","hashtags":["tag1","tag2","tag3"],"link":"https://example.com"}
After each, append <NEXT>. Generate up to 10 personas.
Context: ${ctx}`;

      const completion=await openai.chat.completions.create({
        model:"gpt-4o-mini",
        stream:true,
        temperature:0.9,
        messages:[
          {role:"system",content:"Output only JSON objects separated by <NEXT>"},
          {role:"user",content:prompt}
        ]
      });

      let buf="";
      for await (const chunk of completion){
        const txt=chunk.choices?.[0]?.delta?.content||"";
        buf+=txt;
        if(buf.includes("<NEXT>")){
          const parts=buf.split("<NEXT>");
          const one=parts.shift();
          buf=parts.join("<NEXT>");
          try{
            const persona=JSON.parse(one.trim());
            socket.emit("personaChunk",persona);
          }catch{}
        }
      }
      socket.emit("personaDone");
    }catch(e){
      console.error("❌ Stream error:",e);
      socket.emit("personaError",e.message);
    }
  });
});

/* ---------- Start Server ---------- */
const PORT=process.env.PORT||3000;
httpServer.listen(PORT,()=>console.log(`✅ AI-Native Persona Browser running on :${PORT}`));
