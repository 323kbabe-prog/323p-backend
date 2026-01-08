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
const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");

const app = express();

//////////////////////////////////////////////////////////////
// CURRICULUM SESSION PRODUCT LOCK (12 UNIQUE)
//////////////////////////////////////////////////////////////
const SESSION_PRODUCTS = new Set();

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

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

//////////////////////////////////////////////////////////////
// BACKGROUND JOB STORE
//////////////////////////////////////////////////////////////
const CURRICULUM_JOBS = {};
// ADD — track retry failures per job
const CURRICULUM_RETRIES = {};

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
  "Sociology",
  "Economics",
  "Design",
  "Communication",
  "Statistics",
  "Computer Science",
  "Symbolic Systems",
  "Education",
  "Philosophy",
  "Law",
  "Integrated Reasoning"
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
const AMAZON_LIMIT = 12;

function rememberAmazon(title) {
  AMAZON_MEMORY.unshift(title);
  if (AMAZON_MEMORY.length > AMAZON_LIMIT) AMAZON_MEMORY.pop();
}

//////////////////////////////////////////////////////////////
// BEAUTY / COSMETIC HARD LOCK
//////////////////////////////////////////////////////////////
const BEAUTY_KEYWORDS = [
  "beauty",
  "cosmetic",
  "skincare",
  "skin care",
  "makeup",
  "hair",
  "haircare",
  "serum",
  "cleanser",
  "moisturizer",
  "cream",
  "lotion",
  "toner",
  "essence",
  "mask",
  "foundation",
  "lipstick",
  "shampoo",
  "conditioner"
];

const BEAUTY_FALLBACK_PRODUCTS = [
  "CeraVe Hydrating Facial Cleanser",
  "La Roche-Posay Toleriane Double Repair Moisturizer",
  "The Ordinary Niacinamide 10% + Zinc 1%",
  "Neutrogena Hydro Boost Water Gel",
  "COSRX Advanced Snail 96 Mucin Power Essence",
  "Paula's Choice 2% BHA Liquid Exfoliant",
  "Laneige Water Sleeping Mask",
  "Olaplex No.3 Hair Perfector",
  "Cetaphil Gentle Skin Cleanser",
  "La Roche-Posay Anthelios Melt-in Milk SPF 100"
];

//////////////////////////////////////////////////////////////
// POPULAR BEAUTY SEARCH SEEDS (Google popularity bias)
//////////////////////////////////////////////////////////////
const POPULAR_BEAUTY_QUERIES = [
  "best face cream",
  "trending skincare",
  "popular moisturizer",
  "best serum",
  "viral skincare product",
  "best sunscreen",
  "top beauty product",
  "best anti aging cream",
  "popular makeup product",
  "best cleanser"
];

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

  return (j.organic_results || []).find(x => {
    const title = (x.title || "").toLowerCase();

    return (
      (x.link?.includes("/dp/") || x.link?.includes("/gp/product")) &&
      !AMAZON_MEMORY.includes(x.title) &&
      BEAUTY_KEYWORDS.some(keyword => title.includes(keyword))
    );
  });
}

//////////////////////////////////////////////////////////////
// POPULAR BEAUTY PRODUCT PICKER (Google-ranked)
//////////////////////////////////////////////////////////////
async function fetchPopularBeautyProduct() {
  for (const query of POPULAR_BEAUTY_QUERIES) {
    const product = await fetchAmazonProduct(query);
    if (product) return product;
  }
  return null;
}

//////////////////////////////////////////////////////////////
// AUTO PRODUCT GENERATOR
//////////////////////////////////////////////////////////////
async function generateBeautyProduct() {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: "Generate ONE real Amazon beauty or cosmetic product (skincare, makeup, or haircare only). Do NOT generate devices, supplements, tools, or accessories. Output product name only."
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
    messages: [
      {
        role: "user",
        content: `
You are teaching a Stanford University class from the perspective of ${major}.

Case material:
"${productTitle}"

Academic lens:
"${videoTitle}"

IMPORTANT FORMATTING RULES:
- Output MUST be plain text only
- DO NOT use Markdown
- DO NOT use ###, **, ---, or decorative symbols
- Use only normal text, line breaks, and simple dash bullets (-)

FIRST, write this section exactly:

What to learn

Under this section, generate EXACTLY three learning points.

For EACH learning point:
- Start with a short, distinctive title written as a sentence fragment
- Put the title on its own line
- On the next line, write ONE short explanatory paragraph (2–3 sentences)
- The paragraph must explain how this learning point trains thinking, not what conclusion to reach
- Titles must feel like reusable cognitive tools, not topic labels

AFTER the learning section, write the following lines exactly:

2×-AI Engine — Stanford Academic Foresight
Reality · ${sixMonthDateLabel()}

Immediately after that header, write EXACTLY five short academic paragraphs explaining the case using the ${major} lens.

Rules:
- Academic teaching tone
- Calm and analytical
- No selling language
- No product review language
- No calls to action
- No emojis
- No extra sections
`
      }
    ],
    temperature: 0.3
  });

  const content = out?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty class content");
  }

  return content.trim();
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

  // 1️⃣ Try popularity-first (Google-ranked)
product = await fetchPopularBeautyProduct();

// 2️⃣ Fallback to user query
if (!product) {
  for (let i = 0; i < 3; i++) {
    product = await fetchAmazonProduct(q);
    if (product) break;
    q = q.split(" ").slice(0, 3).join(" ");
  }
}

  if (!product) return { report: null };
  
  // 🔒 Session-level uniqueness lock (12 unique products)
if (SESSION_PRODUCTS.has(product.title)) {
  return { report: null };
}

const titleLower = product.title.toLowerCase();

// ✅ BEAUTY WHITELIST (already in your code)
if (!BEAUTY_KEYWORDS.some(k => titleLower.includes(k))) {
  return { report: null };
}

// 🔴 INSERT THIS BLOCK — EXACTLY HERE
const BANNED_KEYWORDS = [
  "printer",
  "ink",
  "toner",
  "cartridge",
  "device",
  "machine",
  "replacement",
  "compatible",
  "refill",
  "hardware"
];

if (BANNED_KEYWORDS.some(b => titleLower.includes(b))) {
  return { report: null };
}

// ✅ KEEP EVERYTHING BELOW THIS
rememberAmazon(product.title);
SESSION_PRODUCTS.add(product.title);

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
// BACKGROUND CURRICULUM RUNNER
//////////////////////////////////////////////////////////////
async function runCurriculumJob(jobId) {
  try {
    CURRICULUM_RETRIES[jobId] = 0;

    while (CURRICULUM_JOBS[jobId].results.length < 12) {
      let attempts = 0;
      let result = null;

      // Try up to 8 times for a valid class
      while (attempts < 8 && (!result || !result.report)) {
        const example = await generateBeautyProduct();
        result = await runPipeline(example);
        attempts++;
      }

      if (result && result.report) {
        CURRICULUM_JOBS[jobId].results.push(result.report);
        CURRICULUM_RETRIES[jobId] = 0;
      } else {
        CURRICULUM_RETRIES[jobId]++;

        const fallback = await runPipeline("popular skincare product");

        if (fallback && fallback.report) {
          CURRICULUM_JOBS[jobId].results.push(fallback.report);
          CURRICULUM_RETRIES[jobId] = 0;
        }

        if (CURRICULUM_RETRIES[jobId] > 3) {
          break;
        }
      }
    }

    CURRICULUM_JOBS[jobId].status = "done";
    delete CURRICULUM_RETRIES[jobId];

  } catch (err) {
    CURRICULUM_JOBS[jobId].status = "error";
    CURRICULUM_JOBS[jobId].error = err.message;
  }
}

//////////////////////////////////////////////////////////////
// ROUTES
//////////////////////////////////////////////////////////////

app.post("/run", async (req, res) => {
  res.json(await runPipeline(req.body.topic || ""));
});

//////////////////////////////////////////////////////////////
// START BACKGROUND CURRICULUM
//////////////////////////////////////////////////////////////
app.post("/start-curriculum", (req, res) => {
  const jobId = crypto.randomUUID();

  CURRICULUM_JOBS[jobId] = {
    status: "running",
    results: [],
    startedAt: Date.now()
  };

  runCurriculumJob(jobId);
  res.json({ jobId });
});

//////////////////////////////////////////////////////////////
// CHECK CURRICULUM STATUS
//////////////////////////////////////////////////////////////
app.get("/curriculum-status/:jobId", (req, res) => {
  const job = CURRICULUM_JOBS[req.params.jobId];
  if (!job) return res.status(404).json({ error: "Job not found" });

  res.json({
    status: job.status,
    completed: job.results.length
  });
});

//////////////////////////////////////////////////////////////
// GET CURRICULUM RESULT
//////////////////////////////////////////////////////////////
app.get("/curriculum-result/:jobId", (req, res) => {
  const job = CURRICULUM_JOBS[req.params.jobId];
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (job.status !== "done") return res.status(400).json({ error: "Not finished" });

  res.json({ results: job.results });
});

//////////////////////////////////////////////////////////////
// NEXT (SINGLE CLASS)
//////////////////////////////////////////////////////////////
app.post("/next", async (_, res) => {
  if (SESSION_PRODUCTS.size >= 12) {
    SESSION_PRODUCTS.clear();
    AMAZON_MEMORY.length = 0;
  }

  let attempts = 0;
  let result = null;

  while (attempts < 10 && (!result || !result.report)) {
    const example = await generateBeautyProduct();
    result = await runPipeline(example);
    attempts++;
  }

  if (!result || !result.report) {
    const fallback =
      BEAUTY_FALLBACK_PRODUCTS[Math.floor(Math.random() * BEAUTY_FALLBACK_PRODUCTS.length)];
    result = await runPipeline(fallback);
  }

  if (!result || !result.report) {
    return res.status(500).json({ report: "Beauty fallback failed" });
  }

  res.json(result);
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

app.post("/email-curriculum", async (req, res) => {
  const { email, content } = req.body;

  if (!email || !content) {
    return res.status(400).json({ ok: false });
  }

  try {
    const doc = new PDFDocument({ margin: 40 });
    let buffers = [];

    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", async () => {
      const pdfBuffer = Buffer.concat(buffers);

      await transporter.sendMail({
        from: `"AI Case Classroom" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Your AI Case Classroom Curriculum",
        text: "Attached is your completed AI Case Classroom curriculum.",
        attachments: [
          {
            filename: "AI-Case-Classroom.pdf",
            content: pdfBuffer
          }
        ]
      });

      res.json({ ok: true });
    });

    doc.fontSize(18).text("AI Case Classroom", { align: "center" });
doc.moveDown(2);

// Split curriculum into classes
const classes = content.split(/Session \d+ of 12 —/g).filter(Boolean);

// Extract the session headers back
const headers = content.match(/Session \d+ of 12 —[^\n]+/g) || [];

classes.forEach((classBody, index) => {
  if (index > 0) {
    doc.addPage();
  }

  // Write session title
  if (headers[index]) {
    doc.fontSize(16).text(headers[index], { align: "left" });
    doc.moveDown();
  }

  // Write class content
  doc.fontSize(12).text(classBody.trim(), {
    align: "left",
    lineGap: 4
  });
});

doc.end();

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

app.listen(PORT, () => {
  console.log("🎓 AI Case Classroom backend live");
});