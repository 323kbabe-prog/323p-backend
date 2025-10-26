// server.js — Full Persona-First GPT Extraction + Drop Sharing Backend
// -----------------------------------------------------------
// Includes:
//  - Persona generation (GPT-4o-mini) using persona pool
//  - Drop save & share routes
//  - View counter
//  - Static + Socket.IO server setup
// -----------------------------------------------------------

const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
const fetch = require("node-fetch");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ✅ Ensure data directory exists
if (!fs.existsSync("/data")) fs.mkdirSync("/data");

// -----------------------------------------------------------
// 1. Persona Pool — creative DNA for GPT
// -----------------------------------------------------------
const ethnicities = ["Korean","Black","White","Latina","Asian-American","Mixed"];
const vibes = [
  "AI founder","tech designer","digital artist","trend forecaster","sound producer",
  "creative coder","AI choreographer","short-form producer","metaverse curator","brand futurist"
];

// -----------------------------------------------------------
// 2. Socket event for live streaming personas
// -----------------------------------------------------------
io.on("connection", (socket) => {
  console.log("🧠 Client connected.");

  socket.on("personaSearch", async (query) => {
    if (!query) return;
    console.log(`🌐 Persona search for: "${query}"`);
    try {
      // --- GPT Prompt for persona generation ---
      const personaPrompt = `
You are an AI-Native persona generator.

Use these ethnicities and creative roles as inspiration:
Ethnicities: ${ethnicities.join(", ")}
Roles: ${vibes.join(", ")}

Topic: "${query}"

Generate 10 creative personas reacting to this topic.
Each entry must have:
- "persona": name + short identity
- "thought": 1-sentence first-person reflection (max 25 words)
- "hashtags": 3 relevant tags (no #)
Return only JSON array.
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.9,
        messages: [
          { role: "system", content: "Output valid JSON only." },
          { role: "user", content: personaPrompt }
        ]
      });

      const raw = completion.choices?.[0]?.message?.content?.trim() || "";
      const match = raw.match(/\[[\s\S]*\]/);
      const personas = match ? JSON.parse(match[0]) : [];

      // Stream each persona card
      for (let i = 0; i < personas.length; i++) {
        const p = personas[i];
        socket.emit("personaChunk", p);
        await new Promise(r => setTimeout(r, 150)); // smooth stream effect
      }

      socket.emit("personaDone");
    } catch (err) {
      console.error("❌ Persona generation error:", err.message);
      socket.emit("personaError", "Persona generation failed.");
    }
  });
});

// -----------------------------------------------------------
// 3. API: Save generated drops
// -----------------------------------------------------------
app.post("/api/save-drop", (req, res) => {
  try {
    const id = Math.random().toString(36).substring(2, 15);
    const filePath = path.join("/data", `drop-${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(req.body, null, 2));
    console.log("💾 Saved drop:", id);
    res.json({ id });
  } catch (err) {
    console.error("❌ Save drop failed:", err.message);
    res.status(500).json({ error: "Save failed." });
  }
});

// -----------------------------------------------------------
// 4. API: View counter
// -----------------------------------------------------------
const VIEW_FILE = "/data/views.json";
function loadViews() {
  try { return JSON.parse(fs.readFileSync(VIEW_FILE, "utf8")); }
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

// -----------------------------------------------------------
// 5. Serve saved drop pages (share link)
// -----------------------------------------------------------
app.get("/", (req, res) => {
  const dropId = req.query.drop;
  if (!dropId) {
    return res.send("<h3 style='font-family:Inter,sans-serif;text-align:center;margin-top:40px;'>No drop specified.</h3>");
  }

  const filePath = path.join("/data", `drop-${dropId}.json`);
  if (!fs.existsSync(filePath)) {
    return res.send("<h3 style='font-family:Inter,sans-serif;text-align:center;margin-top:40px;'>Drop not found.</h3>");
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const html = `
      <html>
        <head>
          <meta charset="utf-8"/>
          <title>Persona Drop — ${dropId}</title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
            body{font-family:'Inter',sans-serif;background:#fafafa;margin:0;padding:40px;color:#000;}
            h1{text-align:center;margin-bottom:30px;}
            .card{background:#fff;border-radius:16px;box-shadow:0 1px 4px rgba(0,0,0,0.1);
                  padding:20px;margin:16px auto;max-width:600px;}
            .persona{font-weight:700;margin-bottom:8px;}
            .thought{margin-bottom:10px;}
            .hashtags{color:#666;font-size:14px;margin-bottom:8px;}
            a.back{display:block;text-align:center;margin-top:40px;font-size:14px;color:#007aff;text-decoration:none;}
            a.back:hover{text-decoration:underline;}
          </style>
        </head>
        <body>
          <h1>Persona Drop</h1>
          ${data.map(p => `
            <div class="card">
              <div class="persona">${p.persona}</div>
              <div class="thought">${p.thought}</div>
              <div class="hashtags">#${p.hashtags.join(" #")}</div>
            </div>
          `).join("")}
          <p style="text-align:center;opacity:0.7">Share their thoughts.</p>
          <a class="back" href="https://1ai323.ai">← Back to AI-Native Persona Browser</a>
        </body>
      </html>`;
    res.send(html);
  } catch (err) {
    console.error("❌ Drop load error:", err.message);
    res.status(500).send("Error loading drop.");
  }
});

// -----------------------------------------------------------
// 6. Start server
// -----------------------------------------------------------
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));
