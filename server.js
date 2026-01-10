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
// CLASS GENERATOR — THESIS FORMAT (TITLE FIXED)
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

After this line, write an academic thesis.
The purpose of this thesis is not to deliver content, but to demonstrate a way of thinking.

Background meaning (do not quote directly, but reflect in structure and tone):
• Users are not paying for content — they are paying for cognitive structure.
• People do not pay for results — they pay for certainty.
• This work does not sell outcomes — it models a thinking habit.

Formatting rules:
- Do NOT use Markdown, asterisks (**), or numbered lists.
- Use plain academic section headers only.
- Section headers may use: colon (:), long dash (—), period (.), or bullet dot (•).
- Choose the symbol naturally and stay consistent.
- Use big dot points (•) within sections to reveal reasoning structure.
- Bullet points should represent mental models, distinctions, or analytical moves — not features or summaries.

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

Section guidelines:

Title
- Write a clear academic thesis title describing the case and the academic perspective.
- The title should name a phenomenon or pattern, not the product or system.
- Do not mention engine names, system names, or branding.

Abstract
Write 3–4 sentences, then include 2–3 big dot points that clarify the structure of the inquiry.
• What kind of situation is being examined
• What kind of thinking is being applied
• Why this way of thinking creates clarity

Introduction
Describe the broader context in which the case exists.
Then include big dot points that surface framing assumptions.
• What problem space this case belongs to
• What kinds of user routines or expectations are implied
• What type of decision-making environment is present

Observation
Describe observable signals without interpretation.
Then include big dot points that separate observation from meaning.
• What is visible, repeatable, or standardized
• What behaviors appear normalized
• What is present without explaining why

Analysis
Interpret the observations using academic reasoning.
Then include big dot points that show analytical moves.
• How form, behavior, or design shape understanding
• How constraints influence choices
• How meaning is produced through structure, not claims

Discussion
If this way of thinking is correct, describe what appears to function effectively.
Then include big dot points that focus on mechanisms, not outcomes.
• What creates certainty for users
• What reduces cognitive effort
• What makes decisions feel easier or safer

Notes
Write one short paragraph clarifying the limits of this analysis.
Then include big dot points that protect against over-interpretation.
• This is an interpretive model, not a verdict
• This does not predict success or failure
• This does not recommend action

Citation (Contextual)
Write one sentence explaining that this analysis draws on general academic concepts.
Then include 1–2 big dot points indicating domains of thought.
• Design theory
• Behavioral reasoning
• Organizational or communication studies
Do not name authors, institutions, or specific works.

Questions to Notice
End with exactly 3 short questions.
These questions should train attention rather than seek answers.
They should invite the reader to notice structure, assumptions, or repetition elsewhere.
Do not answer the questions.

Rules:
- Maintain an academic tone.
- Use clear, plain English.
- No selling, no judging.
- No claims of direct access to external sources.
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