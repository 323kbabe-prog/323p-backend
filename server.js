// server.js — op14: cosmetics only, backend split description → image
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
async function makeDescription(pick){
  const prompt=`Write exactly 300 words in a first-person description of using "${pick.product}" by ${pick.brand}. 
  Sensory, photo-realistic, emojis inline.`;
  const system="You are a college student beauty vlogger.";

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
async function generateImageUrl(pick,persona){
  const stickers=randomStickers();
  const prompt=`Photo-realistic influencer-style photocard. 
  Close-up selfie of ${persona} clearly holding and applying the product "${pick.product}" by ${pick.brand}. 
  The ${pick.product} must be visible in the image. 
  Glossy skin, full make-up, pastel background with fluorescent lighting. 
  Floating emoji stickers: ${stickers}.`;

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

/* ---------------- API: Description ---------------- */
app.get("/api/description",async(req,res)=>{
  // Pick product once
  const pick=TOP50_COSMETICS[Math.floor(Math.random()*TOP50_COSMETICS.length)];
  console.log(`💄 product chosen: ${pick.brand} — ${pick.product}`);

  const persona=randomPersona();

  console.log("✍️ drafting description…");
  const description=await makeDescription(pick);
  console.log("✅ description ready");

  res.json({
    brand:pick.brand,
    product:pick.product,
    persona,
    description
  });
});

/* ---------------- API: Image ---------------- */
app.get("/api/image",async(req,res)=>{
  const brand=req.query.brand;
  const product=req.query.product;
  const persona=randomPersona();

  if(!brand || !product){
    return res.status(400).json({error:"brand and product required"});
  }

  console.log(`🖼️ rendering image for: ${brand} — ${product}`);
  const imageUrl=await generateImageUrl({brand,product},persona);
  console.log("✅ image ready");

  res.json({ image:imageUrl });
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