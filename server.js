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
const stickerPool = ["🤖","👾","⚡","💻","📟","📡","🎶","🎤","✊","📢","🔥","🌈","✨","💖","😍"];
function randomStickers(countMin=3,countMax=6){
  const count=Math.floor(Math.random()*(countMax-countMin+1))+countMin;
  return Array.from({length:count},()=>stickerPool[Math.floor(Math.random()*stickerPool.length)]).join(" ");
}

/* ---------------- Pools ---------------- */
const { TOP50_COSMETICS, TOP_MUSIC, TOP_POLITICS, TOP_AIDROP } = require("./topicPools");

/* ---------------- Description Generator ---------------- */
async function makeDescription(topic,pick){
  let prompt,system;
  if(topic==="cosmetics"){
    prompt=`Write exactly 300 words in a first-person description of using "${pick.product}" by ${pick.brand}. Sensory, photo-realistic, emojis inline.`;
    system="You are a college student talking about beauty.";
  }
  else if(topic==="music"){
    prompt=`Write exactly 300 words in a first-person hype reaction to hearing "${pick.track}" by ${pick.artist}. Emotional, emojis inline.`;
    system="You are a college student reacting to music.";
  }
  else if(topic==="politics"){
    prompt=`Write exactly 300 words in a first-person rant about ${pick.issue}, mentioning ${pick.keyword}. Activist college student voice, emojis inline.`;
    system="You are a college student activist.";
  }
  else{
    prompt=`Write exactly 300 words in a first-person surreal story about ${pick.concept}. Chaotic Gen-Z slang, emojis inline.`;
    system="You are a college student living AI culture.";
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
    // ✅ OP13: Updated with fluorescent lamp + full make-up
    prompt=`Photo-realistic selfie of ${persona} applying ${pick.product} by ${pick.brand}, 
    under bright fluorescent lamp lighting, face shown with make-up fully done and styled, 
    casual candid vibe. Pastel photocard style. Stickers floating around: ${stickers}.`;
  }
  else if(topic==="music"){
    prompt=`Photo-realistic mobile snapshot of ${persona} vibing to "${pick.track}" by ${pick.artist}, 
    messy dorm background, neon accents. Pastel photocard selfie vibe. Stickers floating around: 🎶 💖 ✨ ${stickers}.`;
  }
  else if(topic==="politics"){
    prompt=`Photo-realistic snapshot of ${persona} at a protest about ${pick.issue}, 
    holding a sign about ${pick.keyword}. Background: city street. Stickers floating around: ${stickers}.`;
  }
  else{ // aidrop
    prompt=`Photo-realistic surreal snapshot of ${pick.concept} shown as a cultural object (not a person). 
    Glitchy, holographic neon background with pixel overlays. Floating meme emojis and digital stickers: 🐸 👾 💻 🌐 ✨ ${stickers}.`;
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
    console.error("❌ Empty image response:",out);
  }catch(e){
    console.error("❌ Image error:",e.message);
  }
  return "https://placehold.co/600x600?text=No+Image";
}

/* ---------------- Drop Generator ---------------- */
async function generateDrop(topic){
  let pick;
  if(topic==="cosmetics") pick=TOP50_COSMETICS[Math.floor(Math.random()*TOP50_COSMETICS.length)];
  else if(topic==="music") pick=TOP_MUSIC[Math.floor(Math.random()*TOP_MUSIC.length)];
  else if(topic==="politics") pick=TOP_POLITICS[Math.floor(Math.random()*TOP_POLITICS.length)];
  else pick=TOP_AIDROP[Math.floor(Math.random()*TOP_AIDROP.length)];

  const persona=randomPersona();
  const description=await makeDescription(topic,pick);
  const imageUrl=await generateImageUrl(topic,pick,persona);

  return {
    brand:pick.brand||pick.artist||pick.issue||"323aidrop",
    product:pick.product||pick.track||pick.keyword||pick.concept,
    persona,
    description,
    hashtags:["#NowTrending"],
    image:imageUrl,
    refresh:3000,
    isDaily:false
  };
}

/* ---------------- API ---------------- */
app.get("/api/trend",async(req,res)=>{
  const topic=req.query.topic||"cosmetics";
  const roomId=req.query.room;
  if(!roomId) return res.status(400).json({error:"room parameter required"});
  console.log(`🔄 Live generation: topic=${topic}, room=${roomId}`);
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