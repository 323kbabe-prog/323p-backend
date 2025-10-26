// server.js — AI-Native Persona Browser (Streaming Edition + SSL Validation)
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

console.log("🚀 Starting AI-Native Persona Browser backend (Streaming Edition)...");
console.log("OPENAI_API_KEY:", !!process.env.OPENAI_API_KEY);
console.log("SERPAPI_KEY:", !!process.env.SERPAPI_KEY);
console.log("NEWSAPI_KEY:", !!process.env.NEWSAPI_KEY);

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------------- Persona Pool ---------------- */
const ethnicities = ["Korean", "Black", "White", "Latina", "Asian-American", "Mixed"];
const vibes = [
  "AI founder", "tech designer", "digital artist", "vlogger", "streamer",
  "trend forecaster", "AR creator", "fashion engineer", "metaverse curator",
  "AI researcher", "sound producer", "content strategist", "neural-net stylist",
  "startup intern", "creative coder"
];

function randomPersona() {
  const ethnicity = ethnicities[Math.floor(Math.random() * ethnicities.length)];
  const vibe = vibes[Math.floor(Math.random() * vibes.length)];
  const first = ["Aiko","Marcus","Sofia","Ravi","Mina","David","Lila","Kenji","Isabella"];
  const last  = ["Tanaka","Lee","Martinez","Singh","Park","Johnson","Patel","Kim","Garcia"];
  const name  = `${first[Math.floor(Math.random() * first.length)]} ${last[Math.floor(Math.random() * last.length)]}`;
  return `${name}, ${ethnicity} ${vibe}`;
}

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
const VIEW_FILE = path.join("/tmp", "views.json");
function loadViews() { try { return JSON.parse(fs.readFileSync(VIEW_FILE, "utf8")); } catch { return { total: 0 }; } }
function saveViews(v) { fs.writeFileSync(VIEW_FILE, JSON.stringify(v, null, 2)); }
app.get("/api/views", (req, res) => {
  const v = loadViews(); v.total++; saveViews(v); res.json({ total: v.total });
});

/* ---------------- Retry Wrapper for OpenAI ---------------- */
async function createCompletionWithRetry(messages, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await openai.chat.completions.create({
        model: "gpt-4o-mini",
        stream: true,
        temperature: 0.9,
        messages,
      });
    } catch (err) {
      if (err.error?.type === "server_error" && attempt < retries) {
        console.warn(`⚠️ OpenAI server error, retrying (${attempt + 1}/${retries})...`);
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      throw err;
    }
  }
}

/* ---------------- Socket.io Streaming ---------------- */
io.on("connection", socket => {
  console.log("🛰️ Client connected:", socket.id);

  socket.on("personaSearch", async query => {
    console.log(`🌐 Streaming live personas for: "${query}"`);

    if (!process.env.OPENAI_API_KEY) {
      return socket.emit("personaError", "Missing OPENAI_API_KEY in environment.");
    }

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
Generate one persona at a time as valid JSON, for example:
{"persona":"${randomPersona()}","thought":"short first-person note","hashtags":["tag1","tag2","tag3"],"link":"https://example.com"}
After each, append the marker <NEXT>.
Generate up to 10 personas.
Context: ${context}
`;

      const completion = await createCompletionWithRetry([
        { role: "system", content: "Output only JSON objects separated by <NEXT>" },
        { role: "user", content: prompt }
      ]);

      let buffer = "";
      for await (const chunk of completion) {
        const text = chunk.choices?.[0]?.delta?.content || "";
        buffer += text;
        if (buffer.includes("<NEXT>")) {
          const parts = buffer.split("<NEXT>");
          const personaText = parts.shift();
          buffer = parts.join("<NEXT>");
          try {
            const persona = JSON.parse(personaText.trim());
            socket.emit("personaChunk", persona);
          } catch {}
        }
      }
      socket.emit("personaDone");
    } catch (err) {
      console.error("❌ Streaming error:", err);
      socket.emit("personaError", err.message);
    }
  });
});

/* ---------------- Save & Serve Drops ---------------- */
const DATA_DIR = "/tmp/data";
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

app.post("/api/save-drop", (req, res) => {
  try {
    const id = Math.random().toString(36).substring(2, 15);
    const filePath = path.join(DATA_DIR, `drop-${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2));
    console.log("💾 Saved drop:", id);
    res.json({ id });
  } catch (err) {
    console.error("❌ Save-drop error:", err.message);
    res.status(500).json({ error: "Save failed" });
  }
});

app.get("/data/:filename", (req, res) => {
  const filePath = path.join(DATA_DIR, req.params.filename);
  if (fs.existsSync(filePath)) return res.sendFile(filePath);
  res.status(404).json({ error: "Drop not found" });
});

/* ---------------- Root Health Route ---------------- */
app.get("/", (req, res) => {
  res.send("✅ AI-Native Persona Browser API running — backend operational.");
});

/* ---------------- Start Server ---------------- */
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () =>
  console.log(`✅ AI-Native Persona Browser (Streaming) running on :${PORT}`)
);
