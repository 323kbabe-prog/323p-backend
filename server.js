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

if (!fs.existsSync("/data")) fs.mkdirSync("/data");

/* ---------------- Dynamic topic, persona & thought preview ---------------- */
app.get("/", (req, res) => {
  const topic = req.query.query || "";
  const persona = req.query.persona || "";
  const thought = req.query.thought || "";
  const hashtags = req.query.hashtags || "";

  const safe = str =>
    (str || "")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const safeTopic = safe(topic);
  const safePersona = safe(persona);
  const safeThought = safe(thought);
  const safeTags = safe(hashtags);

  const ogTitle =
    safePersona && safePersona.length > 1
      ? `AI-Native Persona Browser — ${safePersona}`
      : `AI-Native Persona Browser — ${safeTopic || "Web Live Data Mode"}`;

  const ogDesc =
    safeThought && safeThought.length > 1
      ? safeThought
      : safeTopic || "Tap here to open the link.";

  const ogImage = "https://yourdomain.com/og-image.jpg";

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

/* ---------------- Static Files ---------------- */
app.use(express.static(path.join(__dirname, "public")));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------------- SSL Validator ---------------- */
async function validateHttpsLink(url) {
  return new Promise(resolve=>{
    try {
      const req = https.request(url,{method:"HEAD",timeout:3000},res=>{
        if(res.statusCode>=200 && res.statusCode<400) resolve(true);
        else resolve(false);
      });
      req.on("error",()=>resolve(false));
      req.on("timeout",()=>{req.destroy();resolve(false);});
      req.end();
    } catch { resolve(false); }
  });
}

/* ---------------- View Counter ---------------- */
const VIEW_FILE = path.join("/data","views.json");
function loadViews(){ try{return JSON.parse(fs.readFileSync(VIEW_FILE,"utf8"));}catch{return{total:0};} }
function saveViews(v){ fs.writeFileSync(VIEW_FILE,JSON.stringify(v,null,2)); }

// READ-ONLY route: does NOT increment
app.get("/api/views-readonly", (req, res) => {
  const v = loadViews();
  res.json({ total: v.total });
});

// Incrementing route (leave as-is)
app.get("/api/views",(req,res)=>{
  const v=loadViews(); v.total++; saveViews(v); res.json({total:v.total});
});

/* ---------------- Socket.io Streaming ---------------- */
io.on("connection", socket => {
  console.log("🛰️ Client connected:", socket.id);

  socket.on("personaSearch", async query => {
    console.log(`🌐 Streaming live personas for: "${query}"`);
    try {
      let linkPool = [];
      try {
        const serp = await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=5&api_key=${process.env.SERPAPI_KEY}`);
        const serpData = await serp.json();
        linkPool = (serpData.organic_results || [])
          .map(r=>r.link)
          .filter(l=>l && l.startsWith("https://"))
          .slice(0,5);
        const checks = await Promise.all(linkPool.map(validateHttpsLink));
        linkPool = linkPool.filter((_,i)=>checks[i]);
      } catch(e){ console.warn("⚠️ SerpAPI issue:",e.message); }

      const context = linkPool.join(", ") || "No verified links.";

      /* ---- GPT Streaming Prompt ---- */
      const prompt = `
You are an AI persona generator connected to live web data.

Use this context about "${query}" but do not repeat it literally.
Generate exactly 10 personas as valid JSON objects, each separated by the marker <NEXT>.

Each persona must:
- Have a unique name, cultural background, and age between 18 and 49.
- Represent a different academic or professional field (like a distinct university major).
  Cover diverse disciplines such as technology, medicine, law, arts, business, philosophy, environment, psychology, sociology, design, and engineering.
- Speak in the first person about how the topic "${query}" connects to their field or research.
- Mention one realistic project, study, or collaboration they personally experienced related to the topic.
- Reflect their age and field in tone and vocabulary.
- Keep each persona concise and believable.

Output format for each persona:
{
  "persona": "Name (Age), [Field or Major]",
  "thought": "First-person reflection connecting their identity to '${query}' and describing one personal event or project tied to it.",
  "hashtags": ["tag1","tag2","tag3"],
  "link": "https://example.com"
}
Context: ${context}
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        stream: true,
        temperature: 0.9,
        messages: [
          { role:"system", content:"Output only JSON objects separated by <NEXT>" },
          { role:"user", content:prompt }
        ]
      });

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
          } catch { /* skip partials */ }
        }
      }

      // ✅ Emit any remaining persona (last drop)
      if (buffer.trim().length > 0) {
        try {
          const lastPersona = JSON.parse(buffer.trim());
          socket.emit("personaChunk", lastPersona);
        } catch { /* ignore if invalid */ }
      }

      socket.emit("personaDone");
    } catch (err) {
      console.error("❌ Streaming error:", err);
      socket.emit("personaError", err.message);
    }
  });
});

/* ---------------- OpenAI Image Generation (Resilient & Fast) ---------------- */
app.post("/api/generate-image", async (req, res) => {
  const { persona, age, profession } = req.body;

  const role = (profession || "").toLowerCase();
  let background = "neutral background";
  if (role.includes("scientist") || role.includes("research"))
    background = "bright research lab background";
  else if (role.includes("engineer") || role.includes("developer") || role.includes("programmer"))
    background = "tech workspace with computer screens";
  else if (role.includes("designer") || role.includes("artist") || role.includes("illustrator"))
    background = "creative studio background";
  else if (role.includes("manager") || role.includes("marketer") || role.includes("consultant"))
    background = "modern office background";
  else if (role.includes("musician") || role.includes("performer") || role.includes("dancer"))
    background = "music studio or stage lighting";
  else if (role.includes("teacher") || role.includes("professor"))
    background = "classroom or library background";

  const prompt = `portrait photo of ${persona || "a person"}, ${age || "25"} years old, ${profession || "creator"},
  professional attire, neutral confident expression, cinematic soft light, ${background},
  realistic skin texture, natural tone, no text, no logo, no watermark`;

  try {
    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1536", // valid vertical format
      quality: "low",    // fastest available
    });
    res.json({ url: result.data[0].url });
  } catch (err) {
    // --- graceful fallback for transient OpenAI server errors ---
    console.error("⚠️ Image generation error:", err?.message || err);
    // return a neutral placeholder so the front end still renders
    res.json({
      url: "https://upload.wikimedia.org/wikipedia/commons/9/99/Sample_User_Icon.png",
      warning: "OpenAI image generation temporarily unavailable; placeholder used."
    });
  }
});

/* ---------------- Start Server ---------------- */
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, ()=>console.log(`✅ AI-Native Persona Browser (Streaming) running on :${PORT}`));
