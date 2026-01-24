//////////////////////////////////////////////////////////////
// JACK CHANG — THINKING PATH BACKEND (FINAL)
// Process over outcome · No advice · No conclusions
//////////////////////////////////////////////////////////////

const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();

// -------------------- BASIC SETUP --------------------
app.get("/", (_, res) => res.status(200).send("OK"));
app.use(cors({ origin: "*" }));
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// -------------------- STEP LOGGER --------------------
function stepLog(steps, text) {
  steps.push({
    time: new Date().toISOString(),
    text
  });
}

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
// ROUTE — GENERATE PERSONA
// =====================================================
app.post("/generate-persona", async (req, res) => {
  try {
    const riskText = (req.body.riskText || "").trim();

    if (!riskText) {
      return res.json({
        persona: `
Thinking voice:
- Neutral internal reasoning.

Search behavior:
- Neutral exploratory queries.
`
      });
    }

    const persona = await generatePersonaDescriptor(riskText);
    res.json({ persona });

  } catch (err) {
    console.error("❌ Persona generation failed:", err);

    res.status(200).json({
      persona: `
Thinking voice:
- Fallback neutral reasoning.

Search behavior:
- Fallback exploratory queries.
`
    });
  }
});

// =====================================================
// THINKING PATH GENERATOR (CORE ENGINE)
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
- Emotional inputs require exploring social, economic, and personal risk layers.
- Maintain the same neutral, factual tone.
- Depth increases; emotional language does NOT.

Step rules:
- Each step must represent a distinct cognitive objective.
- Each step must move thinking forward.
- No step may restate a previous step in different words.

For each step:
1) Write ONE short sentence describing the thinking focus.
   - Direct, practical, matter-of-fact.
   - Internal reasoning style, not instruction.
2) Generate ONE precise Google search query.
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
// PERSONA GENERATOR — AI OWNS VOICE & SEARCH STYLE
// =====================================================
async function generatePersonaDescriptor(riskText) {
  const out = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    messages: [
      {
        role: "system",
        content: `
You are generating a persona specification.

Rules:
- Output ONLY the structure below.
- Do NOT explain.
- Do NOT include user words.
- Decide perspective, sentence pressure, and search behavior yourself.
- Persona may vary per request.

FORMAT (exact):

Thinking voice:
- <bullet>
- <bullet>
- <bullet>
- <bullet>

Search behavior:
- <bullet>
- <bullet>
- <bullet>
`
      },
      {
        role: "user",
        content: `Risk context (do not reuse words): ${riskText}`
      }
    ]
  });

  return out.choices[0].message.content.trim();
}

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
