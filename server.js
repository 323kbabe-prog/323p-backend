//////////////////////////////////////////////////////////////
// Rain Man Business Engine — BLOCK 1
// Imports, Setup, Helpers, Majors, Share System
//////////////////////////////////////////////////////////////

const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const OpenAI = require("openai");
const cors = require("cors");
const fs = require("fs");
const fetch = require("node-fetch");

const app = express();
app.use(cors({ origin:"*" }));
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const SERP_KEY = process.env.SERPAPI_KEY || null;

console.log("🚀 Rain Man Business Engine Started");
console.log("SERP Active:", !!SERP_KEY);

// --------------------------------------------
// AI LOCATION EXTRACTOR — NO FIXED LIST
// --------------------------------------------
async function extractLocationAI(text, openai) {
  if (!text || text.trim().length < 2) return null;

  const prompt = `
Extract the most likely geographic location mentioned in this sentence.
Rules:
- Return ONLY the location name.
- It must be a real city, state, region, or country.
- If multiple appear, pick the most specific one (city > region > country).
- If no valid location is found, return: NONE

Input: ${text}
Output:
  `;

  try {
    const out = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.0
    });

    let loc = out.choices[0].message.content.trim();

    if (!loc || loc.toUpperCase() === "NONE") return null;

    // return clean hashtag-friendly label (New York → NewYork)
    return loc.replace(/\s+/g, "");
  } catch (err) {
    console.log("AI-Location Error:", err);
    return null;
  }
}

// ---------- Identity Pools ----------
const genders=["Female","Male","Nonbinary"];
const races=["Asian","Black","White","Latino","Middle Eastern","Mixed"];
const ages=[...Array.from({length:32},(_,i)=>i+18)];

const PROF={
  A:["Human Biology","Psychology","Sociology","Public Health","Bioengineering"],
  B:["Political Science","Public Policy","International Relations","Ethics in Society","Science, Technology & Society"],
  C:["Computer Science","Mechanical Engineering","Electrical Engineering","Symbolic Systems","Aeronautics & Astronautics"],
  D:["Economics","Management Science & Engineering","Data Science","Mathematical & Computational Science","Statistics"],
  E:["Art Practice","Communication","Film & Media Studies","Linguistics","Music"]
};

// ---------- Share System ----------
const ORIGIN_MAP={
  blue:"https://blueoceanbrowser.com",
  npc:"https://npcbrowser.com",
  persona:"https://personabrowser.com",
  billy:"https://24billybrowser.com"
};

const SHARES_FILE="/data/shares.json";
if(!fs.existsSync("/data")) fs.mkdirSync("/data");

function readShares(){
  try{ return JSON.parse(fs.readFileSync(SHARES_FILE,"utf8")); }
  catch{ return {}; }
}

function writeShares(v){
  fs.writeFileSync(SHARES_FILE, JSON.stringify(v,null,2));
}

// POST /share
app.post("/api/share",(req,res)=>{
  const all = readShares();
  const id = Math.random().toString(36).substring(2,8);

  all[id] = {
    personas:req.body.personas || [],
    query:req.body.query || "",
    origin:req.body.origin || "blue"
  };

  writeShares(all);
  res.json({ shortId:id });
});

// GET /share/:id
app.get("/api/share/:id",(req,res)=>{
  const all = readShares();
  const s = all[req.params.id];
  if(!s) return res.status(404).json([]);
  res.json(s.personas || []);
});

// /s/:id → redirect with auto-load
app.get("/s/:id",(req,res)=>{
  const all = readShares();
  const s = all[req.params.id];

  if(!s) return res.redirect("https://blueoceanbrowser.com");

  const redirectURL = ORIGIN_MAP[s.origin] || ORIGIN_MAP.blue;

  res.send(`
    <!doctype html><html><head><meta charset='utf-8'/>
    <script>
      sessionStorage.setItem("sharedId","${req.params.id}");
      setTimeout(()=>{
        window.location.href="${redirectURL}?query="+encodeURIComponent("${s.query||""}");
      },400);
    </script>
    </head><body></body></html>
  `);
});

//////////////////////////////////////////////////////////////
// BLOCK 2 — Executive Rewrite Engine
//////////////////////////////////////////////////////////////

app.post("/api/rewrite", async(req,res)=>{
  let { query } = req.body;
  query = (query||"").trim();
  if(!query) return res.json({ rewritten:"" });

  const prompt = `
Rewrite the user's text into a single sharp business strategy directive.
Rules:
- EXACTLY 1 sentence.
- No quoting.
- No emotion.
- No metaphors.
- No filler.
- Must sound like senior executive instruction.
- Strengthen direction and clarity.
- Make it business-executable.
Input: ${query}
Rewritten:
  `;

  try{
    const out = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      messages:[{role:"user",content:prompt}],
      temperature:0.2
    });

    let rewritten = out.choices[0].message.content
      .replace(/["“”‘’]/g,"")
      .trim();

    rewritten = rewritten.split(".")[0] + "."; // force single sentence

    res.json({ rewritten });

  }catch(err){
    console.log("Rewrite Error:",err);
    res.json({ rewritten:query });
  }
});

//////////////////////////////////////////////////////////////
// BLOCK 3 — Rain Man Business Thought Engine (News-Only SERP)
//////////////////////////////////////////////////////////////

const httpServer = createServer(app);
const io = new Server(httpServer,{ cors:{origin:"*"} });

io.on("connection", socket => {

socket.on("personaSearch", async rewrittenQuery => {
try{

  const location = extractLocation(rewrittenQuery);
  const CAT_ORDER = ["A","B","C","D","E","A","B","C","D","E"];

  for(let i=0;i<10;i++){

    const cat   = CAT_ORDER[i];
    const major = pick(PROF[cat]);
    const demo  = {
      gender:pick(genders),
      race:pick(races),
      age:pick(ages)
    };

    // --------------------------------------------
    // SERP NEWS SEARCH — identity-specific
    // --------------------------------------------
    const serpQuery = `${major} business news ${new Date().getFullYear()}`;

    let serpContext = "No verified data.";

    if(SERP_KEY){
      try{
        const url = `https://serpapi.com/search.json?q=${
          encodeURIComponent(serpQuery)
        }&tbm=nws&num=5&api_key=${SERP_KEY}`;

        const r = await fetch(url);
        const j = await r.json();

        const titles = (j.news_results || [])
          .map(x => x.title)
          .filter(Boolean)
          .slice(0,5)
          .join(" | ");

        if(titles) serpContext = titles;

      }catch(e){
        console.log("SERP NEWS FAIL:", e.message);
      }
    }

    // Extract ALL number forms
    const serpNumbers = [
      ...(serpContext.match(/[0-9]+(\.[0-9]+)?%/g) || []),
      ...(serpContext.match(/[0-9]+(\.[0-9]+)?/g) || []),
      ...(serpContext.match(/\b[0-9]+(\.[0-9]+)?\s*million\b/gi) || []),
      ...(serpContext.match(/\b[0-9]+(\.[0-9]+)?\s*billion\b/gi) || [])
    ];

    const numList = serpNumbers.join(", ") || "none";

// Build SERP bullet entries
let serpBulletItems = [];

if (serpContext && serpContext !== "No verified data.") {
  // Split each news headline into its own bullet
  serpBulletItems = serpContext
    .split(" | ")
    .map(line => line.trim())
    .filter(Boolean);
}

    // --------------------------------------------
    // FULL RAIN MAN BUSINESS PROMPT
    // --------------------------------------------

    const fullPrompt = `
You are a ${demo.gender}, ${demo.race}, age ${demo.age}, trained in ${major}.
Your communication mode is ultra-clipped Rain Man business logic.
No metaphors. No emotion. No abstraction. No figurative language.
Use only ${major} vocabulary.

Forbidden:
- No vocabulary from rewritten direction.
- No vocabulary from this external text: "${serpContext}"
- No references to “query”, “user”, “search”, “trend”, “online”, “data”, “metric”, “result”.

Allowed:
Numbers extracted from external context: ${numList}.

ONE PARAGRAPH ONLY.

FORMAT:
Sentence 1 — MUST begin with “I will”, MUST describe a ${major}-logic business action, MUST loosely reflect the category of "${rewrittenQuery}" but without using its words, MUST include at least one number from: ${numList}.
Sentence 2 — short factual sentence (no “I will”).
Sentence 3 — short factual sentence (no “I will”).

Then:
A continuous sequence of “I will” statements, all in ${major} logic.
Must include steps, routines, evaluations.
Must incorporate numbers (e.g., 1.2 million, 48%, 2025) without explanation.
Must include one tiny anecdote: “I noted one instance once.”

After the paragraph, output the following bullets:

Key directions to consider:
- direction 1
- direction 2
- direction 3
- direction 4
${serpBulletItems.map(x => `- ${x}`).join("\n")}

All bullets must be procedural, ${major}-specific, clipped, and may use numbers.

Return plain text only.
    `;

    // --------------------------------------------
    // CALL OPENAI
    // --------------------------------------------
    const ai = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      messages:[{role:"user",content:fullPrompt}],
      temperature:0.55
    });

    const fullThought = ai.choices[0].message.content.trim();

    // --------------------------------------------
// AI-GENERATED HASHTAGS (Final Version)
// --------------------------------------------

// 1. Base tag for the major
const majorKeyword = major.split(" ")[0];
let hashtags = [`#${majorKeyword}`];

// 2. Ask AI to create 3 business-relevant hashtags
const hashPrompt = `
Generate exactly 3 business-style hashtags based on this rewritten strategic direction:

"${rewrittenQuery}"

Rules:
- Output ONLY hashtags.
- No explanation.
- No numbering.
- Use real business language.
- Do NOT invent weird words.
- Use 1–2 word hashtags only.
- No metaphors.
- No locations.
- No emojis.
- No more than 18 characters per hashtag.
Output:
`;

try {
  const aiHash = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: hashPrompt }],
    temperature: 0.3
  });

  const raw = aiHash.choices[0].message.content.trim();

  // Clean + extract hashtags
  const aiTags = raw
    .split(/\s+/)
    .filter(t => t.startsWith("#"))
    .map(t => t.replace(/[^#A-Za-z0-9]/g, "")) // remove strange chars
    .filter(Boolean);

  hashtags.push(...aiTags);

} catch (err) {
  console.log("AI hashtag error:", err);
}

// 3. AI location tag (if exists)
if (location) {
  hashtags.push(`#${location}`);
}

// Clean duplicates + blanks
hashtags = [...new Set(hashtags)].filter(Boolean);

// 4. FORCE EXACTLY 4 HASHTAGS
hashtags = hashtags.slice(0, 4);

// --------------------------------------------
// Emit final persona card
// --------------------------------------------
socket.emit("personaChunk", {
  major,
  gender: demo.gender,
  race: demo.race,
  age: demo.age,
  thought: fullThought,
  serpContext,
  hashtags,
  category: cat
});

//////////////////////////////////////////////////////////////
// BLOCK 4 — Views, Static Serve, Server Start
//////////////////////////////////////////////////////////////

const VIEW_FILE="/data/views.json";

function readViews(){
  try{ return JSON.parse(fs.readFileSync(VIEW_FILE,"utf8")); }
  catch{ return {total:0}; }
}

function writeViews(v){
  fs.writeFileSync(VIEW_FILE, JSON.stringify(v,null,2));
}

app.get("/api/views",(req,res)=>{
  const v = readViews();
  v.total++;
  writeViews(v);
  res.json({ total:v.total });
});

// Serve static frontend (HTML, JS, CSS)
app.use(express.static(path.join(__dirname,"public")));

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT,()=>{
  console.log("🔥 Final Rain Man Business Engine running on", PORT);
});
