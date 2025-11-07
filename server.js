// server.js — personabrowser.com (Streaming Edition + Short Link Share + Dynamic OG + Live Views)
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

console.log("🚀 Starting personabrowser.com backend (Streaming Edition + Live Views)…");

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
    <title>${ogTitle}</title>
    <script>
      sessionStorage.setItem('sharedId', '${req.params.id}');
      setTimeout(() => {
        window.location.href = 'https://personabrowser.com';
      }, 1200);
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

/* ---------------- View Counter (Today + Yesterday) ---------------- */
const VIEW_FILE = path.join("/data", "views.json");

function ensureViewFile() {
  if (!fs.existsSync(VIEW_FILE)) {
    const init = { today: 0, yesterday: 0, lastDate: new Date().toISOString().slice(0,10) };
    fs.writeFileSync(VIEW_FILE, JSON.stringify(init, null, 2));
  }
}

function loadViews() {
  ensureViewFile();
  return JSON.parse(fs.readFileSync(VIEW_FILE, "utf8"));
}

function saveViews(v) {
  fs.writeFileSync(VIEW_FILE, JSON.stringify(v, null, 2));
}

function updateDailyViewCount() {
  const v = loadViews();
  const todayStr = new Date().toISOString().slice(0,10);
  if (v.lastDate !== todayStr) {
    v.yesterday = v.today;
    v.today = 0;
    v.lastDate = todayStr;
  }
  v.today++;
  saveViews(v);
  return v;
}

app.get("/api/views", (req, res) => {
  const v = updateDailyViewCount();
  res.json({ today: v.today, yesterday: v.yesterday });
});

app.get("/api/views-readonly", (req, res) => {
  const v = loadViews();
  const todayStr = new Date().toISOString().slice(0,10);
  if (v.lastDate !== todayStr) {
    v.yesterday = v.today;
    v.today = 0;
    v.lastDate = todayStr;
    saveViews(v);
  }
  res.json({ today: v.today || 0, yesterday: v.yesterday || 0 });
});

/* ---------------- Socket.io Streaming ---------------- */
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

io.on("connection", socket => {
  console.log("🛰️ Client connected:", socket.id);
  const v = loadViews();
  io.emit("viewUpdate", { today: v.today, yesterday: v.yesterday });
});

/* ---------------- Start Server ---------------- */
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () =>
  console.log(`✅ Backend running (Short-Link + Dynamic OG + Live Views) on :${PORT}`)
);