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
const roomTrends = {};

/* ---------------- Emoji Helper ---------------- */
const EMOJI_POOL = ["✨","💖","🔥","👀","😍","💅","🌈","🌸","😎","🤩","🫶","🥹","🧃","🌟","💋"];
function randomEmojis(count = 2) {
  return Array.from({ length: count }, () => EMOJI_POOL[Math.floor(Math.random() * EMOJI_POOL.length)]).join(" ");
}
function decorateTextWithEmojis(text) {
  return `${randomEmojis(2)} ${text} ${randomEmojis(2)}`;
}

/* ---------------- Persona Generator ---------------- */
let raceIndex = 0;
function randomPersona() {
  const races = ["Black", "Korean", "White", ""];
  const vibes = ["idol", "dancer", "vlogger", "streetwear model", "influencer"];
  const styles = ["casual", "glam", "streetwear", "retro", "Y2K-inspired", "minimalist"];
  const race = races[raceIndex % races.length];
  raceIndex++;
  const vibe = vibes[Math.floor(Math.random() * vibes.length)];
  const style = styles[Math.floor(Math.random() * styles.length)];
  return race ? `a young ${race} female ${vibe} with a ${style} style`
              : `a young female ${vibe} with a ${style} style`;
}

/* ---------------- Backgrounds + Stickers ---------------- */
const genzBackgrounds = [
  "pastel gradient background (milk pink, baby blue, lilac)",
  "vaporwave gradient background (neon pink, cyan, purple)",
  "sunset gradient background (peach, coral, lavender)",
  "aqua gradient background (mint, aqua, periwinkle)",
  "cyberpunk gradient background (hot pink, electric purple, deep blue)",
  "dreamy gradient background (lavender, sky blue, soft pink)"
];
const stickerPool = ["🤖","👾","⚡","💻","📟","⌨️","📡","🔮","🧠","💿","🪩","📼","🪐","🌀","🌐","☄️","👁️","🫀","🦷","🐸","🥒","🧃","🥤","🍄","💅","💋","👑","🔥","😎","🫦","🥹","😭","😂","😵‍💫","🤯","🦋","🐰","🌸","🍓","🍭","🍉","🍒","🍼","☁️","🌙","✨","🌈",":)","<3","☆","^_^"];
function randomStickers(countMin = 5, countMax = 12) {
  const count = Math.floor(Math.random() * (countMax - countMin + 1)) + countMin;
  return Array.from({ length: count }, () => stickerPool[Math.floor(Math.random() * stickerPool.length)]).join(" ");
}

/* ---------------- Topic Pools ---------------- */
// Cosmetics (already 50, truncated here for brevity — keep your original TOP50_COSMETICS)
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

// Music — 50 songs
const TOP_MUSIC = [
  { artist: "Doja Cat", track: "Paint The Town Red" },
  { artist: "Ice Spice", track: "Deli" },
  { artist: "NewJeans", track: "Super Shy" },
  { artist: "Jungkook", track: "Seven" },
  { artist: "The Weeknd", track: "Popular" },
  { artist: "Olivia Rodrigo", track: "Vampire" },
  { artist: "BLACKPINK", track: "Shut Down" },
  { artist: "Drake", track: "IDGAF" },
  { artist: "SZA", track: "Kill Bill" },
  { artist: "Travis Scott", track: "Meltdown" },
  { artist: "Peso Pluma", track: "Ella Baila Sola" },
  { artist: "Karol G", track: "TQG" },
  { artist: "Rema", track: "Calm Down" },
  { artist: "Tyla", track: "Water" },
  { artist: "Billie Eilish", track: "What Was I Made For?" },
  { artist: "Metro Boomin", track: "Creepin'" },
  { artist: "Latto", track: "Lottery" },
  { artist: "Lizzo", track: "About Damn Time" },
  { artist: "Dua Lipa", track: "Dance The Night" },
  { artist: "Miley Cyrus", track: "Flowers" },
  { artist: "Justin Bieber", track: "Honest" },
  { artist: "The Kid LAROI", track: "Stay" },
  { artist: "Taylor Swift", track: "Shake It Off" },
  { artist: "Harry Styles", track: "As It Was" },
  { artist: "Bad Bunny", track: "Tití Me Preguntó" },
  { artist: "Anitta", track: "Envolver" },
  { artist: "Saweetie", track: "Tap In" },
  { artist: "Lil Nas X", track: "Montero" },
  { artist: "Post Malone", track: "Circles" },
  { artist: "Ariana Grande", track: "7 rings" },
  { artist: "Bruno Mars", track: "That's What I Like" },
  { artist: "Lana Del Rey", track: "Summertime Sadness" },
  { artist: "Billie Eilish", track: "Happier Than Ever" },
  { artist: "Post Malone & Swae Lee", track: "Sunflower" },
  { artist: "Beyoncé", track: "Break My Soul" },
  { artist: "ROSALÍA", track: "Despechá" },
  { artist: "Lil Baby", track: "In A Minute" },
  { artist: "Shakira", track: "Bzrp Music Sessions, Vol. 53" },
  { artist: "Ed Sheeran", track: "Bad Habits" },
  { artist: "Kendrick Lamar", track: "N95" },
  { artist: "Megan Thee Stallion", track: "Savage" },
  { artist: "Nicki Minaj", track: "Super Freaky Girl" },
  { artist: "Florence + The Machine", track: "Dog Days Are Over" },
  { artist: "Sam Smith", track: "Unholy" },
  { artist: "Stray Kids", track: "S-Class" },
  { artist: "Seventeen", track: "Super" },
  { artist: "IVE", track: "I AM" },
  { artist: "LE SSERAFIM", track: "Eve, Psyche & the Bluebeard’s wife" },
  { artist: "NCT Dream", track: "Candy" }
];

// Politics — 50 issues
const TOP_POLITICS = [
  { issue: "Climate Policy", keyword: "Paris Agreement" },
  { issue: "Healthcare", keyword: "Medicare Expansion" },
  { issue: "Education", keyword: "Student Loan Debt" },
  { issue: "Free Speech", keyword: "Social Media Regulation" },
  { issue: "Equality", keyword: "Gender Pay Gap" },
  { issue: "Housing", keyword: "Rent Control" },
  { issue: "Immigration", keyword: "Border Policy" },
  { issue: "Technology", keyword: "AI Regulation" },
  { issue: "Voting Rights", keyword: "Early Voting" },
  { issue: "Environment", keyword: "Plastic Ban" },
  { issue: "Income Inequality", keyword: "Minimum Wage" },
  { issue: "Mental Health", keyword: "Access to Care" },
  { issue: "Reproductive Rights", keyword: "Abortion Access" },
  { issue: "Gun Control", keyword: "Universal Background Checks" },
  { issue: "LGBTQ+ Rights", keyword: "Trans Healthcare" },
  { issue: "Racial Justice", keyword: "Police Reform" },
  { issue: "Water Rights", keyword: "Clean Water Access" },
  { issue: "Food Security", keyword: "Right to Food" },
  { issue: "Disability Rights", keyword: "ADA Enforcement" },
  { issue: "Criminal Justice", keyword: "Prison Reform" },
  { issue: "Homelessness", keyword: "Affordable Shelter" },
  { issue: "Net Neutrality", keyword: "Open Internet" },
  { issue: "Union Rights", keyword: "Right to Organize" },
  { issue: "Privacy", keyword: "Data Protection" },
  { issue: "Renewable Energy", keyword: "Green Jobs" },
  { issue: "Campaign Finance", keyword: "Dark Money" },
  { issue: "Voting Access", keyword: "Mail-In Ballots" },
  { issue: "Indigenous Rights", keyword: "Land Sovereignty" },
  { issue: "Civil Liberties", keyword: "Freedom of Assembly" },
  { issue: "Youth Unemployment", keyword: "Job Creation" },
  { issue: "Tax Justice", keyword: "Progressive Tax" },
  { issue: "Drug Policy", keyword: "Decriminalization" },
  { issue: "Police Accountability", keyword: "Body Cameras" },
  { issue: "Global Migration", keyword: "Refugee Crisis" },
  { issue: "Healthcare Access", keyword: "Telehealth" },
  { issue: "Digital Divide", keyword: "Broadband Access" },
  { issue: "Consumer Privacy", keyword: "Surveillance Reform" },
  { issue: "Corruption", keyword: "Government Transparency" },
  { issue: "Food Waste", keyword: "Sustainability Practices" },
  { issue: "Childcare", keyword: "Universal Pre-K" },
  { issue: "Transportation", keyword: "Public Transit" },
  { issue: "Climate Adaptation", keyword: "Flood Protection" },
  { issue: "Space Policy", keyword: "Satellite Regulation" },
  { issue: "AI Ethics", keyword: "Bias in Algorithms" },
  { issue: "Animal Rights", keyword: "Factory Farming" },
  { issue: "Trade", keyword: "Tariffs" },
  { issue: "Foreign Policy", keyword: "Ukraine Aid" },
  { issue: "Labor", keyword: "Gig Worker Rights" }
];

// Aidrop — 50 canon concepts
const TOP_AIDROP = [
  { concept: "Infinite TikTok Loop" },
  { concept: "AI Noodles" },
  { concept: "Talking to GPT Bestie" },
  { concept: "Meme Economy" },
  { concept: "Glitch Selfies" },
  { concept: "Streamed Ramen Nights" },
  { concept: "Algorithm Crush" },
  { concept: "Digital Graffiti" },
  { concept: "NicheTok Clans" },
  { concept: "Creator Paycheck-to-Drop" },
  { concept: "Virtual Concert Vibes" },
  { concept: "Bot Dance Challenges" },
  { concept: "AI Filter Skin" },
  { concept: "Dreamcore Aesthetic" },
  { concept: "Hacking Your Algorithm" },
  { concept: "Digital Thrift Haul" },
  { concept: "Creator Burnout Loop" },
  { concept: "Clone Selfies" },
  { concept: "Augmented Reality Hangouts" },
  { concept: "Sound-Swipe Culture" },
  { concept: "Fail Meme Montage" },
  { concept: "Infinite Scroll Shame" },
  { concept: "Chatbot Crush" },
  { concept: "Daily Drops Addiction" },
  { concept: "Glitch Text Overlays" },
  { concept: "Remix Obsession" },
  { concept: "TikTok Drip Fits" },
  { concept: "AI-Synth Beats" },
  { concept: "Automated Selfies" },
  { concept: "Filter Bubble Reality" },
  { concept: "NFT Dream" },
  { concept: "Pixelated Memories" },
  { concept: "Cyber Ramen Wars" },
  { concept: "Mosaic Screens" },
  { concept: "Viral Soundboard" },
  { concept: "Emoji Overload" },
  { concept: "Algorithmic Love Stories" },
  { concept: "Feed-Fever Loops" },
  { concept: "Synthwave Nights" },
  { concept: "GlitchBot Diaries" },
  { concept: "AI Cityscape Dreams" },
  { concept: "Underground Soundwave" },
  { concept: "Stream Collapse" },
  { concept: "Pop-Up Culture Rooms" },
  { concept: "Hashtag Graffiti Walls" },
  { concept: "Looped Life Clips" },
  { concept: "AI DJ Sets" },
  { concept: "Selfie Clone Wars" },
  { concept: "Algorithm Mood Swings" },
  { concept: "AI Ramen Cook-Off" }
];

/* ---------------- Description Generators ---------------- */
async function makeDescription(topic, pick) {
  let prompt, system;
  if (topic === "cosmetics") {
    prompt = `Write a 70+ word first-person description of using "${pick.product}" by ${pick.brand}. Make it sensory, authentic, and Gen-Z relatable. Add emojis inline.`;
    system = "You are a beauty lover speaking in first person.";
  } else if (topic === "music") {
    prompt = `Write a 70+ word first-person hype reaction to hearing "${pick.track}" by ${pick.artist}. Make it emotional, Gen-Z tone, and use emojis inline.`;
    system = "You are a fan reacting to music.";
  } else if (topic === "politics") {
    prompt = `Write a 70+ word first-person passionate rant about ${pick.issue}, referencing ${pick.keyword}. Gen-Z activist tone with emojis inline.`;
    system = "You are a young activist speaking to peers.";
  } else {
    prompt = `Write a 70+ word first-person surreal, glitchy story about ${pick.concept}. Use chaotic Gen-Z slang and emojis inline.`;
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
    console.error("❌ Description error:", e.message);
    return decorateTextWithEmojis(prompt);
  }
}

/* ---------------- Image Generator ---------------- */
async function generateImageUrl(topic, pick, persona) {
  const bg = genzBackgrounds[Math.floor(Math.random() * genzBackgrounds.length)];
  const stickers = randomStickers();
  let prompt;
  if (topic === "cosmetics") {
    prompt = `Photocard-style, ${persona}, applying ${pick.product} by ${pick.brand}. Pastel booth aesthetic, background ${bg}, stickers ${stickers}. Square 1:1.`;
  } else if (topic === "music") {
    prompt = `Idol/dancer photocard, ${persona}, performing "${pick.track}" by ${pick.artist}. Neon stage, stickers 🎤🎶⭐ ${stickers}. Square 1:1.`;
  } else if (topic === "politics") {
  prompt = `Cinematic photo of ${persona}, at a real protest about ${pick.issue}.
  Photo-realistic details, urban street background, natural daylight.
  Subject holding a protest sign or megaphone, candid action shot.
  Overlay protest stickers (✊📢🔥 ${stickers}) like digital graffiti.
  Square 1:1 format.`;
} else {
    prompt = `Glitchy cyberpunk photocard, ${persona}, embodying ${pick.concept}. Colors purple/aqua, stickers 🤖⚡👾 ${stickers}. Square 1:1.`;
  }
  try {
    const out = await openai.images.generate({ model: "gpt-image-1", prompt, size: "1024x1024" });
    const d = out?.data?.[0];
    if (d?.b64_json) return `data:image/png;base64,${d.b64_json}`;
    if (d?.url) return d.url;
  } catch (e) {
    console.error("❌ Image error:", e.message);
  }
  return "https://placehold.co/600x600?text=No+Image";
}

/* ---------------- Drop Generator ---------------- */
async function generateDrop(topic) {
  let pick;
  if (topic === "cosmetics") pick = TOP50_COSMETICS[Math.floor(Math.random()*TOP50_COSMETICS.length)];
  else if (topic === "music") pick = TOP_MUSIC[Math.floor(Math.random()*TOP_MUSIC.length)];
  else if (topic === "politics") pick = TOP_POLITICS[Math.floor(Math.random()*TOP_POLITICS.length)];
  else pick = TOP_AIDROP[Math.floor(Math.random()*TOP_AIDROP.length)];

  const persona = randomPersona();
  const description = await makeDescription(topic, pick);
  const imageUrl = await generateImageUrl(topic, pick, persona);

  return {
    brand: pick.brand || pick.artist || pick.issue || "323aidrop",
    product: pick.product || pick.track || pick.keyword || pick.concept,
    persona,
    description,
    hashtags: ["#NowTrending"],
    image: imageUrl,
    refresh: 3000
  };
}

/* ---------------- API Routes ---------------- */
app.get("/api/trend", async (req, res) => {
  try {
    const topic = req.query.topic || "cosmetics";
    const roomId = req.query.room;
    if (!roomId) return res.status(400).json({ error: "room parameter required" });

    const drop = await generateDrop(topic);
    roomTrends[roomId] = { current: drop };
    res.json(drop);
  } catch (e) {
    console.error("❌ Trend API error:", e.message);
    res.json({ error: "Trend API failed" });
  }
});

app.get("/api/voice", async (req, res) => {
  try {
    const text = req.query.text || "";
    if (!text.trim()) {
      res.setHeader("Content-Type", "audio/mpeg");
      return res.send(Buffer.alloc(1000));
    }
    const out = await openai.audio.speech.create({ model: "gpt-4o-mini-tts", voice: "alloy", input: text });
    const audioBuffer = Buffer.from(await out.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(audioBuffer);
  } catch (e) {
    console.error("❌ Voice API error:", e.message);
    res.status(500).json({ error: "Voice TTS failed" });
  }
});

app.get("/api/start-voice", (req, res) => {
  res.json({ ok: true });
});

/* ---------------- Chat ---------------- */
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
    console.log(`❌ User disconnected: ${socket.id}`);
  });
});

/* ---------------- Serve static ---------------- */
app.use(express.static(path.join(__dirname)));

/* ---------------- Start ---------------- */
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 323aidrop backend live on :${PORT}`);
});
