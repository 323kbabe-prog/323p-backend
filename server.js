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

async function sendApplicationEmail({ name, question, persona, card }) {
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
// AI-CIDI — REAL NAME SOUND MODE (OPTION A, LOCKED)
//////////////////////////////////////////////////////////////

const CIDI_SUPPORTED_LANGS = ["en", "ja", "ko", "zh", "fr"];

function normalizeLang(lang) {
  if (!lang) return "en";
  if (lang.startsWith("zh")) return "zh";
  if (lang.startsWith("ja")) return "ja";
  if (lang.startsWith("ko")) return "ko";
  if (lang.startsWith("fr")) return "fr";
  return "en";
}

function cidiFilterToNativeScript(lang, text) {
  if (!text) return "";

  if (lang === "zh") return text.replace(/[^\u4e00-\u9fff\s]/g, "");
  if (lang === "ja") return text.replace(/[^\u3040-\u30ff\u4e00-\u9fff\s]/g, "");
  if (lang === "ko") return text.replace(/[^\uac00-\ud7af\s]/g, "");

  return text.replace(/[^A-Za-z\s]/g, "");
}

async function runCidi(systemPrompt, userText) {
  const r = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userText }
    ]
  });
  return r.output_text?.trim() || "";
}

app.post("/api/cidi/pronounce", async (req, res) => {
  try {
    let { source_text, user_language, target_language } = req.body || {};

    user_language = normalizeLang(user_language);
    target_language = normalizeLang(target_language);

    if (!source_text) {
      return res.status(400).json({ error: "Missing source_text" });
    }

    if (
      !CIDI_SUPPORTED_LANGS.includes(user_language) ||
      !CIDI_SUPPORTED_LANGS.includes(target_language)
    ) {
      return res.status(400).json({ error: "Unsupported language" });
    }

    const systemPrompt = `
You are AI-CIDI — english name researcher.

TASK:
Translate the input sentence into the target language.
and out put that in input language character.

RULES:
- Real english names only.
- NO phonetics.
- NO IPA.
- NO invented syllables.
- NO explanations.
- ONE line output.

LANGUAGE LOCK:
- Output MUST be written ONLY in the USER’S native writing system.

STYLE:
- Sound similarity > accuracy
- Imperfect but human
- Natural spoken flow
`;

    const raw = await runCidi(systemPrompt, source_text);
    const output = cidiFilterToNativeScript(user_language, raw) || "[unavailable]";

    res.json({
      pronunciation: output,
      engine: "AI-CIDI",
      mode: "real-name-sound"
    });

  } catch (err) {
    console.error("AI-CIDI error:", err);
    res.status(500).json({ error: "AI-CIDI failed" });
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
app.post("/generate-persona", async (req, res) => {
  try {
    const riskText = (req.body.riskText || "").trim();

    if (!riskText) {
      return res.json({
        persona: `Thinking voice:
- Neutral internal reasoning.

Search behavior:
- Neutral exploratory queries.

Primary risk sensitivity:
Unspecified.`
      });
    }

const accepted = await wdnabAcceptProblemOrWish(riskText);

if (!accepted) {
  return res.json({
    persona: "Input does not express a clear human concern."
  });
}

    const persona = await generatePersonaFromRisk(riskText);
    res.json({ persona });

  } catch (err) {
    console.error("❌ Persona generation failed:", err);
    res.json({
      persona: `Thinking voice:
- Fallback neutral reasoning.

Search behavior:
- Fallback exploratory queries.

Primary risk sensitivity:
Unavailable.`
    });
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
<!-- CARD 3 : [FULL NAME] -->
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

app.post("/submit-application", async (req, res) => {
  try {
    const { name, question, persona, card } = req.body;

    if (!name || !question) {
      return res.status(400).json({ ok: false, reason: "missing_fields" });
    }

    const key = makeApplicationKey(name, question);

    // 🔒 HARD BLOCK
    if (submittedApplications.has(key)) {
      return res.status(409).json({
        ok: false,
        reason: "already_submitted"
      });
    }

    // Mark as submitted
    submittedApplications.add(key);

    await sendApplicationEmail({
      name,
      question,
      persona,
      card
    });

    res.json({ ok: true });

  } catch (err) {
    console.error("Email error:", err);
    res.status(500).json({ ok: false });
  }
});

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

// -------------------- SERVER --------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🧠 Jack Chang Thinking Path backend live");
});

