// server.js — personabrowser.com (Streaming Edition + Short Link Share + Dynamic OG Preview)
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

function ensureDataDir() {
  if (!fs.existsSync("/data")) fs.mkdirSync("/data");
}

/* ---------------- Root Dynamic Preview ---------------- */
app.get("/", (req, res) => {
  const ogTitle = "personabrowser.com";
  const ogDesc = "Live data personas — instantly generated.";
  const ogImage = "https://personabrowser.com/neutral-preview.jpg";

  res.send(`<!doctype html>
  <html><head>
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
      setTimeout(() => {
        window.location.replace('/index.html' + qs);
      }, 1200);
    </script>
  </head><body></body></html>`);
});

/* ---------------- Short-Link Share ---------------- */
const SHARES_FILE = path.join("/data", "shares.json");

app.post("/api/share", (req, res) => {
  try {
    ensureDataDir();
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

/* ---------------- Dynamic OG for Short-Link ---------------- */
app.get("/s/:id", (req, res) => {
  const all = fs.existsSync(SHARES_FILE)
    ? JSON.parse(fs.readFileSync(SHARES_FILE, "utf8"))
    : {};
  const personas = all[req.params.id];
  if (!personas) return res.redirect("https://personabrowser.com");

  const first = personas[0] || {};
  const ogTitle = first.persona
    ? `${first.persona} — personabrowser.com`
    : "personabrowser.com";
  const ogDesc = first.thought
    ? first.thought.slice(0, 160)
    : "Shared AI Personas";
  const ogImage = "https://personabrowser.com/neutral-preview.jpg";

  res.send(`<!doctype html>
  <html><head>
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
      sessionStorage.setItem('sharedId', '${req.params.id}');
      setTimeout(() => {
        window.location.href = 'https://personabrowser.com';
      }, 1200);
    </script>
  </head><body></body></html>`);
});

/* ---------------- API to load shared personas ---------------- */
app.get("/api/share/:id", (req, res) => {
  const all = fs.existsSync(SHARES_FILE)
    ? JSON.parse(fs.readFileSync(SHARES_FILE, "utf8"))
    : {};
  const personas = all[req.params.id];
  if (!personas) return res.status(404).json({ error: "Not found" });
  res.json(personas);
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
function saveViews(v) {
  try {
    ensureDataDir();
    fs.writeFileSync(VIEW_FILE, JSON.stringify(v, null, 2));
  } catch (err) {
    console.warn("⚠️ Could not persist view count:", err.message);
  }
}

app.get("/api/views", (req, res) => {
  const v = loadViews(); 
  v.total++; 
  saveViews(v);
  res.json({ total: v.total });
});

// ✅ Add this route for your Live Views page
app.get("/api/views-readonly", (req, res) => {
  const v = loadViews();
  res.json({ total: v.total || 0 });
});

/* ---------------- Socket.io Streaming ---------------- */
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

io.on("connection", socket => {
  console.log("🛰️ Client connected:", socket.id);

  /* ---- Live Views Tracking ---- */
  try {
    const v = loadViews();
    v.total++;
    saveViews(v);

    // Broadcast new total to everyone
    io.emit("viewUpdate", { total: v.total });

    // Handle disconnects
    socket.on("disconnect", () => {
      const cur = loadViews();
      if (cur.total > 0) cur.total--;
      saveViews(cur);
      io.emit("viewUpdate", { total: cur.total });
    });
  } catch (err) {
    console.warn("⚠️ Live views tracking error:", err.message);
  }

  /* ---- Persona Streaming ---- */
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
      } catch (e) {
        console.warn("⚠️ SerpAPI issue:", e.message);
      }

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
              socket.emit("personaChunk", JSON.parse(parts[i].trim()));
            } catch {}
          }
          buffer = parts[parts.length - 1];
        }
      }

      if (buffer.trim().length > 0) {
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
  console.log(`✅ personabrowser.com backend running (Short-Link + Dynamic OG + Live Views) on :${PORT}`)
);

