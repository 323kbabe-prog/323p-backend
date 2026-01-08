//////////////////////////////////////////////////////////////
// AI CASE CLASSROOM — BACKEND (PAY-PER-SEARCH, ONE FREE)
// Academic × Amazon Case Engine
//////////////////////////////////////////////////////////////

const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const OpenAI = require("openai");
const Stripe = require("stripe");
const crypto = require("crypto");

const app = express();

// Health check
app.get("/", (_, res) => res.status(200).send("OK"));

app.use(cors({ origin: "*" }));
app.use(express.json());

//////////////////////////////////////////////////////////////
// ENV
//////////////////////////////////////////////////////////////
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const SERP_KEY = process.env.SERPAPI_KEY || null;
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "SECRET_KEY_HERE";

// Admin secret for one-pass generation
const ADMIN_SECRET = process.env.ADMIN_SECRET;

//////////////////////////////////////////////////////////////
// ONE-TIME SEARCH TOKEN STORE
//////////////////////////////////////////////////////////////
const usedSearchTokens = new Set();

// Creates a single-use signed token
function generateSearchToken(topic) {
  const payload = {
    topic,
    nonce: crypto.randomBytes(16).toString("hex"),
    iat: Date.now()
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");

  const sig = crypto
    .createHmac("sha256", ACCESS_TOKEN_SECRET)
    .update(payloadB64)
    .digest("hex");

  return `${payloadB64}.${sig}`;
}

// Verifies + consumes token
function verifyAndConsumeSearchToken(token) {
  if (!token) return null;

  if (usedSearchTokens.has(token)) return null; // Prevent reuse

  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;

  const expectedSig = crypto
    .createHmac("sha256", ACCESS_TOKEN_SECRET)
    .update(payloadB64)
    .digest("hex");

  if (expectedSig !== sig) return null;

  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());

  usedSearchTokens.add(token); // consume

  return payload.topic;
}

//////////////////////////////////////////////////////////////
// BEAUTY TRANSFORMATION ENGINE
//////////////////////////////////////////////////////////////
async function transformToBeautyProductQuery(input) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [{
      role: "system",
      content:
`Transform ANY user input into a Beauty / Personal Care product query.
Output ONLY the rewritten product query.

Examples:
"I'm stressed" → "lavender aromatherapy body oil"
"I want to travel" → "travel-size skincare kit"
"I feel ugly" → "brightening vitamin C serum"
"I have too much work" → "cooling eye mask"
"I can't make decisions" → "starter skincare routine set"`
    },{
      role:"user",
      content:input
    }]
  });

  return out.choices[0].message.content.trim();
}

//////////////////////////////////////////////////////////////
// BEAUTY CATEGORY CLASSIFIER (FREE USERS)
//////////////////////////////////////////////////////////////
async function aiAllowsBeautyCategory(input) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [{
      role: "system",
      content:
`Decide if input refers to a REAL product in Amazon Beauty & Personal Care.
Output ONLY: ALLOW or DENY.`
    }, {
      role: "user",
      content: input
    }]
  });

  return out.choices[0].message.content.trim() === "ALLOW";
}

//////////////////////////////////////////////////////////////
// STANFORD MAJORS
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
// STANFORD VIDEO SEARCH
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
// AMAZON PRODUCT SEARCH
//////////////////////////////////////////////////////////////
async function fetchAmazonProduct(query) {
  if (!SERP_KEY) return null;

  const q = `${query} site:amazon.com/dp OR site:amazon.com/gp/product`;

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
// CLASS GENERATOR
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
- Academic tone
- No selling, no judging
- 5 short paragraphs

Then write:
If this way of thinking is correct, what works:

Then exactly 3 short sentences.
Follow with 3 points explaining how people in ${major} think about a topic.
`
    }]
  });

  return out.choices[0].message.content.trim();
}

//////////////////////////////////////////////////////////////
// PIPELINE
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
// RUN ROUTE (SECURE PAY-PER-SEARCH)
//////////////////////////////////////////////////////////////
app.post("/run", async (req, res) => {
  let topic = req.body.topic || "";
  const token = req.body.searchToken || null;

  // PAID SEARCH — use token
  if (token) {
    const extractedTopic = verifyAndConsumeSearchToken(token);
    if (!extractedTopic) {
      return res.json({
        report: "Invalid or used token. Please purchase another search."
      });
    }

    topic = await transformToBeautyProductQuery(extractedTopic);
    return res.json(await runPipeline(topic));
  }

  // FREE SEARCH — must be real Beauty category
  const allowed = await aiAllowsBeautyCategory(topic);
  if (!allowed) {
    return res.json({
      report: "Free mode allows only REAL Amazon Beauty & Personal Care products."
    });
  }

  return res.json(await runPipeline(topic));
});

//////////////////////////////////////////////////////////////
// STRIPE — $0.50 PER SEARCH
//////////////////////////////////////////////////////////////
app.post("/create-search-session", async (req, res) => {
  const topic = req.body.topic || "";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: { name: "AI Case Classroom — One Search" },
        unit_amount: 50   // $0.50
      },
      quantity: 1
    }],
    success_url:
      `https://blueoceanbrowser.com/amazonclassroom.html?search_token=` +
      generateSearchToken(topic),
    cancel_url:
      "https://blueoceanbrowser.com/amazonclassroom.html"
  });

  res.json({ url: session.url });
});

//////////////////////////////////////////////////////////////
// ADMIN ONE-PASS SEARCH TOKEN GENERATOR
//////////////////////////////////////////////////////////////
app.get("/create-admin-pass", async (req, res) => {
  const secret = req.query.secret;
  const topic  = req.query.topic || "";

  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!topic.trim()) {
    return res.json({ error: "Missing topic" });
  }

  const token = generateSearchToken(topic);

  const url = `https://blueoceanbrowser.com/amazonclassroom.html?search_token=${token}`;

  res.json({ ok: true, url });
});

//////////////////////////////////////////////////////////////
// SERVER
//////////////////////////////////////////////////////////////
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🎓 Pay-per-search AI Case Classroom backend live");
});