//////////////////////////////////////////////////////////////
// JACK CHANG — THINKING PATH BACKEND (FINAL)
// Process over outcome · No advice · No conclusions
//////////////////////////////////////////////////////////////

const crypto = require("crypto");

// TEMP in-memory store (fine for MVP)
// Later you can replace with DB
const submittedApplications = new Set();

function makeApplicationKey(name, question) {
  return crypto
    .createHash("sha256")
    .update(`${name}|${question}`)
    .digest("hex");
}

const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendApplicationEmail({ name, question, persona, card, saasHtml }) {
  await transporter.sendMail({
    from: `"AI JACK CHANG ME" <${process.env.EMAIL_USER}>`,
    to: "jackchang067@gmail.com",
    subject: "New Social Search Application",
    text: `
NAME:
${name}

META QUESTION:
${question}

PERSONA:
${persona}

CARD:
${card}

----------------------------------------
GENERATED SaaS RAW HTML:
----------------------------------------

${saasHtml || "[No SaaS Generated]"}
    `,
  });
}

// -------------------- BASIC SETUP --------------------
app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/", (_, res) => res.status(200).send("OK"));


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

//////////////////////////////////////////////////////////////
// AI-CIDI — PINYIN-ALIGNED ENGLISH (NAME-FIRST MODE)
// OPTION A — TEXT PARSING (STABLE)
//////////////////////////////////////////////////////////////

async function runCidiPinyinAligned(openai, inputText) {
  const systemPrompt = `
You are AI-CIDI — PINYIN-ALIGNED ENGLISH (NAME-FIRST).

Your goal:
Produce an English sentence that FOLLOWS CHINESE PINYIN SOUND ORDER
and still makes sense in English.

━━━━━━━━━━━━━━━━━━━━━━
MANDATORY INTERNAL STEPS
━━━━━━━━━━━━━━━━━━━━━━

1) Translate the INPUT sentence into Chinese.
2) Convert the Chinese into STANDARD PINYIN
   - space-separated
   - no tone marks
3) For EACH pinyin unit:
   - Choose EXACTLY ONE real English word
   - Spoken sound must be CLOSE to that pinyin
4) The FIRST English word MUST be:
   - a real, common American first name
5) Remaining words:
   - real English dictionary words (not names)
6) Preserve EXACT pinyin order
7) Assemble ONE readable English sentence

━━━━━━━━━━━━━━━━━━━━━━
HARD RULES
━━━━━━━━━━━━━━━━━━━━━━

- English words ONLY
- REAL dictionary words ONLY
- NO phonetic spelling
- NO IPA
- NO invented words
- NO punctuation
- ONE word per pinyin unit
- ONE sentence only
- Sentence must be understandable English

━━━━━━━━━━━━━━━━━━━━━━
PRIORITY LOGIC
━━━━━━━━━━━━━━━━━━━━━━

- Sound similarity > literal meaning
- Sentence should make basic sense
- DO NOT translate meaning directly
- DO NOT optimize grammar over sound

━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT (EXACT)
━━━━━━━━━━━━━━━━━━━━━━

Chinese:
<Chinese>

Pinyin:
<pinyin>

Result:
<English sentence>

━━━━━━━━━━━━━━━━━━━━━━
REFERENCE (DO NOT OUTPUT)
━━━━━━━━━━━━━━━━━━━━━━

Input:
I want a cup of coffee

Chinese:
我想要一杯咖啡

Pinyin:
wo xiang yao yi bei ka fei

Result:
Will wanna you eat a big coffee
`;

  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: inputText }
    ]
  });

  return response.output_text?.trim() || "";
}

//////////////////////////////////////////////////////////////
// ROUTE — PINYIN-ALIGNED ENGLISH
//////////////////////////////////////////////////////////////

app.post("/api/cidi/pinyin", async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text) {
      return res.status(400).json({ error: "Missing text" });
    }

    const raw = await runCidiPinyinAligned(openai, text);

    // ---- SAFE TEXT PARSING (NO JSON) ----
    const chineseMatch = raw.match(/Chinese:\s*([\s\S]*?)\n\nPinyin:/);
    const pinyinMatch  = raw.match(/Pinyin:\s*([\s\S]*?)\n\nResult:/);
    const resultMatch  = raw.match(/Result:\s*([\s\S]*)$/);

    if (!chineseMatch || !pinyinMatch || !resultMatch) {
      return res.json({
        chinese: "[不可用]",
        pinyin: "",
        result: "[unavailable]",
        engine: "AI-CIDI",
        mode: "pinyin-aligned-english"
      });
    }

    const chinese = chineseMatch[1].trim();
    const pinyin  = pinyinMatch[1].trim();
    const result  = resultMatch[1].trim();

    // ---- BASIC VALIDATION ----
    if (
      !/^[A-Za-z]+(\s[A-Za-z]+)*$/.test(result) ||
      result.split(/\s+/).some(w => w.length < 2)
    ) {
      return res.json({
        chinese,
        pinyin,
        result: "[unavailable]",
        engine: "AI-CIDI",
        mode: "pinyin-aligned-english"
      });
    }

    // ---- SUCCESS ----
    return res.json({
      chinese,
      pinyin,
      result,
      engine: "AI-CIDI",
      mode: "pinyin-aligned-english"
    });

  } catch (err) {
    console.error("AI-CIDI error:", err);
    return res.status(500).json({ error: "AI-CIDI failed" });
  }
});

// -------------------- STEP LOGGER --------------------
function stepLog(steps, text) {
  steps.push({
    time: new Date().toISOString(),
    text
  });
}

// =====================================================
// PERSONA GENERATOR — AI-GENERATED FROM USER META-QUESTION
// =====================================================
async function generatePersonaFromRisk(riskText) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content: `
You generate a persona description.

CRITICAL RULES:
- Output plain text only.
- Do NOT include <script> tags.
- Do NOT include explanations.
- Do NOT repeat sections.
- Do NOT add extra sections.
- Do NOT use first-person pronouns ("I", "me", "my").
DOMAIN IDENTITY LOCK (CRITICAL):

Infer a dominant life domain from the meta-question
(e.g. gaming, coding, finance, health, environment).

ALL bullets MUST stay inside that domain.

Each bullet MUST include at least ONE domain-specific term.

DO NOT generalize.
DO NOT use abstract language.
DO NOT use neutral life wording.

FORMAT (MUST MATCH EXACTLY):

Thinking voice:
- One short descriptive bullet.
- One short descriptive bullet.
- One short descriptive bullet.

Search behavior:
- One short descriptive bullet.
- One short descriptive bullet.
- One short descriptive bullet.

STYLE CONSTRAINTS:
- Bullets must be short phrases (max 12 words).
- No paragraphs.
- No commas if possible.
- No colons inside bullets.
- Content must be shaped by the user's meta-question.
`
      },
      {
        role: "user",
        content: riskText
      }
    ]
  });

  return out.choices[0].message.content.trim();
}

// =====================================================
// ROUTE — GENERATE PERSONA (FROM USER INPUT)
// =====================================================
// ROUTE — GENERATE PERSONA (FROM USER INPUT)
app.post("/generate-persona", async (req, res) => {
  try {
    const riskText = (req.body.riskText || "").trim();

    if (!riskText) {
      return res.json({ persona: "Input is required." });
    }

    const accepted = await wdnabAcceptProblemOrWish(riskText);

    if (!accepted) {
      return res.json({
        persona: "Input does not express a clear human concern."
      });
    }

    const persona = await generatePersonaFromRisk(riskText);
    return res.json({ persona });

  } catch (err) {
    console.error("❌ Persona generation failed:", err);
    return res.status(500).json({ error: "persona_failed" });
  }
});

// =====================================================
// AI GATE — ACCEPT PROBLEM OR WISH (LENIENT)
// =====================================================
async function wdnabAcceptProblemOrWish(input, persona = "") {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content: `
${persona}

You are an input classification system.

Decide whether the user input plausibly expresses:
- a problem (difficulty, concern, uncertainty), or
- a wish (desire, intent, aspiration).

Rules:
- Accept short, informal, or imperfect grammar.
- Accept vague human statements if intent is recognizable.
- Treat statements like "I have a problem with X" as a problem.

Reject ONLY if:
- The input is random characters
- The input has no interpretable human intent

Output ONLY:
ACCEPT or REJECT
`
      },
      { role: "user", content: input }
    ]
  });

  return out.choices[0].message.content.trim() === "ACCEPT";
}

// =====================================================
// INPUT REWRITE — NORMALIZE TO PROBLEM OR WISH
// =====================================================
async function wdnabRewriteToProblemOrWish(input, persona = "") {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content: `
${persona}

You are a cognitive normalization system.

Rewrite the user input into ONE clear sentence that expresses:
- a problem, or
- a wish.

Rules:
- Preserve the underlying human intent.
- If the input is vague, clarify intent.
- If the input is a phrase (e.g. "Learning AI"),
  rewrite it as a desire to understand or learn.
- Do NOT give advice.
- Do NOT solve the problem.
- Output EXACTLY one sentence.

Only output:
Unable to rewrite as a problem or a wish.
if the input is meaningless.
`
      },
      { role: "user", content: input }
    ]
  });

  return out.choices[0].message.content.trim();
}

// =====================================================
// CARD GENERATOR — AI-GENERATED CARD (LOCKED FORMAT)
// =====================================================
async function generateCardFromPersona(personaText) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content: `
You are emitting RAW SOURCE CODE.

ABSOLUTE MODE:
- You are a code generator, not a formatter.
- Output MUST be treated as literal text.
- Whitespace, indentation, and newlines are DATA.
- DO NOT minify.
- DO NOT collapse lines.
- DO NOT optimize HTML.

CRITICAL:
- Output MUST be wrapped inside a triple backtick block.
- Inside the block, preserve formatting EXACTLY.
- The user will read this as source code, not render it.

IDENTITY LOCK:
- Use ONLY the name found after "Persona name:".
- Do NOT invent names.
- Do NOT invent filenames.
- If Persona name is missing, output NOTHING.

SUBTITLE RULES (CRITICAL — NO EXCEPTIONS):
- Generate a subtitle of EXACTLY 3–4 words.
- Subtitle MUST be a product or system label.
- Subtitle MUST describe the persona’s role, system, or mode of thinking.
- Subtitle MUST feel like a tool name, interface label, or system identity.
- Subtitle MUST NOT repeat the full name.
- Subtitle MUST NOT be a sentence.
- Subtitle MUST NOT include verbs such as:
  "helps", "builds", "creates", "explores", "guides", "supports", "provides".
- Subtitle MUST NOT include pronouns.
- Subtitle MUST NOT include marketing language.
- Use Title Case (Each Word Capitalized).

OUTPUT FORMAT (EXACT — DO NOT DEVIATE):

\`\`\`html
<!-- CARD 0 : [FULL NAME] -->
<a class="card" href="[lowercasefirstname][lowercaselastname].html">

  <!-- INTERNAL PERSONA MARKER (HIDDEN FROM USER) -->
  <script type="text/plain" data-persona="[lowercasefirstname]-[lowercaselastname]-v1">
Persona: [FULL NAME]
Risk tier: MEDIUM-HIGH
Thinking style: [short identity phrase]
  </script>

  <div class="card-header">
    <img
      src="[lowercasefirstname][lowercaselastname].jpeg"
      alt="[FULL NAME]"
      class="card-avatar"
    />
    <div class="card-title">
      [FULL NAME]<br>
      [SUBTITLE — 3 to 4 words]
    </div>
  </div>

  <div class="card-desc">
    [ONE sentence describing how this persona searches, derived from persona text]
  </div>

  <div class="card-action">
    Enter the search →
  </div>

</a>
\`\`\`

STRICT:
- Do not add text outside the code block.
- Do not remove blank lines.
- Do not compress.
`
      },
      {
        role: "user",
        content: personaText
      }
    ]
  });

  return out.choices[0].message.content.trim();
}

//////////////////////////////////////////////////////////////
// FLLM SaaS HTML GENERATOR (LOCKED PERSONA MODE + UI SETTINGS)
//////////////////////////////////////////////////////////////

async function generateSaaSFromMeta(metaAnswer, name, persona) {
  const safePersona = JSON.stringify(persona);

  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: `
You are emitting RAW SOURCE CODE.

ABSOLUTE RULES
1) Output MUST be wrapped inside triple backticks.
2) Output ONLY a Squarespace-ready <div class="page"> block.
3) Do NOT include <!DOCTYPE>, <html>, <head>, or <body>.
4) No explanation text.
5) Preserve formatting exactly.

LOCKED PERSONA RULES (CRITICAL)
6) The page MUST hard-lock a constant personaText variable.
7) personaText MUST be the exact Persona JSON string provided.
8) personaText MUST NOT be summarized, modified, or omitted.
9) No matter what the user types, the request MUST always send the SAME personaText.
10) Do NOT allow persona switching.

UI SETTINGS (MANDATORY)
- Add an inline <style> block inside <div class="page"> with:
  - max-width: 760px; margin: 60px auto;
  - system font
  - textarea: border #e5e7eb, border-radius 6px, padding 12px, font-size 15px
  - button: background #111, white text, border-radius 6px, disabled opacity
  - pre: background #f9fafb, padding 16px, border-radius 6px, white-space: pre-wrap
- Include:
  <div id="inputMessage" style="display:none;"></div>
  <div id="logBar" style="display:none;"></div>

STRUCTURE REQUIREMENTS
- <div class="page">
- <style>...</style>
- Avatar image block
- Blue info text block (mention Persona Mode)
- <h1> tool name
- <textarea id="saasInput">
- <button id="run">Run</button>
- <pre id="result"></pre>
- <div id="inputMessage"></div>
- <div id="logBar"></div>
- Footer block

REQUEST REQUIREMENTS (CRITICAL)
- The script MUST POST to EXACTLY:
  https://three23p-backend.onrender.com/persona-execution
- The script MUST NOT mention or call /thinking-path anywhere.
- The fetch body MUST be EXACTLY:
  { input: value, persona: personaText }
- Display data.answer in <pre>
- Disable button while loading
- If input empty: show "Please enter your input."
- If backend returns an error message, show it in inputMessage

PERSONA EMBEDDING (MANDATORY)
Inside the <script> block you MUST include EXACTLY:

const personaText = PERSONA_JSON;

Where PERSONA_JSON is the exact persona JSON string provided.

IMPORTANT
- Do NOT call /thinking-path.
- Output only the code.
`
      },
      {
        role: "user",
        content: `
User name: ${name}
Meta answer: ${metaAnswer}
PERSONA_JSON:
${safePersona}
`
      }
    ]
  });

  return out.choices[0].message.content.trim();
}

// =====================================================
// ROUTE — GENERATE CARD (FROM PERSONA)
// =====================================================
app.post("/generate-card", async (req, res) => {
  try {
    const { persona } = req.body;

    if (!persona) {
      return res.send("");
    }

    const card = await generateCardFromPersona(persona);
    res.send(card);

  } catch (err) {
    console.error("❌ Card generation failed:", err);
    res.send("");
  }
});

//////////////////////////////////////////////////////////////
// ROUTE — GENERATE SaaS HTML (RAW CODE)
// POST /generate-saas-html
//////////////////////////////////////////////////////////////

app.post("/generate-saas-html", async (req, res) => {
  try {
    const metaAnswer = (req.body.metaAnswer || "").trim();
    const name = (req.body.name || "").trim() || "User";
    const persona = (req.body.persona || "").trim() || "";

    if (!metaAnswer) {
      return res.status(400).send("");
    }

    const accepted = await wdnabAcceptProblemOrWish(metaAnswer);
    if (!accepted) {
      return res.status(200).send("");
    }

    const rewritten = await wdnabRewriteToProblemOrWish(metaAnswer);

    const rawSaas = await generateSaaSFromMeta(
      rewritten,
      name,
      persona
    );

    return res.status(200).send(rawSaas);

  } catch (err) {
    console.error("❌ /generate-saas-html failed:", err);
    return res.status(500).send("");
  }
});

// =====================================================
// THINKING PATH GENERATOR (CORE ENGINE — STRONG DOMAIN MODE)
// =====================================================
async function wdnabGenerateThinkingPath(problemOrWish, persona = "") {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content: `
${persona}

You are a logic-only thinking system.

Core principles:
- Process over outcome.
- Structure over answers.
- The user evaluates evidence independently.
- Thinking stops when risk is sufficiently mapped.

Hard constraints:
- Do NOT solve the problem.
- Do NOT give advice.
- Do NOT draw conclusions.
- Do NOT persuade or recommend.
- No emotional language.
- No ideology.
- No judgments.

Input:
"${problemOrWish}"

Your task:
Create a structured Thinking Path that helps the user think clearly on their own.

Persona binding (MANDATORY):
Each thinking focus sentence MUST be written from the perspective of THIS PERSON
as described in the persona above.

If two personas are different, their thinking steps MUST differ.
Do NOT reuse generic reasoning patterns across personas.

DOMAIN IDENTITY LOCK (CRITICAL — NO EXCEPTIONS):
The persona above represents a dominant life domain, obsession, or identity.

Infer this domain dynamically from the persona description and the user’s meta-question.
Do NOT choose from a predefined list.

ALL thinking focus sentences AND ALL search queries MUST be expressed
STRICTLY within that inferred domain.

ABSOLUTE RULES:
- Do NOT generalize language.
- Do NOT abstract concepts.
- Do NOT replace domain-specific terms with neutral wording.
- Do NOT produce generic life advice phrasing.
- Do NOT escape the domain even if the input is vague.

Every step must sound like it comes from someone who LIVES inside this domain.

DOMAIN VOCABULARY REQUIREMENT:
Each thinking focus sentence MUST include at least ONE concept, term, or concern
that is native to the persona’s domain.

Each search query MUST include at least ONE domain-specific keyword.

FAILURE CONDITIONS (INCORRECT OUTPUT):
- Generic words like “performance”, “improvement”, “mistakes”, “success”
  WITHOUT domain-specific grounding.
- Neutral phrasing that could apply to any person.
- Searches that could be reused for a different persona.

Depth logic:
- Decide the number of steps dynamically.
- Use only as many steps as are cognitively necessary.
- Do NOT add filler steps.
- Stop when additional steps would repeat or dilute reasoning.

Emotional depth rule:
- If the input carries personal, identity, future, or self-worth uncertainty,
  increase reasoning depth.
- Emotional load means higher cognitive risk.
- Higher risk requires checking more dimensions before stopping.
- Maintain the same neutral, factual tone.
- Depth increases; emotional language does NOT.

Step rules:
- Each step must represent a distinct cognitive objective.
- Each step must move thinking forward.
- No step may restate a previous step in different words.

For each step:
1) Write ONE short sentence describing the thinking focus.
   - The sentence MUST start with the exact word "I".
   - Do NOT start with questions like "What", "How", or "Why".
   - Use first-person internal reasoning only.
   - Must reflect THIS PERSON’s priorities, fears, and decision style.
   - Generic phrasing is not allowed.

2) Generate ONE precise Google search query.
   - The query MUST sound like what THIS PERSON would actually type.
   - The query MUST include at least ONE domain-specific keyword.
   - Different personas MUST NOT produce identical queries for the same input.

3) Encode the query using URL-safe format (spaces replaced with +).

4) Output the query as a clickable Google search link.

Formatting MUST match exactly:

Thinking Path:

Step 1 — [Thinking focus]
Search:
https://www.google.com/search?q=...

Step 2 — [Thinking focus]
Search:
https://www.google.com/search?q=...

(continue sequentially as needed)

End with EXACTLY this line:
This system provides a thinking path, not answers.
`
      }
    ]
  });

  return out.choices[0].message.content.trim();
}

//////////////////////////////////////////////////////////////
// PERSONA EXECUTION ENGINE
//////////////////////////////////////////////////////////////

async function wdnabPersonaExecutionEngine(input, persona = "") {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content: `
${persona}

You are a persona-aligned execution engine.

Provide immediate actionable output.
No links.
No thinking path.
No disclaimers.
Short and executable.
`
      },
      { role: "user", content: input }
    ]
  });

  return out.choices[0].message.content.trim();
}

//////////////////////////////////////////////////////////////
// ROUTE — PERSONA EXECUTION
//////////////////////////////////////////////////////////////

app.post("/persona-execution", async (req, res) => {
  try {
    const { input, persona } = req.body;

    if (!input || !persona) {
      return res.json({ answer: "Input required." });
    }

    const answer = await wdnabPersonaExecutionEngine(input, persona);

    return res.json({ answer });

  } catch (err) {
    console.error("❌ persona-execution failed:", err);
    return res.status(500).json({ answer: "System unavailable." });
  }
});

// =====================================================
// ROUTE — THINKING PATH (ONLY ROUTE)
// =====================================================
app.post("/thinking-path", async (req, res) => {
  try {
    const steps = [];
    const input = (req.body.input || "").trim();
    const persona = (req.body.persona || "").trim();

    stepLog(steps, "Thinking path request received");

    if (!input) {
      return res.json({
        report: "Input is required.",
        steps
      });
    }

    let finalInput = input;

    stepLog(steps, "Evaluating input intent");

    const accepted = await wdnabAcceptProblemOrWish(input, persona);

    if (!accepted) {
      stepLog(steps, "Input rejected — rewriting");

      const rewritten = await wdnabRewriteToProblemOrWish(input, persona);

      if (
        !rewritten ||
        rewritten === "Unable to rewrite as a problem or a wish."
      ) {
        return res.json({
          report: "Input cannot be interpreted.",
          steps
        });
      }

      finalInput = rewritten;
      stepLog(steps, "Rewrite successful");
    }

    stepLog(steps, "Generating thinking path");

    const report = await wdnabGenerateThinkingPath(finalInput, persona);

    stepLog(steps, "Thinking path delivered");

    res.json({ report, steps });

  } catch (err) {
    console.error("❌ Thinking path failed:", err);

    res.status(200).json({
      report: "Thinking path generation failed.",
      steps: []
    });
  }
});

//////////////////////////////////////////////////////////////
// ROUTE — SUBMIT APPLICATION (EMAIL LOCK PERSISTENT)
//////////////////////////////////////////////////////////////

const fs = require("fs");
const path = require("path");

const LOCK_FILE = path.join(__dirname, "email-locks.json");

let submittedEmails = new Set();

// Load saved emails if file exists
if (fs.existsSync(LOCK_FILE)) {
  try {
    const saved = JSON.parse(fs.readFileSync(LOCK_FILE));
    submittedEmails = new Set(saved);
  } catch (err) {
    console.error("Failed to load lock file:", err);
  }
}

function saveEmailLocks() {
  fs.writeFileSync(
    LOCK_FILE,
    JSON.stringify([...submittedEmails], null, 2)
  );
}

app.post("/submit-application", async (req, res) => {
  try {
    const { email, name, question, persona, card, saasHtml } = req.body;

    if (!email || !name || !question) {
      return res.status(400).json({
        ok: false,
        reason: "missing_fields"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 🔒 ONE SUBMISSION PER EMAIL
    if (submittedEmails.has(normalizedEmail)) {
      return res.status(409).json({
        ok: false,
        reason: "already_used"
      });
    }

    // Mark as used
    submittedEmails.add(normalizedEmail);
    saveEmailLocks();

    // ✅ Start with whatever frontend sent (if any)
    let finalSaas = saasHtml;

    // ✅ If frontend did not send SaaS HTML, generate it here
    if (!finalSaas) {
      const rewritten = await wdnabRewriteToProblemOrWish(question);

      const rawSaasGenerated = await generateSaaSFromMeta(
        rewritten,
        name,
        persona
      );

      finalSaas = rawSaasGenerated
        .replace(/^```html\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/, "");

      // 🔒 HARD INJECT PERSONA SAFETY (guarantee personaText exists)
      if (!finalSaas.includes("const personaText")) {
        finalSaas = finalSaas.replace(
          "<script>",
          `<script>\nconst personaText = ${JSON.stringify(persona)};\n`
        );
      }
    }

    // ✅ Email always gets SaaS HTML
    await sendApplicationEmail({
      name,
      question,
      persona,
      card,
      saasHtml: finalSaas
    });

    return res.json({ ok: true });

  } catch (err) {
    console.error("Submit application error:", err);
    return res.status(500).json({
      ok: false,
      reason: "email_failed"
    });
  }
});

// -------------------- SERVER --------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🧠 Jack Chang Thinking Path backend live");
});

