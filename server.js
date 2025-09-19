// server.js — backend with mimicLine + safe Music image prompts (his/her pronouns)
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
  "Doja Cat": "a playful smirk, one hand squishing cheek and the other tugging bangs",
  "Ice Spice": "wide curious eyes, one hand pulling curls forward and the other resting on chin",
  "NewJeans": "big innocent eyes, both hands pulling bangs forward in a playful pose",
  "Jungkook": "a soft smile, one hand brushing fringe aside and the other hand on neck",
  "The Weeknd": "a serious glare, one hand adjusting eyebrow and the other pushing hair back",
  "Olivia Rodrigo": "pouty lips, one hand resting under chin and the other framing cheek",
  "BLACKPINK": "confident sharp eyes, one hand flipping hair back and the other on jaw",
  "Drake": "a knowing smirk, one hand pointing at eyebrow and the other resting on chin",
  "SZA": "dreamy tilted gaze, one hand under chin and the other lifting wavy hair",
  "Travis Scott": "intense eyes, both hands pulling braids or hair to the sides",
  "Peso Pluma": "a serious look, one hand straightening collar and the other touching hairline",
  "Karol G": "focused eyes, both hands parting long hair away from face",
  "Rema": "playful wide eyes, one hand tugging short twists and the other on cheek",
  "Tyla": "smiling pout, one hand cupping cheek and the other smoothing sleek hair",
  "Billie Eilish": "tired dreamy eyes, one hand pulling hoodie up and the other brushing hair aside",
  "Metro Boomin": "blank intense stare, one hand adjusting cap and the other near mouth",
  "Latto": "a confident smirk, one hand lifting eyebrow and the other flipping hair",
  "Lizzo": "a wide grin, one hand framing cheek and the other lifting hair up high",
  "Dua Lipa": "a serious pout, one hand under chin and the other pushing long hair back",
  "Miley Cyrus": "a wild grin with tongue out, both hands tousling messy hair",
  "Justin Bieber": "a soft smile, one hand tugging hoodie and the other ruffling fringe",
  "The Kid LAROI": "a confused stare, both hands pushing messy blond hair back",
  "Taylor Swift": "wide eyes with red lips, one hand framing chin and the other holding side bangs",
  "Harry Styles": "a gentle grin, one hand adjusting collar and the other brushing hair back",
  "Bad Bunny": "a serious stare, one hand mimicking sunglasses frame and the other on chin",
  "Anitta": "a flirty smirk, one hand tugging hair strands and the other framing lips",
  "Saweetie": "pouty lips, both hands framing jawline dramatically",
  "Lil Nas X": "a mischievous grin, one hand pointing at face and the other pulling hair",
  "Post Malone": "relaxed eyes, one hand scratching head and the other touching jawline",
  "Ariana Grande": "a pout with big eyes, both hands holding up an imaginary high ponytail",
  "Bruno Mars": "a smirk with raised brow, one hand tipping an imaginary hat and the other on chin",
  "Lana Del Rey": "melancholy eyes, one hand resting on cheek and the other brushing hair aside",
  "Billie Eilish (Happier Than Ever)": "a serious stare, one hand brushing blonde bangs and the other under chin",
  "Post Malone & Swae Lee": "relaxed sleepy eyes, one hand rubbing face and the other pushing hair back",
  "Beyoncé": "a confident queenly stare, one hand on hip and the other pushing hair behind ear",
  "ROSALÍA": "an intense pout, one hand under chin and the other pulling long hair back",
  "Lil Baby": "a tight serious gaze, one hand touching chin and the other brushing side fade",
  "Shakira": "a big smile, one hand flipping hair forward and the other framing cheek",
  "Ed Sheeran": "a soft grin, one hand rubbing back of neck and the other tousling ginger hair",
  "Kendrick Lamar": "a serious glare, one hand on chin and the other adjusting collar",
  "Megan Thee Stallion": "a fierce pout, one hand adjusting jawline and the other flipping hair",
  "Nicki Minaj": "dramatic wide eyes, one hand framing lips and the other holding long hair straight",
  "Florence + The Machine": "an ethereal gaze, one hand lifting hair and the other framing cheek",
  "Sam Smith": "a soft serious stare, one hand over heart and the other near cheek",
  "Stray Kids": "a playful grin, both hands lifting bangs playfully off forehead",
  "Seventeen": "idol smile, both hands adjusting styled hair as if mid-performance",
  "IVE": "an intense stare, one hand pushing hair back and the other pointing at lips",
  "LE SSERAFIM": "a bold stare, one hand adjusting bangs and the other on chin",
  "NCT Dream": "a cute grin, both hands pulling bangs forward playfully"
};

/* ---------------- Gender Map for Pronouns ---------------- */
const artistGender = {
  "Doja Cat": "her", "Ice Spice": "her", "NewJeans": "her", "Jungkook": "his",
  "The Weeknd": "his", "Olivia Rodrigo": "her", "BLACKPINK": "her", "Drake": "his",
  "SZA": "her", "Travis Scott": "his", "Peso Pluma": "his", "Karol G": "her",
  "Rema": "his", "Tyla": "her", "Billie Eilish": "her", "Metro Boomin": "his",
  "Latto": "her", "Lizzo": "her", "Dua Lipa": "her", "Miley Cyrus": "her",
  "Justin Bieber": "his", "The Kid LAROI": "his", "Taylor Swift": "her", "Harry Styles": "his",
  "Bad Bunny": "his", "Anitta": "her", "Saweetie": "her", "Lil Nas X": "his",
  "Post Malone": "his", "Ariana Grande": "her", "Bruno Mars": "his", "Lana Del Rey": "her",
  "Billie Eilish (Happier Than Ever)": "her", "Post Malone & Swae Lee": "his",
  "Beyoncé": "her", "ROSALÍA": "her", "Lil Baby": "his", "Shakira": "her",
  "Ed Sheeran": "his", "Kendrick Lamar": "his", "Megan Thee Stallion": "her", "Nicki Minaj": "her",
  "Florence + The Machine": "her", "Sam Smith": "his", "Stray Kids": "his", "Seventeen": "his",
  "IVE": "her", "LE SSERAFIM": "her", "NCT Dream": "his"
};

/* ---------------- Pools ---------------- */
const { TOP50_COSMETICS, TOP_MUSIC, TOP_POLITICS, TOP_AIDROP } = require("./topicPools");

/* ---------------- Description Generator ---------------- */
async function makeDescription(topic,pick){
  let prompt,system;
  if(topic==="cosmetics"){
    prompt=`Write exactly 140 words in a first-person description of using "${pick.product}" by ${pick.brand}. Sensory, photo-realistic, emojis inline.`;
    system="You are a college student talking about beauty.";
  }
  else if(topic==="music"){
    prompt=`Write exactly 140 words in a first-person hype reaction to hearing "${pick.track}" by ${pick.artist}. Emotional, emojis inline.`;
    system="You are a college student reacting to music.";
  }
  else if(topic==="politics"){
    prompt=`Write exactly 140 words in a first-person rant about ${pick.issue}, mentioning ${pick.keyword}. Activist college student voice, emojis inline.`;
    system="You are a college student activist.";
  }
  else{
    prompt=`Write exactly 140 words in a first-person surreal story about ${pick.concept}. Chaotic Gen-Z slang, emojis inline.`;
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
    prompt=`Photo-realistic mobile snapshot of ${persona} applying ${pick.product} by ${pick.brand}, casual candid selfie vibe. Pastel photocard style. Stickers floating around: ${stickers}.`;
  }
  else if(topic==="music"){
    const feature = artistFeatures[pick.artist] || "a dramatic playful expression with improvised hand gestures";
    const pronoun = artistGender[pick.artist] || "their";
    prompt=`Photo-realistic mobile snapshot of ${persona} in their dorm room, playfully trying to imitate ${pronoun} ${feature}. Dorm has posters, laptop, messy desk. Pastel photocard selfie vibe. Stickers floating around: 🎶 💖 ✨ ${stickers}.`;
  }
  else if(topic==="politics"){
    prompt=`Photo-realistic mobile snapshot of ${persona} at a protest about ${pick.issue}, holding a sign about ${pick.keyword}. Background: city street. Stickers floating around: ${stickers}.`;
  }
  else{ // aidrop
    prompt=`Photo-realistic surreal snapshot of ${pick.concept} shown as a cultural object (not a person). Glitchy, holographic neon background with pixel overlays. Floating meme emojis and digital stickers: 🐸 👾 💻 🌐 ✨ ${stickers}.`;
  }

  try{
    const out=await openai.images.generate({
      model:"gpt-image-1",
      prompt,
      size:"1024x1024" // ✅ always square
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

  // ✅ Add mimicLine only for Music
  let mimicLine=null;
  if(topic==="music"){
    const feature = artistFeatures[pick.artist] || "a dramatic playful expression with improvised hand gestures";
    mimicLine=`🎶✨ I tried ${feature} like ${pick.artist} 😅.`;
  }

  return {
    brand:pick.brand||pick.artist||pick.issue||"323aidrop",
    product:pick.product||pick.track||pick.keyword||pick.concept,
    persona,
    description,
    mimicLine,
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
