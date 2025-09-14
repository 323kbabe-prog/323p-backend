// server.js — 323drop backend (room-specific trends, host/guest aware)
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

/* ---------------- State ---------------- */
const roomTrends = {}; // { roomId: { trend data } }
let generatingNext = {};

/* ---------------- Products ---------------- */
const TOP50_COSMETICS = [
{ brand: "Rhode", product: "Peptide Lip Tint" },
{ brand: "Fenty Beauty", product: "Gloss Bomb Lip Gloss" },
{ brand: "Anastasia Beverly Hills", product: "Clear Brow Gel" },
{ brand: "YSL", product: "Make Me Blush Baby Doll" },
{ brand: "Laura Mercier", product: "Loose Setting Powder" },
{ brand: "Beautyblender", product: "Blending Sponge" },
{ brand: "Givenchy", product: "Prisme Libre Blush" },
{ brand: "Sephora Collection", product: "Pro Brushes" },
{ brand: "COSRX", product: "Advanced Snail 96 Mucin Essence" },
{ brand: "Lush", product: "Dream Cream" },
{ brand: "Nyx", product: "Jumbo Eye Pencil" },
{ brand: "Nars", product: "Radiant Creamy Concealer" },
{ brand: "Too Faced", product: "Better Than Sex Mascara" },
{ brand: "Charlotte Tilbury", product: "Magic Cream" },
{ brand: "Haus Labs", product: "Triclone Foundation" },
{ brand: "Dior", product: "Lip Glow Oil" },
{ brand: "Freck Beauty", product: "Faux Freckle Pen" },
{ brand: "Sol de Janeiro", product: "Brazilian Crush Mist" },
{ brand: "Paula’s Choice", product: "2% BHA Liquid Exfoliant" },
{ brand: "Essence", product: "Lash Princess Mascara" },
{ brand: "Color Wow", product: "Dream Coat Spray" },
{ brand: "Laneige", product: "Lip Sleeping Mask" },
{ brand: "Maybelline", product: "Sky High Mascara" },
{ brand: "Kitsch", product: "Heatless Curl Set" },
{ brand: "Biodance", product: "Bio-Collagen Mask" },
{ brand: "MAC", product: "Squirt Plumping Gloss Stick" },
{ brand: "Clinique", product: "Black Honey Lipstick" },
{ brand: "L’Oréal Paris", product: "Infallible Foundation" },
{ brand: "Isle of Paradise", product: "Self-Tanning Drops" },
{ brand: "Rare Beauty", product: "Liquid Blush" },
{ brand: "SHEGLAM", product: "Makeup Essentials" },
{ brand: "Huda Beauty", product: "Concealer" },
{ brand: "Cécred", product: "Haircare Treatment" },
{ brand: "Medicube", product: "PDRN Pink Glass Glow Set" },
{ brand: "E.L.F.", product: "Halo Glow Powder" },
{ brand: "Bubble Skincare", product: "Gel Cleanser" },
{ brand: "Tower 28 Beauty", product: "SOS Spray" },
{ brand: "Olay", product: "Regenerist Cream" },
{ brand: "I’m From", product: "Rice Toner" },
{ brand: "DIBS Beauty", product: "Desert Island Duo" },
{ brand: "Milk Makeup", product: "Cooling Water Jelly Tint" },
{ brand: "Glow Recipe", product: "Watermelon Dew Drops" },
{ brand: "Danessa Myricks Beauty", product: "Yummy Skin Balm Powder" },
{ brand: "Refy", product: "Brow Sculpt" },
{ brand: "Kosas", product: "Revealer Concealer" },
{ brand: "Bioderma", product: "Micellar Water" },
{ brand: "Embryolisse", product: "Lait-Crème Concentré" },
{ brand: "CurrentBody", product: "LED Hair Growth Helmet" },
{ brand: "Dyson Beauty", product: "Airwrap Styler" }
];

/* ---------------- Emoji Helper ---------------- */
const EMOJI_POOL = ["✨", "💖", "🔥", "👀", "😍", "💅", "🌈", "🌸", "😎", "🤩", "🫶", "🥹", "🧃", "🌟", "💋"];
function randomEmojis(count = 2) {
  return Array.from({ length: count }, () => EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)]).join(" ");
}
function decorateTextWithEmojis(text) {
  return `${randomEmojis(2)} ${text} ${randomEmojis(2)}`;
}

/* ---------------- Persona Generator ---------------- */
function randomPersona() {
  const ethnicities = ["Korean", "Black", "White", "Latina", "Asian-American", "Mixed"];
  const vibes = ["idol", "dancer", "vlogger", "streetwear model", "trainee", "influencer"];
  const styles = ["casual", "glam", "streetwear", "retro", "Y2K-inspired", "minimalist"];
  return `a ${Math.floor(Math.random() * 7) + 17}-year-old female ${
    ethnicities[Math.floor(Math.random() * ethnicities.length)]
  } ${vibes[Math.floor(Math.random() * vibes.length)]} with a ${styles[Math.floor(Math.random() * styles.length)]} style`;
}

/* ---------------- Helpers ---------------- */
async function makeDescription(brand, product) {
  try {
    const prompt = `Write a 70+ word first-person description of using "${product}" by ${brand}. Make it sensory, authentic, and Gen-Z relatable.`;
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      messages: [
        { role: "system", content: "You are a beauty lover speaking in first person." },
        { role: "user", content: prompt }
      ]
    });
    let desc = completion.choices[0].message.content.trim();
    desc = desc.replace(new RegExp(`${product}`, "gi"), `${product} ${randomEmojis(2)}`);
    desc = desc.replace(new RegExp(`${brand}`, "gi"), `${brand} ${randomEmojis(2)}`);
    return `${desc} ${randomEmojis(3)}`;
  } catch (e) {
    console.error("❌ Description error:", e.message);
    return decorateTextWithEmojis(`Using ${product} by ${brand} feels unforgettable and addictive.`);
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
        Sticker shapes only (hearts, stars, sparkles, emoji, text emoticon).
        Square 1:1 format. No text/logos.
      `,
      size: "1024x1024"
    });
    const d = out?.data?.[0];
    if (d?.b64_json) return `data:image/png;base64,${d.b64_json}`;
    if (d?.url) return d.url;
  } catch (e) {
    console.error("❌ Image error:", e.message);
  }
  return "https://placehold.co/600x600?text=No+Image";
}

async function generateNextPick(roomId) {
  if (generatingNext[roomId]) return;
  generatingNext[roomId] = true;
  try {
    const pick = TOP50_COSMETICS[Math.floor(Math.random() * TOP50_COSMETICS.length)];
    const persona = randomPersona();
    const description = await makeDescription(pick.brand, pick.product);
    const imageUrl = await generateImageUrl(pick.brand, pick.product, persona);
    const decoratedBrand = decorateTextWithEmojis(pick.brand);
    const decoratedProduct = decorateTextWithEmojis(pick.product);
    roomTrends[roomId] = {
      brand: decoratedBrand,
      product: decoratedProduct,
      persona,
      description,
      hashtags: ["#BeautyTok", "#NowTrending"],
      image: imageUrl,
      refresh: 3000
    };
    console.log(`✅ Trend ready for room ${roomId}: ${pick.brand} - ${pick.product}`);
  } finally {
    generatingNext[roomId] = false;
  }
}

/* ---------------- API Routes ---------------- */
app.get("/api/trend", async (req, res) => {
  try {
    const roomId = req.query.room || "default";
    const guestMode = req.query.guest === "true";

    if (!roomTrends[roomId]) {
      if (guestMode) {
        // Guest should never generate — return placeholder instead
        return res.json({
          brand: "waiting…",
          product: "waiting for host",
          persona: "none yet",
          description: "please wait — the host has not started this room yet.",
          hashtags: ["#Waiting"],
          image: "https://placehold.co/600x600?text=Waiting+for+Host",
          refresh: 5000
        });
      } else {
        console.log(`⏳ Host generating first drop for room ${roomId}...`);
        await generateNextPick(roomId);
      }
    }

    res.json(roomTrends[roomId]);
  } catch (e) {
    console.error("❌ Trend API error:", e.message);
    res.json({
      brand: decorateTextWithEmojis("Error"),
      product: decorateTextWithEmojis("System"),
      persona: "error persona",
      description: decorateTextWithEmojis("Something went wrong. Retrying soon…"),
      hashtags: ["#Error"],
      image: "https://placehold.co/600x600?text=Error",
      refresh: 5000
    });
  }
});

app.get("/api/voice", async (req, res) => {
  try {
    const text = req.query.text || "";
    if (!text) return res.status(400).json({ error: "Missing text" });
    const out = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      input: text,
    });
    const audioBuffer = Buffer.from(await out.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(audioBuffer);
  } catch (e) {
    console.error("❌ Voice API error:", e.message);
    res.status(500).json({ error: "Voice TTS failed" });
  }
});

app.get("/health", (_req,res) => res.json({ ok: true, time: Date.now() }));

/* ---------------- Chat (Socket.IO) ---------------- */
io.on("connection", (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);
  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    socket.roomId = roomId;
    console.log(`👥 ${socket.id} joined room: ${roomId}`);
  });
  socket.on("chatMessage", ({ roomId, user, text }) => {
    console.log(`💬 [${roomId}] ${user}: ${text}`);
    io.to(roomId).emit("chatMessage", { user, text });
  });
  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.id} (room ${socket.roomId || "none"})`);
  });
});

/* ---------------- Serve static ---------------- */
app.use(express.static(path.join(__dirname)));

/* ---------------- Start ---------------- */
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, async () => {
  console.log(`🚀 323drop backend live on :${PORT}`);
});
