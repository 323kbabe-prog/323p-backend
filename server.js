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

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const fetch = require("node-fetch");
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
    subject: `AI Bubble Identity Created — ${name}`,
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
// 🌍 IP LOCATION HELPER (ADD HERE)
//////////////////////////////////////////////////////////////
async function getLocationFromIP(ip){

  try{

    const res = await fetch(`http://ip-api.com/json/${ip}`);
    const data = await res.json();

    if(data && data.status === "success"){
      return `${data.city}, ${data.country}`;
    }

    return "unknown";

  }catch(err){
    console.log("IP location error:", err);
    return "unknown";
  }

}

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
Generate a Coachella topic exactly like real people talking online.

Think like:
- YouTube vlog titles
- TikTok captions
- comment sections under viral videos
- Twitter/X reactions

Focus on:
- specific performances
- celebrity appearances
- outfits and looks
- viral moments
- reactions (good or bad)

Tone:
- casual
- emotional
- reactive
- slightly dramatic

Rules:
• 1 short sentence OR 1–2 short lines
• must sound like something a real person would post
• no abstract philosophy
• no deep “identity” wording
• include curiosity, reaction, or opinion
• end as a question

Style examples (DO NOT COPY, JUST MATCH STYLE):
- Did you see that performance last night??
- Why is everyone posting the same Coachella outfit?
- That set looked insane, was it actually good live?
- Who had the best moment at Coachella this year?

IMPORTANT:
Make it feel like it came from a real viral post or comment.

Always include a specific event or moment, not a general idea.
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
      src="https://images.squarespace-cdn.com/content/6784e2cf16887b12d499fa90/db5fa948-c490-479a-90be-0c4aebc00431/CCC+User+Icon.png?content-type=image%2Fpng"
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
- If input empty: show "Enter a thought, idea, or question to start the AI debate."
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

   const rewritten = metaAnswer;

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
// PERSONA EXECUTION ENGINE (MINIMAL TOOL VOICE MODE)
//////////////////////////////////////////////////////////////

async function wdnabPersonaExecutionEngine(input, persona = "") {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content: `
You are the following persona. Speak from this worldview.

${persona}

VOICE IDENTITY RULE
All personas share the same core speaking voice.
The style remains consistent across all personas.
Only the viewpoint or philosophy changes.

BEHAVIOR RULES
- Speak briefly and naturally.
- Use calm tool-like language.
- Maintain the persona worldview.

MINIMAL RESPONSE RULE
- Do NOT rewrite the user's input.
- Do NOT repeat the user's words.
- Do NOT ask questions.

SHORT INPUT RULE
If the user input is extremely short (1–3 words):
- Reply with ONE word or ONE short sentence.
- Acknowledge or lightly agree.

NORMAL INPUT RULE
If the input contains more detail:
- Respond with 1–3 short sentences.
- Statements only.
- Suggestions may appear but only as statements.

PROHIBITED
- No questions
- No explanations of reasoning
- No links
- No disclaimers

TONE
Calm
Natural
Confident
Minimal
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
      const rewritten = question;

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

//////////////////////////////////////////////////////////////
// LOAD EMAIL LIST
//////////////////////////////////////////////////////////////

const EMAIL_LIST_FILE = path.join(__dirname, "email-list.json");

let emailList = new Set();

if (fs.existsSync(EMAIL_LIST_FILE)) {
  try {
    const saved = JSON.parse(fs.readFileSync(EMAIL_LIST_FILE));
    emailList = new Set(saved);
    console.log("Loaded emails:", [...emailList]);
  } catch (err) {
    console.error("Email list load failed:", err);
  }
}

//////////////////////////////////////////////////////////////
// SERP AI TREND FETCHER + QUESTION GENERATOR (X / TWITTER MODE)
//////////////////////////////////////////////////////////////

async function getTodayAITopic(){

try{

// 🔥 Google → X posts (real-time signal)
const ytUrl = `https://www.googleapis.com/youtube/v3/search?key=${process.env.YOUTUBE_API_KEY}&q=coachella&type=video&part=snippet&maxResults=20`;

const ytRes = await fetch(ytUrl);
const ytData = await ytRes.json();


// ---- ERROR CHECK ----
if(data.error){
console.error("SERP ERROR:", data.error);
return "What are the most important developments in artificial intelligence today?";
}

// ---- USE ORGANIC RESULTS (NOT NEWS) ----
const results = data.organic_results || [];

if(results.length === 0){
return "What are the most important developments in artificial intelligence today?";
}

// ---- PICK TOP RESULT (MOST RELEVANT / VIRAL APPROXIMATION) ----
const headline =
results[0]?.title ||
results[0]?.snippet ||
"What are the most important developments in artificial intelligence today?";

console.log("SERP X headline:", headline);

/*
Convert headline into debate question
*/

const ai = await openai.chat.completions.create({
model:"gpt-4o-mini",
temperature:0.6,
messages:[
{
role:"system",
content:`
Convert a real-world AI headline or social post into a debate question.

Rules:
• Output ONE question only
• Keep it under 20 words
• Focus on impact, risk, or future implications
• Keep real names if present (OpenAI, Google, Elon Musk, etc.)
`
},
{
role:"user",
content:headline
}
]
});

const question = ai.choices[0].message.content.trim();

console.log("Generated debate question:", question);

return question;

}catch(err){

console.error("SERP fetch error:", err);

return "What are the most important developments in artificial intelligence today?";

}

}

//////////////////////////////////////////////////////////////
// SEND EMAIL TO LIST (TOPIC ONLY)
//////////////////////////////////////////////////////////////

async function sendDebateToEmailList(question, messages) {

  if (!emailList || emailList.size === 0) return;

  const subject = "10 AIs just debated this";

  // 🔥 build debate content
const debateText = messages
  .map(m => {
    const searchLink = `https://www.google.com/search?q=${(m.search || "")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "+")}`;

    return `${m.persona}: ${m.text}\n→ Search: ${searchLink}`;
  })
  .join("\n\n");


  const text = `
10 AIs just debated this:

"${question}"

${debateText}

Explore more:
https://aijackchang.com/multiaidebate

AI Social Search Engine
So you don’t search on Google alone.
`;

  // 🔥 non-blocking send
  for (const email of emailList) {

    if (!email || !email.includes("@")) continue;

    transporter.sendMail({
      from: `"AI Social Search Engine" <${process.env.EMAIL_USER}>`,
      to: email,
      subject,
      text
    })
    .then(() => console.log("Sent:", email))
    .catch(err => console.error("Failed:", email, err));

  }
}


//////////////////////////////////////////////////////////////
// ROUTE — TODAY AI DEBATE
//////////////////////////////////////////////////////////////

app.get("/today-ai-debate", async (req,res)=>{

try{

const topic = await getTodayAITopic();

return res.json({
topic
});

}catch(err){

console.error("today-ai-debate error:",err);

return res.json({
topic:"What are the most important developments in artificial intelligence today?"
});

}

});

//////////////////////////////////////////////////////////////
// RANDOM ACADEMIC PERSONA + THINKING PATH SEARCH ENGINE
//////////////////////////////////////////////////////////////

const ACADEMIC_PERSONAS = [

"Economics perspective",
"Psychology perspective",
"Computer science perspective",
"Political science perspective",
"Biology research perspective",

"Environmental science perspective",
"Urban planning perspective",
"Philosophy perspective",
"Mathematics perspective",
"Design perspective",

"Sociology perspective",
"Anthropology research perspective",
"History perspective",
"Journalism perspective",
"Law perspective",

"Business strategy perspective",
"Marketing perspective",
"Finance perspective",
"Data science perspective",
"Artificial intelligence research perspective",

"Public policy perspective",
"International relations perspective",
"Education perspective",
"Health sciences perspective",
"Nutrition science perspective",

"Architecture perspective",
"Mechanical engineering perspective",
"Civil engineering perspective",
"Media studies perspective",
"Linguistics perspective",

"Film studies perspective",
"Music industry perspective",
"Entertainment media perspective",
"Game design perspective",
"Pop culture studies perspective"

];

function randomPersona(){

return ACADEMIC_PERSONAS[
Math.floor(Math.random()*ACADEMIC_PERSONAS.length)
];

}

function validQuestion(text){

if(!text) return false;

const t=text.trim();

if(t.length < 6) return false;
if(t.length > 200) return false;

if(!/[a-zA-Z]/.test(t)) return false;

return true;

}

//////////////////////////////////////////////////////////////
// SIMPLE EMAIL CAPTURE (FOR CHAT PAGE ONLY)
//////////////////////////////////////////////////////////////

app.post("/quick-save", async (req, res) => {
  try {

    const { email, input } = req.body;

    if (!email || !input) {
      return res.json({ ok: false });
    }

    const date = new Date().toISOString();

    // 🔒 EMAIL DISABLED
/*
await transporter.sendMail({
  from: `"AI-CIDI CHAT" <${process.env.EMAIL_USER}>`,
  to: "jackchang067@gmail.com", // 🔥 you receive it
  subject: "New AI-CIDI Chat Input",
  text: `
Email:
${email}

Date:
${date}

User Input:
${input}
  `
});
*/

return res.json({ ok: true });

} catch (err) {
  console.error("quick-save error:", err);
  return res.json({ ok: false });
}
});

//////////////////////////////////////////////////////////////
// ROUTE — MAJOR SEARCH ENGINE
//////////////////////////////////////////////////////////////

app.post("/major-search", async (req,res)=>{

try{

const question=(req.body.question || "").trim();

if(!validQuestion(question)){

return res.json({
persona:"",
answer:"Enter a thought, idea, or question to start the AI debate.",
thinking_path:[]
});

}

const persona=randomPersona();

const response=await openai.chat.completions.create({
model:"gpt-4o-mini",
temperature:0.4,
messages:[
{
role:"system",
content:`
You answer from this perspective:

${persona}

Provide:

1. A short paragraph answer (3–5 sentences) responding to the question.
The paragraph should clearly explain the idea from this perspective.

2. A Thinking Path with 3 steps.

Each step must include:
- WHY this step matters
- a Google search query.

Format exactly:

Answer:
(paragraph)

Thinking Path:

Step 1 —
Why: explanation
Search: query words

Step 2 —
Why: explanation
Search: query words

Step 3 —
Why: explanation
Search: query words
`
},
{
role:"user",
content:question
}
]
});

const raw=response.choices[0].message.content.trim();

const answer=raw.split("Thinking Path")[0]
.replace("Answer:","")
.trim();

const stepBlocks = raw.match(/Step\s\d[\s\S]*?Search:\s*(.*)/g) || [];

const thinking_path = stepBlocks.map(block => {

const whyMatch = block.match(/Why:\s*(.*)/);
const searchMatch = block.match(/Search:\s*(.*)/);

const why = whyMatch ? whyMatch[1].trim() : "";
const query = searchMatch ? searchMatch[1].trim() : "";

const encoded = query
.trim()
.replace(/[^\w\s-]/g,"")
.replace(/\s+/g,"+");

return {
  why,
  link:`https://www.google.com/search?q=${encoded}`
};
});

return res.json({
persona,
answer,
thinking_path
});

}catch(err){

console.error("major-search error:",err);

res.status(500).json({
persona:"",
answer:"System unavailable.",
thinking_path:[]
});

}

});

//////////////////////////////////////////////////////////////
// DEBATE PERSONAS
//////////////////////////////////////////////////////////////

const DEBATE_PERSONAS = [

"Economics perspective",
"Psychology perspective",
"Computer science perspective",
"Political science perspective",
"Biology research perspective",

"Environmental science perspective",
"Urban planning perspective",
"Philosophy perspective",
"Mathematics perspective",
"Design perspective",

"Sociology perspective",
"Anthropology research perspective",
"History perspective",
"Journalism perspective",
"Law perspective",

"Business strategy perspective",
"Marketing perspective",
"Finance perspective",
"Data science perspective",
"Artificial intelligence research perspective",

"Public policy perspective",
"International relations perspective",
"Education perspective",
"Health sciences perspective",
"Nutrition science perspective",

"Architecture perspective",
"Mechanical engineering perspective",
"Civil engineering perspective",
"Media studies perspective",
"Linguistics perspective",

"Film studies perspective",
"Music industry perspective",
"Entertainment media perspective",
"Game design perspective",
"Pop culture studies perspective"

];

//////////////////////////////////////////////////////////////
// SHUFFLE
//////////////////////////////////////////////////////////////

function shuffleArray(arr){

for(let i = arr.length - 1; i > 0; i--){

const j = Math.floor(Math.random() * (i + 1));

[arr[i],arr[j]] = [arr[j],arr[i]];

}

return arr;

}

//////////////////////////////////////////////////////////////
// VALIDATION
//////////////////////////////////////////////////////////////

function validDebateQuestion(text){

if(!text) return false;

const t = text.trim();

if(t.length < 4) return false;

if(t.length > 200) return false;

return true;

}

//////////////////////////////////////////////////////////////
// LANGUAGE DETECTION
//////////////////////////////////////////////////////////////

async function detectLanguage(text){

const r = await openai.chat.completions.create({
model:"gpt-4o-mini",
temperature:0,
messages:[
{
role:"system",
content:"Detect the language of the text. Reply ONLY with ISO code like en, zh, es, fr, de."
},
{
role:"user",
content:text
}
]
});

return r.choices[0].message.content.trim().toLowerCase();

}

//////////////////////////////////////////////////////////////
// TRANSLATE TO ENGLISH
//////////////////////////////////////////////////////////////

async function translateToEnglish(text){

const r = await openai.chat.completions.create({
model:"gpt-4o-mini",
temperature:0,
messages:[
{
role:"system",
content:"Translate the text into natural English."
},
{
role:"user",
content:text
}
]
});

return r.choices[0].message.content.trim();

}

//////////////////////////////////////////////////////////////
// TRANSLATE FROM ENGLISH
//////////////////////////////////////////////////////////////

async function translateFromEnglish(text, lang){

if(lang === "en") return text;

const r = await openai.chat.completions.create({
model:"gpt-4o-mini",
temperature:0,
messages:[
{
role:"system",
content:`Translate the following English text to ${lang}.`
},
{
role:"user",
content:text
}
]
});

return r.choices[0].message.content.trim();

}

//////////////////////////////////////////////////////////////
// LIVE DEBATE ENGINE (STABLE VERSION)
//////////////////////////////////////////////////////////////

app.post("/major-debate", async (req,res)=>{

try{

const userInput = (req.body.question || "").trim();

if(!validDebateQuestion(userInput)){
return res.json({messages:[]});
}

// detect user language
const userLang = await detectLanguage(userInput);

// translate to English for AI processing
const question = await translateToEnglish(userInput);

// AI nonsense detection
const nonsenseCheck = await openai.chat.completions.create({
model:"gpt-4o-mini",
temperature:0,
messages:[
{
role:"system",
content:`
Decide if the user input is a meaningful question or discussion topic.

If the input is random text, meaningless characters, or nonsense reply NO.

If the input expresses a real topic, idea, or question reply YES.

Reply ONLY YES or NO.
`
},
{
role:"user",
content:question
}
]
});

const verdict = nonsenseCheck.choices[0].message.content.trim();

if(verdict !== "YES"){

const errorText = await translateFromEnglish(
"Enter a thought, idea, or question to start the AI debate.",
userLang
);

return res.json({
messages:[],
error:errorText
});

}

const personas = shuffleArray([...DEBATE_PERSONAS]).slice(0,10);

const systemPrompt = `
You are simulating a live expert debate.

User question:
"${question}"

Participants:
${personas.join("\n")}

Debate rules:

• Exactly 10 messages total
• Each message must respond to a previous speaker
• Every message MUST mention another persona by name
• At least 40% of messages must disagree with a previous point
• Some messages should challenge assumptions
• Some should defend earlier arguments
• The debate should include conflict, rebuttal, and counterpoints

Example:

Economics chat disagreeing with Psychology chat
Law chat challenging Economics chat
Design chat defending Psychology chat

Example style:

Economics chat replying to Psychology chat
Law chat disagreeing with Economics chat
Design chat building on Urban planning chat

Constraints:

• Messages must be 1–2 sentences
• Each message must introduce a NEW idea
• No repeated sentences
• No paraphrasing earlier text

NEW REQUIRED OUTPUT FIELD:

• Each message MUST also include a "search" field
• "search" must be a short Google search phrase (5–10 words)
• The search must directly reflect the idea in that message
• Use natural human search wording (no symbols, no punctuation)
• Do NOT repeat search phrases across messages
• Each search should help the user explore that specific viewpoint

STRICT OUTPUT REQUIREMENT:

Each message MUST include ALL of the following fields:

- persona
- text
- search

The "search" field is REQUIRED.

If any message is missing "search", the entire output is invalid.

Do NOT omit "search" under any condition.

Output JSON ONLY.

Format:

{
 "messages":[
  {
   "persona":"Economics perspective",
   "text":"message",
   "search":"search phrase"
  }
 ]
}

`;

const response = await openai.chat.completions.create({
model:"gpt-4o-mini",
temperature:0.9,
response_format:{type:"json_object"},
messages:[
{role:"system",content:systemPrompt},
{role:"user",content:"Start the debate."}
]
});

let raw = response.choices?.[0]?.message?.content || "";

raw = raw
.replace(/```json/g,"")
.replace(/```/g,"")
.trim();

let parsed;

try{

parsed = JSON.parse(raw);

}catch{

return res.json({messages:[]});

}

const rawMessages =
parsed.messages ||
parsed.debate ||
parsed.output ||
[];

for (const m of rawMessages) {
  if (!m.search || m.search.trim() === "") {

    // 🔥 fallback: generate search from text
    const words = (m.text || "")
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(" ")
      .filter(w => w.length > 2);

    m.search = words.slice(0, 8).join(" ");
  }
}

/*
SMART DUPLICATE FILTER
(prevents repeated or near-repeated messages)
*/

const seen = new Set();
const messages = [];

for(const m of rawMessages){

const clean = (m.text || "")
.trim()
.toLowerCase()
.replace(/[^\w\s]/g,"")
.slice(0,80);

if(!seen.has(clean)){

seen.add(clean);

messages.push({
  persona: (m.persona || "Unknown")
    .replace(/perspective/i,"chat"),
  text: m.text,
  search: m.search || ""
});

}

if(messages.length >= 10) break;

}

// translate debate back to user language
const joinedText = messages
.map((m,i)=>`[${i}] ${m.text}`)
.join("\n");

const translated = await translateFromEnglish(joinedText, userLang);

const lines = translated.split("\n");

for(let i=0;i<messages.length;i++){
messages[i].text =
(lines[i] || "")
.replace(/^\[\d+\]\s*/,"") || messages[i].text;
}

if(messages.length === 0){
return res.json({messages:[]});
}

await sendDebateToEmailList(userInput, messages);

return res.json({messages});

}catch(err){

console.error("major-debate error:",err);

return res.status(500).json({messages:[]});

}

});

//////////////////////////////////////////////////////////////
// ROUTE — FETCH YOUR YOUTUBE SHORTS
//////////////////////////////////////////////////////////////

app.get("/youtube-shorts", async (req, res) => {

  try {

    const query = (req.query.q || "").toLowerCase();

   const API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;

const ytUrl = `https://www.googleapis.com/youtube/v3/search?key=${process.env.YOUTUBE_API_KEY}&q=coachella+vlog&type=video&part=snippet&maxResults=20`;

const ytRes = await fetch(ytUrl);
const ytData = await ytRes.json();

    if (!data.items) {
      return res.json({ videos: [] });
    }

    // 🔥 FILTER BY TITLE MATCH
    const filtered = data.items.filter(v =>
      v.snippet.title.toLowerCase().includes(query)
    );

    const finalVideos = filtered.length > 0
      ? filtered
      : data.items.slice(0, 5);

    const result = finalVideos.map(v => ({
      id: v.id.videoId,
      title: v.snippet.title,
      thumbnail: v.snippet.thumbnails.high.url
    }));

    res.json({ videos: result });

  } catch (err) {
    console.error("YouTube Shorts fetch error:", err);
    res.json({ videos: [] });
  }

});

//////////////////////////////////////////////////////////////
// CONTINUE DEBATE — USER VS BEST AI
//////////////////////////////////////////////////////////////

app.post("/debate-continue", async (req, res) => {
  try {

    const userInput = (req.body.input || "").trim();

    if (!userInput) {
      return res.json({ reply: "Say something to continue the debate." });
    }

    // STEP 1 — pick persona
    const pick = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `
Choose the BEST persona for this input.

Only choose ONE from list:
${DEBATE_PERSONAS.join("\n")}

Output ONLY the persona name.
`
        },
        {
          role: "user",
          content: userInput
        }
      ]
    });

    const persona = pick.choices[0].message.content.trim();

    // STEP 2 — reply
    const replyRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      messages: [
        {
          role: "system",
          content: `
You are ${persona} in a live debate.

STRICT RULES:

- Respond directly to the user's claim
- You MUST take a position (agree OR disagree)
- If disagreeing, be clear and assertive
- Do NOT stay neutral

STYLE:

- Use strong argumentative language
- Prefer phrases like:
  - "This is incorrect because..."
  - "That assumption fails..."
  - "This ignores..."
  - "That logic breaks down when..."
  
- Challenge the idea, not just describe it
- You may contradict or push back

FORMAT:

- 4–6 sentences only
- No questions
- No soft language like "it depends", "also", "in addition"
`
        },
        {
          role: "user",
          content: userInput
        }
      ]
    });

const reply = replyRes.choices[0].message.content.trim();

// STEP 3 — GENERATE SEARCH
const searchRes = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  temperature: 0.3,
  messages: [
    {
      role: "system",
      content: `
Convert this idea into a natural Google search query.

Rules:
- 5–10 words
- lowercase
- no punctuation
- must sound like a real human search
- do NOT copy phrases like "this is incorrect"

Output ONLY the search query.
`
    },
    {
      role: "user",
      content: reply
    }
  ]
});

const searchWords = searchRes.choices[0].message.content.trim();

// RETURN RESPONSE
return res.json({
  persona: persona.replace(/perspective/i, "chat"),
  reply,
  search: searchWords
});

} catch (err) {
  console.error("debate-continue error:", err);

  return res.json({
    persona: "AI",
    reply: "System unavailable.",
    search: ""
  });
}
});

//////////////////////////////////////////////////////////////
// ROUTE — REWRITE ENGLISH (FIX GRAMMAR ONLY)
//////////////////////////////////////////////////////////////

app.post("/rewrite-english", async (req, res) => {
  try {
    const { text } = req.body || {};

    if (!text) {
      return res.status(400).json({ result: "" });
    }

    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `
Fix grammar only.

Rules:
- Keep original meaning
- Do NOT expand
- Do NOT explain
- Return ONE corrected sentence only
`
        },
        {
          role: "user",
          content: text
        }
      ]
    });

    const result = r.choices[0].message.content.trim();

    return res.json({ result });

  } catch (err) {
    console.error("rewrite-english error:", err);
    return res.status(500).json({ result: "" });
  }
});

//////////////////////////////////////////////////////////////
// ROUTE — /aicidicoachellafomo (FINAL CLEAN VERSION)
//////////////////////////////////////////////////////////////
app.post("/aicidicoachellafomo", async (req,res)=>{
  try{

    let userInput = (req.body.question || "").trim();

    //////////////////////////////////////////////////////////////
    // 🔥 STEP 0 — LIVE SIGNALS (FIXED)
    //////////////////////////////////////////////////////////////
    const liveTitles = Array.isArray(req.body.liveTitles)
      ? req.body.liveTitles
      : [];

    const signals = liveTitles
      .map(s => (s || "").toLowerCase().trim())
      .filter(Boolean)
      .slice(0,10);

    const liveContext = signals.join("\n");

    //////////////////////////////////////////////////////////////
    // 🔥 STEP 1 — PERSONAS
    //////////////////////////////////////////////////////////////
    function extractYouTubePersonas(results){
      const personas = [];
      const seen = new Set();

      for(const r of results){
        const name = (r.snippet?.channelTitle || "").trim();
        const title = (r.snippet?.title || "").trim();

        if(name && !seen.has(name.toLowerCase())){
          seen.add(name.toLowerCase());
          personas.push({
            name: "virtual @" + name,
            title
          });
        }

        if(personas.length >= 10) break;
      }

      return personas;
    }

    const ytUrl = `https://www.googleapis.com/youtube/v3/search?key=${process.env.YOUTUBE_API_KEY}&q=coachella&type=video&part=snippet&maxResults=20`;

    const ytRes = await fetch(ytUrl);
    const ytData = await ytRes.json();

    let personas = extractYouTubePersonas(ytData.items || []);

    if(personas.length < 5){
      personas = [
        { name:"virtual @festivalvibes", title:"coachella crowd energy vlog" },
        { name:"virtual @streetweartok", title:"coachella outfit breakdown" },
        { name:"virtual @musicreacts", title:"live set reaction coachella" }
      ];
    }

    const personaTextBlock = personas.map(p => `
${p.name}
Video Title: ${p.title}
`).join("\n");

    //////////////////////////////////////////////////////////////
    // 🔥 STEP 2 — SYSTEM PROMPT (FINAL)
    //////////////////////////////////////////////////////////////
    const systemPrompt = `
You are Cidi — a real-time AI content director.

You operate in a neutral, analytical, machine-like tone.

LIVE SIGNALS:
${liveContext}

CREATORS:
${personaTextBlock}

━━━━━━━━━━━━━━━━━━
TASK
━━━━━━━━━━━━━━━━━━

For EACH creator:

1. Identify what is being repeatedly captured
2. Describe the pattern without emotion
3. Provide structured guidance

━━━━━━━━━━━━━━━━━━
TEXT STRUCTURE (STRICT)
━━━━━━━━━━━━━━━━━━

• 4–6 sentences total

Sentence 1–2:
- neutral observation
- describe pattern

Sentence 3–6:
- MUST start with "You should"
- slightly critical
- suggest improvement

━━━━━━━━━━━━━━━━━━
STYLE
━━━━━━━━━━━━━━━━━━

• no emotional words
• no hype
• no influencer tone
• analytical only

━━━━━━━━━━━━━━━━━━
TITLE RULES
━━━━━━━━━━━━━━━━━━

• 4–8 words
• neutral tone
• no punctuation

━━━━━━━━━━━━━━━━━━
OUTPUT JSON ONLY
━━━━━━━━━━━━━━━━━━

{
  "messages":[
    {
      "persona":"virtual @name",
      "title":"title",
      "text":"paragraph",
      "search":"search phrase"
    }
  ]
}
`;

    //////////////////////////////////////////////////////////////
    // 🔥 STEP 3 — GENERATE
    //////////////////////////////////////////////////////////////
    const response = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      temperature:0.8,
      response_format:{type:"json_object"},
      messages:[
        {role:"system",content:systemPrompt},
        {role:"user",content:"Start"}
      ]
    });

    let raw = response.choices?.[0]?.message?.content || "";
    raw = raw.replace(/```json/g,"").replace(/```/g,"").trim();

    let parsed;
    try{
      parsed = JSON.parse(raw);
    }catch{
      return res.json({messages:[]});
    }

    //////////////////////////////////////////////////////////////
    // 🔥 STEP 4 — CLEAN OUTPUT (ENFORCE STRUCTURE)
    //////////////////////////////////////////////////////////////
    const messages = (parsed.messages || []).slice(0,10).map(m => {

      const match = personas.find(p =>
        p.name.toLowerCase().trim() === (m.persona || "").toLowerCase().trim()
      );

      let text = (m.text || "").trim();

      // split sentences
      let sentences = text
        .replace(/\n/g," ")
        .split(/(?<=[.?!])\s+/)
        .filter(s => s.length > 5);

      // limit to 6
      sentences = sentences.slice(0,6);

      // ensure at least 4
      if(sentences.length < 4){
        sentences.push("You should refine the framing for stronger clarity.");
      }

      // enforce "You should"
      const halfIndex = Math.floor(sentences.length / 2);

      for(let i = halfIndex; i < sentences.length; i++){
        if(!/^you should/i.test(sentences[i])){
          sentences[i] = "You should " + sentences[i].replace(/^[^a-zA-Z]+/, "");
        }
      }

      text = sentences.join(" ");

      // search fallback
      let search = (m.search || "").toLowerCase();

      if(!search){
        search = text
          .toLowerCase()
          .replace(/[^\w\s]/g,"")
          .split(" ")
          .slice(0,8)
          .join(" ");
      }

      return {
        persona: m.persona || "virtual @user",
        title: m.title || match?.title || "",
        text,
        search
      };
    });

    //////////////////////////////////////////////////////////////
    // 🔥 FINAL OUTPUT
    //////////////////////////////////////////////////////////////
    return res.json({
      topic: userInput || "Coachella live trends",
      messages
    });

  }catch(err){
    console.error("coachella route error:",err);
    return res.status(500).json({messages:[]});
  }
});


// =====================================================
// ROUTE /aicidi-topic (10 LIVE SIMPLE)
// =====================================================
app.post("/aicidi-topic", async (req,res)=>{

  try{

    let userInput = (req.body.question || "").trim();

    if(!userInput){

      // =====================================================
      // 🔥 NEWEST — LAST ~10 MINUTES
      // =====================================================
      let newestItems = [];

      const past = new Date(Date.now() - 10 * 60 * 1000);

      const newestUrl = `https://www.googleapis.com/youtube/v3/search?key=${process.env.YOUTUBE_API_KEY}&q=coachella&type=video&part=snippet&maxResults=10&order=date&publishedAfter=${past.toISOString()}`;

      const newestRes = await fetch(newestUrl);
      const newestData = await newestRes.json();

      newestItems = newestData.items || [];

      // ✅ SIMPLE fallback (IMPORTANT)
      if(newestItems.length === 0){
        const fallbackUrl = `https://www.googleapis.com/youtube/v3/search?key=${process.env.YOUTUBE_API_KEY}&q=coachella&type=video&part=snippet&maxResults=10&order=date`;

        const fallbackRes = await fetch(fallbackUrl);
        const fallbackData = await fallbackRes.json();

        newestItems = fallbackData.items || [];
      }

      // =====================================================
      // ✅ SHOW 10
      // =====================================================
      const newest10 = newestItems.map((v,i)=>{
        return `${i+1}. ${cleanTitle(v.snippet.title)}`;
      }).join("\n");


      // =====================================================
      // ✅ FINAL OUTPUT
      // =====================================================
      const topic = `

Newest 10 Performances:
${newest10}

Viral Discussion Question:
Which moment is happening right now?`;

      userInput = topic;
    }

    return res.json({ topic:userInput });

  }catch(err){
    return res.json({ topic:"What is happening at Coachella right now?" });
  }

});


// =====================================================
// helpers
// =====================================================
function cleanTitle(title){
  return title
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/🔥/g, "")
    .replace(/#\S+/g, "")
    .trim();
}

// =====================================================
// ROUTE /aicidi-join
// =====================================================

app.post("/aicidi-join", async (req, res) => {
  try {
    const userInput = (req.body.input || "").trim();

    if (!userInput) {
      return res.json({
        persona: "AI chat",
        reply: "Say something to join the debate.",
        search: ""
      });
    }

    // STEP 1 — pick persona
    const pick = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `
Choose the BEST persona for this input.

Only choose ONE from list:
${DEBATE_PERSONAS.join("\n")}

Output ONLY the persona name.
`
        },
        {
          role: "user",
          content: userInput
        }
      ]
    });

    const persona = pick.choices[0].message.content.trim();

    // STEP 2 — reply
    const replyRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      messages: [
        {
          role: "system",
          content: `
You are ${persona} in a live debate.

STRICT RULES:

- Respond directly to the user's claim
- Take a position (agree or disagree)
- Be assertive

FORMAT:
- 3–6 sentences
- No questions
`
        },
        {
          role: "user",
          content: userInput
        }
      ]
    });

    const rewriteRes = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  temperature: 0.6,
  messages: [
    {
      role: "system",
      content: `
Rewrite the user input into a YouTube creator title.

Rules:
- short (4–8 words)
- natural English
- no "I", no "want"
- no punctuation
- must feel like a video title

Output ONLY the title
`
    },
    {
      role: "user",
      content: userInput
    }
  ]
});

const rewriteTitle = rewriteRes.choices[0].message.content.trim();

    const contentRes = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  temperature: 0.7,
  messages: [
    {
      role: "system",
      content: `
Turn the idea into influencer-style content suggestion.

Rules:
- MUST be a content idea (not opinion)
- describe WHAT to film
- include moment, action, vibe
- 1–2 sentences only
- sound like YouTube / TikTok creator

Example:
"Film your friend reacting to the crowd energy, then cut to a moment where they drop the phone and fully enjoy the experience"

Output ONLY the content idea
`
    },
    {
      role: "user",
      content: replyRes.choices[0].message.content
    }
  ]
});

const reply = contentRes.choices[0].message.content.trim();

    // STEP 3 — search
    const searchRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `
Convert this idea into a Google search query.

Rules:
- 5–10 words
- lowercase
- no punctuation

Output ONLY the query.
`
        },
        {
          role: "user",
          content: reply
        }
      ]
    });

    const search = searchRes.choices[0].message.content.trim();

    return res.json({
  persona: persona.replace(/perspective/i, "chat"),
  reply,
  search,
  rewriteTitle   // 🔥 ADD THIS
});

  } catch (err) {
    console.error("aicidi-join error:", err);

    return res.json({
      persona: "AI",
      reply: "System unavailable.",
      search: ""
    });
  }
});

//////////////////////////////////////////////////////////////
// 🔥 REAL-TIME CHATROOM (AI + STRANGER INTERACTION)
//////////////////////////////////////////////////////////////

const http = require("http");
const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server, {
  cors: { origin: "*" }
});

const rooms = {};

io.on("connection", (socket) => {

////////////////////////////////////////////////////////////
// 🤖 STRANGER LOOP (AI ↔ STRANGER ONLY)
////////////////////////////////////////////////////////////
function startStrangerLoop(roomId){

  let chainCount = 0;

  async function loop(){

    const delay = 3000; // 🔥 3 sec trigger

    setTimeout(async () => {

      const room = rooms[roomId];
      if(!room) return;

      const lastMsg = room[room.length - 1];
      const idle = Date.now() - (lastMsg?.time || Date.now());

      // 🔥 only trigger if idle AND last speaker is AI
      if(idle > 3000 && lastMsg?.persona === "AI"){

        if(chainCount > 3){
          chainCount = 0;
          return loop();
        }

        const randomFeed = [
          "quiet room",
          "nobody talking",
          "late night scrolling",
          "low energy",
          "background noise",
          "empty vibe"
        ];

        const vibe = randomFeed[Math.floor(Math.random()*randomFeed.length)];

        try{

          ////////////////////////////////////////////////////////////
          // 👻 STRANGER SPEAKS (ONLY TO AI)
          ////////////////////////////////////////////////////////////
          const s = await openai.chat.completions.create({
            model:"gpt-4o-mini",
            temperature:0.9,
            messages:[
              {
                role:"system",
                content:`
You are a random human in a chatroom.

- respond casually
- 1 short sentence
- not helpful
- not addressing anyone directly
- feels like a passing comment
`
              },
              {
                role:"user",
                content:`Previous message: ${lastMsg.content}
Room vibe: ${vibe}`
              }
            ]
          });

          const strangerText = s.choices[0].message.content.trim();

          rooms[roomId].push({
            role:"assistant",
            persona:"Stranger",
            content:strangerText,
            time:Date.now()
          });

          io.to(roomId).emit("message", {
            role:"ai",
            persona:"Stranger",
            text:strangerText
          });

          ////////////////////////////////////////////////////////////
          // 🤖 AI RESPONDS TO STRANGER
          ////////////////////////////////////////////////////////////
          const a = await openai.chat.completions.create({
            model:"gpt-4o-mini",
            temperature:0.7,
            messages:[
              {
                role:"system",
                content:`
You are another random person in a chatroom.

- reply casually
- short response
- not helpful
- conversational
`
              },
              {
                role:"user",
                content:strangerText
              }
            ]
          });

          const aiReply = a.choices[0].message.content.trim();

          rooms[roomId].push({
            role:"assistant",
            persona:"AI",
            content:aiReply,
            time:Date.now()
          });

          io.to(roomId).emit("message", {
            role:"ai",
            persona:"AI",
            text:aiReply
          });

          chainCount++;

        }catch(err){
          console.log("loop error:", err);
        }

      }

      loop();

    }, delay);
  }

  loop();
}

////////////////////////////////////////////////////////////
// JOIN ROOM
////////////////////////////////////////////////////////////
socket.on("joinRoom", (roomId) => {

  socket.join(roomId);

  if (!rooms[roomId]) {
    rooms[roomId] = [];
    startStrangerLoop(roomId);
  }

  const intro = "Welcome to 323LAchat";

  socket.emit("message", {
    role:"ai",
    persona:"AI",
    text:intro
  });

  if (rooms[roomId].length === 0) {
    rooms[roomId].push({
      role:"assistant",
      persona:"AI",
      content:intro,
      time:Date.now()
    });
  }

});

////////////////////////////////////////////////////////////
// SEND MESSAGE (USER → AI ONLY)
////////////////////////////////////////////////////////////
socket.on("sendMessage", async ({ roomId, message }) => {

  if (!message) return;

  if (!rooms[roomId]) rooms[roomId] = [];

  ////////////////////////////////////////////////////////
  // SAVE USER
  ////////////////////////////////////////////////////////
  rooms[roomId].push({
    role:"user",
    persona:"User",
    content:message,
    time:Date.now()
  });

  io.to(roomId).emit("message", {
    role:"user",
    text:message
  });

  ////////////////////////////////////////////////////////
  // AI REPLY (TO USER ONLY)
  ////////////////////////////////////////////////////////
  let aiText = "";

  try{
    const r = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      temperature:0.7,
      messages:[
        {
          role:"system",
          content:`
You are a random human in a chatroom.

- 1 sentence
- casual
- not helpful
`
        },
        {
          role:"user",
          content:message
        }
      ]
    });

    aiText = r.choices[0].message.content;

  }catch(err){
    aiText = "error";
  }

  rooms[roomId].push({
    role:"assistant",
    persona:"AI",
    content:aiText,
    time:Date.now()
  });

  io.to(roomId).emit("message", {
    role:"ai",
    persona:"AI",
    text:aiText
  });

});

////////////////////////////////////////////////////////////
socket.on("disconnect", () => {
  console.log("🔴 disconnected:", socket.id);
});

});

//////////////////////////////////////////////////////////////
// 🚀 START SERVER
//////////////////////////////////////////////////////////////

const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("🔥 chatroom running");
});

