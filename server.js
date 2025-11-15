// server.js — npcbrowser.com (Simulation NPC Edition)
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

console.log("🚀 Starting NPC Browser backend (Simulation NPC Edition)…");

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
      const serp = await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=5&api_key=${process.env.SERPAPI_KEY
