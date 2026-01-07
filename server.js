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
- DO NOT use ###, **, ---, or any formatting symbols
- Use only normal text, line breaks, and simple bullet characters (-)

FIRST, write this header on its own line exactly:
What to learn

Under this header, write EXACTLY three learning points.

For EACH learning point:
- Start with a single dash followed by a space
- Write ONE short explanatory paragraph (2–3 sentences)
- Explain how this learning point trains thinking, not what conclusion to reach

After the learning section, write the following lines exactly:

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
- No Markdown
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