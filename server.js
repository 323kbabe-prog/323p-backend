// server.js — op18 backend (persona + image + voice + credit store + stripe)
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const OpenAI = require("openai");
const cors = require("cors");

const app = express();
app.use(cors({ origin: "*" }));

// ✅ Serve static files from /public so bg1.png … bg10.png work
app.use(express.static(path.join(__dirname, "public")));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const fs = require("fs");

// ---------------- Credit Store ----------------
const USERS_FILE = path.join(__dirname, "users.json");

function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
  } catch {
    return {};
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

// ... your existing persona/image/voice logic ...
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

const descEmojis = [
  "💄","💅","✨","🌸","👑","💖","🪞","🧴","🫧","😍","🌈","🔥","🎶","🎤","🎧","💃",
  "🕺","🏛️","📢","✊","📣","⚡","👾","🤖","📸","💎","🌟","🥰","🌺","🍓","🍭","💫","🎀"
];

const productEmojiMap = {
  "freckle": ["✒️","🖊️","🎨","🪞","✨","🫧"],
  "lip": ["💋","👄","💄","✨","💕"],
  "blush": ["🌸","🌺","💕","✨"],
  "mascara": ["👁️","👀","🖤","💫"],
  "eyeliner": ["✒️","🖊️","👁️","✨"],
  "foundation": ["🧴","🪞","✨","💖"],
};

const vibeEmojiMap = {
  "streetwear model": ["👟","🧢","🕶️","🖤","🤍"],
  "idol": ["🎤","✨","🌟","💎"],
  "dancer": ["💃","🕺","🎶","🔥"],
  "vlogger": ["📸","🎥","💻","🎤"],
  "trainee": ["📓","🎶","💼","🌟"],
  "influencer": ["👑","💖","📸","🌈"],
};

const { TOP50_COSMETICS, TOP_MUSIC, TOP_POLITICS, TOP_AIDROP } = require("./topicPools");

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

/* ---------------- Stripe Setup ---------------- */
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

/* ---------------- Stripe Webhook ---------------- */
// ⚠️ must be BEFORE express.json()
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error("❌ Webhook signature error:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const { userId, credits } = session.metadata || {};

      if (userId && credits) {
        try {
          const users = loadUsers();
          if (!users[userId]) {
            users[userId] = { credits: 0, history: [] };
          }
          users[userId].credits += parseInt(credits, 10);
          users[userId].history.push({
            type: "purchase",
            credits: parseInt(credits, 10),
            at: new Date().toISOString(),
            stripeSession: session.id,
          });
          saveUsers(users);
          console.log(`✅ Added ${credits} credits to ${userId}`);
        } catch (err) {
          console.error("❌ Failed to update user credits:", err.message);
        }
      }
    }

    res.json({ received: true });
  }
);

/* ---------------- JSON middleware ---------------- */
// ✅ now safe to enable for normal APIs
app.use(express.json());

/* ---------------- API: Credits ---------------- */
app.get("/api/credits", (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: "userId required" });

  const user = getUser(userId);
  res.json({ credits: user.credits, history: user.history });
});

/* ---------------- API: Description ---------------- */
app.get("/api/description", async (req,res) => { ... });

/* ---------------- API: Image ---------------- */
app.get("/api/image", async (req,res) => { ... });

/* ---------------- Voice ---------------- */
app.get("/api/voice", async (req,res) => { ... });

/* ---------------- API: Buy Credits ---------------- */
app.post("/api/buy", async (req, res) => { ... });

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
