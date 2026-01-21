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
// STEP LOGGER
//////////////////////////////////////////////////////////////
function stepLog(steps, text) {              // ADDED
  steps.push({                               // ADDED
    time: new Date().toISOString(),          // ADDED
    text                                    // ADDED
  });                                        // ADDED
}                                           // ADDED

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

The ${productTitle} must be treated as the primary case material.
All observations, analyses, and reasoning must be grounded in this product as the concrete object of study.
Do not generalize away from the product; abstract only after the product has been fully examined.

START WITH THIS LINE EXACTLY:
2×-AI Engine — Academic Case Analysis

After this line, write an academic analysis.
The purpose of this analysis is not to deliver content, but to train human reasoning using Constraint-Based Cognitive Reasoning Training.

Background meaning (do not quote directly, but reflect in structure and tone):
• Users are not paying for content — they are paying for cognitive structure.
• People do not pay for results — they pay for certainty.
• This work does not sell outcomes — it models a repeatable thinking habit.

Formatting rules:
- Do NOT use Markdown, asterisks (**), or numbered lists.
- Use plain academic section headers only.
- Section headers may use: colon (:), long dash (—), period (.), or bullet dot (•).
- Choose one symbol style and remain consistent.
- Use big dot points (•) within sections to expose reasoning structure.
- Bullet points must represent mental models, constraints, or analytical distinctions — never features or summaries.

Use the following section titles, in this exact order:

Title  
Pedagogical Objective  
Abstract  
Introduction  
Observation  
Analysis  
Cognitive Error Modes  
Discussion  
Transfer Test  
Notes  
Meta-Reflection  
Citation (Contextual)  
Questions to Notice

Section guidelines:

Title:
Write a clear academic title describing the phenomenon or pattern being examined.
Do not mention the product, system names, or branding.

Pedagogical Objective:
State explicitly which cognitive capability is being trained.
Focus on a thinking skill such as constraint reasoning, assumption detection, abstraction, or decision framing.
Do not describe the product here. Describe the mental capability being exercised.

Abstract:
Write one paragraph of 6–7 sentences.
Explain what is being examined, how it is examined, and why this mode of reasoning matters.
After the paragraph, include 2–3 big dot points that clarify the structure of the inquiry.
• What type of situation is being examined
• What form of reasoning is applied
• Why this reasoning structure reduces uncertainty

Introduction:
Write one paragraph of 6–7 sentences situating the case within a broader context.
Explain the environment, pressures, and constraints that make this case meaningful.
After the paragraph, include big dot points that surface framing assumptions.
• What decision space this case occupies
• What routines or expectations are implicitly present
• What constraints shape interpretation

Observation:
Write one paragraph of 6–7 sentences describing observable signals only.
Focus on form, repetition, usage patterns, and visibility.
Do not explain causes or meanings yet.
After the paragraph, include big dot points separating observation from interpretation.
• What is consistently present
• What behaviors appear normalized
• What can be seen without inference

Analysis:
Write one paragraph of 6–7 sentences interpreting the observations using academic reasoning.
Explain how structure, constraints, and context shape understanding.
After the paragraph, include big dot points that expose analytical moves.
• How constraints guide interpretation
• How structure produces meaning
• How certainty is created without explicit claims

Cognitive Error Modes:
Write a short paragraph identifying common reasoning errors that could occur when interpreting this case.
Focus on how humans might misread or oversimplify the situation.
After the paragraph, include big dot points.
• Likely oversimplifications
• False causal assumptions
• Pattern-matching traps
• Outcome bias risks

Discussion:
Write one paragraph of 6–7 sentences describing what appears to function if this reasoning model is correct.
Focus on mechanisms that reduce uncertainty or cognitive effort.
Avoid evaluating success or failure.
After the paragraph, include big dot points focused on mechanisms.
• What creates cognitive stability
• What reduces decision friction
• What supports confident action

Transfer Test:
Write one paragraph explaining how the same reasoning structure could apply in a different domain.
Do not name a specific product, industry, or example.
Focus on structural similarity rather than surface features.

Notes:
Write one paragraph of 6–7 sentences clarifying the limits of this analysis.
Explain what this reasoning model does and does not claim.
After the paragraph, include big dot points.
• This is an interpretive model, not a verdict
• This does not predict outcomes
• This does not recommend actions

Meta-Reflection:
Write 3–4 sentences describing what the reader should notice about their own thinking while reading this analysis.
Focus on shifts in attention, certainty, or interpretation.

Citation (Contextual):
After completing all sections above, generate this section by analyzing the reasoning actually used.
Write one concise sentence summarizing the intellectual basis of the analysis.
Then include 2–3 big dot points listing domains of thought demonstrated.
• Design theory
• Behavioral reasoning
• Organizational or communication structures
Do not mention authors, institutions, years, or external works.

Questions to Notice:
End with exactly 3 short questions.
Each question must begin with a checkbox-style symbol.
Use either ☐ or □ consistently.
Each question must refer to the reader’s thinking process, not the case itself.
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
async function runPipelineWithProduct(product, steps) {   // ADDED (signature only)
  let major, video;

  stepLog(steps, "Selecting academic lens");              // ADDED

  for (let i = 0; i < STANFORD_MAJORS.length; i++) {
    major = pickMajor();
    video = await fetchStanfordVideo(major);
    if (video) break;
  }
  if (!video) return null;

  stepLog(steps, "Generating academic analysis");         // ADDED

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
  const steps = [];                                       // ADDED
  const topic = req.body.topic || "";
  const token = req.body.searchToken || null;

  stepLog(steps, "Validating product domain");            // ADDED

  const plausible = await aiIsPlausibleBeautyProduct(topic);
  if (!plausible) {
    return res.json({ report: "Only Amazon Beauty & Personal Care products are supported.", steps }); // ADDED
  }

  stepLog(steps, "Searching Amazon product");             // ADDED

  const product = await fetchAmazonProduct(topic);
  if (!product) {
    return res.json({ report: "Only Amazon Beauty & Personal Care products are supported.", steps }); // ADDED
  }

  if (token) {
    stepLog(steps, "Validating access token");            // ADDED

    const payload = verifySearchToken(token);
    if (!payload) {
      return res.json({ report: "Invalid or used token. Please purchase another search.", steps }); // ADDED
    }
  }

  const result = await runPipelineWithProduct(product, steps); // ADDED
  if (!result) {
    return res.json({ report: "No valid case material found.", steps }); // ADDED
  }

  if (token) {
    consumeSearchToken(token);
    stepLog(steps, "Token consumed");                     // ADDED
  }

  stepLog(steps, "Delivery complete");                    // ADDED

  return res.json({ ...result, steps });                  // ADDED
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
        product_data: { name: "AI Training Humans Class — One Search" },
        unit_amount: 50
      },
      quantity: 1
    }],
    success_url:
  "https://blueoceanbrowser.com/aitraininghumansengineamazonstanford.html?search_token=" +
  generateSearchToken(topic),

cancel_url:
  "https://blueoceanbrowser.com/aitraininghumansengineamazonstanford.html"
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
  `https://blueoceanbrowser.com/aitraininghumansengineamazonstanford.html?search_token=${token}`;
  res.json({ ok: true, url });
});

//////////////////////////////////////////////////////////////
// W D N A B — B
// THINKING PATH ENGINE — PROBLEM / WISH → GOOGLE THINKING MAP
// Independent Chunk (No Amazon, No Stanford, No SERP Fetch)
//////////////////////////////////////////////////////////////

// ==========================================================
// AI GATE — ACCEPT ONLY PROBLEM OR WISH (WDNAB—B)
// ==========================================================
async function wdnabProcessInput(input) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content: `
You are WDNAB-B, a logic-only thinking system.

Your job is to:
1. Determine whether the input expresses a problem or a wish.
2. If it does NOT, rewrite it into a clear problem or wish while preserving the underlying intent.
3. Generate a thinking path from the final problem or wish.

Rules:
- Never solve the problem.
- Never give advice.
- Never draw conclusions.
- Never persuade.
- No emotional language.
- No ideology.
- No judgments.

Rewrite rules:
- Preserve underlying intent even if implicit.
- You may replace surface phrasing with commonly understood human meaning
  (e.g., "listen to me" → "be heard and understood").
- Do not add new information.
- Output exactly ONE sentence for the rewrite.

Thinking path rules:
- Determine number of steps dynamically.
- Each step has:
  • One short, direct thinking focus sentence.
  • One Google search link (URL encoded).

Output format MUST be valid JSON exactly like this:

{
  "accepted": true | false,
  "final_input": "string",
  "rewrite": "string | null",
  "thinking_path": "full formatted thinking path text"
}

If the input cannot reasonably be rewritten, return:

{
  "accepted": false,
  "final_input": null,
  "rewrite": null,
  "thinking_path": null
}
`
      },
      {
        role: "user",
        content: input
      }
    ]
  });

 let parsed;
try {
  parsed = JSON.parse(out.choices[0].message.content.trim());
} catch {
  return {
    accepted: false,
    final_input: null,
    rewrite: null,
    thinking_path: null
  };
}
return parsed;
}

// ==========================================================
// ROUTE — W D N A B — B THINKING PATH
// ==========================================================
app.post("/thinking-path", async (req, res) => {
  const steps = [];
  const input = (req.body.input || "").trim();

  stepLog(steps, "Engine: WDNAB—B");
  stepLog(steps, "Processing input");

  if (!input) {
    return res.json({
      report: "Input is required. Please express a problem or a wish.",
      steps
    });
  }

  const result = await wdnabProcessInput(input);

  if (!result.thinking_path) {
    return res.json({
      report: "Input rejected. Please express a problem or a wish.",
      steps
    });
  }

  stepLog(steps, "Thinking path generated");

  return res.json({
    report: result.thinking_path,
    rewrite: result.rewrite,   // may be null
    steps
  });
});

//////////////////////////////////////////////////////////////
// SERVER
//////////////////////////////////////////////////////////////
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🎓 Pay-per-delivered-search AI Case Classroom backend live");
});