// server.js — AI-Native Persona Swap Browser (Web Live Data Mode + DeepLinkCheck™ Validation)
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const OpenAI = require("openai");
const cors = require("cors");
const fs = require("fs");
const fetch = require("node-fetch");
const dns = require("dns").promises;

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

console.log("🚀 Starting AI-Native Persona Swap Browser backend...");
console.log("OPENAI_API_KEY:", !!process.env.OPENAI_API_KEY);
console.log("SERPAPI_KEY:", !!process.env.SERPAPI_KEY);
console.log("NEWSAPI_KEY:", !!process.env.NEWSAPI_KEY);

if (!fs.existsSync("/data")) fs.mkdirSync("/data");

app.use(express.static(path.join(__dirname, "public")));
app.use("/aidrop", express.static(path.join(__dirname, "public/aidrop")));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------------- Persona Pool ---------------- */
const ethnicities = ["Korean", "Black", "White", "Latina", "Asian-American", "Mixed"];
const vibes = [
  "AI founder","tech designer","digital artist","vlogger","streamer","trend forecaster",
  "AR creator","fashion engineer","metaverse curator","product tester","AI researcher",
  "sound producer","content strategist","neural-net stylist","startup intern","creative coder",
  "virtual stylist","app builder","crypto storyteller","UX dreamer","AI makeup artist",
  "music technologist","motion designer","social media director","brand futurist","AI poet",
  "concept photographer","video remixer","fashion influencer","streetwear archivist",
  "digital journalist","UI visionary","culture hacker","AI choreographer","sound curator",
  "data storyteller","aesthetic researcher","creator-economy coach","AI community host",
  "trend analyst","digital anthropologist","cyber curator","creator engineer","neon editor",
  "AI copywriter","content DJ","tech-fashion hybrid","virtual merch designer","AI film editor",
  "short-form producer","creative technologist"
];

function randomPersona() {
  const ethnicity = ethnicities[Math.floor(Math.random() * ethnicities.length)];
  const vibe = vibes[Math.floor(Math.random() * vibes.length)];
  const firstNames = ["Aiko","Marcus","Sofia","Ravi","Mina","David","Lila","Oliver","Kenji","Isabella"];
  const lastNames = ["Tanaka","Lee","Martinez","Singh","Park","Johnson","Thompson","Patel","Kim","Garcia"];
  const name = `${firstNames[Math.floor(Math.random()*firstNames.length)]} ${lastNames[Math.floor(Math.random()*lastNames.length)]}`;
  return `${name}, ${ethnicity} ${vibe.charAt(0).toUpperCase()+vibe.slice(1)}`;
}

/* ---------------- DeepLinkCheck™ Validation ---------------- */
async function deepLinkCheck(links) {
  const trustedTLDs = [".com", ".org", ".net", ".co", ".gov", ".edu", ".io", ".ai", ".jp"];
  const valid = [];

  for (const r of links) {
    if (!r.link || !r.link.startsWith("https")) continue;
    if (r.link.includes("example.com")) continue;

    const domain = r.link.split("/")[2];
    if (!trustedTLDs.some(tld => domain.endsWith(tld))) continue;

    try {
      // Step 1: DNS resolve (to avoid NXDOMAIN)
      await dns.lookup(domain);

      // Step 2: HTTP check (fast HEAD request)
      const resp = await fetch(r.link, { method: "HEAD", timeout: 5000 });
      if (resp.ok) valid.push(r);
    } catch (err) {
      console.log(`⚠️ Rejected ${r.link}: ${err.code || err.message}`);
    }
  }

  // fallback if too few valid
  if (valid.length < 3) {
    valid.push({ link: "https://www.reuters.com" });
    valid.push({ link: "https://www.nytimes.com" });
    valid.push({ link: "https://www.bbc.com" });
  }

  return valid.slice(0, 5);
}

/* ---------------- Persona Search API ---------------- */
app.get("/api/persona-search", async (req, res) => {
  const query = req.query.query || "latest AI trends";
  console.log(`🌐 Live Persona Search for: "${query}"`);

  let webContext = "";
  let linkPool = [];

  // 1️⃣ Fetch live context from SerpAPI
  try {
    const serp = await fetch(
      `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=8&api_key=${process.env.SERPAPI_KEY}`
    );
    const serpData = await serp.json();
    const results = serpData.organic_results || [];

    linkPool = results
      .map(r => ({
        link: r.link,
        title: r.title || "",
        snippet: r.snippet || ""
      }))
      .filter(r => r.link && r.link.startsWith("https://"))
      .filter(r => !r.link.includes("example.com"))
      .slice(0, 10);

    const snippets = linkPool.map(r => r.snippet || r.title);
    webContext += snippets.join(" ");
  } catch (err) {
    console.warn("⚠️ SerpAPI failed:", err.message);
  }

  // 2️⃣ Fallback: NewsAPI backup
  if (!webContext) {
    try {
      const news = await fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&pageSize=8&apiKey=${process.env.NEWSAPI_KEY}`
      );
      const newsData = await news.json();
      const articles = newsData.articles?.map(a => a.title + " " + a.description) || [];
      linkPool = newsData.articles
        ?.map(a => ({ link: a.url, title: a.title }))
        .filter(a => a.link && a.link.startsWith("https://") && !a.link.includes("example.com")) || [];
      webContext += articles.join(" ");
    } catch (err2) {
      console.warn("⚠️ NewsAPI fallback failed:", err2.message);
      webContext = "No live web context available.";
    }
  }

  // 3️⃣ Run DeepLinkCheck™
  linkPool = await deepLinkCheck(linkPool);
  const linkList = linkPool.map(r => r.link).join(", ");

  // 4️⃣ Build GPT prompt
  const prompt = `
You are an AI-Native persona generator connected to verified live web data.

Use this real context about "${query}":
${webContext}

Use these verified links for reference: ${linkList}

Generate 10 unique JSON entries.
Each entry must include:
- "persona": realistic founder persona (use diverse origins)
- "thought": a first-person experience or event related to this topic
- "hashtags": exactly 3 short real hashtags (no # symbol)
- "links": 1–3 URLs from the verified list, relevant to the thought.

Return only valid JSON (no markdown, no notes).
`;

  // 5️⃣ GPT request
  let raw = "";
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      messages: [
        { role: "system", content: "Return only valid JSON arrays." },
        { role: "user", content: prompt }
      ],
    });
    raw = completion.choices?.[0]?.message?.content?.trim() || "";
  } catch (err) {
    console.error("❌ GPT request failed:", err.message);
  }

  // 6️⃣ Parse GPT output
  let parsed = [];
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) parsed = JSON.parse(match[0]);
  } catch {
    parsed = [];
  }

  // 7️⃣ Fallback if nothing parsed
  if (!Array.isArray(parsed) || parsed.length === 0) {
    parsed = [
      {
        persona: "Aiko Tanaka, Japanese AI researcher",
        thought: "I spent today studying how emotion-based algorithms shape human decisions.",
        hashtags: ["AI", "Research", "Behavior"],
        links: ["https://www.japantimes.co.jp"]
      }
    ];
  }

  res.json(parsed);
});

/* ---------------- View Counter ---------------- */
const VIEW_FILE = path.join("/data", "views.json");
function loadViews() {
  try { return JSON.parse(fs.readFileSync(VIEW_FILE, "utf-8")); }
  catch { return { total: 0 }; }
}
function saveViews(v) {
  fs.writeFileSync(VIEW_FILE, JSON.stringify(v, null, 2));
}
app.get("/api/views", (req, res) => {
  const v = loadViews();
  v.total += 1;
  saveViews(v);
  res.json({ total: v.total });
});

/* ---------------- Socket ---------------- */
io.on("connection", socket => {
  socket.on("joinRoom", id => socket.join(id));
});

/* ---------------- Start ---------------- */
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () =>
  console.log(`✅ AI-Native Persona Swap Browser backend live on :${PORT}`)
);