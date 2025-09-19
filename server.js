// server.js — live-only backend with artist-specific Music mimic algorithm
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

/* ---------------- Artist → Feature Map ---------------- */
const artistFeatures = {
  "Doja Cat": "playful smirk with sharp eyeliner eyes, head tilted slightly",
  "Ice Spice": "wide eyes and curly hair pulled forward around cheeks",
  "NewJeans": "big innocent eyes with bangs covering forehead, soft smile",
  "Jungkook": "gentle smile with fringe slightly covering eyes, boyish charm",
  "The Weeknd": "serious glare with furrowed brows and slicked back hair",
  "Olivia Rodrigo": "intense pouty lips with eyeliner stare",
  "BLACKPINK": "confident bold eyes with hair flipped back",
  "Drake": "raised brows with a knowing smirk and trimmed beard look",
  "SZA": "dreamy eyes with head tilted and long wavy hair",
  "Travis Scott": "intense wide eyes, braided hair pulled by both hands",
  "Peso Pluma": "serious stare with side-swept hair and sharp jawline",
  "Karol G": "serious expression with slightly squinted eyes and long hair parted",
  "Rema": "wide playful eyes with short twisted hair touched by hand",
  "Tyla": "smiling pout with hand on cheek, hair styled sleek back",
  "Billie Eilish": "tired dreamy eyes, hair covering one side of face",
  "Metro Boomin": "straight face with dark cap pulled low, intense gaze",
  "Latto": "confident smirk with raised brow and lip gloss pout",
  "Lizzo": "big expressive eyes and wide grin, hair pulled high",
  "Dua Lipa": "pouty lips with chin up, sleek long hair pushed back",
  "Miley Cyrus": "wild grin with tongue slightly out, tousled hair",
  "Justin Bieber": "soft boyish smile, fringe pushed forward",
  "The Kid LAROI": "confused stare with messy blond hair in face",
  "Taylor Swift": "wide eyes with red lips, side fringe hair style",
  "Harry Styles": "gentle grin with tousled hair and dimples",
  "Bad Bunny": "serious cool look with shaved hairline and shades mimic",
  "Anitta": "flirty smirk with hand playing in long hair",
  "Saweetie": "pouty lips and glamorous hair flip",
  "Lil Nas X": "playful shocked eyes with mischievous grin",
  "Post Malone": "relaxed eyes with slightly open mouth and hand through hair",
  "Ariana Grande": "big eyes with pout, hair styled in high ponytail",
  "Bruno Mars": "smirk with one brow raised, curly hair pushed up",
  "Lana Del Rey": "melancholy eyes with soft parted lips, hand near cheek",
  "Billie Eilish (Happier Than Ever)": "serious tired stare with blonde hair brushed to side",
  "Post Malone & Swae Lee": "relaxed sleepy eyes with casual hair tousle",
  "Beyoncé": "confident sharp eyes with hair pulled back queenly pose",
  "ROSALÍA": "intense stare with pout lips and sleek pulled hair",
  "Lil Baby": "serious tight eyes with short hair touched at sides",
  "Shakira": "big smile with wide eyes and wavy hair pushed forward",
  "Ed Sheeran": "soft eyes with small smile, messy ginger hair",
  "Kendrick Lamar": "serious stare with brows furrowed, short hair cropped",
  "Megan Thee Stallion": "confident pout with hair framing both sides of face",
  "Nicki Minaj": "dramatic wide eyes with bold lip pout, hair pulled long",
  "Florence + The Machine": "ethereal gaze with hand in flowing hair",
  "Sam Smith": "serious stare with slightly parted lips and clean hair",
  "Stray Kids": "bright wide eyes with playful open-mouth smile, styled bangs",
  "Seventeen": "group-idol bright eyes, hair swept with both hands",
  "IVE": "intense idol stare with hair pulled back, lips parted",
  "LE SSERAFIM": "sharp bold eyes with trendy bangs and pout",
  "NCT Dream": "cute playful grin with wide open eyes, bangs styled forward"
};

/* ---------------- Pools ---------------- */
const { TOP50_COSMETICS, TOP_MUSIC, TOP_POLITICS, TOP_AIDROP } = require("./topicPools");

/* ---------------- Description Generator ---------------- */
async function makeDescription(topic,pick){
  let prompt,system;
  if(topic==="cosmetics"){prompt=`Write a 70+ word first-person description of using "${pick.product}" by ${pick.brand}. Sensory, photo-realistic, emojis inline.`;system="You are a college student talking about beauty.";}
  else if(topic==="music"){prompt=`Write a 70+ word first-person hype reaction to hearing "${pick.track}" by ${pick.artist}. Emotional, emojis inline.`;system="You are a college student reacting to music.";}
  else if(topic==="politics"){prompt=`Write a 70+ word rant about ${pick.issue}, mentioning ${pick.keyword}. Activist college student voice, emojis inline.`;system="You are a college student activist.";}
  else{prompt=`Write a 70+ word surreal story about ${pick.concept}. Chaotic Gen-Z slang, emojis inline.`;system="You are a college student living AI culture.";}
  try{
    const completion=await openai.chat.completions.create({model:"gpt-4o-mini",temperature:0.9,messages:[{role:"system",content:system},{role:"user",content:prompt}]});
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
    prompt=`Photo-realistic mobile snapshot of ${persona} applying ${pick.product} by ${pick.brand}, casual candid selfie vibe. Pastel photocard style. Stickers floating around: ${stickers}.`;
  }
  else if(topic==="music"){
    const feature = artistFeatures[pick.artist] || "dramatic stage expression with face and hair adjustments";
    prompt=`Photo-realistic mobile snapshot of ${persona} in their dorm room, playfully trying to imitate ${feature} (inspired by ${pick.artist}). They are using both hands on their face or hair to adjust their eye size, hair style, or facial features in order to mimic the performer’s look. Dorm has posters, laptop, messy desk. Pastel photocard selfie vibe. Stickers floating around: 🎶 💖 ✨ ${stickers}.`;
  }
  else if(topic==="politics"){
    prompt=`Photo-realistic mobile snapshot of ${persona} at a protest about ${pick.issue}, holding a sign about ${pick.keyword}. Background: city street. Stickers floating around: ${stickers}.`;
  }
  else { // aidrop
    prompt=`Photo-realistic surreal snapshot of ${pick.concept} shown as a cultural object (not a person). Glitchy, holographic neon background with pixel overlays. Floating meme emojis and digital stickers: 🐸 👾 💻 🌐 ✨ ${stickers}.`;
  }

  try{
    const out=await openai.images.generate({
      model:"gpt-image-1",
      prompt,
      size:"1024x1024" // ✅ always 1:1 square
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
    const out=await openai.audio.speech.create({model:"gpt-4o-mini-tts",voice:"alloy",input:text});
    const audioBuffer=Buffer.from(await out.arrayBuffer());
    res.setHeader("Content-Type","audio/mpeg");
    res.send(audioBuffer);
  }catch(e){
    console.error("❌ Voice error:",e.message);
    res.status(500).json({error:"Voice TTS failed"});
  }
});

/* ---------------- Chat ---------------- */
io.on("connection",(socket)=>{socket.on("joinRoom",(roomId)=>{socket.join(roomId);socket.roomId=roomId;});});

/* ---------------- Start ---------------- */
app.use(express.static(path.join(__dirname)));
const PORT=process.env.PORT||3000;
httpServer.listen(PORT,()=>console.log(`🚀 Backend live on :${PORT}`));