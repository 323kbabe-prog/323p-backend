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
// (loose, human-like)
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

Write the analysis using the following academic thesis structure and headings exactly, in this order:

Title
- Write a clear, descriptive academic-style title that names the phenomenon being examined, not the product itself.

Abstract
- Write 3–4 sentences.
- Explain what is being examined, how it is examined, and why this analysis is useful.
- Do not mention sources, institutions, or authority.

Introduction
- Describe the context in which the product exists.
- Explain the routine, situation, or problem it appears to address.
- Keep the tone descriptive and neutral.

Observation
- Describe observable signals related to the product.
- Focus on how it is encountered, used, or normalized in everyday life.
- Do not interpret yet. Do not give opinions.

Analysis
- Interpret the observed signals using academic reasoning.
- Consider perspectives such as behavior, design, economics, or social patterns.
- Explain why these patterns might exist.
- Avoid evaluation or recommendation.

Discussion
- If this way of thinking is correct, describe what appears to function effectively.
- Focus on mechanisms and structures rather than outcomes.
- Keep the tone conditional and exploratory.

Notes
- Write one short paragraph clarifying the limits of this analysis.
- State that the discussion is interpretive, not evaluative.
- Make clear that it does not offer recommendations, predictions, or judgments.

Citation (Contextual)
- Write one sentence explaining that this analysis draws on general concepts commonly discussed in academic literature.
- Do not name authors, institutions, or specific works.

Questions to Notice
- End with exactly 3 short questions.
- These questions should help the reader notice assumptions, overlooked patterns, or similar structures elsewhere.
- Do not answer the questions.

Rules:
- Maintain an academic tone.
- Use clear, plain English.
- No selling, no judging.
- Do not claim direct access to external sources.
- Do not make predictions.
`
    }]
  });

  return out.choices[0].message.content.trim();
}

//////////////////////////////////////////////////////////////
// PIPELINE
//////////////////////////////////////////////////////////////
async function runPipelineWithProduct(productTitle) {
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
    productTitle
  });

  if (!body) return null;

  return {
    report:
`• ${major} — Academic Perspective
${video.link}

Case Study Material
${productTitle}

${body}`
  };
}

//////////////////////////////////////////////////////////////
// RUN ROUTE — FREE & PAID USE SAME ENGINE
//////////////////////////////////////////////////////////////
app.post("/run", async (req, res) => {
  let topic = req.body.topic || "";
  const token = req.body.searchToken || null;

  // STEP 1 — AI plausibility
  const plausible = await aiIsPlausibleBeautyProduct(topic);
  if (!plausible) {
    return res.json({
      report: "Only Amazon Beauty & Personal Care products are supported."
    });
  }

  // STEP 2 — Amazon decides
  const product = await fetchAmazonProduct(topic);
  if (!product) {
    return res.json({
      report: "Only Amazon Beauty & Personal Care products are supported."
    });
  }

  // PAID SEARCH
  if (token) {
    const payload = verifySearchToken(token);
    if (!payload) {
      return res.json({
        report: "Invalid or used token. Please purchase another search."
      });
    }

    const result = await runPipelineWithProduct(product.title);
    if (!result) {
      return res.json({
        report: "No valid case material found. Your token was NOT used."
      });
    }

    consumeSearchToken(token);
    return res.json(result);
  }

  // FREE SEARCH
  const result = await runPipelineWithProduct(product.title);
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
      `https://blueoceanbrowser.com/amazonclassroom.html?search_token=` +
      generateSearchToken(topic),
    cancel_url:
      "https://blueoceanbrowser.com/amazonclassroom.html"
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
    `https://blueoceanbrowser.com/amazonclassroom.html?search_token=${token}`;

  res.json({ ok: true, url });
});

//////////////////////////////////////////////////////////////
// SERVER
//////////////////////////////////////////////////////////////
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🎓 Pay-per-delivered-search AI Case Classroom backend live");
});