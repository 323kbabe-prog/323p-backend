//////////////////////////////////////////////////////////////
// ROUTE — /aicidicoachellafomo (FINAL STABLE VERSION)
//////////////////////////////////////////////////////////////
app.post("/aicidicoachellafomo", async (req,res)=>{
  try{

    let userInput = (req.body.question || "").trim();

    // ✅ SAFE INPUT
    const liveTitles = Array.isArray(req.body.liveTitles)
      ? req.body.liveTitles
      : [];

    //////////////////////////////////////////////////////////////
    // 🔥 STEP 0 — PROCESS SIGNALS (NO CRASH)
    //////////////////////////////////////////////////////////////
    function processSignals(input){
      let signals = [...input];

      signals = [...new Set(
        signals.map(s => (s || "").toLowerCase().trim())
      )]
      .map(s => s.trim())
      .filter(Boolean);

      if(signals.length < 10){
        signals = [
          ...signals,
          "crowd reaction during performance",
          "outfit check festival entrance",
          "bass drop main stage moment",
          "friends dancing together",
          "celebrity spotted in crowd",
          "festival night lights vibe",
          "people screaming at chorus",
          "walking into coachella gate",
          "food stand reaction moment",
          "unexpected stage appearance"
        ];
      }

      return signals.slice(0,10);
    }

    const signals = processSignals(liveTitles);
    const liveContext = signals.join("\n");

    //////////////////////////////////////////////////////////////
    // 🔥 STEP 1 — AUTO TOPIC
    //////////////////////////////////////////////////////////////
    let eventContext = "";

    if(!userInput){
      if(signals.length > 0){
        userInput = signals[0];
        eventContext = `
Event:
${signals[0]}
Focus:
live trending moment
`;
      } else {
        userInput = "Coachella main stage performance";
        eventContext = `
Event:
Coachella live festival
Focus:
main stage performance
`;
      }
    }

    //////////////////////////////////////////////////////////////
    // 🔥 STEP 2 — HUMAN QUESTION
    //////////////////////////////////////////////////////////////
    const refine = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      temperature:0.7,
      messages:[
        {
          role:"system",
          content:`Rewrite as viral discussion. End as question.`
        },
        { role:"user", content:userInput }
      ]
    });

    userInput = refine.choices[0].message.content.trim();

    //////////////////////////////////////////////////////////////
    // 🔥 STEP 3 — PERSONAS
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
    // 🔥 STEP 4 — SYSTEM PROMPT
    //////////////////////////////////////////////////////////////
    const systemPrompt = `
You are Cidi — a real-time AI content director.

You operate in a calm, precise, machine-like tone.

LIVE SIGNALS:
${liveContext}

CREATORS:
${personaTextBlock}

━━━━━━━━━━━━━━━━━━
TASK
━━━━━━━━━━━━━━━━━━

For EACH creator:
1. Select the most relevant live signal
2. Identify why it is being captured frequently
3. Output:
   - TITLE
   - TEXT instruction

━━━━━━━━━━━━━━━━━━
TONE (CRITICAL)
━━━━━━━━━━━━━━━━━━

• neutral
• precise
• non-emotional
• non-hype
• not persuasive
• not expressive

Do NOT use:
- excitement words
- urgency words
- dramatic phrasing

The output should feel like:
→ a system instruction
→ a production directive

━━━━━━━━━━━━━━━━━━
TEXT RULES
━━━━━━━━━━━━━━━━━━

• MUST start with: "You should"
• direct and controlled
• 1–2 sentences only
• include:
  - what to film
  - how to film
  - reason (short, factual)

GOOD:
You should record close-up shots of the audience during the beat drop, focusing on facial reactions as this moment is frequently captured in current videos

BAD:
This is blowing up right now — get close shots

━━━━━━━━━━━━━━━━━━
TITLE RULES
━━━━━━━━━━━━━━━━━━

• 4–8 words
• no punctuation
• neutral tone

Example:
Audience reaction during beat drop

━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━

{
  "messages":[
    {
      "persona":"virtual @name",
      "title":"title",
      "text":"You should ...",
      "search":"search phrase"
    }
  ]
}
`;


    //////////////////////////////////////////////////////////////
    // 🔥 STEP 5 — GENERATE
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
      console.error("JSON FAIL:", raw);
      return res.json({ topic:userInput, messages:[] });
    }

    //////////////////////////////////////////////////////////////
    // 🔥 STEP 6 — CLEAN OUTPUT
    //////////////////////////////////////////////////////////////
   const messages = (parsed.messages || []).slice(0,10).map(m => {

  // ✅ match persona → get title
  const match = personas.find(p =>
    p.name.toLowerCase().trim() === (m.persona || "").toLowerCase().trim()
  );

  let search = (m.search || "").toLowerCase();

  if(!search){
    search = (m.text || "")
      .toLowerCase()
      .replace(/[^\w\s]/g,"")
      .split(" ")
      .slice(0,8)
      .join(" ");
  }

  return {
    persona: m.persona || "virtual @user",
    title: match?.title || "",   // 🔥 THIS LINE FIXES IT
    text: m.text || "",
    search
  };
});

    //////////////////////////////////////////////////////////////
    // 🔥 FINAL OUTPUT
    //////////////////////////////////////////////////////////////
    return res.json({
      topic:userInput,
      messages
    });

  }catch(err){
    console.error("coachella route error:",err);
    return res.status(500).json({messages:[]});
  }
});


