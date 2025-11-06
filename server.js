// server.js — AI-Native Persona Browser (Streaming Edition — Clean / No-Brand OG)
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
if (!fs.existsSync("/data")) fs.mkdirSync("/data");

/* ---------------- Dynamic Preview Generator ---------------- */
app.get("/", (req, res) => {
  const slug = req.query.p || "";
  const safe = str =>
    (str || "")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  // If short link version (?p=...)
  if (slug) {
    const decoded = decodeURIComponent(slug).replace(/-/g, " ");

    // ✅ NEUTRAL / BLANK Open Graph tags (no brand text)
    const ogTitle = safe(decoded) || "personabrowser.com";
    const ogDesc = "Live data personas.";
    const ogImage = ""; // no image for clean share

    return res.send(`<!doctype html>
    <html lang="en">
    <head>
      <meta charset="utf-8"/>
      <meta name="viewport" content="width=device-width,initial-scale=1.0">
      <meta property="og:title" content="${ogTitle}">
      <meta property="og:description" content="${ogDesc}">
      <meta property="og:image" content="${ogImage}">
      <meta property="og:type" content="website">
      <meta name="twitter:card" content="summary">
      <meta name="twitter:title" content="${ogTitle}">
      <meta name="twitter:description" content="${ogDesc}">
      <title>${ogTitle}</title>
      <script>
        window.location.href='/index.html?p=${encodeURIComponent(slug)}';
      </script>
    </head>
    <body></body>
    </html>`);
  }

  // fallback if no slug
  res.redirect("/index.html");
});

/* ---------------- Static Files ---------------- */
app.use(express.static(path.join(__dirname, "public")));

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
        title: title || "personabrowser.com",
        slashtag: slug,
        domain: { fullName: "rebrand.ly" },
        tags: ["personabrowser"],
        description: description || "Live data personas.",
        meta: {
          ogTitle: "personabrowser.com",
          ogDescription: "Live data personas.",
          ogImage: "" // blank for no preview image
        }
      })
    });
    const data = await result.json();
    res.json({ shortUrl: data.shortUrl });
  } catch (err) {
    console.error("❌ Rebrandly error:", err);
    res.status(500).json({ error: "Shortener failed" });
  }
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
      const prompt = `
You are an AI persona generator connected to live web data.
Generate exactly 10 personas as valid JSON objects, each separated by <NEXT>.
Each persona must include "persona", "thought", and "hashtags".
Topic: "${query}".`;
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
          buffer = parts[parts.length - 1];
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
httpServer.listen(PORT, ()=>console.log(`✅ Clean no-brand server running on :${PORT}`));
