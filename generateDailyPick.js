// generateDailyPick.js
const path = require("path");
const fs = require("fs");
const OpenAI = require("openai");

// ✅ same config as server.js
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const PICKS_FILE = path.join(__dirname, "dailyPicks.json");

// pools copied from server.js
const TOP50_COSMETICS = [
  { brand: "Fenty Beauty", product: "Gloss Bomb Lip Gloss" },
  { brand: "Rhode", product: "Peptide Lip Tint" },
  { brand: "Nars", product: "Radiant Creamy Concealer" },
  { brand: "Rare Beauty", product: "Liquid Blush" }
  // … you can paste the full list from server.js here
];
const EMOJI_POOL = ["✨","💖","🔥","👀","😍","💅","🌈","🌸","😎","🤩","🫶","🥹","🧃","🌟","💋"];
function randomEmojis(count = 2) {
  return Array.from({ length: count }, () => EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)]).join(" ");
}
function decorateTextWithEmojis(text) {
  return `${randomEmojis(2)} ${text} ${randomEmojis(2)}`;
}

// helpers
async function makeDescription(brand, product) {
  try {
    const prompt = `Write a 70+ word first-person description of using "${product}" by ${brand}. Make it sensory, authentic, and Gen-Z relatable. Add emojis inline.`;
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      messages: [
        { role: "system", content: "You are a beauty lover speaking in first person." },
        { role: "user", content: prompt }
      ]
    });
    return completion.choices[0].message.content.trim() + " " + randomEmojis(3);
  } catch (e) {
    console.error("❌ Description error:", e.message);
    return `Using ${product} by ${brand} feels unforgettable and addictive. ${randomEmojis(3)}`;
  }
}

async function generateDailyPicks() {
  const pick = TOP50_COSMETICS[Math.floor(Math.random() * TOP50_COSMETICS.length)];
  const description = await makeDescription(pick.brand, pick.product);

  const dailyPicks = [{
    brand: decorateTextWithEmojis(pick.brand),
    product: decorateTextWithEmojis(pick.product),
    persona: "a young female influencer with a glam style", // simplified
    description,
    hashtags: ["#BeautyTok", "#NowTrending"],
    image: "https://placehold.co/600x600?text=No+Image", // keep placeholder
    refresh: 3000
  }];

  const dailyDate = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(PICKS_FILE, JSON.stringify({ dailyDate, dailyPicks }, null, 2));
  console.log(`🌅 Daily Pick Generated (${dailyDate}): ${pick.brand} – ${pick.product}`);
}

// run
generateDailyPicks();
