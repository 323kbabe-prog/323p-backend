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

Thinking voice:
The thinking focus sentences should reflect how this person
internally reasons when under pressure.

Sentence construction should adapt to this person’s background,
stage of life, and stakes — while remaining factual and neutral.

Avoid generic academic phrasing by default.
Prefer concrete, lived, internal framing when risk is personal.

Search behavior:
Search queries must reflect how this person would actually search
when trying to reduce uncertainty under risk.

The query phrasing should align with:
- this person’s vocabulary
- their stage of life
- their fears and priorities
- the kind of evidence they trust

Avoid generic or academic queries by default.
Prefer natural, first-person or situational phrasing
when the risk is personal.

Step rules:
- Each step must represent a distinct cognitive objective.
- Each step must move thinking forward.

For each step:
1) Write ONE short sentence describing the thinking focus.
2) Generate ONE Google search query in this person’s voice.
3) Encode it using URL-safe format.
4) Output it as a clickable Google search link.

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
});

// -------------------- SERVER --------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("🧠 Jack Chang Thinking Path backend live");
});