// server.js — npcbrowser.com (Simulation NPC Edition + Short Link + Language + SERPAPI)

const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const OpenAI = require("openai");
const cors = require("cors");
const fs = require("fs");
const fetch = require("node-fetch");
const https = require("https");

const ROOT_DOMAIN = "https://npcbrowser.com";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

console.log("🚀 Starting NPC Browser backend (Simulation NPC Edition)…");
console.log("OPENAI_API_KEY:", !!process.env.OPENAI_API_KEY);
console.log("SERPAPI_KEY:", !!process.env.SERPAPI_KEY);

if (!fs.existsSync("/data")) fs.mkdirSync("/data");
function ensureDataDir() {
  if (!fs.existsSync("/data")) fs.mkdirSync("/data");
}

/* ---------------- Root OG Preview ---------------- */
app.get("/", (req, res) => {
  const title = "NPC Browser — AI NPCs That React to the Real World";
  const desc = "NPC personas generated in real time — shaped by the simulation and live web data.";
  const image = `${ROOT_DOMAIN}/og-npc.jpg`;

  res.send(`<!doctype html>
  <html><head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1.0">

    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${desc}">
    <meta property="og:image" content="${image}">
    <meta property="og:type" content="website">

    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${desc}">
    <meta name="twitter:image" content="${image}">

    <title>${title}</title>

    <script>
      const qs = window.location.search;
      setTimeout(()=>{ window.location.replace("/index.html" + qs); }, 1100);
    </script>
  </head><body></body></html>`);
});

/* ---------------- Short-Link Share System ---------------- */
const SHARES_FILE = path.join("/data", "shares.json");

app.post("/api/share", (req, res) => {
  try {
    ensureDataDir();
    const id = Math.random().toString(36).substring(2, 8);

    const all =
      fs.existsSync(SHARES_FILE)
        ? JSON.parse(fs.readFileSync(SHARES_FILE, "utf8"))
        : {};

    all[id] = req.body.personas;

    fs.writeFileSync(SHARES_FILE, JSON.stringify(all, null, 2));
    res.json({ shortId: id });

  } catch (err) {
    console.error("❌ Share save failed:", err);
    res.status(500).json({ error: "Failed to save share" });
  }
});

/* ---------------- OG Preview for /s/:id ---------------- */
app.get("/s/:id", (req, res) => {
  const all =
    fs.existsSync(SHARES_FILE)
      ? JSON.parse(fs.readFileSync(SHARES_FILE, "utf8"))
      : {};

  const personas = all[req.params.id];
  if (!personas) return res.redirect(ROOT_DOMAIN);

  const first = personas[0] || {};
  const ogTitle = "NPC Browser — Shared NPC from the Simulation";
  const ogDesc = first.thought
    ? first.thought.slice(0, 160)
    : "Simulation NPC generated from live data.";

  const ogImage = `${ROOT_DOMAIN}/og-npc.jpg`;

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
      sessionStorage.setItem("sharedId", "${req.params.id}");
      setTimeout(()=>{ window.location.href="${ROOT_DOMAIN}"; }, 1100);
    </script>
  </head><body></body></html>`);
});

/* ---------------- Load Shared Personas ---------------- */
app.get("/api/share/:id", (req, res) => {
  const all =
    fs.existsSync(SHARES_FILE)
      ? JSON.parse(fs.readFileSync(SHARES_FILE, "utf8"))
      : {};

  const personas = all[req.params.id];
  if (!personas) return res.status(404).json({ error: "Not found" });

  res.json(personas);
});

/* ---------------- View Counter ---------------- */
const VIEW_FILE = path.join("/data", "views.json");

function loadViews() {
  try {
    return JSON.parse(fs.readFileSync(VIEW_FILE, "utf8"));
  } catch {
    return { total: 0 };
  }
}

function saveViews(v) {
  ensureDataDir();
  fs.writeFileSync(VIEW_FILE, JSON.stringify(v, null, 2));
}

app.get("/api/views", (req, res) => {
  const v = loadViews();
  v.total++;
  saveViews(v);
  res.json({ total: v.total });
});

/* ---------------- Static Files ---------------- */
app.use(express.static(path.join(__dirname, "public")));

/* ---------------- Validate HTTPS Link ---------------- */
async function validateHttpsLink(url) {
  return new Promise(resolve => {
    try {
      const req = https.request(
        url,
        { method: "HEAD", timeout: 3000 },
        res => resolve(res.statusCode >= 200 && res.statusCode < 400)
      );
      req.on("error", () => resolve(false));
      req.on("timeout", () => { req.destroy(); resolve(false); });
      req.end();
    } catch {
      resolve(false);
    }
  });
}

/* ---------------- NPC Streaming Engine ---------------- */
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

io.on("connection", socket => {
  console.log("🛰️ Client connected:", socket.id);

  socket.on("personaSearch", async query => {
    console.log(`🔍 NPC Search for: ${query}`);

    /* Detect language */
    let lang = "en";
    try {
      const lr = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          { role: "system", content: "Return only ISO language code" },
          { role: "user", content: query }
        ]
      });

      lang = lr.choices[0].message.content.trim().toLowerCase();

    } catch {
      lang = "en";
    }

    /* SERPAPI Fetch */
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
      console.warn("⚠️ SERPAPI issue:", e.message);
    }

    const context = linkPool.join(", ") || "No valid sources.";

    /* NPC Simulation-Lore Prompt */
    const prompt = `
You are NPC Browser — a simulation engine generating self-aware NPC personas based on live web data.

For the topic "${query}", generate exactly 10 NPC JSON objects separated by <NEXT>.
Each NPC must:

- Be aware they are a simulated NPC formed from algorithmic data pulses.
- React to real web signals (from: ${context}).
- Include demographics: gender, race, age (18–49).
- Have an identity (NPC role) not a human name.
- Narrate in first-person, calm, eerie, philosophical tone.
- Describe how the topic rewrote their “behavior rules”.
- Contain one "memory injection" (a believable past project in the simulation).
- Provide 3–5 real, relevant hashtags.
- Respond in ${lang}.

Output only JSON objects separated by <NEXT>.
`;

    /* Streaming from OpenAI */
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        stream: true,
        temperature: 0.95,
        messages: [
          { role: "system", content: "Output only JSON, separated by <NEXT>" },
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

      if (buffer.trim()) {
        try {
          socket.emit("personaChunk", JSON.parse(buffer.trim()));
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
httpServer.listen(PORT, () => {
  console.log(`✅ NPC Browser backend running on :${PORT}`);
});