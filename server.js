//////////////////////////////////////////////////////////////
//  server.js — NPC Browser (Super Agentic Trend Engine v1.0)
//////////////////////////////////////////////////////////////

const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const OpenAI = require("openai");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

console.log("🚀 NPC Browser (Agentic Trend Engine) starting...");
console.log("OPENAI_API_KEY loaded:", !!process.env.OPENAI_API_KEY);

// SAFE JSON PARSER
function safeJSON(str) {
  try { return JSON.parse(str); }
  catch {
    try {
      const match = str.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch {}
  }
  return null;
}

// SPLIT TREND WORDS (fix glued words)
function splitTrendWord(word){
  return word
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[\-_]/g, " ")
    .replace(/([0-9])([A-Za-z])/g, "$1 $2")
    .replace(/([A-Za-z])([0-9])/g, "$1 $2")
    .trim();
}

// LOCATION DETECTOR
function extractLocation(text){
  const LOCATIONS = [
    "LA", "Los Angeles",
    "NYC","New York",
    "Tokyo","Osaka","Kyoto",
    "Paris","London","Berlin",
    "Seoul","Busan",
    "Taipei","Singapore",
    "San Francisco","SF",
    "Chicago","Miami","Toronto"
  ];
  const lower = text.toLowerCase();
  for (let loc of LOCATIONS){
    if(lower.includes(loc.toLowerCase().replace(".", ""))){
      return loc.replace(".", "");
    }
  }
  return null;
}

// RANDOM DEMOGRAPHICS + FIELDS
const genders = ["Female","Male","Nonbinary"];
const races = ["Asian","Black","White","Latino","Middle Eastern","Mixed"];
const ages = [20,21,22,23,24,25];

const fields = [
  "Psychology","Sociology","Computer Science","Economics",
  "Philosophy","Human Biology","Symbolic Systems",
  "Political Science","Mechanical Engineering","Art & Theory",
  "Anthropology","Linguistics","Earth Systems",
  "Media Studies","Cognitive Science"
];

function pickUnique(arr,count){
  const copy=[...arr];
  const selected=[];
  while(selected.length<count && copy.length){
    const idx=Math.floor(Math.random()*copy.length);
    selected.push(copy.splice(idx,1)[0]);
  }
  return selected;
}

// SOCKET + PERSONA ENGINE
const httpServer=createServer(app);
const io=new Server(httpServer,{cors:{origin:"*"}});

io.on("connection", socket=>{
  console.log("🛰️ Client connected:",socket.id);

  socket.on("personaSearch", async query=>{
    try {
      const selectedFields = pickUnique(fields,10);
      const detectedLocation = extractLocation(query);

      for(let i=0;i<10;i++){
        const persona={
          persona:{
            gender:genders[Math.floor(Math.random()*genders.length)],
            race:races[Math.floor(Math.random()*races.length)],
            age:ages[Math.floor(Math.random()*ages.length)],
            identity:selectedFields[i]
          },
          thought:"",
          hashtags:[],
          trend:[]
        };

        // NPC Thought
        const thoughtPrompt=`
IDENTITY:
${persona.persona.gender}, ${persona.persona.race}, ${persona.persona.age}, ${persona.persona.identity}

TOPIC: "${query}"

TASK:
1. Write a 2–3 sentence deep AGENTIC interpretation.
2. Provide 3–5 hashtags (NO # symbols).

Return JSON:
{
  "thought":"...",
  "hashtags":["a","b","c"]
}
        `;

        const resp=await openai.chat.completions.create({
          model:"gpt-4o-mini",
          messages:[{role:"user",content:thoughtPrompt}],
          temperature:0.75
        });

        const parsed=safeJSON(resp.choices?.[0]?.message?.content||"")||{
          thought:"An NPC perspective emerges.",
          hashtags:["vibes","culture","identity"]
        };

        persona.thought=parsed.thought;
        persona.hashtags=parsed.hashtags;

        // TREND ENGINE (AG4 HYBRID)
        const trendPrompt=`
Transform the following into EXACTLY 4 SHORT trend keywords (1–2 words each).
Style: Creative Hybrid (vibe + emotion + aesthetic + culture)
NO punctuation, NO academic terms, NO long phrases.

NPC thought:
"${persona.thought}"

Hashtags:
${persona.hashtags.join(", ")}

User topic:
"${query}"

Return JSON only:
{
  "trend": ["w1","w2","w3","w4"]
}
        `;

        const tResp=await openai.chat.completions.create({
          model:"gpt-4o-mini",
          messages:[{role:"user",content:trendPrompt}],
          temperature:0.55
        });

        let trendParsed = safeJSON(tResp.choices?.[0]?.message?.content||"") ||
          { trend:["vibe","culture","identity","flow"] };

        let trendWords = trendParsed.trend.map(w => splitTrendWord(w));

        // Location override
        if (detectedLocation){
          trendWords[0] = `${detectedLocation} vibe`;
        }

        persona.trend = trendWords.slice(0,4);

        socket.emit("personaChunk",persona);
      }

      socket.emit("personaDone");

    } catch(err){
      console.error("❌ personaSearch error:",err);
      socket.emit("personaError","NPC system error");
    }
  });

  socket.on("disconnect",()=>console.log("❌ Client disconnected:",socket.id));
});

// VIEW COUNTER
const VIEW_FILE="/data/views.json";
function readViews(){try{return JSON.parse(fs.readFileSync(VIEW_FILE,"utf8"));}catch{return{total:0};}}
function writeViews(v){try{fs.writeFileSync(VIEW_FILE,JSON.stringify(v,null,2));}catch{}}

app.get("/api/views",(req,res)=>{
  const v=readViews();
  v.total++;
  writeViews(v);
  res.json({total:v.total});
});

// STATIC FILES
app.use(express.static(path.join(__dirname,"public")));

// START SERVER
const PORT=process.env.PORT||3000;
httpServer.listen(PORT,()=>{
  console.log(`🔥 NPC Browser (Agentic Trend Engine v1.0) running on :${PORT}`);
});