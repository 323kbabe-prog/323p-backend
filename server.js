// server.js — op19 backend (persona + image + voice + credit store + stripe)
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const OpenAI = require("openai");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors({ origin: "*" }));

// ✅ Serve static files from /public so bg1.png … bg10.png work
app.use(express.static(path.join(__dirname, "public")));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------------- Stripe Setup ---------------- */
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Packs reference Stripe Product Price IDs (from your Dashboard, Test mode now, Live later)
const PACKS = {
  small: { priceId: process.env.STRIPE_PRICE_SMALL, credits: 30 },
  medium: { priceId: process.env.STRIPE_PRICE_MEDIUM, credits: 60 },
  large: { priceId: process.env.STRIPE_PRICE_LARGE, credits: 150 },
};

/* ---------------- Credit Store ---------------- */
// Store users.json on Render's persistent disk
const USERS_FILE = path.join("/data", "users.json");

function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
  } catch {
    return {}; // if file doesn’t exist yet
  }
}

function saveUsers(data) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

let users = loadUsers();

// helper: get or create a user
function getUser(userId) {
  if (!users[userId]) {
    users[userId] = { credits: 5, history: [] }; // 🎁 start with 5 free credits
    saveUsers(users);
  }
  return users[userId];
}

/* ---------------- Persona Generator ---------------- */
function randomPersona() {
  const ethnicities = ["Korean", "Black", "White", "Latina", "Asian-American", "Mixed"];
  const vibes = ["idol", "dancer", "vlogger", "streetwear model", "trainee", "influencer"];
  const styles = ["casual", "glam", "streetwear", "retro", "Y2K-inspired", "minimalist"];
  return `a ${Math.floor(Math.random() * 7) + 17}-year-old female ${
    ethnicities[Math.floor(Math.random() * ethnicities.length)]
  } ${vibes[Math.floor(Math.random() * vibes.length)]} with a ${
    styles[Math.floor(Math.random() * styles.length)]
  } style`;
}

/* ---------------- Emoji Pools ---------------- */
const descEmojis = [
  "💄","💅","✨","🌸","👑","💖","🪞","🧴","🫧","😍","🌈","🔥","🎶","🎤","🎧","💃",
  "🕺","🏛️","📢","✊","📣","⚡","👾","🤖","📸","💎","🌟","🥰","🌺","🍓","🍭","💫","🎀"
];

// Map product keywords to emoji sets
const productEmojiMap = {
  "freckle": ["✒️","🖊️","🎨","🪞","✨","🫧"],
  "lip": ["💋","👄","💄","✨","💕"],
  "blush": ["🌸","🌺","💕","✨"],
  "mascara": ["👁️","👀","🖤","💫"],
  "eyeliner": ["✒️","🖊️","👁️","✨"],
  "foundation": ["🧴","🪞","✨","💖"],
};

// Persona vibe emojis
const vibeEmojiMap = {
  "streetwear model": ["👟","🧢","🕶️","🖤","🤍"],
  "idol": ["🎤","✨","🌟","💎"],
  "dancer": ["💃","🕺","🎶","🔥"],
  "vlogger": ["📸","🎥","💻","🎤"],
  "trainee": ["📓","🎶","💼","🌟"],
  "influencer": ["👑","💖","📸","🌈"],
};

/* ---------------- Pools ---------------- */
const { TOP50_COSMETICS, TOP_MUSIC, TOP_POLITICS, TOP_AIDROP } = require("./topicPools");

/* ---------------- Description Generator ---------------- */
async function makeDescription(topic,pick,persona){
  let prompt,system;

  if(topic==="cosmetics"){
    const lowerProd = (pick.product || "").toLowerCase();
    let prodEmojis = [];
    for(const key in productEmojiMap){
      if(lowerProd.includes(key)){
        prodEmojis = productEmojiMap[key];
        break;
      }
    }

    let vibeEmojis = [];
    for(const vibe in vibeEmojiMap){
      if(persona.includes(vibe)){
        vibeEmojis = vibeEmojiMap[vibe];
        break;
      }
    }

    const emojiSet = [...descEmojis, ...prodEmojis, ...vibeEmojis];

    prompt=`Write exactly 300 words in a first-person description of using "${pick.product}" by ${pick.brand}. 
I am ${persona}. Sensory, photo-realistic. Add emojis inline in every sentence. 
Use emojis generously from this set: ${emojiSet.join(" ")}.`;

    system="You are a college student talking about beauty.";
  }
  else if(topic==="music"){
    prompt=`Write exactly 300 words in a first-person hype reaction to hearing "${pick.track}" by ${pick.artist}. 
Emotional, energetic. Add emojis inline in every sentence. 
Use emojis generously from this set: ${descEmojis.join(" ")}.`;
    system="You are a college student reacting to music.";
  }
  else if(topic==="politics"){
    prompt=`Write exactly 300 words in a first-person rant about ${pick.issue}, mentioning ${pick.keyword}. 
Activist style. Add emojis inline in every sentence. 
Use emojis generously from this set: ${descEmojis.join(" ")}.`;
    system="You are a college student activist.";
  }
  else{
    prompt=`Write exactly 300 words in a first-person surreal story about ${pick.concept}. 
Chaotic Gen-Z slang. Add emojis inline in every sentence. 
Use emojis generously from this set: ${descEmojis.join(" ")}.`;
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
async function generateImageUrl(brand, product, persona) {
  try {
    const out = await openai.images.generate({
      model: "gpt-image-1",
      prompt: `
        Create a photocard-style image.
        Subject: ${persona}, Gen-Z aesthetic.
        They are holding and applying ${product} by ${brand}.
        Pastel gradient background (milk pink, baby blue, lilac).
        Glitter bokeh, glossy K-beauty skin glow.
        Sticker shapes only (hearts, emoji, text emoticon).
      `,
      size: "1024x1024"
    });
    const d = out?.data?.[0];
    if(d?.url) return d.url;
    if(d?.b64_json) return `data:image/png;base64,${d.b64_json}`;
  } catch(e){
    console.error("❌ Image error:",e.message);
  }
  return "https://placehold.co/600x600?text=No+Image";
}

/* ---------------- Stripe Webhook ---------------- */
// ⚠️ Must be BEFORE app.use(express.json())
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("❌ Webhook signature error:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const { userId, credits } = session.metadata || {};

      if (userId && credits) {
        const currentUsers = loadUsers();
        if (!currentUsers[userId]) {
          currentUsers[userId] = { credits: 0, history: [] };
        }
        currentUsers[userId].credits += parseInt(credits, 10);
        currentUsers[userId].history.push({
          type: "purchase",
          credits: parseInt(credits, 10),
          at: new Date().toISOString(),
          stripeSession: session.id,
        });
        saveUsers(currentUsers);
        users = currentUsers;
        console.log(`✅ Added ${credits} credits to ${userId}`);
      }
    }

    res.json({ received: true });
  }
);

/* ---------------- JSON middleware ---------------- */
app.use(express.json());

/* ---------------- API: Credits ---------------- */
app.get("/api/credits", (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: "userId required" });

  const freshUsers = loadUsers();
  const user = freshUsers[userId] || { credits: 5, history: [] };

  res.json({ credits: user.credits });
});

/* ---------------- API: Buy Credits ---------------- */
app.post("/api/buy", async (req, res) => {
  try {
    const { userId, pack } = req.query;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const chosen = PACKS[pack] || PACKS.small;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price: chosen.priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/cancel`,
      metadata: { userId, credits: chosen.credits },
    });

    res.json({ id: session.id, url: session.url });
  } catch (err) {
    console.error("❌ Stripe checkout error:", err.message);
    res.status(500).json({ error: "Checkout failed" });
  }
});

/* ---------------- API: Description ---------------- */
app.get("/api/description", async (req,res) => {
  const topic=req.query.topic||"cosmetics";
  let pick;
  if(topic==="cosmetics") pick=TOP50_COSMETICS[Math.floor(Math.random()*TOP50_COSMETICS.length)];
  else if(topic==="music") pick=TOP_MUSIC[Math.floor(Math.random()*TOP_MUSIC.length)];
  else if(topic==="politics") pick=TOP_POLITICS[Math.floor(Math.random()*TOP_POLITICS.length)];
  else pick=TOP_AIDROP[Math.floor(Math.random()*TOP_AIDROP.length)];

  const persona=randomPersona();
  const description=await makeDescription(topic,pick,persona);

  let mimicLine=null;
  if(topic==="music"){
    mimicLine=`🎶✨ I tried a playful move like ${pick.artist} 😅.`;
  }

  res.json({
    brand:pick.brand||pick.artist||pick.issue||"323aidrop",
    product:pick.product||pick.track||pick.keyword||pick.concept,
    persona,
    description,
    mimicLine,
    hashtags:["#NowTrending"],
    isDaily:false
  });
});

/* ---------------- API: Image ---------------- */
app.get("/api/image", async (req,res) => {
  const brand=req.query.brand;
  const product=req.query.product;
  const persona=req.query.persona;

  if(!brand || !product){
    return res.status(400).json({error:"brand and product required"});
  }

  const imageUrl=await generateImageUrl(brand,product,persona);
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
