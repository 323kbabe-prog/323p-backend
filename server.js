//////////////////////////////////////////////////////////////
// AI CASE CLASSROOM — BACKEND (AI-GATED)
// Academic × Amazon Case Engine
//////////////////////////////////////////////////////////////

const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const OpenAI = require("openai");
const Stripe = require("stripe");
const crypto = require("crypto");

const app = express();

// 🔴 Render health check
app.get("/", (_, res) => res.status(200).send("OK"));

app.use(cors({ origin: "*" }));
app.use(express.json());

//////////////////////////////////////////////////////////////
// ENV
//////////////////////////////////////////////////////////////
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const SERP_KEY = process.env.SERPAPI_KEY || null;
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || null;

//////////////////////////////////////////////////////////////
// AI CATEGORY CLASSIFIER (SOURCE OF TRUTH)
//////////////////////////////////////////////////////////////
async function aiAllowsBeautyCategory(input) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [{
      role: "system",
      content:
`You are a strict classifier.

Decide whether the user input refers to a REAL product that belongs to
Amazon's Beauty & Personal Care category (cosmetics, skincare, makeup, haircare, beauty devices).

Rules:
- Output ONLY one word
- If it belongs → ALLOW
- Otherwise → DENY
- No explanations
- No punctuation`
    }, {
      role: "user",
      content: input
    }]
  });

  return out.choices[0].message.content.trim() === "ALLOW";
}

//////////////////////////////////////////////////////////////
// ACCESS CHECK (UNCHANGED)
//////////////////////////////////////////////////////////////
function hasFullAccess(token) {
  if (!ACCESS_TOKEN_SECRET || !token) return false;

  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return false;

  const payload = Buffer.from(payloadB64, "base64url").toString();
  const expected = crypto
    .createHmac("sha256", ACCESS_TOKEN_SECRET)
    .update(payload)
    .digest("hex");

  if (expected !== sig) return false;

  const data = JSON.parse(payload);
  return Date.now() < data.exp && data.scope === "full";
}

//////////////////////////////////////////////////////////////
// STANFORD MAJORS (UNCHANGED)
//////////////////////////////////////////////////////////////
const STANFORD_MAJORS = [
  "Psychology","Economics","Design","Sociology",
  "Computer Science","Statistics","Symbolic Systems",
  "Communication","Education","Philosophy","Law"
];

let majorPool = [...STANFORD_MAJORS];
function pickMajor() {
  if (!majorPool.length) majorPool = [...STANFORD_MAJORS];
  return majorPool.splice(Math.floor(Math.random() * majorPool.length), 1)[0];
}

//////////////////////////////////////////////////////////////
// STANFORD VIDEO SEARCH (UNCHANGED)
//////////////////////////////////////////////////////////////
const STANFORD_CHANNELS = [
  "Stanford University","Stanford Online",
  "Stanford GSB","Stanford Medicine","Stanford Engineering"
];

function isOfficialStanford(channel = "") {
  return STANFORD_CHANNELS.some(n =>
    channel.toLowerCase().includes(n.toLowerCase())
  );
}

async function fetchStanfordVideo(major) {
  if (!SERP_KEY) return null;

  const q = `Stanford University ${major} site:youtube.com/watch`;
  const url =
    `https://serpapi.com/search.json?q=${encodeURIComponent(q)}` +
    `&num=10&api_key=${SERP_KEY}`;

  const r = await fetch(url);
  const j = await r.json();

  return (j.organic_results || []).find(v =>
    v.link?.includes("youtube.com/watch") &&
    isOfficialStanford(v.source || v.channel || "")
  );
}

//////////////////////////////////////////////////////////////
// AMAZON SEARCH (UNCHANGED)
//////////////////////////////////////////////////////////////
async function fetchAmazonProduct(query) {
  if (!SERP_KEY) return null;

  const q = `
    ${query}
    site:amazon.com/dp OR site:amazon.com/gp/product
  `;

  const url =
    `https://serpapi.com/search.json?q=${encodeURIComponent(q)}` +
    `&num=10&api_key=${SERP_KEY}`;

  const r = await fetch(url);
  const j = await r.json();

  return (j.organic_results || []).find(
    x => x.link?.includes("/dp/") || x.link?.includes("/gp/product")
  );
}

//////////////////////////////////////////////////////////////
// CLASS GENERATOR (UNCHANGED)
//////////////////////////////////////////////////////////////
async function generateClass({ major, videoTitle, productTitle }) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    messages: [{
      role: "user",
      content: `
You are teaching an academic class from the perspective of ${major}.

Case material: "${productTitle}"
Academic lens: "${videoTitle}"

START WITH THIS LINE EXACTLY:
2×-AI Engine — Academic Case Analysis

Rules:
- Academic teaching tone
- No selling, no judging
- EXACTLY 5 short paragraphs

Then write:
If this way of thinking is correct, what works:

Then EXACTLY 3 short sentences. Follow with 3 points explaining how people in ${major} think about a topic.
`
    }]
  });

  return out.choices[0].message.content.trim();
}

//////////////////////////////////////////////////////////////
// PIPELINE (UNCHANGED)
//////////////////////////////////////////////////////////////
async function runPipeline(input) {
  let major, video;

  for (let i = 0; i < STANFORD_MAJORS.length; i++) {
    major = pickMajor();
    video = await fetchStanfordVideo(major);
    if (video) break;
  }

  if (!video) return { report: null };

  const product = await fetchAmazonProduct(input);
  if (!product) return { report: null };

  const body = await generateClass({
    major,
    videoTitle: video.title,
    productTitle: product.title
  });

  return {
    report:
`• ${major} — Academic Perspective
${video.link}

Case Study Material
${product.link}

${body}`
  };
}

//////////////////////////////////////////////////////////////
// ROUTE — AI-GATED
//////////////////////////////////////////////////////////////
app.post("/run", async (req, res) => {
  const topic = req.body.topic || "";
  const token = req.body.accessToken || null;

  const fullAccess = hasFullAccess(token);

  if (!fullAccess) {
    const allowed = await aiAllowsBeautyCategory(topic);
    if (!allowed) {
      return res.json({
        report:
"Access limited. Before payment, only Amazon Beauty & Personal Care products are allowed."
      });
    }
  }

  res.json(await runPipeline(topic));
});

//////////////////////////////////////////////////////////////
// STRIPE (UNCHANGED)
//////////////////////////////////////////////////////////////
app.post("/create-checkout-session", async (_, res) => {
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: {
          name: "AI Case Classroom — Full Access",
          description: "Unlimited category access"
        },
        unit_amount: 2900
      },
      quantity: 1
    }],
    success_url:
      "https://blueoceanbrowser.com/amazonclassroom.html?paid=1",
    cancel_url:
      "https://blueoceanbrowser.com/amazonclassroom.html"
  });

  res.json({ url: session.url });
});

//////////////////////////////////////////////////////////////
// SERVER
//////////////////////////////////////////////////////////////
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🎓 AI Case Classroom backend live");
});