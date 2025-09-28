// server.js — OP19$ backend (persona + image + voice + credit store + stripe)
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const OpenAI = require("openai");
const cors = require("cors");
const fs = require("fs");
const Stripe = require("stripe");

const app = express();
app.use(cors({ origin: "*" }));

// ✅ Serve static files from /public so bg1.png … bg10.png work
app.use(express.static(path.join(__dirname, "public")));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ---------------- Credit Store ----------------
const USERS_FILE = path.join("/data", "users.json");

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

function getUser(userId) {
  if (!users[userId]) {
    users[userId] = { credits: 3, history: [] }; // 🎁 starter credits
    saveUsers(users);
  }
  return users[userId];
}

/* ---------------- Persona Generator ---------------- */
let ethnicityIndex = 0;

function randomPersona() {
  const ethnicities = ["Korean", "Black", "White", "Latina", "Asian-American", "Mixed"];
  const vibes = ["idol", "dancer", "vlogger", "streetwear model", "trainee", "influencer"];
  const styles = ["casual", "glam", "streetwear", "retro", "Y2K-inspired", "minimalist"];

  const ethnicity = ethnicities[ethnicityIndex];
  ethnicityIndex = (ethnicityIndex + 1) % ethnicities.length;

  const vibe = vibes[Math.floor(Math.random() * vibes.length)];
  const style = styles[Math.floor(Math.random() * styles.length)];

  return `a ${Math.floor(Math.random() * 7) + 17}-year-old female ${ethnicity} ${vibe} with a ${style} style`;
}

/* ---------------- Emoji Pools ---------------- */
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

/* ---------------- Description Generator ---------------- */
async function makeDescription(topic, pick, persona) {
  let prompt, system;

  if (topic === "cosmetics") {
    const lowerProd = (pick.product || "").toLowerCase();
    let prodEmojis = [];
    for (const key in productEmojiMap) {
      if (lowerProd.includes(key)) { prodEmojis = productEmojiMap[key]; break; }
    }
    let vibeEmojis = [];
    for (const vibe in vibeEmojiMap) {
      if (persona.includes(vibe)) { vibeEmojis = vibeEmojiMap[vibe]; break; }
    }
    const emojiSet = [...descEmojis, ...prodEmojis, ...vibeEmojis];
    prompt = `Write exactly 300 words in a first-person description of using "${pick.product}" by ${pick.brand}.
I am ${persona}. Sensory, photo-realistic. Add emojis inline in every sentence.
Use emojis from: ${emojiSet.join(" ")}`;
    system = "You are a college student talking about beauty.";
  } else if (topic === "music") {
    prompt = `Write exactly 300 words in a first-person hype reaction to hearing "${pick.track}" by ${pick.artist}.
Emotional, energetic. Add emojis inline in every sentence.`;
    system = "You are a college student reacting to music.";
  } else if (topic === "politics") {
    prompt = `Write exactly 300 words in a first-person rant about ${pick.issue}, mentioning ${pick.keyword}.
Activist style. Add emojis inline in every sentence.`;
    system = "You are a college student activist.";
  } else {
    prompt = `Write exactly 300 words in a first-person surreal story about ${pick.concept}.
Chaotic Gen-Z slang. Add emojis inline in every sentence.`;
    system = "You are a college student living AI culture.";
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
    });
    return completion.choices[0].message.content.trim();
  } catch (e) {
    console.error("❌ Description error:", e.message);
    return prompt;
  }
}

/* ---------------- Image Generator ---------------- */
async function generateImageUrl(brand, product, persona) {
  try {
    const out = await openai.images.generate({
      model: "gpt-image-1",
      prompt:`Create a photocard-style image.
        Subject: ${persona}, Gen-Z aesthetic.
        They are holding and applying ${product} by ${brand}.
        Pastel gradient background (milk pink, baby blue, lilac).
        Glitter bokeh, glossy K-beauty skin glow.
        Sticker shapes only (hearts, emoji, text emoticon).
      `,
      size: "1024x1024",
    });
    const d = out?.data?.[0];
    if (d?.url) return d.url;
    if (d?.b64_json) return `data:image/png;base64,${d.b64_json}`;
  } catch (e) {
    console.error("❌ Image error:", e.message);
  }
  return "https://placehold.co/600x600?text=No+Image";
}

/* ---------------- Trending Candidates via GPT ---------------- */
async function fetchTrendingCandidates(topic, limit=20) {
  let prompt;

  if (topic === "cosmetics") {
    prompt = `Give me ${limit} trending beauty products right now in the U.S.
Return JSON array of objects with:
[{ "brand": "Fenty Beauty", "product": "Gloss Bomb", "category": "lip", "trendStart": 1696118400000, "hypeVelocity": 0.9, "relevanceScore": 18 }]`;
  } else if (topic === "music") {
    prompt = `Give me ${limit} trending pop or K-pop songs right now.
Return JSON array of objects with:
[{ "artist": "NewJeans", "track": "Super Shy", "category": "kpop", "trendStart": 1696118400000, "hypeVelocity": 0.8, "relevanceScore": 19 }]`;
  } else if (topic === "politics") {
    prompt = `Give me ${limit} trending political issues right now.
Return JSON array of objects with:
[{ "issue": "climate change", "keyword": "climate", "category": "environment", "trendStart": 1696118400000, "hypeVelocity": 0.7, "relevanceScore": 16 }]`;
  } else {
    prompt = `Give me ${limit} trending AI culture concepts right now.
Return JSON array of objects with:
[{ "concept": "AI-native fashion", "category": "ai-culture", "trendStart": 1696118400000, "hypeVelocity": 0.6, "relevanceScore": 15 }]`;
  }

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    });

    return JSON.parse(res.choices[0].message.content);
  } catch (err) {
    console.error("❌ GPT trending fetch error:", err.message);
    return [];
  }
}

/* ---------------- Drop Selection Algorithm ---------------- */
function calcScore(item, history) {
  let score = 0;

  const ageHours = item.trendStart ? ((Date.now() - item.trendStart) / 3600000) : 12;
  if (ageHours < 24) score += 30;
  else if (ageHours < 24*7) score += 20;
  else if (ageHours < 24*30) score += 10;

  const hype = item.hypeVelocity || 0.5;
  if (hype > 0.8) score += 30;
  else if (hype > 0.5) score += 20;
  else if (hype > 0.2) score += 10;

  if (!history.some(h => h.category === item.category)) score += 20;
  else if (!history.some(h => h.product === item.product)) score += 5;

  score += item.relevanceScore || 10;

  return score;
}

async function chooseDrop(topic, history) {
  const candidates = await fetchTrendingCandidates(topic, 20);
  if (!candidates || candidates.length === 0) {
    console.warn("⚠️ No trending candidates found, falling back.");
    return { brand: "Fallback", product: "AI Drop", category: "general" };
  }

  const scored = candidates.map(c => ({ item: c, score: calcScore(c, history) }));
  scored.sort((a, b) => b.score - a.score);

  const winner = scored[0].item;
  history.push(winner);
  return winner;
}

let dropHistory = [];

/* ---------------- API: Description ---------------- */
app.get("/api/description", async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: "userId required" });

  const user = getUser(userId);
  if (user.credits <= 0) return res.status(403).json({ error: "Out of credits" });

  try {
    const topic = req.query.topic || "cosmetics";
    const pick = await chooseDrop(topic, dropHistory);
    const persona = randomPersona();
    const description = await makeDescription(topic, pick, persona);

    user.credits -= 1;
    saveUsers(users);

    let mimicLine = null;
    if (topic === "music" && pick.artist) {
      mimicLine = `🎶✨ I tried a playful move like ${pick.artist} 😅.`;
    }

    res.json({
      brand: pick.brand || pick.artist || pick.issue || "323aidrop",
      product: pick.product || pick.track || pick.keyword || pick.concept,
      persona,
      description,
      mimicLine,
      hashtags: ["#NowTrending"],
      isDaily: false
    });
  } catch (err) {
    console.error("❌ Drop generation failed:", err.message);
    return res.status(500).json({ error: "Drop generation failed" });
  }
});

/* ---------------- API: Image ---------------- */
app.get("/api/image", async (req,res)=>{
  const { brand, product, persona } = req.query;
  if (!brand || !product) return res.status(400).json({error:"brand and product required"});
  const imageUrl = await generateImageUrl(brand, product, persona);
  res.json({ image: imageUrl });
});

/* ---------------- API: Voice ---------------- */
app.get("/api/voice", async (req, res) => {
  const text = req.query.text || "";
  if (!text.trim()) {
    res.setHeader("Content-Type","audio/mpeg");
    return res.send(Buffer.alloc(1000));
  }
  try {
    const out = await openai.audio.speech.create({
      model:"gpt-4o-mini-tts",
      voice:"alloy",
      input:text
    });
    const audioBuffer = Buffer.from(await out.arrayBuffer());
    res.setHeader("Content-Type","audio/mpeg");
    res.send(audioBuffer);
  } catch (e) {
    console.error("❌ Voice error:", e.message);
    res.status(500).json({error:"Voice TTS failed"});
  }
});

/* ---------------- API: Buy Credits ---------------- */
app.post("/api/buy", async (req,res)=>{
  try {
    const { userId, pack, roomId } = req.query;
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    const packs = {
      small:{amount:300,credits:30},
      medium:{amount:500,credits:60},
      large:{amount:1000,credits:150}
    };
    const chosen = packs[pack] || packs.small;
    const session = await stripe.checkout.sessions.create({
      payment_method_types:["card"],
      mode:"payment",
      line_items:[{
        price_data:{
          currency:"usd",
          product_data:{ name:`${chosen.credits} AI Credits` },
          unit_amount:chosen.amount
        },
        quantity:1
      }],
      allow_promotion_codes:true,
      success_url:`${process.env.CLIENT_URL}/?room=${roomId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:`${process.env.CLIENT_URL}/?room=${roomId}`,
      metadata:{ userId, credits: chosen.credits }
    });
    res.json({ id: session.id, url: session.url });
  } catch(err){
    console.error("❌ Stripe checkout error:", err.message);
    res.status(500).json({error:err.message});
  }
});

/* ---------------- Chat ---------------- */
io.on("connection", socket=>{
  socket.on("joinRoom", roomId => {
    socket.join(roomId);
    socket.roomId = roomId;
  });
});

/* ---------------- Start ---------------- */
app.use(express.static(path.join(__dirname)));
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, ()=>console.log(`🚀 OP19$ backend live on :${PORT}`));
