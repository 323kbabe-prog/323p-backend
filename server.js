// server.js — AI-Native Persona Swap Browser (Web Live Data Mode + SSL Validation)
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const OpenAI = require("openai");
const cors = require("cors");
const fs = require("fs");
const fetch = require("node-fetch");
const https = require("https");

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

/* ---------------- SSL Validator (with Expiry Check) ---------------- */
async function validateHttpsLink(url) {
  return new Promise((resolve) => {
    try {
      const req = https.request(url, { method: "HEAD" }, res => {
        // ✅ Check SSL certificate expiration
        if (res.socket && res.socket.getPeerCertificate) {
          const cert = res.socket.getPeerCertificate();
          if (cert.valid_to) {
            const expiry = new Date(cert.valid_to);
            if (expiry < new Date()) {
              console.log(`⚠️ Expired SSL certificate skipped: ${url}`);
              return resolve(false); // Skip expired certificates
            }
          }
        }

        // ✅ Only accept valid HTTPS responses
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve(true);
        } else {
          console.log(`⚠️ Invalid HTTPS status (${res.statusCode}) for: ${url}`);
          resolve(false);
        }
      });

      req.on("error", (err) => {
        console.warn(`⚠️ HTTPS validation error for ${url}:`, err.message);
        resolve(false);
      });

      req.end();
    } catch (err) {
      console.warn(`⚠️ Unexpected HTTPS validation issue for ${url}:`, err.message);
      resolve(false);
    }
  });
}

/* ---------------- Persona Search API ---------------- */
app.get("/api/persona-search", async (req, res) => {
  const query = req.query.query || "latest AI trends";
  console.log(`🌐 Live Persona Search for: "${query}"`);

  let webContext = "";
  let linkPool = [];

  try {
    const serp = await fetch(
      `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=10&api_key=${process.env.SERPAPI_KEY}`
    );
    const serpData = await serp.json();

    // ✅ HTTPS-only + relevance-filtered
    const results = serpData.organic_results || [];
    linkPool = results
      .map(r => ({
        link: r.link,
        title: r.title || "",
        snippet: r.snippet || ""
      }))
      .filter(r => r.link && r.link.startsWith("https://"))
      .sort((a, b) => {
        const q = query.toLowerCase();
        const scoreA = (r.title + r.snippet).toLowerCase().includes(q) ? 1 : 0;
        const scoreB = (b.title + b.snippet).toLowerCase().includes(q) ? 1 : 0;
        return scoreB - scoreA;
      })
      .slice(0, 10);

    // ✅ SSL validation (remove expired links)
    const validLinks = [];
    for (const r of linkPool) {
      const ok = await validateHttpsLink(r.link);
      if (ok) validLinks.push(r);
    }
    linkPool = validLinks.slice(0, 5);

    const snippets = linkPool.map(r => r.snippet || r.title);
    webContext = snippets.join(" ");
    if (!webContext) throw new Error("SerpAPI empty");
  } catch (err) {
    console.warn("⚠️ SerpAPI failed:", err.message);
    try {
      const news = await fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&pageSize=5&apiKey=${process.env.NEWSAPI_KEY}`
      );
      const newsData = await news.json();
      const articles = newsData.articles?.map(a => a.title + " " + a.description) || [];
      linkPool = newsData.articles?.map(a => a.url).filter(u => u && u.startsWith("https://")) || [];
      webContext = articles.join(" ");
    } catch (err2) {
      console.warn("⚠️ NewsAPI fallback failed:", err2.message);
      webContext = "No live web context available.";
    }
  }

  const prompt = `
You are an AI-Native persona generator connected to live web data.

Use this real context about "${query}":
${webContext}

Generate 10 unique JSON entries. Each entry must include:
- "persona": e.g. "${randomPersona()}"
- "thought": a short first-person real-world experience (max 25 words)
- "hashtags": exactly 3 real hashtags (no # symbols)
- "link": one relevant, verified working HTTPS link from this list: ${linkPool.map(x => x.link).join(", ")}

Return ONLY a valid JSON array.
`;

  let raw = "";
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      messages: [
        { role: "system", content: "Output only valid JSON arrays, nothing else." },
        { role: "user", content: prompt }
      ]
    });
    raw = completion.choices?.[0]?.message?.content?.trim() || "";
  } catch (err) {
    console.error("❌ GPT request failed:", err.message);
  }

  let parsed = [];
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) parsed = JSON.parse(match[0]);
  } catch {
    parsed = [];
  }

  if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
    parsed = [
      {
        persona: "Aiko Tanaka, Japanese Language Enthusiast",
        thought: "I learned Japanese by journaling every morning and translating my own words with an AI model.",
        hashtags: ["JapaneseLanguage", "LearningJourney", "AIStudy"],
        link: "https://www.japantimes.co.jp"
      }
    ];
  }

// ✅ Step 6 — Final live check: verify each link actually responds with HTTP 200
async function verifyLiveLinks(arr) {
  const checked = [];
  for (const item of arr) {
    if (!item.link) continue;
    try {
      const r = await fetch(item.link, { method: "HEAD", timeout: 4000 });
      if (r.ok) {
        checked.push(item);
      } else {
        console.log(`⚠️ Skipped broken link (${r.status}): ${item.link}`);
      }
    } catch (err) {
      console.log(`⚠️ Link unreachable: ${item.link}`);
    }
  }
  // If none valid, return original array (fallback safety)
  return checked.length > 0 ? checked : arr;
}

// Run final link verification before sending response
parsed = await verifyLiveLinks(parsed);

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