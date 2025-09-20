// server.js — op12: cosmetics only, synced product + sequential logs
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const OpenAI = require("openai");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "*" }));
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------------- Persona ---------------- */
function randomPersona() {
  return "a young college student";
}

/* ---------------- Stickers ---------------- */
const stickerPool = ["💖","✨","😍","💄","🌈","👾","🌟","💅","📸","🦄","🍓","🥤"];
function randomStickers(countMin=3,countMax=6){
  const count=Math.floor(Math.random()*(countMax-countMin+1))+countMin;
  return Array.from({length:count},()=>stickerPool[Math.floor(Math.random()*stickerPool.length)]).join(" ");
}

/* ---------------- Pools ---------------- */
const { TOP50_COSMETICS } = require("./topicPools");

/* ---------------- Description Generator ---------------- */
async function makeDescription(topic,pick){
  let prompt,system;
  if(topic==="cosmetics"){
    prompt=`Write exactly 300 words in a first-person description of using "${pick.product}" by ${pick.brand}. 
    Sensory, photo-realistic, emojis inline.`;
    system="You are a college student beauty vlogger.";
  }

  try{
    const completion=await openai.chat.completions.create({
      model:"gpt-4o-mini",
      temperature:0.9,
      messages:[{role:"system",content:system},{role:"user",content:prompt}]
    });
    return completion.choices[0].message.content.trim();
  }catch(e){
    console.error("❌ Description error:",e.message);
    return prompt;
  }
}

/* ---------------- Image Generator ---------------- */
async function generateImageUrl(topic,pick,persona){
  const stickers=randomStickers();
  let prompt="";

  if(topic==="cosmetics"){
    prompt=`Photo-realistic selfie of ${persona} applying ${pick.product} by ${pick.brand}, 
    casual candid vibe in a college setting. Pastel photocard style. 
    Stickers floating around: ${stickers}.`;
  }

  try{
    const out=await openai.images.generate({
      model:"gpt-image-1",
      prompt,
      size:"1024x1024"
    });
    const d=out?.data?.[0];
    if(d?.url) return d.url;
    if(d?.b64_json) return `data:image/png;base64,${d.b64_json}`;
  }catch(e){
    console.error("❌ Image error:",e.message);
  }
  return "https://placehold.co/600x600?text=No+Image";
}

/* ---------------- Drop Generator ---------------- */
async function generateDrop(topic){
  let pick;
  if(topic==="cosmetics"){
    // ✅ Random product picked once
    pick=TOP50_COSMETICS[Math.floor(Math.random()*TOP50_COSMETICS.length)];
  }

  const persona=randomPersona();

  // Sequential generation
  console.log("✍️ drafting description…");
  const description=await makeDescription(topic,pick);
  console.log("✅ description ready");

  console.log("🔊 voice task queued (frontend will play TTS)…");

  console.log("🖼️ rendering image…");
  const imageUrl=await generateImageUrl(topic,pick,persona);
  if(imageUrl && !imageUrl.includes("placehold")){
    console.log("✅ image ready");
  } else {
    console.log("❌ image error / placeholder returned");
  }

  console.log("⚡ drop fully generated\n");

  return {
    brand:pick.brand,
    product:pick.product,
    persona,
    description,
    image:imageUrl,
    hashtags:["#NowTrending"],
    refresh:3000,
    isDaily:false
  };
}

/* ---------------- API: Drop ---------------- */
app.get("/api/trend",async(req,res)=>{
  const topic="cosmetics"; // ✅ Only cosmetics
  const roomId=req.query.room;
  if(!roomId) return res.status(400).json({error:"room parameter required"});

  console.log(`🔄 Live generation started for room=${roomId}, topic=${topic}`);
  const drop=await generateDrop(topic);
  res.json(drop);
});

/* ---------------- Voice ---------------- */
app.get("/api/voice",async(req,res)=>{
  const text=req.query.text||"";
  if(!text.trim()){res.setHeader("Content-Type","audio/mpeg");return res.send(Buffer.alloc(1000));}
  try{
    const out=await openai.audio.speech.create({
      model:"gpt-4o-mini-tts",
      voice:"alloy",
      input:text,
    });
    const audioBuffer=Buffer.from(await out.arrayBuffer());
    res.setHeader("Content-Type","audio/mpeg");
    res.send(audioBuffer);
  }catch(e){
    console.error("❌ Voice error:",e.message);
    res.status(500).json({error:"Voice TTS failed"});
  }
});

/* ---------------- Chat ---------------- */
io.on("connection",(socket)=>{
  socket.on("joinRoom",(roomId)=>{
    socket.join(roomId);
    socket.roomId=roomId;
  });
});

/* ---------------- Start ---------------- */
app.use(express.static(path.join(__dirname)));
const PORT=process.env.PORT||3000;
httpServer.listen(PORT,()=>console.log(`🚀 Backend live on :${PORT}`));