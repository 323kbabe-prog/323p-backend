// generateDailyPick.js
// Creates daily picks for all 4 topics and saves them to dailyPicks.json

const path = require("path");
const fs = require("fs");
const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const { TOP50_COSMETICS, TOP_MUSIC, TOP_POLITICS, TOP_AIDROP } = require("./topicPools");

/* ---------------- Persona ---------------- */
function randomPersona() {
  return "a young college student";
}

/* ---------------- Emoji ---------------- */
const EMOJI_POOL = ["✨","💖","🔥","👀","😍","💅","🌈","🌸","😎","🤩","🫶","🥹","🧃","🌟","💋"];
function randomEmojis(count=2) {
  return Array.from({ length: count }, () =>
    EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)]
  ).join(" ");
}

/* ---------------- Description Generator ---------------- */
async function makeDescription(topic, pick) {
  let prompt, system;
  if (topic === "cosmetics") {
    prompt = `Write a 70+ word first-person description of using "${pick.product}" by ${pick.brand}. Sensory, photo-realistic, Gen-Z relatable, emojis inline.`;
    system = "You are a college student talking about beauty.";
  } else if (topic === "music") {
    prompt = `Write a 70+ word first-person hype reaction to hearing "${pick.track}" by ${pick.artist}. Emotional, Gen-Z tone, emojis inline.`;
    system = "You are a college student reacting to music.";
  } else if (topic === "politics") {
    prompt = `Write a 70+ word first-person passionate rant about ${pick.issue}, referencing ${pick.keyword}. Activist college student voice, emojis inline.`;
    system = "You are a college student activist.";
  } else {
    prompt = `Write a 70+ word first-person surreal story about ${pick.concept}. Chaotic, Gen-Z slang, emojis inline.`;
    system = "You are a college student living AI culture.";
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }]
    });
    return completion.choices[0].message.content.trim() + " " + randomEmojis(3);
  } catch (e) {
    console.error(`❌ GPT error for ${topic}:`, e.message);
    return prompt + " " + randomEmojis(3);
  }
}

/* ---------------- Main ---------------- */
async function generateAllDailyPicks() {
  const today = new Date().toISOString().slice(0,10);
  const dailyPicks = {};

  console.log(`\n🌅 Generating daily picks for ${today}\n`);

  // Cosmetics
  const c = TOP50_COSMETICS[Math.floor(Math.random()*TOP50_COSMETICS.length)];
  dailyPicks.cosmetics = {
    brand: c.brand,
    product: c.product,
    persona: randomPersona(),
    description: await makeDescription("cosmetics", c),
    hashtags: ["#BeautyTok","#NowTrending"],
    isDaily: true
  };
  console.log(`💄 Cosmetics Pick: ${c.brand} – ${c.product}`);

  // Music
  const m = TOP_MUSIC[Math.floor(Math.random()*TOP_MUSIC.length)];
  dailyPicks.music = {
    brand: m.artist,
    product: m.track,
    persona: randomPersona(),
    description: await makeDescription("music", m),
    hashtags: ["#NowTrending"],
    isDaily: true
  };
  console.log(`🎶 Music Pick: ${m.artist} – ${m.track}`);

  // Politics
  const p = TOP_POLITICS[Math.floor(Math.random()*TOP_POLITICS.length)];
  dailyPicks.politics = {
    brand: p.issue,
    product: p.keyword,
    persona: randomPersona(),
    description: await makeDescription("politics", p),
    hashtags: ["#NowTrending"],
    isDaily: true
  };
  console.log(`🏛 Politics Pick: ${p.issue} – ${p.keyword}`);

  // Aidrop
  const a = TOP_AIDROP[Math.floor(Math.random()*TOP_AIDROP.length)];
  dailyPicks.aidrop = {
    brand: "323aidrop",
    product: a.concept,
    persona: randomPersona(),
    description: await makeDescription("aidrop", a),
    hashtags: ["#NowTrending"],
    isDaily: true
  };
  console.log(`🌐 Aidrop Pick: ${a.concept}`);

  // Save JSON
  const filePath = path.join(__dirname, "dailyPicks.json");
  fs.writeFileSync(filePath, JSON.stringify({ dailyDate: today, dailyPicks }, null, 2));
  console.log(`\n✅ Saved all picks to ${filePath}\n`);
}

/* ---------------- Run ---------------- */
generateAllDailyPicks();
