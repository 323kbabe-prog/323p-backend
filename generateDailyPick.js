const path = require("path");
const fs = require("fs");
const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Import all topic pools
const { TOP50_COSMETICS, TOP_MUSIC, TOP_POLITICS, TOP_AIDROP } = require("./topicPools");

/* ---------------- Emoji + Persona Helpers ---------------- */
const EMOJI_POOL = ["✨","💖","🔥","👀","😍","💅","🌈","🌸","😎","🤩","🫶","🥹","🧃","🌟","💋"];
function randomEmojis(count = 2) {
  return Array.from({ length: count }, () =>
    EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)]
  ).join(" ");
}
let raceIndex = 0;
function randomPersona() {
  const races = ["Black", "Korean", "White", ""];
  const vibes = ["college student"];
  const styles = ["casual","glam","streetwear","retro","Y2K-inspired","minimalist"];
  const race = races[raceIndex % races.length];
  raceIndex++;
  const vibe = vibes[Math.floor(Math.random() * vibes.length)];
  const style = styles[Math.floor(Math.random() * styles.length)];
  return race ? `a young ${race} female ${vibe} with a ${style} style`
              : `a young female ${vibe} with a ${style} style`;
}

/* ---------------- Description Generator ---------------- */
async function makeDescription(topic, pick) {
  let prompt, system;
  if (topic === "cosmetics") {
    prompt = `Write a 70+ word first-person description of using "${pick.product}" by ${pick.brand}. Sensory, Gen-Z relatable, emojis inline.`;
    system = "You are a beauty lover speaking in first person.";
  } else if (topic === "music") {
    prompt = `Write a 70+ word first-person hype reaction to hearing "${pick.track}" by ${pick.artist}. Emotional, Gen-Z tone, emojis inline.`;
    system = "You are a fan reacting to music.";
  } else if (topic === "politics") {
    prompt = `Write a 70+ word first-person passionate rant about ${pick.issue}, referencing ${pick.keyword}. Gen-Z activist tone, emojis inline.`;
    system = "You are a young activist.";
  } else {
    prompt = `Write a 70+ word first-person surreal, glitchy story about ${pick.concept}. Chaotic Gen-Z slang, emojis inline.`;
    system = "You are an AI-native Gen-Z creator.";
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt }
      ]
    });
    return completion.choices[0].message.content.trim() + " " + randomEmojis(3);
  } catch (e) {
    console.error("❌ GPT error:", e.message);
    return `${prompt} ${randomEmojis(3)}`;
  }
}

/* ---------------- Main Generator ---------------- */
async function generateAllDailyPicks() {
  const today = new Date().toISOString().slice(0,10);
  const dailyPicks = {};

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

  // Save JSON
  const filePath = path.join(__dirname, "dailyPicks.json");
  fs.writeFileSync(filePath, JSON.stringify({ dailyDate: today, dailyPicks }, null, 2));
  console.log(`🌅 Generated daily picks for all topics (${today})`);
  console.log(`📂 Saved to ${filePath}`);
}

/* ---------------- Run ---------------- */
generateAllDailyPicks();
