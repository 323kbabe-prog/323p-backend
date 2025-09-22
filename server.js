// server.js — op18 backend (persona + image + voice + credit store)
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const OpenAI = require("openai");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors({ origin: "*" }));

// ✅ Serve static files from /public
app.use(express.static(path.join(__dirname, "public")));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------------- Credit Store ---------------- */
const USERS_FILE = path.join("/data", "users.json");

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
    users[userId] = { credits: 5, history: [] }; // 🎁 5 free credits
    saveUsers(users);
  }
  return users[userId];
}

/* ---------------- Persona Generator ---------------- */
function randomPersona() {
  const ethnicities = ["Korean", "Black", "White", "Latina", "Asian-American", "Mixed"];
  const vibes = ["idol", "dancer", "vlogger", "streetwear model", "trainee", "influencer"];
  const styles = ["casual", "glam", "streetwear", "retro", "Y2K-inspired", "minimalist"];
  return `a ${Math.floor(Math.random() * 7) + 17}-year-old female ${
    ethnicities[Math.floor(Math.random() * ethnicities.length)]
  } ${vibes[Math.floor(Math.random() * vibes.length)]} with a ${
    styles[Math.floor(Math.random() * styles.length)]
  } style`;
}

/* ---------------- Pools ---------------- */
const { TOP50_COSMETICS, TOP_MUSIC, TOP_POLITICS, TOP_AIDROP } = require("./topicPools");

/* ---------------- Description Generator ---------------- */
async function makeDescription(topic, pick, persona) {
  const prompt = `Write exactly 120 words about ${pick.product || pick.track || pick.issue}. I am ${persona}. Add emojis inline.`;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      messages: [{ role: "system", content: "You are a college student." }, { role: "user", content: prompt }]
    });
    return completion.choices[0].message.content.trim();
  } catch (e) {
    console.error("❌ Description error:", e.message);
    return prompt;
  }
}

/* ---------------- Image Generator ---------------- */
async function generateImageUrl(brand, product, persona) {
  try {
    const out = await openai.images.generate({
      model: "gpt-image-1",
      prompt: `Create a photocard-style image. Subject: ${persona}. Holding ${product} by ${brand}.`,
      size: "1024x1024"
    });
    const d = out?.data?.[0];
    if (d?.url) return d.url;
    if (d?.b64_json) return `data:image/png;base64,${d.b64_json}`;
  } catch (e) {
    console.error("❌ Image error:", e.message);
  }
  return "https://placehold.co/600x600?text=No+Image";
}

/* ---------------- JSON middleware ---------------- */
app.use(express.json());

/* ---------------- API: Credits ---------------- */
app.get("/api/credits", (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: "userId required" });

  const user = getUser(userId);
  res.json({ credits: user.credits });
});

/* ---------------- API: Description (deducts credit) ---------------- */
app.get("/api/description", async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: "userId required" });

  const user = getUser(userId);
  if (user.credits < 1) {
    return res.status(400).json({ error: "Not enough credits" });
  }

  // deduct 1 credit
  user.credits -= 1;
  user.history.push({ type: "use", credits: -1, at: new Date().toISOString() });
  saveUsers(users);

  const topic = req.query.topic || "cosmetics";
  let pick;
  if (topic === "cosmetics") pick = TOP50_COSMETICS[Math.floor(Math.random() * TOP50_COSMETICS.length)];
  else if (topic === "music") pick = TOP_MUSIC[Math.floor(Math.random() * TOP_MUSIC.length)];
  else if (topic === "politics") pick = TOP_POLITICS[Math.floor(Math.random() * TOP_POLITICS.length)];
  else pick = TOP_AIDROP[Math.floor(Math.random() * TOP_AIDROP.length)];

  const persona = randomPersona();
  const description = await makeDescription(topic, pick, persona);

  res.json({
    brand: pick.brand || pick.artist || pick.issue || "323aidrop",
    product: pick.product || pick.track || pick.keyword || pick.concept,
    persona,
    description,
    hashtags: ["#NowTrending"],
    isDaily: false,
    credits: user.credits // 👈 return balance
  });
});

/* ---------------- API: Image ---------------- */
app.get("/api/image", async (req, res) => {
  const { brand, product, persona } = req.query;
  if (!brand || !product) return res.status(400).json({ error: "brand and product required" });

  const imageUrl = await generateImageUrl(brand, product, persona);
  res.json({ image: imageUrl });
});

/* ---------------- Voice ---------------- */
app.get("/api/voice", async (req, res) => {
  const text = req.query.text || "";
  if (!text.trim()) { res.setHeader("Content-Type", "audio/mpeg"); return res.send(Buffer.alloc(1000)); }
  try {
    const out = await openai.audio.speech.create({ model: "gpt-4o-mini-tts", voice: "alloy", input: text });
    const audioBuffer = Buffer.from(await out.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(audioBuffer);
  } catch (e) {
    console.error("❌ Voice error:", e.message);
    res.status(500).json({ error: "Voice TTS failed" });
  }
});

/* ---------------- Chat ---------------- */
io.on("connection", (socket) => {
  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    socket.roomId = roomId;
  });
});

/* ---------------- Start ---------------- */
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`🚀 Backend live on :${PORT}`));
