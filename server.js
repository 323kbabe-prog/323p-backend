// server.js — personabrowser.com (Streaming Edition + Short Link Share + iOS/Android Compatible)
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

console.log("🚀 Starting personabrowser.com backend (Streaming Edition)…");
console.log("OPENAI_API_KEY:", !!process.env.OPENAI_API_KEY);
console.log("SERPAPI_KEY:", !!process.env.SERPAPI_KEY);

if (!fs.existsSync("/data")) fs.mkdirSync("/data");

/* ---------------- Dynamic Preview Generator (OG tags for iOS/Android share) ---------------- */
app.get("/", (req, res) => {
  const ogTitle = "personabrowser.com";
  const ogDesc = "Live data personas — instantly generated.";
  const ogImage = "https://personabrowser.com/neutral-preview.jpg";

  res.send(`<!doctype html>
  <html lang="en">
  <head>
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
    <script>
      const qs = window.location.search;
      window.location.href = '/index.html' + qs;
    </script>
  </head>
  <body></body>
  </html>`);
});

/* ---------------- Short-Link Share Routes ---------------- */
const SHARES_FILE = path.join("/data", "shares.json");

// Save shared personas and return short ID
app.post("/api/share", (req, res) => {
  try {
    const data = req.body.personas;
    const id = Math.random().toString(36).substring(2, 8);
    const all = fs.existsSync(SHARES_FILE)
      ? JSON.parse(fs.readFileSync(SHARES_FILE, "utf8"))
      : {};
    all[id] = data;
    fs.writeFileSync(SHARES_FILE, JSON.stringify(all, null, 2));
    res.json({ shortId: id });
  } catch (err) {
    console.error("❌ Share save failed:", err);
    res.status(500).json({ error: "Failed to save share" });
  }
});

// Redirect short link to GoDaddy front-end and preload shared data
app.get("/s/:id", (req, res) => {
  const all = fs.existsSync(SHARES_FILE)
    ? JSON.parse(fs.readFileSync(SHARES_FILE, "utf8"))
    : {};
  const personas = all[req.params.id];
  if (!personas) return res.redirect("https://personabrowser.com");

  // Encode personas safely for URL transfer
  const encoded = encodeURIComponent(JSON.stringify(personas));

  res.send(`<!doctype html>
  <html><head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta property="og:title" content="personabrowser.com">
  <meta property="og:description" content="Shared AI Personas">
  <meta property="og:image" content="https://personabrowser.com/neutral-preview.jpg">
  <script>
    // Embed the personas in the redirect itself
    const data = decodeURIComponent("${encoded}");
    sessionStorage.setItem('sharedData', data);
    window.location.href = 'https://personabrowser.com';
  </script>
  </head><body></body></html>`);
});

/* ---------------- Static Files ---------------- */
app.use(express.static(path.join(__dirname, "public")));

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

/* ---------------- Socket.io Streaming ---------------- */
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
Generate exactly 10 personas as valid JSON objects, each separated by the marker <NEXT>.
Each persona must:
- Have a unique name, cultural background, and age between 18 and 49.
- Represent a different academic or professional field.
- Speak in the first person about how the topic "${query}" connects to their field.
- Mention one realistic project, study, or collaboration they personally experienced.
Output format:
{
  "persona": "Name (Age), [Field]",
  "thought": "Reflection about '${query}'",
  "hashtags": ["tag1","tag2","tag3"]
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
            try {
              const persona = JSON.parse(parts[i].trim());
              socket.emit("personaChunk", persona);
            } catch {}
          }
          buffer = parts[parts.length - 1];
        }
      }

      if (buffer.trim().length > 0) {
        try {
          const lastPersona = JSON.parse(buffer.trim());
          socket.emit("personaChunk", lastPersona);
        } catch {}
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
  console.log(`✅ personabrowser.com backend running with short-link share + OG tags on :${PORT}`)
);