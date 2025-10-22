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

/* ---------------- AIDROP HISTORY MEMORY ---------------- */
const AIDROP_FILE = path.join("/data", "aidrop_history.json");

function loadAidropHistory() {
  try { return JSON.parse(fs.readFileSync(AIDROP_FILE, "utf-8")); }
  catch { return []; }
}

function saveAidropHistory(arr) {
  // keep only the last 50 to keep prompt short
  fs.writeFileSync(AIDROP_FILE, JSON.stringify(arr.slice(-50), null, 2));
}

// ✅ Logging environment variables on startup
console.log("🚀 Starting OP19$ backend...");
console.log("OPENAI_API_KEY:", !!process.env.OPENAI_API_KEY);
console.log("STRIPE_SECRET_KEY:", !!process.env.STRIPE_SECRET_KEY);
console.log("STRIPE_WEBHOOK_SECRET:", !!process.env.STRIPE_WEBHOOK_SECRET);

// ✅ Make sure /data exists
if (!fs.existsSync("/data")) {
  fs.mkdirSync("/data");
}

// ✅ Serve static files from /public so bg1.png … bg10.png work
app.use(express.static(path.join(__dirname, "public")));

// ✅ Explicitly expose /aidrop folder
app.use('/aidrop', express.static(path.join(__dirname, 'public/aidrop')));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ---------------- Credit Store ----------------
const USERS_FILE = path.join("/data", "users.json");
const MAX_CREDITS = 150; // 🔒 maximum credits allowed

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
    users[userId] = { credits: 2, history: [] }; // 🎁 starter credits
    saveUsers(users);
  }
  return users[userId];
}

/* ---------------- Persona Generator ---------------- */
/* ---------------- Persona Generator — 323AIDROP Expanded ---------------- */
let ethnicityIndex = 0;

function randomPersona() {
  const ethnicities = [
    "Korean", "Black", "White", "Latina", "Asian-American", "Mixed"
  ];

  // 50 modern Gen-Z creator archetypes — tech, AI, and culture
  const vibes = [
    "AI founder", "tech designer", "digital artist", "vlogger", "streamer",
    "trend forecaster", "AR creator", "fashion engineer", "metaverse curator",
    "product tester", "AI researcher", "sound producer", "content strategist",
    "neural-net stylist", "startup intern", "creative coder", "virtual stylist",
    "app builder", "crypto storyteller", "UX dreamer", "AI makeup artist",
    "music technologist", "motion designer", "social media director",
    "brand futurist", "AI poet", "concept photographer", "video remixer",
    "fashion influencer", "streetwear archivist", "digital journalist",
    "UI visionary", "culture hacker", "AI choreographer", "sound curator",
    "data storyteller", "aesthetic researcher", "creator-economy coach",
    "AI community host", "trend analyst", "digital anthropologist",
    "cyber curator", "creator engineer", "neon editor", "AI copywriter",
    "content DJ", "tech-fashion hybrid", "virtual merch designer",
    "AI film editor", "short-form producer", "creative technologist"
  ];

  // Pure Gen-Z style aesthetics
  const styles = [
    "clean girl", "cyber y2k", "soft grunge", "streetwear", "pastel tech",
    "chrome glow", "minimalcore", "vintage remix", "e-girl", "e-boy",
    "retro-futurist", "quiet luxury", "mirror selfie", "AIcore", "blurry nostalgia",
    "glow street", "dream archive", "LA casual", "NYC minimal", "K-pop inspired",
    "oversized fit", "iridescent glam", "techwear", "soft chaos", "loud-calm hybrid",
    "main-character energy", "monochrome mood", "afterlight aesthetic",
    "sunset filter", "glittercore", "vapor minimal", "coquette digital",
    "chrome pastel", "recycled glam", "studio glow", "hazy realism",
    "low-contrast street", "creative uniform", "digital thrift", "pastel glitch",
    "underground luxe", "city casual", "future-retro", "blurred edge",
    "sleek monochrome", "glassy shimmer", "AI street", "motion chic",
    "gen-alpha preview", "calm pop", "glow neutral"
  ];

  const ethnicity = ethnicities[ethnicityIndex];
  ethnicityIndex = (ethnicityIndex + 1) % ethnicities.length;

  const vibe = vibes[Math.floor(Math.random() * vibes.length)];
  const style = styles[Math.floor(Math.random() * styles.length)];
  const age = Math.floor(Math.random() * 6) + 18; // 18–23

  return `a ${age}-year-old ${ethnicity} ${vibe} with a ${style} style`;
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

/* ---------------- Pools ---------------- */
const { TOP50_COSMETICS, TOP_MUSIC, TOP_POLITICS, TOP_AIDROP } = require("./topicPools");

/* ---------------- Description Generator ---------------- */
async function makeDescription(topic, pick, persona) {
  let prompt, system;

if (topic === "cosmetics" || topic === "nextmonth") {
  const emojiSet = [...descEmojis];
  prompt = `
Predict next-month beauty trend for ${pick.product || pick.brand}.
I am ${persona}, speaking from my own experience as a Gen-Z beauty creator who lives and breathes trend signals.

Write four short paragraphs (each around 30 words) in first person, but do not include any paragraph titles or numbers.

1️⃣ The first paragraph should describe upcoming visuals, tones, and materials I notice emerging in beauty looks — how they appear to me and why they catch my eye.

2️⃣ The second paragraph should describe the touch, texture, and sensory experience — how it feels to use or wear, and how that sensation connects to emotion.

3️⃣ The third paragraph should describe the cultural and emotional meaning — how this trend fits into everyday life, mood, and identity, blending what people will love with why it matters.

4️⃣ The final paragraph should end with one key insight or prediction about next-month beauty forecasting — my personal closing thought as a creator, confident yet reflective.

Each paragraph must be separated by two newlines.
`;
  system = "You are a Gen-Z beauty creator and trend forecaster writing four first-person poetic paragraphs (look, feel, emotion, signal) without visible titles.";
}
else if (topic === "aidrop") {
  // 🧠 Load memory of previous concepts
  const pastConcepts = loadAidropHistory();
  const avoidText = pastConcepts.length
    ? `Avoid repeating any of these past app ideas:\n${pastConcepts.map(x => "- " + x).join("\n")}\n\n`
    : "";

  // 🌍 Fetch live Google Trends
  let liveTrendsText = "";
  try {
    const res = await fetch("https://trends.google.com/trending/rss?geo=US");
    const xml = await res.text();
    const matches = [...xml.matchAll(/<title>(.*?)<\/title>/g)].slice(2, 7);
    const topTrends = matches.map(m => m[1]);
    liveTrendsText = `Today's top real trends rn: ${topTrends.join(", ")}.`;
  } catch (err) {
    console.warn("⚠️ Live trend fetch failed:", err.message);
  }

  // 🗣️ Let GPT itself generate a Gen-Z opener dynamically
const openerPrompt = `
Write one short Gen-Z slang opener for a podcast drop.
It should sound like the first line of a Gen-Z founder speaking live, using real slang (like “lowkey”, “ngl”, “it’s giving”, “deadass”, “no cap”).
Keep it under 10 words, end with a dash.
`;

let opener = "";
try {
  const openerResp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 1.0,
    messages: [
      { role: "system", content: "You are a Gen-Z creative voice assistant." },
      { role: "user", content: openerPrompt }
    ]
  });
  opener = openerResp.choices[0].message.content.trim();
} catch (err) {
  console.warn("⚠️ Opener generation failed:", err.message);
  opener = "Lowkey obsessed with this idea —"; // fallback
}

 // 💬 Full persona + slang-driven prompt
  prompt = `
${avoidText}
${liveTrendsText}

You are ${persona}, a Gen-Z founder raised in Los Angeles, speaking like you’re on mic or camera.
You mix L.A. street energy with creative-tech genius — confident, slang-heavy, and emotionally smart.

Tone: talk how real L.A. kids talk online.  

Start with "${opener}" and keep that tone all the way through.

Write four short paragraphs (~35 words each, separated by two newlines):
1️⃣ how you came up with this new AI social app idea — what moment or vibe sparked it.  
2️⃣ what the app actually does, described like you bragging to your crew, not pitching.  
3️⃣ how it changes online culture, creator life, or people’s daily rhythm — make it sound big.  
4️⃣ close with a mic-drop prediction about how this app shifts the timeline — something slick like “mark my words, the internet not ready frfr.”

Every line should read like spoken rhythm — poetic, emotional, confident, slangy.
`;

  system = "You are a Los Angeles Gen-Z founder — bold, street-smart, confident, and emotional, speaking in modern slang and rhythm.";

  // 🧬 Generate the result
  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 1.25,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt }
    ],
  });

  const result = resp.choices[0].message.content.trim();

  // 🧠 Remember to avoid repeats next time
  const conceptLine = result.split("\n")[0];
  pastConcepts.push(conceptLine);
  saveAidropHistory(pastConcepts);

  return result;
}

else if (topic === "music") {
  const emojiSet = [...descEmojis];
  prompt = `
Predict next-month’s music wave.  
I am ${persona}, a Gen-Z rapper performing live, voice full of anger and rhythm.  

Write four short verses.  
Each verse should have several lines formatted exactly like this:  

Uh next month’s sound, it’s underground Uh. 
Uh feel that pound, shake the ground Uh.   

Guidelines:
• Every line begins with “Uh” and ends with “Uh”.  
• Break lines exactly like the example — one short rhythmic phrase per line.  
• Keep all end words in each verse rhyming or sharing the same sound.  
• The tone is aggressive, confident, and slang-heavy.  
• Use natural Gen-Z ad-libs or slang inside the lines (yeah, fr, sheesh, bet, no cap) but never break the visual rhythm.  
• Add emojis inline from this set for energy: ${emojiSet.join(" ")}.  
• Themes: beats, AI, drops, rebellion, crowds, dominance.  

Output only the four verses, each in this line-break rhythm, no extra notes.
`;
  system = "You are a Gen-Z rapper writing four angry freestyle verses about next-month’s music trends. Every line begins and ends with 'Uh' and follows the same visual rhythm and rhyme pattern shown in the example.";
}

  // 🌐 Auto-translate to selected language
  const lang = pick.lang || "en"; // fallback
  if (lang !== "en") {
    prompt = `Translate and write everything in ${
      lang === "zh" ? "Chinese" :
      lang === "kr" ? "Korean" :
      lang === "jp" ? "Japanese" :
      lang === "es" ? "Spanish" :
      lang === "fr" ? "French" : "English"
    }.\n` + prompt;
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
async function generateImageUrl(brand, product, persona, topic = "cosmetics") {
  try {
    let promptText;

    if (topic === "aidrop") {
  // 🌐 Realistic AI Product Reveal — Photocard Style
  promptText = `
Product name: ${product} by ${brand}.
Concept: Create a futuristic hyper-realistic 3D product reveal image that looks like a professional tech or beauty campaign.
Show the product as if it physically exists — premium materials, reflections, studio lighting.
Use cinematic lighting and shallow depth of field (blurred background, crisp focus).
Include elegant surface textures (glass, metal, silicone, or glossy plastic depending on tone).
Color theme: futuristic pastel gradients (white, silver, lilac, blue glow).
Include small clean label text near bottom: "1ai323.ai 🌐🤖".
No humans or faces. Focus purely on the product object and composition.
Keep all elements fully visible — no cropped edges or out-of-frame parts.
`;
} else {
      // 💄 Default (Cosmetics or others)
      promptText = `
Create a photocard-style image.
Subject: ${persona}, Gen-Z aesthetic.
They are holding and applying ${product} by ${brand}.
Pastel gradient background (milk pink, baby blue, lilac).
Glitter bokeh, glossy K-beauty skin glow.
Sticker shapes only (hearts, emoji, text emoticon).
Add text "1ai323.ai 🇺🇸🤖🌴" show 50% near the bottom.
`;
    }

    const out = await openai.images.generate({
      model: "gpt-image-1",
      prompt: promptText,
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

/* ---------------- Webhook ---------------- */
app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
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
        const currentUsers = loadUsers();
        if (!currentUsers[userId]) currentUsers[userId] = { credits: 0, history: [] };

        // ✅ enforce maximum credits (cap at 150)
        currentUsers[userId].credits = Math.min(
          currentUsers[userId].credits + parseInt(credits, 10),
          MAX_CREDITS
        );

        currentUsers[userId].history.push({
          type: "purchase",
          credits: parseInt(credits, 10),
          at: new Date().toISOString(),
          stripeSession: session.id
        });
        saveUsers(currentUsers);
        users = currentUsers;
        console.log(`✅ Added ${credits} credits to ${userId}, total now ${currentUsers[userId].credits}`);
      } catch (err) {
        console.error("❌ Failed to update credits:", err.message);
      }
    }
  }
  res.json({ received: true });
});

/* ---------------- JSON middleware ---------------- */
app.use(express.json());

/* ---------------- API: Create User ---------------- */
app.post("/api/create-user", (req, res) => {
  const deviceId = req.headers["x-device-id"];
  if (!deviceId) return res.status(400).json({ error: "Missing deviceId" });

  const currentUsers = loadUsers();

  // 🚫 If this device has already claimed free credits, return without giving more
  const existingUser = Object.values(currentUsers).find(u => u.deviceId === deviceId);
  if (existingUser) {
    console.log(`⚠️ Device ${deviceId} already has a userId`);
    return res.json({ userId: existingUser.userId, credits: existingUser.credits });
  }

  // ✅ Otherwise, create new user with 2 starter credits
  const userId = "user-" + Math.random().toString(36).substr(2, 9);
  currentUsers[userId] = { userId, deviceId, credits: 2, history: [] };
  saveUsers(currentUsers);

  console.log(`🎁 Created new user ${userId} for device ${deviceId}`);
  res.json({ userId, credits: 2 });
});


/* ---------------- API: Credits ---------------- */
app.get("/api/credits", (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: "userId required" });

  let freshUsers = loadUsers();
  const user = freshUsers[userId] || { credits: 2, history: [] };

  res.json({ credits: user.credits });
});

/* ---------------- API: Description ---------------- */
app.get("/api/description", async (req, res) => {
  const lang = req.query.lang || "en";

  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: "userId required" });

  let freshUsers = loadUsers();
  if (!freshUsers[userId]) {
    freshUsers[userId] = { credits: 2, history: [] };
  }
  const user = freshUsers[userId];

  if (user.credits <= 0) {
    return res.status(403).json({ error: "Out of credits" });
  }

  const topic = req.query.topic || "cosmetics";
  let pick;
  if (topic === "cosmetics") pick = TOP50_COSMETICS[Math.floor(Math.random() * TOP50_COSMETICS.length)];
  else if (topic === "music") pick = TOP_MUSIC[Math.floor(Math.random() * TOP_MUSIC.length)];
  else if (topic === "politics") pick = TOP_POLITICS[Math.floor(Math.random() * TOP_POLITICS.length)];
  else pick = TOP_AIDROP[Math.floor(Math.random() * TOP_AIDROP.length)];

  try {
    const persona = randomPersona();
    if (topic === "nextmonth") {
  const searchPrompt = `Search online signals for next-month trend predictions in ${pick.concept || "beauty and AI"}.
  Focus on Gen-Z tone, products, and creator culture.
  Return 3 short trend keywords or hashtags only, separated by commas.`;
  try {
    const searchResp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a live trend-scanning algorithm." },
        { role: "user", content: searchPrompt }
      ]
    });
    pick.concept = searchResp.choices[0].message.content.trim();
  } catch (err) {
    console.error("⚠️ GPT search fetch failed:", err.message);
  }
}

    // 🎯 Pick or reuse one clear concept name
const conceptName = pick.concept || pick.product || pick.keyword || "AI social app";

// ✅ Pass conceptName into makeDescription so the AI writes about this same concept
const description = await makeDescription(topic, { ...pick, lang, conceptName }, persona);



    user.credits -= 1;
    freshUsers[userId] = user;
    saveUsers(freshUsers);

    let mimicLine = null;
    if (topic === "music") mimicLine = `🎶✨ I tried a playful move like ${pick.artist} 😅.`;

res.json({
  brand: pick.brand || pick.artist || pick.issue || "323aidrop",
  product: pick.conceptName || pick.product || pick.track || pick.keyword || pick.concept,
  concept: pick.conceptName || pick.concept || "AI product idea",
  persona,
  description,
  mimicLine,
  hashtags: ["#NowTrending"],
  isDaily: false,
  insight: "auto-generated technical insight about this founder’s app"
});

  } catch (err) {
    console.error("❌ Description error:", err.message);
    res.status(500).json({ error: "Description generation failed" });
  }
});

/* ---------------- API: Image ---------------- */
app.get("/api/image", async (req,res)=>{
  const { brand, product, persona } = req.query;
  if (!brand || !product) return res.status(400).json({error:"brand and product required"});
  const topic = req.query.topic || "cosmetics";
const imageUrl = await generateImageUrl(brand, product, persona, topic);
  res.json({ image: imageUrl });
});

/* ---------------- API: Voice ---------------- */

app.get("/api/voice", async (req, res) => {
  const lang = req.query.lang || "en";
let voice = "alloy";
if (lang === "kr" || lang === "jp" || lang === "zh") voice = "verse";
if (lang === "es") voice = "coral";
if (lang === "fr") voice = "coral";


  const text = req.query.text || "";
  if (!text.trim()) {
    res.setHeader("Content-Type","audio/mpeg");
    return res.send(Buffer.alloc(1000));
  }
  try {
   const out = await openai.audio.speech.create({
  model: "gpt-4o-mini-tts",
  voice,
  input: text
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
      small:{amount:350,credits:30},   // $3.50  → 30 credits
      medium:{amount:650,credits:60},  // $6.50  → 60 credits
      large:{amount:1450,credits:135}  // $14.50 → 135 credits
    };
    const chosen = packs[pack] || packs.small;

    users = loadUsers();
    const user = getUser(userId);

    // ✅ prevent buying if it would exceed max credits
    if (user.credits >= MAX_CREDITS) {
      return res.status(400).json({ error: "Credit limit reached (max 150)" });
    }
    if (user.credits + chosen.credits > MAX_CREDITS) {
      return res.status(400).json({ error: "Buying this pack would exceed max credits (150)" });
    }

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
/* ---------------- Page View Counter ---------------- */
const VIEW_FILE = path.join("/data", "views.json");

function loadViews() {
  try { return JSON.parse(fs.readFileSync(VIEW_FILE, "utf-8")); }
  catch { return { total: 0 }; }
}
function saveViews(v) {
  fs.writeFileSync(VIEW_FILE, JSON.stringify(v, null, 2));
}

// GET /api/views → increments and returns total
app.get("/api/views", (req, res) => {
  const v = loadViews();
  v.total += 1;
  saveViews(v);
  res.json({ total: v.total });
});

httpServer.listen(PORT, ()=>console.log(`🚀 OP19$ backend live on :${PORT}`));
