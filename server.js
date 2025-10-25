// server.js — OP19$ backend (persona + image + voice + credit store + stripe + liveSearch)
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

// ---------------- AIDROP HISTORY MEMORY ----------------
const AIDROP_FILE = path.join("/data", "aidrop_history.json");

function loadAidropHistory() {
  try { return JSON.parse(fs.readFileSync(AIDROP_FILE, "utf-8")); }
  catch { return []; }
}

function saveAidropHistory(arr) {
  fs.writeFileSync(AIDROP_FILE, JSON.stringify(arr.slice(-50), null, 2));
}

// ---------------- Startup Logs ----------------
console.log("🚀 Starting OP19$ backend...");
console.log("OPENAI_API_KEY:", !!process.env.OPENAI_API_KEY);
console.log("STRIPE_SECRET_KEY:", !!process.env.STRIPE_SECRET_KEY);
console.log("STRIPE_WEBHOOK_SECRET:", !!process.env.STRIPE_WEBHOOK_SECRET);

// ---------------- Setup ----------------
if (!fs.existsSync("/data")) fs.mkdirSync("/data");
app.use(express.static(path.join(__dirname, "public")));
app.use('/aidrop', express.static(path.join(__dirname, 'public/aidrop')));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ---------------- Credit Store ----------------
const USERS_FILE = path.join("/data", "users.json");
const MAX_CREDITS = 150;

function loadUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8")); }
  catch { return {}; }
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

// ---------------- Persona Pool ----------------
function randomPersona() {
  const ethnicities = ["Korean", "Black", "White", "Latina", "Asian-American", "Mixed"];
  const vibes = [
    "AI founder", "tech designer", "digital artist", "vlogger", "streamer",
    "trend forecaster", "AR creator", "fashion engineer", "metaverse curator",
    "product tester", "AI researcher", "sound producer", "content strategist",
    "neural-net stylist", "startup intern", "creative coder", "virtual stylist",
    "app builder", "crypto storyteller", "UX dreamer", "AI makeup artist",
    "music technologist", "motion designer", "social media director",
    "brand futurist", "AI poet", "concept photographer", "video remixer",
    "fashion influencer", "streetwear archivist", "digital journalist",
    "UI visionary", "culture hacker", "AI choreographer", "sound curator",
    "data storyteller", "aesthetic researcher", "creator-economy coach",
    "AI community host", "trend analyst", "digital anthropologist",
    "cyber curator", "creator engineer", "neon editor", "AI copywriter",
    "content DJ", "tech-fashion hybrid", "virtual merch designer",
    "AI film editor", "short-form producer", "creative technologist"
  ];
  const styles = [
    "clean girl", "cyber y2k", "soft grunge", "streetwear", "pastel tech",
    "chrome glow", "minimalcore", "vintage remix", "e-girl", "e-boy",
    "retro-futurist", "quiet luxury", "mirror selfie", "AIcore", "blurry nostalgia",
    "glow street", "dream archive", "LA casual", "NYC minimal", "K-pop inspired",
    "oversized fit", "iridescent glam", "techwear", "soft chaos", "loud-calm hybrid",
    "main-character energy", "monochrome mood", "afterlight aesthetic",
    "sunset filter", "glittercore", "vapor minimal", "coquette digital",
    "chrome pastel", "recycled glam", "studio glow", "hazy realism",
    "low-contrast street", "creative uniform", "digital thrift", "pastel glitch",
    "underground luxe", "city casual", "future-retro", "blurred edge",
    "sleek monochrome", "glassy shimmer", "AI street", "motion chic",
    "gen-alpha preview", "calm pop", "glow neutral"
  ];

  const ethnicity = ethnicities[Math.floor(Math.random() * ethnicities.length)];
  const vibe = vibes[Math.floor(Math.random() * vibes.length)];
  const style = styles[Math.floor(Math.random() * styles.length)];
  const age = Math.floor(Math.random() * 6) + 18;
  return `a ${age}-year-old ${ethnicity} ${vibe} with a ${style} style`;
}

// ---------------- API: Live Search (Google Trends + Persona Pool) ----------------
app.get("/api/liveSearch", async (req, res) => {
  const query = req.query.q || "trending ideas";
  console.log(`🔍 Live persona drop search: "${query}"`);

  try {
    // 🌍 Fetch today’s real Google Trends
    let liveTrendsText = "";
    try {
      const rss = await fetch("https://trends.google.com/trending/rss?geo=US");
      const xml = await rss.text();
      const matches = [...xml.matchAll(/<title>(.*?)<\/title>/g)].slice(2, 7);
      const topTrends = matches.map(m => m[1]);
      liveTrendsText = `Today's top Google Trends: ${topTrends.join(", ")}.`;
      console.log("✅ Live trends injected:", topTrends);
    } catch (err) {
      console.warn("⚠️ Could not fetch Google Trends:", err.message);
      liveTrendsText = "No live Google Trends available.";
    }

    // 🔄 Generate 10 persona-based results
    const drops = [];
    for (let i = 0; i < 10; i++) {
      const persona = randomPersona();
      const trendPrompt = `
${liveTrendsText}

You are ${persona}, exploring the user search topic: "${query}".
Blend real online signals from both the user’s query and the trending topics.
Describe one short first-person founder-style event sentence (max 25 words)
— what you built, observed, or experienced connected to these signals.

Then provide:
1. One plausible real-world link (from a relevant or trending source).
2. Three short hashtags (no parentheses, lowercase, real-world).

Output exactly:
Event: <your single founder-style sentence>
Link: <verified link>
Tags: #tag1 #tag2 #tag3
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 1.0,
        messages: [
          { role: "system", content: "You are a real-time founder persona generator using real web trends." },
          { role: "user", content: trendPrompt }
        ],
      });

      const text = completion.choices[0].message.content.trim();
      const event = text.match(/Event:\s*(.+)/)?.[1] || "I’ve been designing an app that reacts to how people use AI daily.";
      const link = text.match(/Link:\s*(.+)/)?.[1] || "https://news.google.com";
      const tags = text.match(/Tags:\s*(.+)/)?.[1]?.split(" ") || ["#ai", "#creativity", "#trend"];

      drops.push({ persona, event, link, hashtags: tags });
    }

    res.json(drops);
  } catch (err) {
    console.error("❌ Live search error:", err.message);
    res.status(500).json({ error: "Failed to generate live persona drops" });
  }
});

// ---------------- Page View Counter ----------------
const VIEW_FILE = path.join("/data", "views.json");
function loadViews() { try { return JSON.parse(fs.readFileSync(VIEW_FILE, "utf-8")); } catch { return { total: 0 }; } }
function saveViews(v) { fs.writeFileSync(VIEW_FILE, JSON.stringify(v, null, 2)); }

app.get("/api/views", (req, res) => {
  const v = loadViews();
  v.total += 1;
  saveViews(v);
  res.json({ total: v.total });
});

// ---------------- Start Server ----------------
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`🚀 OP19$ backend live on :${PORT}`));