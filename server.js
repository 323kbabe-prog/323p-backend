//////////////////////////////////////////////////////////////
// AI CASE CLASSROOM — BACKEND (FULL FIX)
// Stanford × Amazon Foresight Engine
//////////////////////////////////////////////////////////////

const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const OpenAI = require("openai");
const Stripe = require("stripe");
const crypto = require("crypto");

const app = express();

// 🔴 Render health check (must be first)
app.get("/", (_, res) => res.status(200).send("OK"));

app.use(cors({ origin: "*" }));
app.use(express.json());

//////////////////////////////////////////////////////////////
// ENV
//////////////////////////////////////////////////////////////
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const SERP_KEY = process.env.SERPAPI_KEY || null;

// OPTIONAL — email access enabled only if set
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || null;

//////////////////////////////////////////////////////////////
// UTIL
//////////////////////////////////////////////////////////////
function sixMonthDateLabel() {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

//////////////////////////////////////////////////////////////
// STANFORD MAJORS
//////////////////////////////////////////////////////////////
const STANFORD_MAJORS = [
  "Psychology",
  "Economics",
  "Design",
  "Sociology",
  "Computer Science",
  "Statistics",
  "Symbolic Systems",
  "Communication",
  "Education",
  "Philosophy",
  "Law"
];

let majorPool = [...STANFORD_MAJORS];
function pickMajor() {
  if (!majorPool.length) majorPool = [...STANFORD_MAJORS];
  return majorPool.splice(Math.floor(Math.random() * majorPool.length), 1)[0];
}

//////////////////////////////////////////////////////////////
// STANFORD YOUTUBE WHITELIST
//////////////////////////////////////////////////////////////
const STANFORD_CHANNELS = [
  "Stanford University",
  "Stanford Online",
  "Stanford GSB",
  "Stanford Medicine",
  "Stanford Engineering"
];

function isOfficialStanford(channel = "") {
  return STANFORD_CHANNELS.some(n =>
    channel.toLowerCase().includes(n.toLowerCase())
  );
}

//////////////////////////////////////////////////////////////
// AMAZON MEMORY (NO REPEAT)
//////////////////////////////////////////////////////////////
const AMAZON_MEMORY = [];
const AMAZON_LIMIT = 5;

function rememberAmazon(title) {
  AMAZON_MEMORY.unshift(title);
  if (AMAZON_MEMORY.length > AMAZON_LIMIT) AMAZON_MEMORY.pop();
}

//////////////////////////////////////////////////////////////
// AMAZON BEAUTY SEARCH
//////////////////////////////////////////////////////////////
async function fetchAmazonProduct(query) {
  if (!SERP_KEY) return null;

  const q = `
    ${query}
    (beauty OR cosmetic OR skincare OR makeup OR haircare)
    site:amazon.com/dp OR site:amazon.com/gp/product
  `;

  const url =
    `https://serpapi.com/search.json?q=${encodeURIComponent(q)}` +
    `&num=10&api_key=${SERP_KEY}`;

  const r = await fetch(url);
  const j = await r.json();

  return (j.organic_results || []).find(
    x =>
      (x.link?.includes("/dp/") || x.link?.includes("/gp/product")) &&
      !AMAZON_MEMORY.includes(x.title)
  );
}

//////////////////////////////////////////////////////////////
// AUTO PRODUCT GENERATOR
//////////////////////////////////////////////////////////////
async function generateBeautyProduct() {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: "Generate ONE real Amazon beauty product. Output name only."
    }],
    temperature: 0.7
  });

  return out.choices[0].message.content.trim();
}

//////////////////////////////////////////////////////////////
// STANFORD VIDEO SEARCH
//////////////////////////////////////////////////////////////
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
// CLASS GENERATOR
//////////////////////////////////////////////////////////////
async function generateClass({ major, videoTitle, productTitle }) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `
You are teaching a Stanford University class from the perspective of ${major}.

Case material: "${productTitle}"
Academic lens: "${videoTitle}"

START WITH THIS LINE EXACTLY:
2×-AI Engine — Stanford Academic Foresight
Reality · ${sixMonthDateLabel()}

Rules:
- Academic teaching tone
- No selling, no judging
- EXACTLY 5 short paragraphs

Then write:
If this way of thinking is correct, what works:

Then EXACTLY 3 short sentences.
`
    }],
    temperature: 0.3
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

  let product = null;
  let q = input;

  for (let i = 0; i < 3; i++) {
    product = await fetchAmazonProduct(q);
    if (product) break;
    q = q.split(" ").slice(0, 3).join(" ");
  }

  if (!product) return { report: null };

  rememberAmazon(product.title);

  const body = await generateClass({
    major,
    videoTitle: video.title,
    productTitle: product.title
  });

  return {
    report:
`• ${major} — Stanford University
${video.link}

Case Study Material
${product.link}

${body}`
  };
}

//////////////////////////////////////////////////////////////
// ROUTES
//////////////////////////////////////////////////////////////
app.post("/run", async (req, res) => {
  res.json(await runPipeline(req.body.topic || ""));
});

app.post("/next", async (_, res) => {
  const example = await generateBeautyProduct();
  res.json(await runPipeline(example));
});

//////////////////////////////////////////////////////////////
// STRIPE CHECKOUT
//////////////////////////////////////////////////////////////
app.post("/create-checkout-session", async (_, res) => {
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: {
          name: "AI Case Classroom — Full Curriculum",
          description: "12-class curriculum access"
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
// EMAIL ACCESS (OPTIONAL — SAFE FALLBACK)
//////////////////////////////////////////////////////////////
function createAccessToken(email) {
  if (!ACCESS_TOKEN_SECRET) return null;

  const payload = JSON.stringify({
    email,
    scope: "full",
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30
  });

  const sig = crypto
    .createHmac("sha256", ACCESS_TOKEN_SECRET)
    .update(payload)
    .digest("hex");

  return Buffer.from(payload).toString("base64url") + "." + sig;
}

app.post("/send-access-link", async (req, res) => {
  if (!ACCESS_TOKEN_SECRET) {
    return res.json({ ok: false, error: "Email access disabled" });
  }

  const { email } = req.body;
  if (!email) return res.status(400).json({ ok: false });

  const token = createAccessToken(email);
  const link =
    `https://blueoceanbrowser.com/amazonclassroom.html?access=${token}`;

  res.json({ ok: true, link });
});

app.post("/verify-access", async (req, res) => {
  if (!ACCESS_TOKEN_SECRET) return res.json({ ok: false });

  const { token } = req.body;
  if (!token) return res.json({ ok: false });

  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return res.json({ ok: false });

  const payload = Buffer.from(payloadB64, "base64url").toString();
  const expected = crypto
    .createHmac("sha256", ACCESS_TOKEN_SECRET)
    .update(payload)
    .digest("hex");

  if (expected !== sig) return res.json({ ok: false });

  const data = JSON.parse(payload);
  if (Date.now() > data.exp) return res.json({ ok: false });

  res.json({ ok: true, scope: data.scope });
});

//////////////////////////////////////////////////////////////
// SERVER
//////////////////////////////////////////////////////////////
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🎓 AI Case Classroom backend live");
});
