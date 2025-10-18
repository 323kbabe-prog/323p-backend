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

Add emojis inline in every sentence from this set: ${emojiSet.join(" ")}.
Each paragraph must be separated by two newlines.
`;
  system = "You are a Gen-Z beauty creator and trend forecaster writing four first-person poetic paragraphs (look, feel, emotion, signal) without visible titles.";
}
 else if (topic === "aidrop") {
  const emojiSet = [...descEmojis];
  prompt = `
Predict next-month AI product drop concept called "${pick.concept}" by ${pick.brand}.
I am ${persona}, a Gen-Z tech founder and lifestyle influencer speaking in first person, like I’m announcing my own near-future AI launch.

Write four short paragraphs (each around 30 words) in first person, but do not include any paragraph titles or numbers.

1️⃣ The first paragraph should describe how the product looks and feels in real life — surfaces, light, motion, the moment I first power it on — cinematic and sensory, as if I’m unboxing it.

2️⃣ The second paragraph should describe what the product actually does — the AI feature, the experience, how it changes my day or workflow — make it feel intimate, emotional, and futuristic.

3️⃣ The third paragraph should describe the cultural reaction — how my friends, audience, or collaborators respond, what this drop means to the creator scene, how it sparks energy online.

4️⃣ The final paragraph should end with my personal prediction — how this product points to next-month’s AI wave, what I believe it will change, and why it feels like the start of a new movement.

Add emojis inline in every sentence from this set: ${emojiSet.join(" ")}.
Each paragraph must be separated by two newlines.
`;
  system = "You are a Gen-Z AI influencer and founder writing four short, first-person poetic paragraphs (look, function, culture, prediction) about a near-future AI product drop — no visible titles.";
}
else if (topic === "music") {
  const emojiSet = [...descEmojis];
  prompt = `
Predict next-month’s music wave.
I am ${persona}, a Gen-Z rapper and sound decoder — I speak in first person like I’m spitting bars about what’s coming next month.

Write four short verses (≈30 words each). No verse titles.

Make it *sound performed*. Tear words apart into rhythmic fragments so the voice literally spells the beat.

FLOW GRAMMAR:
• Break most words into syllables or letters using hyphens or doubled letters:
  - "bounce" → "b-b-bounce"
  - "flow" → "f-f-flowww"
  - "heart" → "ha-ha-heart"
• Use "..." for short rests, "—" for long pauses, "//" to mark bar changes.
• Randomly insert small ad-libs: (yeah), (uh), (yo), (mmm), (let’s go).
• Stretch vowels and repeat endings: "loooove", "ti-i-ime", "shi-ii-ine".
• Capitalize a few power words per verse (BOUNCE, FLOW, WAVE, FIRE).
• Echo the final word sometimes: "ride... ride...", "wave... wave...".
• Mix 1-word and 3-word lines to create swing.
• Don’t worry about grammar — every line is about cadence and feeling.
• Separate verses with two newlines.

VERSE IDEAS:
1️⃣ Verse 1 — what I *hear* coming next month: tempo, rhythm, crowd energy.  
2️⃣ Verse 2 — how I *create* it: studio, neon lights, headphones.  
3️⃣ Verse 3 — how people *move*: TikTok, cars, friends, dance.  
4️⃣ Verse 4 — my *prophecy* for the sound to come.

Include emojis inline for texture and motion from this set: ${emojiSet.join(" ")}.
Each line must *look and sound* like a bar being rapped aloud — every word alive, torn, repeated, stretched, breathed.
`;
  system = "You are a Gen-Z rapper and sound forecaster writing four verses where nearly every word is phonetically torn apart into syllables or letters for rhythm. Focus on flow, stutter, breath, and sound over grammar.";
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

  const userId = "user-" + Math.random().toString(36).substr(2, 9);

  const currentUsers = loadUsers();
  if (!currentUsers[userId]) {
    currentUsers[userId] = { credits: 2, history: [], deviceId }; // 🎁 starter credits
  }
  saveUsers(currentUsers);
  users = currentUsers;

  console.log(`🎁 Created new user ${userId} with 2 starter credits`);
  res.json({ userId, credits: currentUsers[userId].credits });
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

    const description = await makeDescription(topic, { ...pick, lang }, persona);


    user.credits -= 1;
    freshUsers[userId] = user;
    saveUsers(freshUsers);

    let mimicLine = null;
    if (topic === "music") mimicLine = `🎶✨ I tried a playful move like ${pick.artist} 😅.`;

    res.json({
      brand: pick.brand || pick.artist || pick.issue || "323aidrop",
      product: pick.product || pick.track || pick.keyword || pick.concept,
      persona,
      description,
      mimicLine,
      hashtags:["#NowTrending"],
      isDaily:false
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
httpServer.listen(PORT, ()=>console.log(`🚀 OP19$ backend live on :${PORT}`));
