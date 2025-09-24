// server.js — op18 backend (persona + image + voice + credit store + stripe)
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const OpenAI = require("openai");
const cors = require("cors");
const fs = require("fs");

const app = express();

// ✅ Explicit CORS config for frontend + custom headers
app.use(cors({
  origin: ["https://1ai323.ai"], // allow your frontend domain
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "x-passcode", "x-device-id"]
}));

// ✅ Serve static files from /public so bg1.png … bg10.png work
app.use(express.static(path.join(__dirname, "public")));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------------- Credit Store ----------------
const USERS_FILE = path.join("/data", "users.json");

function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
  } catch {
    return {};
  }
}
function saveUsers(data) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}
let users = loadUsers();

// ---------------- Passcode Middleware ----------------
const API_PASSCODE = process.env.API_PASSCODE || "super-secret-pass";

function checkPasscode(req, res, next) {
  const pass = req.headers["x-passcode"];
  if (pass !== API_PASSCODE) {
    return res.status(403).json({ error: "Forbidden: invalid passcode" });
  }
  next();
}

// ---------------- Persona Generator ----------------
function randomPersona() {
  const ethnicities = ["Korean", "Black", "White", "Latina", "Asian-American", "Mixed"];
  const vibes = ["idol", "dancer", "vlogger", "streetwear model", "trainee", "influencer"];
  const styles = ["casual", "glam", "streetwear", "retro", "Y2K-inspired", "minimalist"];
  return `a ${Math.floor(Math.random() * 7) + 17}-year-old female ${
    ethnicities[Math.floor(Math.random() * ethnicities.length)]
  } ${vibes[Math.floor(Math.random() * vibes.length)]} with a ${
    styles[Math.floor(Math.random() * styles.length)]
  } style`;
}

const { TOP50_COSMETICS, TOP_MUSIC, TOP_POLITICS, TOP_AIDROP } = require("./topicPools");

/* ---------------- API: Create User ---------------- */
app.post("/api/create-user", checkPasscode, (req, res) => {
  const deviceId = req.headers["x-device-id"];
  if (!deviceId) {
    return res.status(400).json({ error: "Missing deviceId" });
  }

  const freshUsers = loadUsers();

  // ✅ Check if this device already claimed free credits
  const already = Object.values(freshUsers).find(u => u.deviceId === deviceId);
  if (already) {
    return res.status(403).json({ error: "Device already claimed free credits" });
  }

  const id = "user-" + Math.floor(Math.random() * 1e9);
  freshUsers[id] = { credits: 5, history: [], deviceId };
  saveUsers(freshUsers);

  res.json({ userId: id, credits: 5 });
});

/* ---------------- API: Credits ---------------- */
app.get("/api/credits", checkPasscode, (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: "userId required" });

  const freshUsers = loadUsers();
  const user = freshUsers[userId];
  if (!user) return res.status(403).json({ error: "Unknown userId" });

  res.json({ credits: user.credits });
});

/* ---------------- API: Description ---------------- */
app.get("/api/description", checkPasscode, async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: "userId required" });

  const freshUsers = loadUsers();
  const user = freshUsers[userId];
  if (!user) return res.status(403).json({ error: "Unknown userId" });

  if (user.credits <= 0) {
    return res.status(403).json({ error: "Out of credits" });
  }

  user.credits -= 1;
  saveUsers(freshUsers);

  const topic = req.query.topic || "cosmetics";
  let pick;
  if (topic === "cosmetics") pick = TOP50_COSMETICS[Math.floor(Math.random() * TOP50_COSMETICS.length)];
  else if (topic === "music") pick = TOP_MUSIC[Math.floor(Math.random() * TOP_MUSIC.length)];
  else if (topic === "politics") pick = TOP_POLITICS[Math.floor(Math.random() * TOP_POLITICS.length)];
  else pick = TOP_AIDROP[Math.floor(Math.random() * TOP_AIDROP.length)];

  const persona = randomPersona();

  res.json({
    brand: pick.brand || pick.artist || pick.issue || "323aidrop",
    product: pick.product || pick.track || pick.keyword || pick.concept,
    persona,
    description: "📝 example description here (replace with OpenAI call)",
    hashtags: ["#NowTrending"],
    isDaily: false
  });
});

/* ---------------- API: Image ---------------- */
app.get("/api/image", checkPasscode, async (req, res) => {
  const brand = req.query.brand;
  const product = req.query.product;
  const persona = req.query.persona;
  if (!brand || !product) {
    return res.status(400).json({ error: "brand and product required" });
  }
  res.json({ image: "https://placehold.co/600x600?text=Image" });
});

/* ---------------- API: Voice ---------------- */
app.get("/api/voice", checkPasscode, async (req, res) => {
  res.setHeader("Content-Type", "audio/mpeg");
  return res.send(Buffer.alloc(1000)); // placeholder
});

/* ---------------- API: Buy Credits ---------------- */
app.post("/api/buy", checkPasscode, async (req, res) => {
  res.json({ url: "https://stripe.com/checkout-session-placeholder" });
});

/* ---------------- Chat ---------------- */
io.on("connection", (socket) => {
  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    socket.roomId = roomId;
  });
});

/* ---------------- Start ---------------- */
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () =>
  console.log(`🚀 Backend live on :${PORT}, client URL: ${process.env.CLIENT_URL}`)
);