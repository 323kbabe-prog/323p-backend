const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const OpenAI = require("openai");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors({ origin: "*" }));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------------- State ---------------- */
const roomTrends = {};
let generatingNext = {};
let dailyPicks = [];
let dailyDate = null;

/* ---------------- Emoji Helper ---------------- */
const EMOJI_POOL = ["✨","💖","🔥","👀","😍","💅","🌈","🌸","😎","🤩","🫶","🥹","🧃","🌟","💋"];
function randomEmojis(count = 2) {
  return Array.from({ length: count }, () =>
    EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)]
  ).join(" ");
}
function decorateTextWithEmojis(text) {
  return `${randomEmojis(2)} ${text} ${randomEmojis(2)}`;
}

/* ---------------- Persona Generator ---------------- */
let raceIndex = 0;
function randomPersona() {
  const races = ["Black", "Korean", "White", ""]; // "" = generic
  const vibes = ["idol", "dancer", "vlogger", "streetwear model", "influencer"];
  const styles = ["casual", "glam", "streetwear", "retro", "Y2K-inspired", "minimalist"];
  const race = races[raceIndex % races.length];
  raceIndex++;
  const vibe = vibes[Math.floor(Math.random() * vibes.length)];
  const style = styles[Math.floor(Math.random() * styles.length)];
  return race ? `a young ${race} female ${vibe} with a ${style} style`
              : `a young female ${vibe} with a ${style} style`;
}

/* ---------------- Background Pool ---------------- */
const genzBackgrounds = [
  "pastel gradient background (milk pink, baby blue, lilac)",
  "vaporwave gradient background (neon pink, cyan, purple)",
  "sunset gradient background (peach, coral, lavender)",
  "aqua gradient background (mint, aqua, periwinkle)",
  "cyberpunk gradient background (hot pink, electric purple, deep blue)",
  "dreamy gradient background (lavender, sky blue, soft pink)"
];

/* ---------------- Sticker Pool ---------------- */
const stickerPool = [
  "🤖","👾","⚡","💻","📟","⌨️","📡","🔮","🧠","💿","🪩","📼",
  "🪐","🌀","🌐","☄️","👁️","🫀","🦷","🐸","🥒","🧃","🥤","🍄",
  "💅","💋","👑","🔥","😎","🫦","🥹","😭","😂","😵‍💫","🤯",
  "🦋","🐰","🌸","🍓","🍭","🍉","🍒","🍼","☁️","🌙","✨","🌈",
  ":)","<3","☆","^_^","¯\\_(ツ)_/¯","(✿◠‿◠)","(｡♥‿♥｡)","(⌐■_■)",
  "(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧","(っ◔◡◔)っ ♥","(ノಠ益ಠ)ノ彡┻━┻","(☞ﾟヮﾟ)☞"
];
function randomStickers(countMin = 5, countMax = 12) {
  const count = Math.floor(Math.random() * (countMax - countMin + 1)) + countMin;
  return Array.from({ length: count }, () =>
    stickerPool[Math.floor(Math.random() * stickerPool.length)]
  ).join(" ");
}

/* ---------------- Top 50 Cosmetics ---------------- */
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

/* ---------------- Persistence ---------------- */
const PICKS_FILE = path.join(__dirname, "dailyPicks.json");

async function loadDailyPicks() {
  try {
    console.log(`📂 Using daily pick file: ${PICKS_FILE}`);
    if (fs.existsSync(PICKS_FILE)) {
      const data = JSON.parse(fs.readFileSync(PICKS_FILE));
      if (data.dailyDate === new Date().toISOString().slice(0, 10)) {
        dailyDate = data.dailyDate;
        dailyPicks = data.dailyPicks;
        console.log(`📂 Loaded Daily Pick from file (${dailyDate})`);
        return;
      } else {
        console.log("⚠️ Daily pick file is outdated, regenerating...");
      }
    } else {
      console.log("⚠️ No daily pick file found, generating...");
    }
  } catch (err) {
    console.error("❌ Failed to load daily pick file:", err.message);
  }
  await generateDailyPicks();
}

/* ---------------- Guard ---------------- */
async function ensureDailyPick() {
  const today = new Date().toISOString().slice(0, 10);
  if (!dailyPicks.length || dailyDate !== today) {
    console.log("⚠️ Daily pick not valid, regenerating...");
    await generateDailyPicks();
  }
}
