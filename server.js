// server.js — OP19$ backend (persona + image + voice + credit store + stripe + streaming)
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

console.log("🚀 Starting OP19$ backend...");
console.log("OPENAI_API_KEY:", !!process.env.OPENAI_API_KEY);
console.log("STRIPE_SECRET_KEY:", !!process.env.STRIPE_SECRET_KEY);
console.log("STRIPE_WEBHOOK_SECRET:", !!process.env.STRIPE_WEBHOOK_SECRET);

if (!fs.existsSync("/data")) fs.mkdirSync("/data");

app.use(express.static(path.join(__dirname, "public")));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ---------------- Credit Store ----------------
const USERS_FILE = path.join("/data", "users.json");
const MAX_CREDITS = 150;

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
    users[userId] = { credits: 2, history: [] };
    saveUsers(users);
  }
  return users[userId];
}

// ---------------- Persona Generator ----------------
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

// ---------------- Emoji Pools ----------------
const descEmojis = [
  "💄","💅","✨","🌸","👑","💖","🪞","🧴","🫧","😍","🌈","🔥","🎶","🎤","🎧","💃",
  "🕺","🏛️","📢","✊","📣","⚡","👾","🤖","📸","💎","🌟","🥰","🌺","🍓","🍭","💫","🎀"
];

// ---------------- Pools ----------------
const { TOP50_COSMETICS, TOP_MUSIC, TOP_POLITICS, TOP_AIDROP } = require("./topicPools");

// ---------------- Description Generator ----------------
async function makeDescription(topic, pick, persona) {
  let prompt, system;
  if (topic === "cosmetics" || topic === "nextmonth") {
    const emojiSet = [...descEmojis];
    prompt = `Write 3 paragraphs each 40 words predicting next-month beauty trends and 3 hashtags for ${pick.product || pick.brand}.
I am ${persona}.
Speak like a Gen-Z beauty analyst + creator — emotional yet logical.
Blend sensory forecasting (what people will love) and product decoding (why it matters).
End with one clear “next-month signal” line.
Add emojis inline in every sentence from: ${emojiSet.join(" ")}`;
    system = "You are a creative trend forecaster describing next-month beauty logic and signals.";
  } else if (topic === "music") {
    prompt = `Write exactly 300 words in a first-person hype reaction to hearing "${pick.track}" by ${pick.artist}.
Emotional, energetic. Add emojis inline in every sentence.`;
    system = "You are a college student reacting to music.";
  } else if (topic === "politics") {
    prompt = `Write exactly 150 words in a first-person rant about ${pick.issue}, mentioning ${pick.keyword}.
Activist style. Add emojis inline in every sentence.`;
    system = "You are a college student activist.";
  } else if (topic === "aidrop") {
    prompt = `Write 3 paragraphs each 40 words and 3 hashtags in a first-person influencer-style description introducing a near-future AI product idea.
The product name is "${pick.concept}" by ${pick.brand}.
I am ${persona}.
Tone: Gen-Z founder + lifestyle influencer — confident, emotional, sensory, slightly surreal but realistic.
The product must feel like a real tech drop about to launch within months.
Include both technical and emotional elements.
Add emojis inline in every sentence, keep the pacing like a TikTok narration.
Mention one or two real-sounding use cases and feelings.
Avoid repeating brand or concept.`;
    system = "You are a Gen-Z tech influencer describing a futuristic AI product drop in first person, emotionally sharp and stylish.";
  }

  const lang = pick.lang || "en";
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

// ---------------- Image Generator ----------------
async function generateImageUrl(brand, product, persona, topic = "cosmetics") {
  try {
    let promptText;
    if (topic === "aidrop") {
      promptText = `
Product name: ${product} by ${brand}.
Concept: Create a futuristic hyper-realistic 3D product reveal image that looks like a professional tech or beauty campaign.
Show the product as if it physically exists — premium materials, reflections, studio lighting.
Use cinematic lighting and shallow depth of field.
Include elegant surface textures (glass, metal, silicone, glossy plastic).
Color theme: futuristic pastel gradients (white, silver, lilac, blue glow).
Include small clean label text near bottom: "1ai323.ai 🌐🤖".
No humans or faces. Focus purely on the product object.`;
    } else {
      promptText = `
Create a photocard-style image.
Subject: ${persona}, Gen-Z aesthetic.
They are holding and applying ${product} by ${brand}.
Pastel gradient background (milk pink, baby blue, lilac).
Glitter bokeh, glossy K-beauty skin glow.
Sticker shapes only (hearts, emoji, text emoticon).
Add text "1ai323.ai 🇺🇸🤖🌴" show 50% near the bottom.`;
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

// ---------------- Webhook ----------------
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
      const currentUsers = loadUsers();
      if (!currentUsers[userId]) currentUsers[userId] = { credits: 0, history: [] };
      currentUsers[userId].credits = Math.min(
        currentUsers[userId].credits + parseInt(credits, 10),
        MAX_CREDITS
      );
      currentUsers[userId].history.push({
        type: "purchase",
        credits: parseInt(credits, 10),
        at: new Date().toISOString(),
        stripeSession: session.id,
      });
      saveUsers(currentUsers);
      users = currentUsers;
      console.log(`✅ Added ${credits} credits to ${userId}, total now ${currentUsers[userId].credits}`);
    }
  }
  res.json({ received: true });
});

app.use(express.json());

// ---------------- API Routes ----------------
app.post("/api/create-user", (req, res) => {
  const deviceId = req.headers["x-device-id"];
  if (!deviceId) return res.status(400).json({ error: "Missing deviceId" });
  const userId = "user-" + Math.random().toString(36).substr(2, 9);
  const currentUsers = loadUsers();
  if (!currentUsers[userId]) currentUsers[userId] = { credits: 2, history: [], deviceId };
  saveUsers(currentUsers);
  users = currentUsers;
  console.log(`🎁 Created new user ${userId} with 2 starter credits`);
  res.json({ userId, credits: currentUsers[userId].credits });
});

app.get("/api/credits", (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: "userId required" });
  const fresh = loadUsers();
  const user = fresh[userId] || { credits: 2, history: [] };
  res.json({ credits: user.credits });
});

app.get("/api/image", async (req, res) => {
  const { brand, product, persona } = req.query;
  if (!brand || !product) return res.status(400).json({ error: "brand and product required" });
  const topic = req.query.topic || "cosmetics";
  const imageUrl = await generateImageUrl(brand, product, persona, topic);
  res.json({ image: imageUrl });
});

app.get("/api/voice", async (req, res) => {
  const lang = req.query.lang || "en";
  let voice = "alloy";
  if (["kr", "jp", "zh"].includes(lang)) voice = "verse";
  if (["es", "fr"].includes(lang)) voice = "coral";
  const text = req.query.text || "";
  if (!text.trim()) {
    res.setHeader("Content-Type", "audio/mpeg");
    return res.send(Buffer.alloc(1000));
  }
  try {
    const out = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice,
      input: text,
    });
    const audioBuffer = Buffer.from(await out.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(audioBuffer);
  } catch (e) {
    console.error("❌ Voice error:", e.message);
    res.status(500).json({ error: "Voice TTS failed" });
  }
});

app.post("/api/buy", async (req, res) => {
  try {
    const { userId, pack, roomId } = req.query;
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    const packs = {
      small: { amount: 350, credits: 30 },
      medium: { amount: 650, credits: 60 },
      large: { amount: 1450, credits: 135 },
    };
    const chosen = packs[pack] || packs.small;
    users = loadUsers();
    const user = getUser(userId);
    if (user.credits >= MAX_CREDITS)
      return res.status(400).json({ error: "Credit limit reached (max 150)" });
    if (user.credits + chosen.credits > MAX_CREDITS)
      return res.status(400).json({ error: "Buying this pack would exceed max credits (150)" });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: `${chosen.credits} AI Credits` },
          unit_amount: chosen.amount,
        },
        quantity: 1,
      }],
      allow_promotion_codes: true,
      success_url: `${process.env.CLIENT_URL}/?room=${roomId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/?room=${roomId}`,
      metadata: { userId, credits: chosen.credits },
    });
    res.json({ id: session.id, url: session.url });
  } catch (err) {
    console.error("❌ Stripe checkout error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ---------------- Streaming Description via Socket ----------------
io.on("connection", socket => {
  socket.on("joinRoom", roomId => {
    socket.join(roomId);
    socket.roomId = roomId;
  });

  socket.on("startDescription", async ({ topic, userId, lang, roomId }) => {
    console.log(`🎬 startDescription for ${topic} | ${userId}`);
    try {
      const persona = randomPersona();
      const allUsers = loadUsers();
      const user = allUsers[userId] || getUser(userId);
      if (user.credits <= 0) {
        io.to(roomId).emit("error", { message: "Out of credits" });
        return;
      }
      let pick;
      if (topic === "cosmetics")
        pick = TOP50_COSMETICS[Math.floor(Math.random() * TOP50_COSMETICS.length)];
      else pick = TOP_AIDROP[Math.floor(Math.random() * TOP_AIDROP.length)];

      const system =
        topic === "aidrop"
          ? "You are a Gen-Z tech influencer describing a futuristic AI product drop in first person."
          : "You are a creative trend forecaster describing next-month beauty logic and signals.";

      const basePrompt =
        topic === "aidrop"
          ? `Write paragraph {i}/3 of about 40 words each, influencer-style, introducing a futuristic AI product "${pick.concept}" by ${pick.brand}. I am ${persona}. Add emojis inline.`
          : `Write paragraph {i}/3 of about 40 words each predicting next-month beauty trends for ${pick.product || pick.brand}. I am ${persona}. Add emojis inline.`;

      user.credits -= 1;
      saveUsers(allUsers);

      for (let i = 1; i <= 3; i++) {
        const prompt = basePrompt.replace("{i}", i);
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.9,
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
        });
        const paragraph = completion.choices[0].message.content.trim();
        io.to(roomId).emit("paragraph", {
          index: i,
          paragraph,
          persona,
          brand: pick.brand,
          product: pick.product || pick.concept,
        });
      }

      io.to(roomId).emit("done");
    } catch (err) {
      console.error("❌ Stream generation error:", err.message);
      io.to(roomId).emit("error", { message: "Generation failed" });
    }
  });
});

// ---------------- Start ----------------
app.use(express.static(path.join(__dirname)));
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`🚀 OP19$ backend live on :${PORT}`));