//////////////////////////////////////////////////////////////
// AI CASE CLASSROOM — BACKEND (PAY PER DELIVERED SEARCH)
// Academic × Amazon Beauty Case Engine
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
const ADMIN_SECRET = process.env.ADMIN_SECRET || null;

//////////////////////////////////////////////////////////////
// ONE-TIME SEARCH TOKEN STORE
//////////////////////////////////////////////////////////////
const usedSearchTokens = new Set();

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

function verifySearchToken(token) {
  if (!token) return null;
  if (usedSearchTokens.has(token)) return null;

  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;

  const expectedSig = crypto
    .createHmac("sha256", ACCESS_TOKEN_SECRET)
    .update(payloadB64)
    .digest("hex");

  if (expectedSig !== sig) return null;

  return JSON.parse(
    Buffer.from(payloadB64, "base64url").toString()
  );
}

function consumeSearchToken(token) {
  usedSearchTokens.add(token);
}

//////////////////////////////////////////////////////////////
// STEP 1 — PLAUSIBILITY CHECK (AI)
//////////////////////////////////////////////////////////////
async function aiIsPlausibleBeautyProduct(input) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [{
      role: "system",
      content:
`Decide if the input looks like a plausible beauty or personal care product name.
This includes skincare, haircare, makeup, or beauty-related items.

Output ONLY:
YES or NO`
    },{
      role: "user",
      content: input
    }]
  });

  return out.choices[0].message.content.trim() === "YES";
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
  return majorPool.splice(
    Math.floor(Math.random() * majorPool.length), 1
  )[0];
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
// AMAZON PRODUCT SEARCH (GROUND TRUTH)
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
// CLASS GENERATOR — THESIS FORMAT (PLAIN SYMBOLS)
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

Write the analysis as an academic thesis.

Formatting rules:
- Do NOT use Markdown, asterisks (**), or numbered lists.
- Use plain academic section headers only.
- Section headers may use: colon (:), long dash (—), period (.), or bullet dot (•).
- Choose the symbol naturally and stay consistent.

Use the following section titles, in this order:

Title
Abstract
Introduction
Observation
Analysis
Discussion
Notes
Citation (Contextual)
Questions to Notice

Rules:
- Maintain an academic tone.
- Use clear, plain English.
- No selling, no judging.
- No predictions.
`
    }]
  });

  return out.choices[0].message.content.trim();
}

//////////////////////////////////////////////////////////////
// PIPELINE
//////////////////////////////////////////////////////////////
async function runPipelineWithProduct(product) {
  let major, video;

  for (let i = 0; i < STANFORD_MAJORS.length; i++) {
    major = pickMajor();
    video = await fetchStanfordVideo(major);
    if (video) break;
  }
  if (!video) return null;

  const body = await generateClass({
    major,
    videoTitle: video.title,
    productTitle: product.title
  });

  if (!body) return null;

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
// RUN ROUTE — FREE & PAID USE SAME ENGINE
//////////////////////////////////////////////////////////////
app.post("/run", async (req, res) => {
  const topic = req.body.topic || "";
  const token = req.body.searchToken || null;

  const plausible = await aiIsPlausibleBeautyProduct(topic);
  if (!plausible) {
    return res.json({ report: "Only Amazon Beauty & Personal Care products are supported." });
  }

  const product = await fetchAmazonProduct(topic);
  if (!product) {
    return res.json({ report: "Only Amazon Beauty & Personal Care products are supported." });
  }

  if (token) {
    const payload = verifySearchToken(token);
    if (!payload) {
      return res.json({ report: "Invalid or used token. Please purchase another search." });
    }

    const result = await runPipelineWithProduct(product);
    if (!result) {
      return res.json({ report: "No valid case material found. Your token was NOT used." });
    }

    consumeSearchToken(token);
    return res.json(result);
  }

  const result = await runPipelineWithProduct(product);
  if (!result) {
    return res.json({ report: "No valid case material found." });
  }

  return res.json(result);
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
        unit_amount: 50
      },
      quantity: 1
    }],
    success_url:
      `https://blueoceanbrowser.com/amazonaicaseclassroom.html?search_token=` +
      generateSearchToken(topic),
    cancel_url:
      "https://blueoceanbrowser.com/amazonaicaseclassroom.html"
  });

  res.json({ url: session.url });
});

//////////////////////////////////////////////////////////////
// ADMIN SEARCH PASS GENERATOR
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
  const url =
    `https://blueoceanbrowser.com/amazonaicaseclassroom.html?search_token=${token}`;

  res.json({ ok: true, url });
});

//////////////////////////////////////////////////////////////
// SERVER
//////////////////////////////////////////////////////////////
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🎓 Pay-per-delivered-search AI Case Classroom backend live");
});