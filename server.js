// server.js — op18 backend (persona + image + voice + credit store + stripe)
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const OpenAI = require("openai");
const cors = require("cors");
const fs = require("fs");
const Stripe = require("stripe");

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
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

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

/* ---------------- API: Buy Credits (Stripe Checkout) ---------------- */
app.post("/api/buy", checkPasscode, async (req, res) => {
  try {
    const { userId, pack, roomId } = req.query;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const freshUsers = loadUsers();
    const user = freshUsers[userId];
    if (!user) return res.status(403).json({ error: "Unknown userId" });

    // ✅ Block if at or above 150 credits
    if (user.credits >= 150) {
      return res.status(403).json({ error: "You already have the maximum credits (150)" });
    }

    const packs = {
      small: { amount: 300, credits: 30 },
      medium: { amount: 500, credits: 60 },
      large: { amount: 1000, credits: 150 },
    };
    const chosen = packs[pack] || packs.small;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: `${chosen.credits} AI Credits` },
            unit_amount: chosen.amount, // cents
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.CLIENT_URL}/?room=${roomId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/?room=${roomId}`,
      metadata: { userId, credits: chosen.credits },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("❌ Stripe checkout error:", err.message);
    res.status(500).json({ error: err.message });
  }
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

/* ---------------- Stripe Webhook ---------------- */
// ⚠️ Must be BEFORE app.use(express.json())
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("❌ Webhook signature error:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const { userId, credits } = session.metadata || {};

      if (userId && credits) {
        try {
          const currentUsers = loadUsers();
          if (!currentUsers[userId]) {
            currentUsers[userId] = { credits: 0, history: [] };
          }

          // ✅ Add credits but cap at 150
          const newBalance = currentUsers[userId].credits + parseInt(credits, 10);
          currentUsers[userId].credits = Math.min(newBalance, 150);

          currentUsers[userId].history.push({
            type: "purchase",
            credits: parseInt(credits, 10),
            at: new Date().toISOString(),
            stripeSession: session.id,
          });

          saveUsers(currentUsers);
          users = currentUsers; // refresh cache

          console.log(
            `✅ Added ${credits} credits to ${userId}, balance now ${currentUsers[userId].credits}`
          );
        } catch (err) {
          console.error("❌ Failed to update user credits:", err.message);
        }
      }
    }

    res.json({ received: true });
  }
);

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
