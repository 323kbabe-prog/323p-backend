// server.js — 323drop backend (description + image + voice + chat + emojis)
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

/* ---------------- OpenAI ---------------- */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------------- State ---------------- */
let nextPickCache = null;
let generatingNext = false;

/* ---------------- Products ---------------- */
const TOP50_COSMETICS = [
  { brand: "Rhode", product: "Peptide Lip Tint" },
  { brand: "Fenty Beauty", product: "Gloss Bomb Lip Gloss" },
  { brand: "Rare Beauty", product: "Liquid Blush" },
  { brand: "Glow Recipe", product: "Watermelon Dew Drops" },
  { brand: "Dior", product: "Lip Glow Oil" }
];

/* ---------------- Emoji Helper ---------------- */
const EMOJI_POOL = ["✨", "💖", "🔥", "👀", "😍", "💅", "🌈", "🌸", "😎", "🤩", "🫶", "🥹", "🧃", "🌟", "💋"];

function randomEmojis(count = 2) {
  let out = [];
  for (let i = 0; i < count; i++) {
    out.push(EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)]);
  }
  return out.join(" ");
}

function decorateTextWithEmojis(text) {
  return `${randomEmojis(2)} ${text} ${randomEmojis(2)}`;
}

/* ---------------- Persona Generator ---------------- */
function randomPersona() {
  const genders = ["female", "male"];
  const ethnicities = ["Korean", "Black", "Latina", "Asian-American", "Mixed"];
  const vibes = ["idol", "dancer", "vlogger", "streetwear model", "trainee", "influencer"];
  const styles = ["casual", "glam", "streetwear", "futuristic", "retro", "Y2K-inspired", "minimalist"];

  const g = genders[Math.floor(Math.random() * genders.length)];
  const e = ethnicities[Math.floor(Math.random() * ethnicities.length)];
  const v = vibes[Math.floor(Math.random() * vibes.length)];
  const s = styles[Math.floor(Math.random() * styles.length)];
  const age = Math.floor(Math.random() * (23 - 17 + 1)) + 17; // 17–23

  return `a ${age}-year-old ${g} ${e} ${v} with a ${s} style`;
}

/* ---------------- Helpers ---------------- */
async function makeDescription(brand, product) {
  try {
    const prompt = `
      Write a 70+ word first-person description of using "${product}" by ${brand}.
      Make it sensory (feel, look, vibe), authentic, and Gen-Z relatable.
      Current time: ${new Date().toISOString()}.
    `;
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
    desc = `${desc} ${randomEmojis(3)}`;

    return desc;
  } catch (e) {
    console.error("❌ Description error:", e.response?.data || e.message);
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
    console.error("❌ Image error:", e.response?.data || e.message);
  }
  return "https://placehold.co/600x600?text=No+Image";
}

async function generateNextPick() {
  if (generatingNext) return;
  generatingNext = true;
  try {
    const pick = TOP50_COSMETICS[Math.floor(Math.random() * TOP50_COSMETICS.length)];
    const persona = randomPersona(); // 👤 new persona
    const description = await makeDescription(pick.brand, pick.product);
    const imageUrl = await generateImageUrl(pick.brand, pick.product, persona);

    const decoratedBrand = decorateTextWithEmojis(pick.brand);
    const decoratedProduct = decorateTextWithEmojis(pick.product);

    nextPickCache = {
      brand: decoratedBrand,
      product: decoratedProduct,
      persona, // 🔒 included in cache
      description,
      hashtags: ["#BeautyTok", "#NowTrending"],
      image: imageUrl,
      refresh: 3000
    };
    console.log("✅ Next pick ready:", decoratedBrand, "-", decoratedProduct, "| Persona:", persona);
  } finally {
    generatingNext = false;
  }
}

/* ---------------- API Routes ---------------- */
app.get("/api/trend", async (req, res) => {
  try {
    if (!nextPickCache) await generateNextPick();
    const result = nextPickCache || {
      brand: decorateTextWithEmojis("Loading"),
      product: decorateTextWithEmojis("Beauty Product"),
      persona: "loading persona…",
      description: decorateTextWithEmojis("AI is warming up… please wait."),
      hashtags: ["#Loading"],
      image: "https://placehold.co/600x600?text=Loading",
      refresh: 5000
    };
    nextPickCache = null;
    generateNextPick();
    res.json(result);
  } catch (e) {
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

app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, async () => {
  console.log(`🚀 323drop backend live on :${PORT}`);
  await generateNextPick();
});
