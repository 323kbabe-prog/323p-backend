// server.js — AI-Native Persona Browser (Streaming Edition + Clean Share Links)
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

console.log("🚀 Starting AI-Native Persona Browser backend (Streaming Edition)…");
console.log("OPENAI_API_KEY:", !!process.env.OPENAI_API_KEY);
console.log("SERPAPI_KEY:", !!process.env.SERPAPI_KEY);

if (!fs.existsSync("/data")) fs.mkdirSync("/data");

/* ---------------- Dynamic Preview Generator ---------------- */
app.get("/", (req, res) => {
  const slug = req.query.p || "";
  const topic = req.query.query || "";
  const persona = req.query.persona || "";
  const thought = req.query.thought || "";

  const safe = str =>
    (str || "")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  // short link (?p=...)
  if (slug) {
    const decoded = decodeURIComponent(slug).replace(/-/g, " ");
    const ogTitle = decoded || "AI-Native Persona Browser";
    const ogDesc = "The world’s first AI-Native Persona Browser — Live Data Mode. Tap to explore live personas.";
    const ogImage = "https://personabrowser.com/preview.jpg";

    return res.send(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta property="og:title" content="${ogTitle}">
<meta property="og:description" content="${ogDesc}">
<meta property="og:image" content="${ogImage}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${ogTitle}">
<meta name="twitter:description" content="${ogDesc}">
<meta name="twitter:image" content="${ogImage}">
<title>${ogTitle}</title>
<script>window.location.href='/index.html?p=${encodeURIComponent(slug)}';</script>
</head><body></body></html>`);
  }

  // fallback full query
  const safeTopic = safe(topic);
  const safePersona = safe(persona);
  const safeThought = safe(thought);
  const ogTitle = safePersona || "AI-Native Persona Browser";
  const ogDesc =
    safeThought && safeThought.length > 1
      ? `${safeThought.slice(0, 150)}…`
      : safeTopic || "Discover live AI-generated personas.";
  const ogImage = "https://personabrowser.com/preview.jpg";

  res.send(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta property="og:title" content="${ogTitle}">
<meta property="og:description" content="${ogDesc}">
<meta property="og:image" content="${ogImage}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${ogTitle}">
<meta name="twitter:description" content="${ogDesc}">
<meta name="twitter:image" content="${ogImage}">
<title>${ogTitle}</title>
<script>window.location.href='/index.html'+window.location.search;</script>
</head><body></body></html>`);
});

/* ---------------- Static Files ---------------- */
app.use(express.static(path.join(__dirname, "public")));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------------- SSL Validator ---------------- */
async function validateHttpsLink(url) {
  return new Promise(resolve => {
    try {
      const req = https.request(url, { method: "HEAD", timeout: 3000 }, res => {
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      });
      req.on("error", () => resolve(false));
      req.on("timeout", () => { req.destroy(); resolve(false); });
      req.end();
    } catch { resolve(false); }
  });
}

/* ---------------- View Counter ---------------- */
const VIEW_FILE = path.join("/data", "views.json");
function loadViews() {
  try { return JSON.parse(fs.readFileSync(VIEW_FILE, "utf8")); }
  catch { return { total: 0 }; }
}
function saveViews(v) { fs.writeFileSync(VIEW_FILE, JSON.stringify(v, null, 2)); }

app.get("/api/views", (req, res) => {
  const v = loadViews(); v.total++; saveViews(v);
  res.json({ total: v.total });
});

/* ---------------- Shortlink Generator (Rebrandly) ---------------- */
app.post("/api/shorten", async (req, res) => {
  const { slug, title, description, image } = req.body;
  const longUrl = `https://personabrowser.com/?p=${encodeURIComponent(slug)}`;

  try {
    const result = await fetch("https://api.rebrandly.com/v1/links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": process.env.REBRANDLY_API_KEY
      },
      body: JSON.stringify({
        destination: longUrl,
        title: title || "AI-Native Persona Browser",
        slashtag: slug,
        domain: { fullName: "rebrand.ly" },
        tags: ["personabrowser"],
        description: description || "The world’s first AI-Native Persona Browser — Live Data Mode.",
        meta: {
          ogTitle: "AI-Native Persona Browser",
          ogDescription: "The world’s first AI-Native Persona Browser — Live Data Mode.",
          ogImage: image || "https://personabrowser.com/preview.jpg"
        }
      })
    });
    const data = await result.json();
    res.json({ shortUrl: data.shortUrl || null });
  } catch (err) {
    console.error("❌ Rebrandly error:", err);
    res.status(500).json({ error: "Shortener failed" });
  }
});

/* ---------------- Socket.io Streaming ---------------- */
io.on("connection", socket => {
  console.log("🛰️ Client connected:", socket.id);

  socket.on("personaSearch", async query => {
    console.log(`🌐 Streaming live personas for: "${query}"`);
    try {
      let linkPool = [];
      try {
        const serp = await fetch(
          `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=5&api_key=${process.env.SERPAPI_KEY}`
        );
        const serpData = await serp.json();
        linkPool = (serpData.organic_results || [])
          .map(r => r.link)
          .filter(l => l && l.startsWith("https://"))
          .slice(0, 5);
        const checks = await Promise.all(linkPool.map(validateHttpsLink));
        linkPool = linkPool.filter((_, i) => checks[i]);
      } catch (e) { console.warn("⚠️ SerpAPI issue:", e.message); }

      const context = linkPool.join(", ") || "No verified links.";

      const prompt = `
You are an AI persona generator connected to live web data.
Use this context about "${query}" but do not repeat it literally.
Generate exactly 10 personas as valid JSON objects, separated by <NEXT>.
Each persona must:
- Have a unique name, background, and age 18–49
- Represent a distinct field
- Speak in first person about "${query}"
- Mention one real project or event
- Be concise and believable
Format:
{
  "persona":"Name (Age), [Field]",
  "thought":"First-person reflection",
  "hashtags":["tag1","tag2","tag3"],
  "link":"https://example.com"
}
Context: ${context}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        stream: true,
        temperature: 0.9,
        messages: [
          { role: "system", content: "Output only JSON objects separated by <NEXT>" },
          { role: "user", content: prompt }
        ]
      });

      let buffer = "";
      for await (const chunk of completion) {
        const text = chunk.choices?.[0]?.delta?.content || "";
        buffer += text;
        if (buffer.includes("<NEXT>")) {
          const parts = buffer.split("<NEXT>");
          for (let i = 0; i < parts.length - 1; i++) {
            try { socket.emit("personaChunk", JSON.parse(parts[i].trim())); } catch {}
          }
          buffer = parts.at(-1);
        }
      }
      if (buffer.trim()) {
        try { socket.emit("personaChunk", JSON.parse(buffer.trim())); } catch {}
      }
      socket.emit("personaDone");
    } catch (err) {
      console.error("❌ Streaming error:", err);
      socket.emit("personaError", err.message);
    }
  });
});

/* ---------------- Start Server ---------------- */
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () =>
  console.log(`✅ AI-Native Persona Browser backend running on :${PORT}`)
);
