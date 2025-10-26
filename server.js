// server.js — AI-Native Persona Swap Browser (Persona Reacts to Video)
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

console.log("🚀 Starting AI-Native Persona Swap Browser backend...");
["OPENAI_API_KEY","SERPAPI_KEY","NEWSAPI_KEY","YOUTUBE_API_KEY","RAPIDAPI_KEY","IG_ACCESS_TOKEN"].forEach(k=>{
  console.log(`${k}:`, !!process.env[k]);
});

if (!fs.existsSync("/data")) fs.mkdirSync("/data");
app.use(express.static(path.join(__dirname, "public")));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------------- Persona Pool ---------------- */
const ethnicities = ["Korean","Black","White","Latina","Asian-American","Mixed"];
const vibes = [
  "AI founder","tech designer","digital artist","vlogger","streamer","trend forecaster",
  "AR creator","fashion engineer","metaverse curator","product tester","AI researcher",
  "sound producer","content strategist","neural-net stylist","startup intern","creative coder",
  "virtual stylist","app builder","crypto storyteller","UX dreamer","AI makeup artist",
  "music technologist","motion designer","social media director","brand futurist","AI poet",
  "concept photographer","video remixer","fashion influencer","streetwear archivist",
  "digital journalist","UI visionary","culture hacker","AI choreographer","sound curator",
  "data storyteller","aesthetic researcher","creator-economy coach","AI community host",
  "trend analyst","digital anthropologist","cyber curator","creator engineer","neon editor",
  "AI copywriter","content DJ","tech-fashion hybrid","virtual merch designer","AI film editor",
  "short-form producer","creative technologist"
];
function randomPersona() {
  const ethnicity = ethnicities[Math.floor(Math.random()*ethnicities.length)];
  const vibe = vibes[Math.floor(Math.random()*vibes.length)];
  const firstNames = ["Aiko","Marcus","Sofia","Ravi","Mina","David","Lila","Oliver","Kenji","Isabella"];
  const lastNames = ["Tanaka","Lee","Martinez","Singh","Park","Johnson","Thompson","Patel","Kim","Garcia"];
  const name = `${firstNames[Math.floor(Math.random()*firstNames.length)]} ${lastNames[Math.floor(Math.random()*lastNames.length)]}`;
  return `${name}, ${ethnicity} ${vibe.charAt(0).toUpperCase()+vibe.slice(1)}`;
}

/* ---------------- Persona Search API ---------------- */
app.get("/api/persona-search", async (req,res)=>{
  const query = req.query.query || "latest AI trends";
  console.log(`🌐 Persona Search for: "${query}"`);

  let webContext = "";

  /* --- Step 1: SerpAPI or NewsAPI context --- */
  try {
    const serp = await fetch(
      `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=8&api_key=${process.env.SERPAPI_KEY}`
    );
    const data = await serp.json();
    const results = data.organic_results || [];
    webContext = results.map(r=>`${r.title}: ${r.snippet}`).join(" ");
  } catch (e) {
    console.warn("⚠️ SerpAPI failed:", e.message);
    try {
      const news = await fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&pageSize=5&apiKey=${process.env.NEWSAPI_KEY}`
      );
      const d = await news.json();
      webContext = d.articles?.map(a=>`${a.title}: ${a.description}`).join(" ") || "";
    } catch(e2){ webContext = "No live context available."; }
  }

  /* --- Step 2: Short-form fetch with titles --- */
  let shortLinks = [];
  try {
    // YouTube Shorts
    if (process.env.YOUTUBE_API_KEY) {
      const yt = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query+" shorts")}&maxResults=5&key=${process.env.YOUTUBE_API_KEY}`
      );
      const ytData = await yt.json();
      ytData.items?.forEach(v=>{
        shortLinks.push({ title:v.snippet.title, link:`https://www.youtube.com/shorts/${v.id.videoId}` });
      });
    }
    // TikTok (RapidAPI)
    if (process.env.RAPIDAPI_KEY) {
      const tiktok = await fetch(
        `https://tiktok-scraper-api.p.rapidapi.com/video/search?keywords=${encodeURIComponent(query)}`,
        { headers:{ "X-RapidAPI-Key":process.env.RAPIDAPI_KEY }}
      );
      const ttData = await tiktok.json();
      ttData.data?.slice(0,5).forEach(v=> shortLinks.push({ title:v.title, link:v.url }));
    }
    // Instagram Reels (optional)
    if (process.env.IG_ACCESS_TOKEN && process.env.IG_BUSINESS_ID) {
      const ig = await fetch(
        `https://graph.facebook.com/v18.0/${process.env.IG_BUSINESS_ID}/media?fields=caption,permalink,media_type&access_token=${process.env.IG_ACCESS_TOKEN}`
      );
      const igData = await ig.json();
      igData.data?.filter(x=>x.media_type==="REEL" && x.caption?.toLowerCase().includes(query.toLowerCase()))
        .slice(0,5)
        .forEach(v=> shortLinks.push({ title:v.caption.slice(0,90), link:v.permalink }));
    }
  } catch(e){ console.warn("⚠️ short-form fetch failed:", e.message); }

  if (shortLinks.length===0) {
    shortLinks=[{title:"generic video",link:"https://www.youtube.com/shorts"}];
  }

  /* --- Step 3: GPT prompt --- */
  const prompt = `
You are an AI-Native persona generator.

Topic: "${query}"

Context from web search:
${webContext}

Below are recent short-form videos (titles + links):
${shortLinks.map((v,i)=>`(${i+1}) ${v.title} — ${v.link}`).join("\n")}

For each video, imagine a different AI-native persona reacting to it.
Write what that persona would say about that specific video, in first-person tone.

Output a JSON array of up to 10 entries with:
- "persona": e.g. "${randomPersona()}"
- "thought": what the persona says about that video's topic (max 25 words)
- "hashtags": 3 relevant trending tags (no #)
- "link": that video's link

Output only JSON.
`;

  let raw="",parsed=[];
  try{
    const c=await openai.chat.completions.create({
      model:"gpt-4o-mini",
      temperature:0.9,
      messages:[
        {role:"system",content:"Output only valid JSON arrays, nothing else."},
        {role:"user",content:prompt}
      ]
    });
    raw=c.choices?.[0]?.message?.content?.trim()||"";
    const match=raw.match(/\[[\s\S]*\]/);
    if(match) parsed=JSON.parse(match[0]);
  }catch(e){
    console.error("❌ GPT error:",e.message);
  }
  if(!Array.isArray(parsed)||parsed.length===0){
    parsed=[{
      persona:"Aiko Tanaka, AI nightlife designer",
      thought:"The new rooftop bar in NYC looks unreal—AI lights, smooth beats, and neon cocktails built for Instagram.",
      hashtags:["NYCNightlife","AIDesign","CocktailTrend"],
      link:shortLinks[0].link
    }];
  }
  res.json(parsed);
});

/* ---------------- View Counter ---------------- */
const VIEW_FILE = "/data/views.json";
function loadViews(){try{return JSON.parse(fs.readFileSync(VIEW_FILE,"utf8"))}catch{return{total:0}}}
function saveViews(v){fs.writeFileSync(VIEW_FILE,JSON.stringify(v,null,2))}
app.get("/api/views",(req,res)=>{
  const v=loadViews(); v.total+=1; saveViews(v);
  res.json({total:v.total});
});

/* ---------------- Socket ---------------- */
io.on("connection",s=> s.on("joinRoom",id=> s.join(id)));

/* ---------------- Start ---------------- */
const PORT=process.env.PORT||3000;
httpServer.listen(PORT,()=> console.log(`✅ Backend running on :${PORT}`));