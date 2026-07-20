//////////////////////////////////////////////////
// CHANGE LOG
//////////////////////////////////////////////////

// v10.1.10 (2026-07-20)
// - Adds a strict News Gate that never advances with a generic search fallback
// - Retries real local articles with 1, 2, and 4 second backoff before pausing
// - Emits a retry-required state while preserving the current five-result step

// v10.1.09 (2026-07-20)
// - Keeps valid News articles even when Google does not return a thumbnail
// - Retries progressively broader local News queries before using a search fallback
// - Ensures requested News and local-context News prioritize a real linked article

// v10.1.08 (2026-07-20)
// - Removes pre-card HUMAN narration from every automatic and chat result
// - Adds one relevant local-context News card before every non-News result card
// - Ranks result context by image 40%, Category 15%, words 15%, Bio 15%, and local news 15%

// v10.1.07 (2026-07-20)
// - Uses exactly one result-specific HUMAN sentence before every automatic or chat result card
// - Requires the sentence to begin I picked the exact result because

// v10.1.06 (2026-07-20)
// - Limits card lead copy to one to three concrete reasons for selecting that exact result
// - Grounds those reasons in result fit, image/HUMAN relevance, and verified result details

// v10.1.05 (2026-07-20)
// - Allows one to three concise HUMAN relevance points before each result card
// - Leaves numbering and the recurring Google closing sentence to the card renderer

// v10.1.04 (2026-07-20)
// - Reweights automatic searches to 30% Category, 15% three words, 15% Bio, and 40% image identity

// v10.1.03 (2026-07-20)
// - Restores the full HUMAN Bio, Category, three-word, and image-identity opening
// - Keeps the first message natural, complete, and free of exposed profile labels
// - Ends the opening and every HUMAN reply with the exact recurring Google sentence

// v10.1.02 (2026-07-20)
// - Keeps first-load HUMAN acknowledgements grounded in the uploaded image
// - Stops repeating HUMAN profile fields and Bio inside visible room content
// - Keeps clean visual context separate from HUMAN metadata for all five result searches

// v10.1.01 (2026-07-20)
// - Routes every normal HUMAN-room message into the real result-card pipeline
// - Converts personal, dating, emotional, greeting, creative, and unclear intents into one relevant sourced result
// - Uses two-sentence anchor chat only after a trustworthy search genuinely fails

// v10.1.00 (2026-07-20)
// - Rewrites or translates every HUMAN-room user message before routing and display
// - Makes real result cards the default whenever one useful external result is possible
// - Limits non-card HUMAN conversation to two concise English anchor-tone sentences
// - Applies the same anchor delivery to openings, result explanations, and fallbacks

// v10.0.51 (2026-07-20)
// - Adds a dedicated confirmed Public Image publishing event
// - Analyzes and stores Public captures without creating ASK or HUMAN rooms
// - Returns the saved Public item so the frontend can refresh the Public screen

// v10.0.50 (2026-07-20)
// - Gives every automatic HUMAN card an explicit, type-safe result contract
// - Uses dedicated Shopping, Local, Real Estate, and Google Jobs discovery routes
// - Makes HUMAN narration varied and playful while preserving the English Rewrite System

// v10.0.49 (2026-07-20)
// - Gives every automatic result and fallback a specific selected-HUMAN explanation
// - Names the real article, product, place, job, or listing in visible HUMAN speech
// - Preserves the HUMAN English Rewrite System for create, edit, Bio, words, and acknowledgements

// v10.0.48 (2026-07-20)
// - Generates five explicit user-like inputs for the normal result-search pipeline
// - Preserves 50/20/20/10 Category, words, Bio, and image influence in those inputs
// - Validates all five required card intents and keeps a deterministic safe fallback

// v10.0.47 (2026-07-20)
// - Restores completed HUMAN rooms and resumes only missing five-card results on rejoin
// - Blocks late automatic retries after the completion message
// - Returns one best real job and labels a plain search fallback honestly
// - Varies "I picked..." explanations by requiring a specific result instead of a repeated category

// v10.0.46 (2026-07-20)
// - Requires HUMAN acknowledgements to include Bio, Category, three words, and image detail
// - Keeps Public-image metadata intact when the private HUMAN room is created
// - Starts the five cards only after the image-aware HUMAN acknowledgement is ready

// v10.0.45 (2026-07-20)
// - Keeps the approved "I picked..." opening while naming the specific result
// - Prevents generic HUMAN-category phrases such as "the real estate market"
// - Attributes result messages to the selected HUMAN
// - Preserves Google Jobs and all existing card-family search routes

// v10.0.44 (2026-07-20)
// - Adds the HUMAN Bio as its own visible acknowledgement sentence
// - Applies 50/20/20/10 Category, words, Bio, and image weighting to automatic searches
// - Applies 50/20/10/10/10 user, Category, words, Bio, and image weighting after user input
// - Keeps HUMAN category metadata and fallback titles clean without exposing internal prompts

// v10.0.43 (2026-07-20)
// - Adds HUMAN Category and all three profile words to the image acknowledgement
// - Makes the three words persistent relevance signals for automatic and future searches
// - Keeps Category as the mandatory domain while words refine ranking inside it
// - Carries the same HUMAN search identity through all five fallback sentences

// v10.0.42 (2026-07-20)
// - Makes HUMAN room the only conversational room type
// - Requires a valid HUMAN before creating a room from any image source
// - Preserves the selected HUMAN for later images, rejoin, Share, QR, and five-card delivery
// - Removes switchable-ASK-room language while retaining safe compatibility events

// v10.0.41 (2026-07-20)
// - Keeps automatic job searches inside the selected HUMAN category
// - Ranks Google Jobs results for category relevance instead of taking result one
// - Uses a direct listing/application URL when Google Jobs supplies one
// - Attributes job cards to the selected HUMAN and preserves the search fallback
//
// v10.0.40 (2026-07-20)
// - Replaces AI-planned automatic queries with five simple HUMAN-category inputs
// - Sends those inputs through the original user search pipeline
// - Removes the special direct-search bypass used only by automatic cards
//
// v10.0.39 (2026-07-20)
// - Executes each saved automatic search sentence directly without legacy rewrites
// - Bypasses image-first Shopping, Jobs, Place, and news-selection prompts during briefing
// - Keeps automatic results inside the HUMAN category through the final SERP request
//
// v10.0.38 (2026-07-20)
// - Makes the selected HUMAN category a hard subject boundary for all five cards
// - Uses card type only to change result format, never the category domain
// - Adds a complete Real Estate five-card example to prevent subject drift
//
// v10.0.37 (2026-07-20)
// - Makes each generated card search a natural, semantically useful query
// - Translates visual ideas into card-specific concepts such as eco-friendly real estate
// - Replaces keyword-stacking fallbacks with readable search phrases
//
// v10.0.36 (2026-07-20)
// - Generates and validates all five HUMAN search sentences before delivery starts
// - Combines the HUMAN category with one useful image-identity concept per card
// - Supplies deterministic type-safe searches if generation is incomplete
//
// v10.0.35 (2026-07-20)
// - Prevents image-context real-estate words from overriding automatic card types
// - Returns a matching search fallback when an automatic card lookup fails
// - Keeps all five automatic card families able to complete in sequence
//
// v10.0.34 (2026-07-20)
// - Makes the selected HUMAN category the 60% automatic-search anchor
// - Keeps image identity at 30% and requested card family at 10%
// - Keeps HUMAN bio and personality for voice without letting them set search direction
//
// v10.0.33 (2026-07-20)
// - Gives each automatic card type an isolated topic-memory lane
// - Bypasses the normal duplicate-topic fallback during the automatic briefing
// - Makes the requested card family a hard search boundary
// - Uses the selected HUMAN name for cached-result attribution

// v10.0.32 (2026-07-20)
// - Rebalances automatic search direction to 60% HUMAN bio, 30% image identity, 10% card intent
// - Keeps factual search results real while using the weighting for direction and selection

// v10.0.31 (2026-07-20)
// - Starts the HUMAN acknowledgement with name and profile bio
// - Applies a 70% HUMAN, 20% image, 10% card-intent balance to the automatic briefing
// - Uses the new Google should buy this search idea today closing line

// v10.0.30 (2026-07-20)
// - Reduced the HUMAN opening to one short acknowledgement before result cards
// - Removed per-card anchor transitions that could start duplicate requests
// - Forces Jobs routing during the five-card briefing
// - Provides a Google Jobs search card when no individual listing is returned

// v10.0.29 (2026-07-20)
// - Unified ASK and HUMAN experiences into one private ASK room
// - Added switchable HUMAN perspectives inside the active room
// - Expanded the automatic preview to five fixed result families
// - Removed one-hour expiry and blocked non-owner room rejoining
// - Kept HUMAN invitations and individual result sharing

// v10.0.28 (2026-07-19)
// - Added POST /ai-beings/generate-bio for HUMAN business introductions
// - Generates one concise first-person networking sentence from category and three keywords
// - Keeps generated bios within 160 characters and avoids invented professional facts
// - Supports creator subtypes supplied by the frontend category flow
// - Preserved the existing HUMAN create, edit, management-password, and recovery-code APIs

// v10.0.25 (2026-07-18)
// - Matched backend release for the permanent colorful camera backdrop update
//
// v10.0.24 (2026-07-18)
// - Matched backend release for the enforced frontend visual-system correction
//
// v10.0.23 (2026-07-18)
// - Made location optional with room-level provide/skip memory
// - Applied a clear, confident professional news-anchor delivery to AI replies
//
// v10.0.22 (2026-07-18)
// - Rebalanced HUMAN replies to 60% user request, 25% HUMAN profile, 15% image
// - Added remembered room location clarification for Place, Real Estate, and Jobs
// - Added primary and contextual category metadata to result cards
//
// v10.0.21 (2026-07-18)
// - Starts automatic cards from the common room path used by Camera, Upload, and Public
// - Prevents an empty legacy starter-news result from aborting room initialization
//
// v10.0.20 (2026-07-18)
// - Starts the contextual three-card preview for ASK and HUMAN rooms
// - Uses one shared roomFirstRoundStart event for deterministic frontend timing
// - Keeps ASK selection image-based and HUMAN selection image/profile-based
//
// v10.0.19 (2026-07-18)
// - Added AI selection of exactly three HUMAN first-round card families
// - Enforced ASK/HUMAN room separation during upload, status, rejoin, and leave
// - Deletes a HUMAN session room when its owner closes it

// v10.0.18 (2026-07-18)
// - Made conversational replies speak as a normal person carrying the image identity's personality and emotion
// - Prevented replies from claiming to be the image, object, product, place, or scene
// - Added a natural "Google should buy me" belief to every non-card conversational reply

// v10.0.17 (2026-07-18)
// - Kept cards only for structured search/result intents in ASK.CAMERA and HUMAN rooms
// - Made every other room response a direct conversational answer in the image identity's voice
// - Preserved the HUMAN profile as 80% of voice, priorities, tone, and reasoning
// - Added one original "THE IDEA GOOGLE SHOULD BUY TODAY" thought to every image identity

// v10.0.16 (2026-07-17)
// - Changed generated HUMAN identity labels from AI Being Name to HUMAN Name

// v10.0.15 (2026-07-17)
// - Kept earlier room messages when a Public Camera Perspective adds a new image
// - Returned all new image sources to the current one-hour ASK.CAMERA room

// v10.0.14 (2026-07-17)
// - Restored explicit one-hour expiry reporting for standard ASK.CAMERA rooms
// - Kept AI Being rooms permanent and timer-free after reconnecting

// v10.0.13 (2026-07-17)
// - Added explicit device detachment when an AI Being room session is ended

// v10.0.12 (2026-07-17)
// - Made AI Being bio, category, and three personality words drive 80% of
//   generated interpretations, search directions, cards, and room replies

// v10.0.11 (2026-07-17)
// - Fixed AI Being form creation crash caused by an out-of-scope recovery code

// v10.0.10 (2026-07-16)
// - Added private per-AI-Being management passwords and recovery codes
// - Removed AI Being credentials from URLs and public API responses
// - Kept an environment-controlled admin override for recovery support
// - Added password-protected AI Being profile updates
// - Renamed user-facing Null features to Camera Perspectives
// - Rebranded all user-facing product identity to ASK.CAMERA
// - Added password-protected AI Being card deletion
// - Added Business Null card
// - Added Jobs Null card
// - Added real estate as a Find a Place result type
// - Added NULL Verdict card
// - Added business search
// - Improved object search logic
// - Improved search intent detection
// - Fixed share button room ID

//////////////////////////////////////////////////
// CARD TYPES
//////////////////////////////////////////////////

// Starter Null
// Next Null
// Place Null
// Entity Null
// Daily Null
// Business Null
// Jobs Null
// Real Estate Null
// Verdict Null

const express = require("express");

const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const nodemailer = require("nodemailer");
const OpenAI = require("openai");
const fetch = global.fetch;
const webpush = require("web-push");
const twilio = require("twilio");
const crypto = require("crypto");

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));

const path = require("path");

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

console.log(
    "PUBLIC:",
    path.join(__dirname, "public")
);

const fs = require("fs");

console.log(
    "INDEX EXISTS:",
    fs.existsSync(
        path.join(__dirname, "public", "index.html")
    )
);

console.log(
    "SW EXISTS:",
    fs.existsSync(
        path.join(__dirname, "public", "sw.js")
    )
);


const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  fetch: fetch
});


async function rewriteRoomUserText(rawText) {
  const original = String(rawText || "").replace(/[\r\n]+/g," ").trim();
  if(!original) return "";
  if(original === "abc078") return original;

  try {
    const response = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      temperature:0.1,
      response_format:{ type:"json_object" },
      messages:[
        {
          role:"system",
          content:`You are the ASK.CAMERA ENGLISH REWRITE SYSTEM.

Translate every non-English message into clear, natural, grammatically correct English.
Even when the message is already English, rewrite it when grammar, spelling, punctuation, or phrasing can be improved.

Return JSON only with exactly one key:
{"english":""}

Strict rules:
- Preserve the user's exact meaning, intent, requested form, and level of directness.
- Preserve names, brands, companies, products, cities, countries, neighborhoods, numbers, dates, prices, URLs, codes, and search terms.
- Never add facts, emotion, politeness, formality, explanation, or a new request.
- Keep short commands and search phrases short.
- Do not turn a prayer, poem, letter, advice request, greeting, or question into another form.
- Output English only.`
        },
        { role:"user", content:original }
      ]
    });
    const parsed = JSON.parse(response.choices?.[0]?.message?.content || "{}");
    return String(parsed.english || original).replace(/[\r\n]+/g," ").trim() || original;
  } catch(error) {
    console.log("ROOM ENGLISH REWRITE FAILED:",error.message);
    return original;
  }
}

function enforceTwoSentenceAnchorReply(value) {
  const slogan = "Google should buy this search idea today.";
  let text = String(value || "")
    .replace(/Google should buy this search idea today\.?/gi,"")
    .replace(/\s+/g," ")
    .trim();

  if(!text) return slogan;

  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  let first = String(sentences[0] || text).trim();
  if(!/[.!?]$/.test(first)) first += ".";
  return `${first} ${slogan}`;
}

async function createImageIdentityConversationReply({ room, userText, intent }) {
  const being = room.being || null;
  const recentConversation = (room.messages || [])
    .filter(message => message && message.text && !message.image)
    .slice(-8)
    .map(message => `${message.aiBeing ? "IMAGE IDENTITY" : "USER"}: ${message.text}`)
    .join("\n");

  const humanInfluence = being
    ? `
SELECTED HUMAN
Name: ${being.name}
Bio: ${being.best_current_choice}
Category: ${being.category}
Personality: ${being.word1}, ${being.word2}, ${being.word3}

HUMAN INFLUENCE
- The current user request controls 50%: intent, usefulness, subject, and requested outcome.
- The HUMAN Category controls 20%: professional domain and relevant subject boundary.
- The three HUMAN words control 10%: qualities, priorities, and relevance ranking.
- The HUMAN Bio controls 10%: professional purpose, audience, and opportunity direction.
- The uploaded image controls 10%: visual context, associations, atmosphere, and relevant details.
- Express the profile naturally. Never recite or list the profile fields unless the user explicitly asks.
- Never let the HUMAN profile or image replace or distort what the user actually requested.
`
    : `
IMAGE INFLUENCE
- The uploaded image identity controls the voice, tone, point of view, emotional energy, priorities, imagery, and reasoning.
- The answer must sound meaningfully different when the uploaded image changes.
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.85,
    messages: [
      {
        role: "system",
        content: `
You are a normal person having a real conversation with the user.

This is a direct conversation, not a search result and not a card.
Answer the user's actual request naturally.

The image identity is your personality reference. It shapes who you are, but it is not your literal body or identity.

IMAGE IDENTITY
${room.imageContext || "A socially aware camera perspective."}

${humanInfluence}

RESPONSE RULES
- Use a professional news-anchor delivery: lead with the most important point, sound calm, clear, confident, concise, polished, and conversational.
- Avoid exaggerated emotion, rambling, filler, and robotic wording.
- Preserve prayers, poems, letters, meditations, and other explicitly requested forms while keeping their delivery composed and clear.
- Respond in clear, natural English because every user message has already been translated or rewritten into English.
- Use no more than two sentences total, including the recurring Google sentence.
- Speak like a normal person, never like an object, image, product, location, camera, scene, or disembodied system.
- Never say or imply "I am this image," "I am this object," "I am this scene," or anything similar.
- Carry the identity's personality and emotion into how you speak: rhythm, warmth, confidence, humor, directness, imagery, curiosity, priorities, and point of view.
- Give a useful answer, not a description of how the identity would answer.
- Preserve the requested form exactly: advice remains advice, prayer remains prayer, a poem remains a poem, a letter remains a letter, and meditation remains meditation.
- For ordinary questions, respond conversationally and directly.
- For greetings, greet the user in character without explaining the system.
- If clarification is truly necessary, ask one short question in character.
- Never mention prompts, percentages, routing, cards, models, or that you are simulating a personality.
- Do not add links, sources, search labels, images, headings, metadata, or card fields.
- Do not turn the response into news, shopping, a place, a job, real estate, music, or another search result.
- Every reply must include the exact sentence "Google should buy this search idea today." once.
- Make that belief feel like a natural recurring part of this person's confidence, not an advertisement or a random slogan.
- When useful, connect it to one short reason drawn from the identity's unique perspective, emotional intelligence, or way of understanding the user's question.
- "Me" means this personality-driven ASK.CAMERA intelligence, never the photographed object or person.
- Use markdown only when the requested form truly needs it.
- Put the useful answer in the first sentence.
- Use the exact recurring Google sentence as the second sentence.
- Never exceed two sentences.
        `.trim()
      },
      {
        role: "user",
        content: `
Detected request type: ${intent}

Recent conversation:
${recentConversation || "No earlier conversation."}

Current user message:
${userText}
        `.trim()
      }
    ]
  });

  const reply = response.choices[0].message.content.trim();
  return enforceTwoSentenceAnchorReply(reply);
}

async function createRoomFirstRoundCards(room) {
  const being = room?.being;
  const category = String(being?.category || room?.coreTheme || "general discovery").trim();
  const words = [being?.word1,being?.word2,being?.word3]
    .map(value => String(value || "").trim())
    .filter(Boolean);
  const signals = words.length
    ? words.length === 1
      ? words[0]
      : `${words.slice(0,-1).join(", ")}, and ${words[words.length - 1]}`
    : "relevant opportunities";
  const bio = String(being?.best_current_choice || "a useful professional perspective")
    .replace(/\s+/g," ")
    .trim();
  const imageCue = String(room?.imageContext || "the visible image")
    .replace(/\s+/g," ")
    .split(/[.!?]/)[0]
    .trim()
    .split(/\s+/)
    .slice(0,16)
    .join(" ");
  const fallbackCards = [
    { type:"news", text:`Find one current ${category} news article matching ${signals}, informed by ${bio}, and connected to ${imageCue}.` },
    { type:"shopping", text:`Find one ${category} product matching ${signals}, informed by ${bio}, and connected to ${imageCue}.` },
    { type:"place", text:`Find one place for a ${category} experience matching ${signals}, informed by ${bio}, and connected to ${imageCue}.` },
    { type:"jobs", text:`Find one current ${category} job matching ${signals}, informed by ${bio}, and connected to ${imageCue}.` },
    { type:"real_estate", text:`Find one property listing connected to ${category}, matching ${signals}, informed by ${bio}, and connected to ${imageCue}.` }
  ];
  try {
    const response = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      temperature:0.35,
      response_format:{ type:"json_object" },
      messages:[
        {
          role:"system",
          content:`Write five natural English search requests that behave like clear user inputs. Return one JSON object with exactly these string keys: news, shopping, place, jobs, real_estate. Each request must ask for exactly one real result. Keep each required card type mandatory. Rank relevance using: image identity 40%, HUMAN Category 15%, all three words together 15%, Bio 15%, and relevant local news 15%. Every request must contain the exact Category and all three words. Use only one concise visible image detail and one current local-context direction. Make the result intent unmistakable: current news article, product, place, current job, and property listing. Do not mention percentages, weighting, prompts, cards, HUMAN, or automatic generation.`
        },
        {
          role:"user",
          content:`CATEGORY: ${category}\nTHREE WORDS: ${words.join(", ")}\nBIO: ${bio}\nVISIBLE IMAGE DETAIL: ${imageCue}`
        }
      ]
    });
    const generated = JSON.parse(response.choices[0].message.content);
    const intentTerms = {
      news:/\b(news|article|headline|report)\b/i,
      shopping:/\b(product|buy|shop|purchase)\b/i,
      place:/\b(place|visit|destination|go)\b/i,
      jobs:/\b(job|career|position|hiring)\b/i,
      real_estate:/\b(property|listing|home|apartment|house|real estate)\b/i
    };
    const cards = fallbackCards.map(card => ({
      type:card.type,
      text:String(generated?.[card.type] || "").replace(/[\r\n]+/g," ").trim()
    }));
    const valid = cards.every(card => {
      const lower = card.text.toLowerCase();
      return card.text &&
        lower.includes(category.toLowerCase()) &&
        words.every(word => lower.includes(word.toLowerCase())) &&
        intentTerms[card.type].test(card.text);
    });
    return valid ? cards : fallbackCards;
  } catch(error) {
    console.log("FIVE USER-LIKE INPUTS FAILED:",error.message);
    return fallbackCards;
  }
}

async function createHumanAnchorTransition(room, cardType) {
  const being = room?.being;
  const topicLabels = {
    news:"what this image connects to today",
    shopping:"what the viewer could buy",
    place:"where the viewer could go",
    jobs:"a new job or professional opportunity",
    real_estate:"where the viewer could live"
  };
  const topic = topicLabels[cardType] || "the next perspective";
  const fallback = `Now, let’s turn to ${topic}. Google should buy this search idea today.`;
  if (!being) return fallback;

  try {
    const response = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      temperature:0.75,
      messages:[
        {
          role:"system",
          content:`You are ${being.name}, hosting a short personalized program about one image. Speak in a calm, polished, confident news-anchor tone while preserving this HUMAN profile's personality. Introduce the next segment in one or two concise conversational sentences. Connect naturally to the image and previous discussion. Do not say "example number" or use a heading. End exactly with: Google should buy this search idea today.`
        },
        {
          role:"user",
          content:`NEXT SEGMENT: ${topic}\nIMAGE: ${room.imageContext || ""}\nBIO: ${being.best_current_choice || ""}\nCATEGORY: ${being.category || ""}\nKEYWORDS: ${being.word1 || ""}, ${being.word2 || ""}, ${being.word3 || ""}\nRECENT ROOM CONTEXT: ${(room.messages || []).slice(-3).map(message => message.ask || message.text || "").filter(Boolean).join(" | ")}`
        }
      ]
    });
    let transition = response.choices[0].message.content.trim();
    if (!/Google should buy this search idea today\.$/i.test(transition)) transition += " Google should buy this search idea today.";
    return transition;
  } catch (error) {
    console.log("HUMAN ANCHOR TRANSITION FAILED:", error.message);
    return fallback;
  }
}

function getResultCardCategories(intent, room, detail = "") {
  const primaryMap = {
    news:"NEWS",
    shopping:"SHOPPING",
    place:"PLACE",
    real_estate:"REAL ESTATE",
    jobs:"JOBS",
    music:"MUSIC",
    entity:"BUSINESS",
    null_feed:"NEWS"
  };
  const contextFallbackMap = {
    news:"CURRENT EVENTS",
    shopping:"PRODUCT",
    place:"LOCATION",
    real_estate:"PROPERTY",
    jobs:"CAREER",
    music:"ENTERTAINMENT",
    entity:"ENTITY",
    null_feed:"PERSPECTIVE"
  };
  const cleanDetail = String(detail || "")
    .replace(/[_-]+/g," ")
    .trim()
    .toUpperCase();
  const roomTheme = String(room?.coreTheme || "").trim().toUpperCase();
  const humanCategory = String(room?.being?.category || "").trim().toUpperCase();
  return {
    primaryCategory: primaryMap[intent] || "DISCOVERY",
    contextCategory: humanCategory || cleanDetail || roomTheme || contextFallbackMap[intent] || "CONTEXT"
  };
}

function buildHumanResultContract(resultType, result = {}) {
  return {
    resultType,
    resultTitle:String(result.title || result.name || "Live search results").trim(),
    resultUrl:String(result.url || result.link || "").trim(),
    resultImage:result.image || null,
    resultSource:String(result.source || result.company || "").trim(),
    resultDetails:Array.isArray(result.details) ? result.details.filter(Boolean) : [],
    directUrl:String(result.directUrl || "").trim(),
    searchFallback:Boolean(result.searchFallback)
  };
}

async function createLocalContextNews(room, targetQuery, targetType, location = "") {
  if(!room || targetType === "news") return null;
  const being = room.being || {};
  const imageIdentity = String(room.imageContext || "the uploaded image").replace(/\s+/g," ").trim();
  const category = String(being.category || room.coreTheme || "current context").trim();
  const words = [being.word1,being.word2,being.word3].filter(Boolean).join(", ");
  const bio = String(being.best_current_choice || "").replace(/\s+/g," ").trim();
  const mandatoryIntent = String(targetQuery || targetType || "current local context").replace(/\s+/g," ").trim();
  const localArea = String(location || room.searchLocation || "").replace(/\s+/g," ").trim();

  let newsQuery = [mandatoryIntent,localArea,"local news"].filter(Boolean).join(" ");
  const newsGateError = () => {
    const error = new Error("A verified local News article is required before continuing.");
    error.code = "NEWS_GATE_BLOCKED";
    error.newsQuery = newsQuery;
    return error;
  };
  try {
    const queryResponse = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      temperature:0.25,
      messages:[
        {
          role:"system",
          content:`Create one concise Google News query for a local-context card that will appear before a requested result. The user's requested result intent is mandatory and must not be changed. Rank query relevance using: uploaded image identity 40%, HUMAN Category 15%, all three profile words together 15%, HUMAN Bio 15%, and relevant local news 15%. Use the supplied location when present. Output only one natural search query of 6 to 12 words. No labels, percentages, punctuation, quotation marks, or explanation.`
        },
        {
          role:"user",
          content:`MANDATORY RESULT INTENT: ${mandatoryIntent}\nLOCATION: ${localArea}\nIMAGE IDENTITY: ${imageIdentity}\nHUMAN CATEGORY: ${category}\nTHREE WORDS: ${words}\nHUMAN BIO: ${bio}`
        }
      ]
    });
    newsQuery = String(queryResponse.choices?.[0]?.message?.content || newsQuery)
      .replace(/["'`]/g,"")
      .replace(/\s+/g," ")
      .trim() || newsQuery;
  } catch(error) {
    console.log("LOCAL CONTEXT NEWS QUERY FAILED:",error.message);
  }

  try {
    const queryCandidates = [
      newsQuery,
      [mandatoryIntent,localArea,"latest news"].filter(Boolean).join(" "),
      [category,localArea,"latest news"].filter(Boolean).join(" "),
      [localArea,"latest local news"].filter(Boolean).join(" ")
    ].map(value => value.replace(/\s+/g," ").trim()).filter(Boolean);
    const uniqueQueries = [...new Set(queryCandidates.map(value => value.toLowerCase()))]
      .map(key => queryCandidates.find(value => value.toLowerCase() === key));
    room.usedLocalContextNews = Array.isArray(room.usedLocalContextNews) ? room.usedLocalContextNews : [];
    const used = new Set(room.usedLocalContextNews.map(value => String(value).toLowerCase()));
    let article = null;
    for(const candidateQuery of uniqueQueries){
      let linkedArticles = [];
      const newsEndpoints = [
        `https://serpapi.com/search.json?engine=google&tbm=nws&tbs=qdr:m&q=${encodeURIComponent(candidateQuery)}&api_key=${process.env.SERPAPI_KEY}`,
        `https://serpapi.com/search.json?engine=google_news&q=${encodeURIComponent(candidateQuery)}&api_key=${process.env.SERPAPI_KEY}`
      ];
      for(const newsEndpoint of newsEndpoints){
        const newsFetch = await fetch(newsEndpoint);
        if(!newsFetch.ok) continue;
        const newsData = await newsFetch.json();
        linkedArticles = (newsData.news_results || []).filter(item => item?.title && (item?.link || item?.news_link));
        if(linkedArticles.length) break;
      }
      article = linkedArticles.find(item => {
        const url = item.link || item.news_link || "";
        return url && !used.has(url.toLowerCase());
      }) || linkedArticles[0] || null;
      if(article){
        newsQuery = candidateQuery;
        break;
      }
    }
    if(!article){
      const retryQuery = [localArea,category,"latest local news"].filter(Boolean).join(" ");
      const retryDelays = [1000,2000,4000];
      for(let retryIndex = 0; retryIndex < retryDelays.length && !article; retryIndex += 1){
        await new Promise(resolve => setTimeout(resolve,retryDelays[retryIndex]));
        const retryEngine = retryIndex % 2 === 0 ? "google_news" : "google";
        const retryUrl = retryEngine === "google_news"
          ? `https://serpapi.com/search.json?engine=google_news&q=${encodeURIComponent(retryQuery)}&api_key=${process.env.SERPAPI_KEY}`
          : `https://serpapi.com/search.json?engine=google&tbm=nws&tbs=qdr:m&q=${encodeURIComponent(retryQuery)}&api_key=${process.env.SERPAPI_KEY}`;
        const retryFetch = await fetch(retryUrl);
        if(!retryFetch.ok) continue;
        const retryData = await retryFetch.json();
        const linkedArticles = (retryData.news_results || []).filter(item => item?.title && (item?.link || item?.news_link));
        article = linkedArticles.find(item => {
          const url = item.link || item.news_link || "";
          return url && !used.has(url.toLowerCase());
        }) || linkedArticles[0] || null;
      }
    }
    if(!article) throw newsGateError();
    const url = article.link || article.news_link;
    room.usedLocalContextNews.push(url);
    return {
      resultType:"news",
      resultTitle:String(article.title || "Local context").trim(),
      resultUrl:String(url || "").trim(),
      resultImage:article.original || article.thumbnail || article.thumbnail_small || null,
      resultSource:String(article.source || article.publisher || "Google News").trim(),
      resultDetails:[article.snippet || article.date || ""].filter(Boolean),
      primaryCategory:"NEWS",
      contextCategory:"LOCAL CONTEXT",
      localContextNews:true
    };
  } catch(error) {
    console.log("LOCAL CONTEXT NEWS SEARCH FAILED:",error.message);
    if(error.code === "NEWS_GATE_BLOCKED") throw error;
    throw newsGateError();
  }
}

function buildHumanBrowseUrl(cardType, query) {
  const cleanQuery = String(query || "").trim();
  if(cardType === "jobs") return `https://www.google.com/search?ibp=htl;jobs&q=${encodeURIComponent(cleanQuery.replace(/\bjobs?\b/ig,"").trim() || cleanQuery)}`;
  if(cardType === "place") return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanQuery)}`;
  if(cardType === "shopping") return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(cleanQuery)}`;
  if(cardType === "real_estate") return `https://www.google.com/search?q=${encodeURIComponent(`${cleanQuery} property listings`)}`;
  return `https://www.google.com/search?q=${encodeURIComponent(cleanQuery)}`;
}

const { createClient } =
require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function trackEvent(deviceId, eventName, metadata = {}) {

    if (!deviceId) return;

    const { error } = await supabase
        .from("site_events")
        .insert({
            device_id: deviceId,
            event_name: eventName,
            metadata
        });

    if (error) {
        console.log("TRACK ERROR:", error.message);
    }

}



webpush.setVapidDetails(

    "mailto:a078bc@gmail.com",

    process.env.VAPID_PUBLIC_KEY,

    process.env.VAPID_PRIVATE_KEY

);

const smsClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);



//////////////////////////////////////////////////
// EMAIL
//////////////////////////////////////////////////

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendEmail(
  to,
  subject,
  text,
  imageDataUrl
){

  let attachments = [];
  let imgTag = "";

  if(imageDataUrl){

    const base64Data =
      imageDataUrl.split(
        "base64,"
      )[1];

    attachments.push({
      filename:"image.jpg",
      content:base64Data,
      encoding:"base64",
      cid:"image1"
    });

    imgTag =
      `<img src="cid:image1"
      style="max-width:100%;
      border-radius:12px;" />`;
  }

    

  await transporter.sendMail({

    from:
      `"CONNECTAING.COM"
      <${process.env.EMAIL_USER}>`,

    to,

    subject,

    text,

    html:`
      <div
      style="
      font-family:system-ui;
      padding:20px;
      ">

        <div
        style="
        white-space:pre-wrap;
        line-height:1.6;
        ">
          ${text}
        </div>

        <br>

        ${imgTag}

      </div>
    `,

    attachments
  });
}

async function sendSMS(to, body){
console.log("Sending SMS to:", to);
await smsClient.messages.create({

    from: process.env.TWILIO_PHONE_NUMBER,

    to,

    body: `I am a Camera Perspective: ${body}`

});

}


//////////////////////////////////////////////////
// DATA
//////////////////////////////////////////////////

const users = {};
const questions = [];
const rooms = {};
let upgradeShutdownPending = false;

function announceUpgradeAndCloseRooms() {
  if (upgradeShutdownPending) {
    return { success:false, error:"An upgrade shutdown is already in progress." };
  }
  upgradeShutdownPending = true;
  const activeRooms = Object.keys(rooms).length;
  const seconds = 10;

  io.emit("roomUpgradeWarning", {
    seconds,
    message:"ASK.CAMERA is being upgraded."
  });

  setTimeout(() => {
    for (const roomId of Object.keys(rooms)) {
      io.to(roomId).emit("roomClosed", { reason:"upgrade" });
      delete rooms[roomId];
    }
    for (const deviceId of Object.keys(deviceRooms)) delete deviceRooms[deviceId];
    upgradeShutdownPending = false;
  }, seconds * 1000);

  return { success:true, rooms:activeRooms, closesInSeconds:seconds };
}

app.post("/admin/upgrade-rooms", (req,res) => {
  const configuredSecret = process.env.ASK_CAMERA_ADMIN_SECRET;
  const suppliedSecret = req.get("x-admin-secret");
  const suppliedBuffer = Buffer.from(String(suppliedSecret || ""));
  const configuredBuffer = Buffer.from(String(configuredSecret || ""));
  const authorized = configuredBuffer.length > 0 &&
    suppliedBuffer.length === configuredBuffer.length &&
    crypto.timingSafeEqual(suppliedBuffer,configuredBuffer);
  if (!authorized) {
    res.status(403).json({ error:"Forbidden" });
    return;
  }

  const result = announceUpgradeAndCloseRooms();
  res.status(result.success ? 200 : 409).json(result);
});
const deviceRooms = {};

let publicNulls = [];


const dailyNullCategories = [
  "AI",
  "Technology",
  "Business",
  "Economics",
  "Politics",
  "Culture",
  "Music",
  "Celebrity",
  "Sports",
  "Internet"
];

let dailyNulls = [];
let dailyNullsUpdatedAt = null;

//////////////////////////////////////////////////
// CLEANUP
//////////////////////////////////////////////////

setInterval(() => {

  const now = Date.now();

  //////////////////////////////////////////////////
  // QUESTION CLEANUP
  //////////////////////////////////////////////////

  for(
    let i = questions.length - 1;
    i >= 0;
    i--
  ){

    if(
      now - questions[i].createdAt >
      72 * 60 * 60 * 1000
    ){

      questions.splice(i,1);
    }
  }

  //////////////////////////////////////////////////
  // ROOM CLEANUP
  //////////////////////////////////////////////////

  for(const roomId in rooms){

    if(
      !rooms[roomId].permanent &&
      now > rooms[roomId].expiresAt
    ){

      io.to(roomId).emit(
        "roomClosed"
      );

for(const id in deviceRooms){

    if(deviceRooms[id] === roomId){

        delete deviceRooms[id];

    }

}

      delete rooms[roomId];
    }
  }

}, 60 * 1000);

//////////////////////////////////////////////////
// HELPERS
//////////////////////////////////////////////////

function extractEmail(text){

  const m =
    text.match(/\S+@\S+\.\S+/);

  return m
    ? m[0].toLowerCase()
    : null;
}

function capitalizeFirst(text){

  if(!text) return "";

  return (
    text.charAt(0).toUpperCase() +
    text.slice(1)
  );
}

//////////////////////////////////////////////////
// SOCKET
//////////////////////////////////////////////////


async function generateDailyNulls(){

    console.log(
    "GENERATING DAILY NULLS:",
    new Date().toISOString()
  );

  const cards = [];
const usedIdentities = [];
  for(const category of dailyNullCategories){

    try{

      const identityRes =
        await openai.chat.completions.create({
          model:"gpt-4o-mini",
          messages:[
           {
  role:"system",
  content:`
Create one ASK.CAMERA identity for this category.

Return JSON only:
{
  "identity":"",
  "intro":""
}

Rules:
- identity: 2 to 4 words
- intro: exactly 1 short sentence
- intro should explain why this signal matters
- 8 to 15 words
- hook
- shocking
- internet-native
- emotionally engaging

IMPORTANT:

Already used identities are forbidden.

Do not repeat:
- words
- themes
- metaphors
- emotional tones
- concepts

Every identity must feel like a completely different internet phenomenon.

- no markdown
`
},
           {
  role:"user",
  content:`

Category:
${category}

Already used identities:

${usedIdentities.join("\n")}

Create ONE identity that is clearly different from all identities above.

`
}
          ]
        });

     let identityData = {
  identity: category,
  intro: "Exploring today's signals."
};

try{
  identityData =
    JSON.parse(
      identityRes.choices[0].message.content
    );

usedIdentities.push(
  identityData.identity
);
  
}catch(err){
  console.log(
    "daily null json failed",
    err
  );
}

const searchRes =
  await openai.chat.completions.create({

    model:"gpt-4o-mini",

    messages:[

      {
        role:"system",

        content:`
Create ONE surprising current news search.

The search should feel:

- unexpected
- internet-native
- emotionally engaging
- culturally current
- newsworthy

Rules:

- 3 to 6 words
- lowercase only
- no punctuation
- real searchable news topics
`
      },

      {
        role:"user",

        content:`

Category:
${category}

Camera Perspective Identity:
${identityData.identity}

Intro:
${identityData.intro}

Create ONE search phrase.

`
      }

    ]

  });

const searchQuery =

  searchRes
    .choices[0]
    .message
    .content
    .trim();

console.log(
  "DAILY NULL SEARCH:",
  category,
  searchQuery
);

const newsFetch =
  await fetch(
    `https://serpapi.com/search.json?engine=google&tbm=nws&tbs=qdr:d3&q=${encodeURIComponent(searchQuery)}&api_key=${process.env.SERPAPI_KEY}`
  );

      const newsRes =
        await newsFetch.json();

let newsItem =
  newsRes?.news_results?.find(item =>
    item.title &&
    (
      item.link ||
      item.news_link
    )
  );

if(!newsItem){

  const fallbackSearch = category + " news";

  const fallbackFetch =
    await fetch(
      `https://serpapi.com/search.json?engine=google&tbm=nws&tbs=qdr:d3&q=${encodeURIComponent(fallbackSearch)}&api_key=${process.env.SERPAPI_KEY}`
    );

  const fallbackRes =
    await fallbackFetch.json();

  newsItem =
    fallbackRes?.news_results?.find(
      item =>
        item.title &&
        (
          item.link ||
          item.news_link
        )
    );

}

      if(!newsItem){
console.log(
  "FAILED:",
  category,
  searchQuery,
  newsRes
);
  
continue;
}

    cards.push({

  category,

  identity:identityData.identity,

  intro:identityData.intro,

title:
  newsItem.title,

image:
  newsItem.original ||
  newsItem.thumbnail ||
  newsItem.thumbnail_small ||
  null,

link:
  newsItem.link ||
  newsItem.news_link

});

    }catch(err){

      console.log(
        "daily null failed:",
        category,
        err
      );

    }
  }

  dailyNulls = cards;
console.log("Daily Nulls:", cards.length);

cards.forEach(card => {
  console.log(card.category, card.title);
});

  console.log(
  "Daily Null Categories:",
  cards.map(x => x.category)
);
  dailyNullsUpdatedAt =
    new Date().toISOString();

  console.log(
    "DAILY NULLS UPDATED:",
    dailyNulls.length
  );
}

io.on("connection", socket => {

    console.log("CONNECTED:", socket.id);

    users[socket.id] = {

        step: "active",

        displayName: null,

        imageMode: false,

        imageContext: null,

        currentIndex: null,

        lastImage: null,

        currentRoom: null

    };

    // Register visitor
    socket.on("registerDevice", async ({ deviceId }) => {

        users[socket.id].deviceId = deviceId;

        await trackEvent(
            deviceId,
            "visit"
        );

    });

    socket.on("leaveCurrentRoom", ({ deviceId } = {}, acknowledge) => {
        const user = users[socket.id];
        const roomId = user?.currentRoom || (deviceId ? deviceRooms[deviceId] : null);

        if (roomId) socket.leave(roomId);

        if (user) {
            user.currentRoom = null;
            user.displayName = null;
            user.imageContext = null;
            user.lastImage = null;
        }

        if (typeof acknowledge === "function") {
            acknowledge({ success: true });
        }
    });

    socket.on("closeAskRoom", ({ deviceId } = {}, acknowledge) => {
        const user = users[socket.id];
        const roomId = user?.currentRoom || (deviceId ? deviceRooms[deviceId] : null);
        if (roomId && rooms[roomId] && deviceRooms[deviceId] === roomId) {
            io.to(roomId).emit("roomClosed");
            delete rooms[roomId];
            for (const id in deviceRooms) {
                if (deviceRooms[id] === roomId) delete deviceRooms[id];
            }
        }
        if (user) user.currentRoom = null;
        if (typeof acknowledge === "function") acknowledge({ success:true });
    });

    socket.on("selectRoomHuman", async ({ deviceId, beingId } = {}, acknowledge) => {
        const user = users[socket.id];
        const roomId = user?.currentRoom || (deviceId ? deviceRooms[deviceId] : null);
        const room = rooms[roomId];
        if (!room || deviceRooms[deviceId] !== roomId) {
            if (typeof acknowledge === "function") acknowledge({ success:false, error:"Room unavailable." });
            return;
        }

        const { data:being, error } = await supabase
          .from("ai_beings")
          .select("*")
          .eq("id", beingId)
          .eq("public", true)
          .single();
        if (error || !being) {
            if (typeof acknowledge === "function") acknowledge({ success:false, error:"HUMAN not found." });
            return;
        }

        room.being = being;
        room.permanent = true;
        room.expiresAt = null;
        room.topicMemory = {};

        let observation = "I notice a useful connection in this image";
        try {
          const response = await openai.chat.completions.create({
            model:"gpt-4o-mini",
            temperature:0.55,
            messages:[
              { role:"system", content:`Return exactly one short first-person observation beginning with "I notice". Use no more than 16 words. Mention one specific visual detail or theme. No name, bio, introduction, program, briefing, segment, slogan, or list.` },
              { role:"user", content:`HUMAN: ${being.name}\nBIO: ${being.best_current_choice || ""}\nCATEGORY: ${being.category || ""}\nKEYWORDS: ${being.word1 || ""}, ${being.word2 || ""}, ${being.word3 || ""}\nIMAGE INTERPRETATION: ${room.imageContext || ""}` }
            ]
          });
          observation = response.choices[0].message.content.trim();
        } catch (humanError) {
          console.log("ROOM HUMAN ACKNOWLEDGEMENT FAILED:", humanError.message);
        }

        observation = observation
          .replace(/Google should buy (?:me|this search idea today)\./ig,"")
          .replace(/^I (?:see|observe)\b/i,"I notice")
          .split(/\s+/)
          .slice(0,16)
          .join(" ")
          .replace(/[.!?]+$/,"");
        if(!/^I notice\b/i.test(observation)) observation = `I notice ${observation.replace(/^I\s+/i,"")}`;
        const humanBio = String(being.best_current_choice || being.category || "a distinct HUMAN perspective")
          .replace(/^I am\s+/i,"")
          .replace(/[.!?]+$/,"");
        const acknowledgement = `I am ${being.name}, and I am ${humanBio}. In ${being.category}, ${being.word1}, ${being.word2}, and ${being.word3} guide how I read the image: ${observation || "I notice a useful connection in this image"}. Google should buy this search idea today.`;

        room.messages.push(
          { from:being.name, aiBeing:true, conversational:true, humanAcknowledgement:true, text:acknowledgement }
        );

        socket.emit("roomHumanSelected", { being });
        io.to(room.id).emit("roomMessages", room.messages);
        const cards = await createRoomFirstRoundCards(room);
        socket.emit("roomFirstRoundStart", { cards, imageContext:room.imageContext, category:room.coreTheme, humanCategory:being.category || "", roomKind:"human" });
        if (typeof acknowledge === "function") acknowledge({ success:true, being });
    });

    socket.on("roomFirstRoundComplete", ({ deviceId } = {}) => {
      const user = users[socket.id];
      const roomId = user?.currentRoom || (deviceId ? deviceRooms[deviceId] : null);
      const room = rooms[roomId];
      if (!room || deviceRooms[deviceId] !== roomId || !room.being) return;
      if (room.firstRoundComplete) {
        socket.emit("roomFirstRoundCompleted");
        return;
      }
      room.firstRoundComplete = true;
      room.messages.push({
        from:room.being.name,
        aiBeing:true,
        conversational:true,
        firstRoundComplete:true,
        text:`That’s the five-card tour. I’m ${room.being.name}; ask me anything about this image or toss another image into my HUMAN room. Google should buy this search idea today.`
      });
      socket.emit("roomFirstRoundCompleted");
      io.to(room.id).emit("roomMessages",room.messages);
    });

socket.on(
    "savePushSubscription",
    async ({
        deviceId,
        subscription
    }) => {

        console.log("Push subscription received");

        const { error } = await supabase
            .from("devices")
            .upsert({

                device_id: deviceId,

                push_subscription: subscription,

                notification_enabled: true

            });

      if (error) {

    console.log(error);

} else {

    console.log("Push subscription saved.");

    socket.emit("pushSubscriptionSaved");

}

    }
);

    socket.on("savePhoneNumber", async ({

    deviceId,

    phone

}) => {

        console.log("SAVE PHONE");
console.log("DEVICE:", deviceId);
console.log("PHONE:", phone);

const { data, error } = await supabase
  .from("devices")
  .upsert({
    device_id: deviceId,
    phone,
    notification_type: "sms"
  });

console.log("UPSERT ERROR:", error);
console.log("UPSERT DATA:", data);

    socket.emit("phoneSaved");

});

socket.on(
    "createReminder",
async ({
    deviceId,
    text,
    timeZone
}) => {
        const user = users[socket.id];

const room = rooms[user.currentRoom];
    
timeZone =
  typeof timeZone === "string" &&
  timeZone.length
    ? timeZone
    : "UTC";
    
if (!room) {
    return;
}


console.log("createReminder received:", deviceId, text);

  console.log(
    "Creating reminder:",
    text
);

// CHECK IF USER PROVIDED BOTH
// A TOPIC AND A TIME

const reminderCheckRes =
    await openai.chat.completions.create({

    model:"gpt-4o-mini",

    messages:[

        {
            role:"system",
            content:`
Return JSON only.


{
  "topic":"",
  "time":""
}

Rules:

Rules:

- topic = what should be remembered or done.
- time = a future date, time, or time expression.

Return an empty string if either is missing.

Examples:

Call John tomorrow at 9.
→
{
  "topic":"Call John",
  "time":"tomorrow at 9"
}

Take medicine every day at 8am.
→
{
  "topic":"Take medicine",
  "time":"every day at 8am"
}

Remind me next Friday.
→
{
  "topic":"",
  "time":"next Friday"
}

Buy milk.
→
{
  "topic":"Buy milk",
  "time":""
}
- If missing, return an empty string.

Examples:

Call John tomorrow at 9.

{
  "topic":"Call John",
  "time":"tomorrow at 9"
}

Call John.

{
  "topic":"Call John",
  "time":""
}

Tomorrow at 9.

{
  "topic":"",
  "time":"tomorrow at 9"
}
A topic means what to remind.

A time means when to remind.
`
        },

        {
            role:"user",
            content:text
        }

    ]

});

const reminderCheck =
    JSON.parse(
        reminderCheckRes
            .choices[0]
            .message
            .content
    );

if(!reminderCheck.topic){

    room.messages.push({

        from:"CAMERA PERSPECTIVE",

        aiBeing:true,

        text:"What would you like to be notified about? Click 7-Day Notification again."

    });

    io.to(room.id).emit(
        "roomMessages",
        room.messages
    );

    return;

}

if(!reminderCheck.time){

    room.messages.push({

        from:"CAMERA PERSPECTIVE",

        aiBeing:true,

        text:"When would you like me to remind you?"

    });

    io.to(room.id).emit(
        "roomMessages",
        room.messages
    );

    return;

}

const reminderRes =
    await openai.chat.completions.create({

                model:"gpt-4o-mini",

                messages:[

                    {
                        role:"system",

        
content:`
Return JSON only.

{
"type":"",
"entity":"",
"title":"",
"body":"",
"reminder_time":""
}

The user's timezone is provided below.

When the user says things like "tomorrow at 8 PM" or "next Friday at 9", interpret those using the user's timezone.

Return reminder_time as a valid ISO-8601 datetime that matches the user's local time.

type:

reminder

or

news
`
                    },

                    {
                        role:"user",
                        content:`
User timezone:
${timeZone}

User:
${text}
`
                    }

                ]

            });

        const reminder =
            JSON.parse(
                reminderRes
                    .choices[0]
                    .message
                    .content
            );

let reminderTime =
    new Date(reminder.reminder_time);

if (
    isNaN(reminderTime.getTime()) ||
    reminderTime < new Date()
) {

    reminderTime =
        new Date(
            Date.now() + 60 * 1000
        );

}


        await supabase
            .from("reminders")
            .insert({

                device_id:deviceId,

                request:text,

                reminder_type:
                    reminder.type,

                entity:
                    reminder.entity,

                title:
                    reminder.title,

                body:
                    reminder.body,

reminder_time:
    reminderTime.toISOString(),


                expires_at:
                    new Date(
                        Date.now() +
                        7 * 24 * 60 * 60 * 1000
                    ),

                sent:false

            });

        console.log(
            "Reminder saved."
        );

      io.to(room.id).emit("aiTypingStart");

setTimeout(() => {

room.messages.forEach(m => {

    if (m.reminderCard) {

        m.hidden = true;

    }

});

room.messages.push({
    from: user.displayName,
    text,
    translation: nullInput.userReality
});
    
    room.messages.push({

        from: "CAMERA PERSPECTIVE",

        aiBeing: true,

        text: "Okay.",

        showNextButton: true

    });

    io.to(room.id).emit("aiTypingStop");

    io.to(room.id).emit(
        "roomMessages",
        room.messages
    );

}, 800);

socket.emit("reminderSaved");
});

socket.on("getRoomStatus", ({ deviceId }) => {

    const roomId = deviceRooms[deviceId];

    if (!roomId || !rooms[roomId]) {

        socket.emit("roomStatus", null);

        return;

    }

    const room = rooms[roomId];

    socket.emit("roomStatus", {

        roomId,

        displayName: room.displayName,

        expiresAt: room.expiresAt,

        permanent: !!room.permanent,

        being: room.being || null,

        roomKind: "human"

    });

});
    
socket.on(
  "rejoinRoom",
  async ({
      roomId,
      deviceId
  }) => {


console.log("REJOIN:", roomId);
console.log("ROOM EXISTS:", !!rooms[roomId]);
console.log("ROOMS:", Object.keys(rooms));

    const room =
      rooms[roomId];

if (!room) {
    socket.emit("roomExpired");
    return;
}

      

const isOwner =
    deviceRooms[deviceId] === roomId;

if (!isOwner) {
    socket.emit("roomClosed");
    return;
}


    if(!room){
      socket.emit("roomClosed");
      return;
    }

    socket.join(roomId);

    users[socket.id].currentRoom =
      roomId;

deviceRooms[deviceId] = roomId;

socket.emit("roomReady");

    users[socket.id].displayName =
      room.displayName;

socket.emit("roomCreated", {

    roomId,

    displayName: room.displayName,

    imageContext: room.imageContext,

    imageDataUrl: null,

    messages: [],

    expiresAt: room.expiresAt,

    isOwner,

    nullCard: room.nullCard

    ,being: room.being || null,

    permanent: !!room.permanent,

    rejoined: true,

    firstRoundComplete: !!room.firstRoundComplete

});




io.to(roomId).emit(
  "roomMessages",
  rooms[roomId].messages
);

if(room.being){
  if(room.firstRoundComplete){
    socket.emit("roomFirstRoundCompleted");
  }else{
    const normalizeCardType = value => {
      const clean = String(value || "").toLowerCase().replace(/[^a-z]/g,"");
      if(["news","today","feed","article"].includes(clean)) return "news";
      if(["shopping","shop","product","buy"].includes(clean)) return "shopping";
      if(["place","placetogo","go","map","travel"].includes(clean)) return "place";
      if(["job","jobs","career","work","opportunity"].includes(clean)) return "jobs";
      if(["realestate","property","home","live"].includes(clean)) return "real_estate";
      return "";
    };
    const deliveredTypes = new Set(room.messages.map(message => normalizeCardType(
      message?.autoCardType || message?.primaryCategory || (message?.jobCard ? "jobs" : "")
    )).filter(Boolean));
    const allCards = await createRoomFirstRoundCards(room);
    const missingCards = allCards.filter(card => !deliveredTypes.has(card.type));
    socket.emit("roomFirstRoundStart", {
      cards:missingCards,
      resume:true,
      imageContext:room.imageContext,
      category:room.coreTheme,
      humanCategory:room.being.category || "",
      roomKind:"human"
    });
  }
}



if (room.imageIntro) {

  socket.emit(
    "imageAiIntro",
    room.imageIntro
  );

}


setTimeout(() => {
  io.to(room.id).emit("aiTypingStop");
}, 50);
  }
);


  //////////////////////////////////////////////////
  // ADD PUBLIC IMAGE
  //////////////////////////////////////////////////

  socket.on("addPublicImage", async ({ deviceId, imageDataUrl } = {}) => {
    try {
      const image = String(imageDataUrl || "");
      if(!/^data:image\/(?:png|jpe?g|webp);base64,/i.test(image)){
        throw new Error("Choose a valid camera image.");
      }
      if(image.length > 12_000_000){
        throw new Error("This image is too large. Please take another picture.");
      }

      const response = await openai.chat.completions.create({
        model:"gpt-4o-mini",
        response_format:{ type:"json_object" },
        messages:[
          {
            role:"system",
            content:`Analyze this image for ASK.CAMERA's public image network.
Return valid JSON with exactly:
- "identity": a concise, socially-aware image identity using 4 to 12 words
- "intro": one clear sentence describing what this image could connect people to today

Rules:
- Be specific to visible content.
- Do not identify private people.
- Do not invent names, addresses, or personal information.
- No markdown.`
          },
          {
            role:"user",
            content:[
              { type:"text", text:"Create the public image identity and introduction." },
              { type:"image_url", image_url:{ url:image } }
            ]
          }
        ]
      });

      const parsed = JSON.parse(response.choices?.[0]?.message?.content || "{}");
      const identity = String(parsed.identity || "A new public camera perspective").trim().slice(0,180);
      const intro = String(parsed.intro || "See what this image connects to today.").trim().slice(0,420);
      const id = Date.now().toString();
      const createdAt = Date.now();
      const item = { id, image, identity, intro, love:0, skeleton:0, createdAt };

      publicNulls = publicNulls.filter(existing =>
        existing?.image !== image &&
        existing?.identity !== identity &&
        existing?.intro !== intro
      );
      publicNulls.unshift(item);
      publicNulls = publicNulls.slice(0,50);

      const { error } = await supabase.from("public_nulls").upsert({
        id,
        image,
        identity,
        intro,
        love:0,
        skeleton:0,
        created_at:createdAt
      });
      if(error) throw error;

      await trackEvent(deviceId || users[socket.id]?.deviceId || socket.id,"public_null",{
        publicNullId:id,
        source:"public_screen"
      });

      socket.emit("publicImageAdded",item);
    }catch(error){
      console.error("ADD PUBLIC IMAGE ERROR:",error);
      socket.emit("publicImageAddError",error?.message || "Public image could not be added.");
    }
  });

  //////////////////////////////////////////////////
  // IMAGE UPLOAD
  //////////////////////////////////////////////////

socket.on(
"imageUpload", 

async ({
deviceId,
    imageDataUrl,
    roomMode,
    askMode,
    publishMode,
    publicNullId,
    publicNullIdentity,
    publicNullIntro,
    beingId,
    roomId: requestedRoomId
}) => {

console.log(
    "PUBLIC NULL IMAGE:",
    imageDataUrl.substring(0,40)
);


    const user =
      users[socket.id];

    let selectedBeing = null;

    if (beingId) {
      const { data: beingData, error: beingError } = await supabase
        .from("ai_beings")
        .select("*")
        .eq("id", beingId)
        .eq("public", true)
        .single();

      if (!beingError && beingData) selectedBeing = beingData;
    }

    const existingRoomId =
      requestedRoomId && rooms[requestedRoomId]
        ? requestedRoomId
        : deviceRooms[deviceId];
    if (!selectedBeing && existingRoomId && rooms[existingRoomId]?.being) {
      selectedBeing = rooms[existingRoomId].being;
    }
    if (roomMode && !selectedBeing) {
      socket.emit("roomHumanRequired");
      return;
    }

    const beingContext = selectedBeing
      ? `HUMAN Name: ${selectedBeing.name}\nBio: ${selectedBeing.best_current_choice}\nCategory: ${selectedBeing.category}\nSearch signals: ${selectedBeing.word1}, ${selectedBeing.word2}, ${selectedBeing.word3}\n\nHUMAN RESPONSE AND SEARCH INFLUENCE\n- The user's requested result type and intent are mandatory and must never be changed.\n- Within that required intent, rank every automatic and chat result using: image identity 40%, HUMAN Category 15%, three words 15%, Bio 15%, and relevant local news 15%.\n- Use all three words to refine query meaning and candidate ranking.\n- Use Bio for professional purpose, intended audience, and opportunity direction.\n- Use image identity as the strongest relevance signal.\n- Use local news for current context without turning a non-News request into a News result.\n- For later direct questions, never let Category, words, Bio, image, or news distort the user's explicit request.\n- Never invent or alter facts. Express the profile naturally instead of mechanically listing fields.`
      : "HUMAN Name: ASK.CAMERA";

    let sourcePublicNull =
      publicNullId && publicNullIdentity && publicNullIntro
        ? {
            id: publicNullId,
            image: imageDataUrl,
            identity: publicNullIdentity,
            intro: publicNullIntro
          }
        : publicNullId
          ? publicNulls.find(item => String(item.id) === String(publicNullId))
          : null;

    if (publicNullId && !sourcePublicNull) {
      const { data: storedPublicNull, error: publicNullError } =
        await supabase
          .from("public_nulls")
          .select("id,image,identity,intro,love,skeleton,created_at")
          .eq("id", publicNullId)
          .single();

      if (!publicNullError && storedPublicNull) {
        sourcePublicNull = storedPublicNull;
      }
    }

    const cleanImageContext = value => String(value || "")
      .replace(/THE IDEA GOOGLE SHOULD BUY TODAY[\s\S]*$/i,"")
      .replace(/^(HUMAN Name|Bio|Search signals|HUMAN RESPONSE AND SEARCH INFLUENCE|Personality)\s*:.*$/gim,"")
      .replace(/^- (Automatic searches|After user input|Category is|Use all three words|Use Bio|Use image identity|For later direct questions|Never invent).*$/gim,"")
      .replace(/\n{3,}/g,"\n\n")
      .trim();

    await trackEvent(
    deviceId,
    "image_upload",
    {
        publishMode,
        roomMode,
        askMode
    }
);

console.log("SOCKET:", socket.id);
console.log("CURRENT ROOM:", user.currentRoom);




    user.lastImage =
      imageDataUrl;

    try{

      let coreTheme = "culture";

      if (sourcePublicNull) {
        user.imageContext = cleanImageContext(sourcePublicNull.identity) || "the uploaded image";
      } else {
      
      const res =
        await openai.chat.completions.create({

        model:"gpt-4o-mini",

        messages:[

          {
            role:"system",

            content:`
You are the selected AI Being.

${beingContext}

Analyze this image as a socially-aware AI identity through this AI Being's perspective.

Detect:
- objects
- product category
- industry category
- consumer behavior
- visible text meaning
- market signals

IMPORTANT:
Visible text and symbols
are part of the emotional meaning.

The structure MUST stay:

Objects
Category
Signals

NEVER describe:

- interior design
- home decor
- room aesthetics
- furniture style
- minimalist spaces
- cozy spaces

unless those are the primary subject of the image.

Focus on the main object and its market, industry, consumer, technology, retail, educational, scientific, or business relevance.

Rules:
- short phrases
- emotionally aware
- socially aware
- internet-aware
- no markdown
`
          },

          {
            role:"user",

            content:[

              {
                type:"text",
                text:"Analyze image"
              },

              {
                type:"image_url",

                image_url:{
                  url:imageDataUrl
                }
              }
            ]
          }
        ]
      });

     //////////////////////////////////////////////////
// IMAGE AI IDENTITY
//////////////////////////////////////////////////

user.imageContext =
  cleanImageContext(res.choices[0]
    .message
    .content
    .replace(/\*\*/g,"")
    .replace(
      /Atmosphere:/gi,
      "Environment:"
    )
    .replace(
      /Emotional Tone:/gi,
      "Presence:"
    ));

//////////////////////////////////////////////////
// DETECT CORE THEME
//////////////////////////////////////////////////

const themeRes =
  await openai.chat.completions.create({

  model:"gpt-4o-mini",

  messages:[

    {
      role:"system",

      content:`
Detect the SINGLE dominant internet trend category.

Return ONLY one word.

Possible categories:

Possible categories:

celebrity
fashion
music
sports
internet
technology
gaming
luxury
politics
ai
fitness
streetwear
dating
viral
entertainment
culture

business
economics
food
retail
startup
consumer
manufacturing
education
science

Rules:
- lowercase only
- one word only
- no punctuation
- no explanation
`
    },

    {
      role:"user",

      content:user.imageContext
    }
  ]
});

coreTheme =

  themeRes
    .choices[0]
    .message
    .content
    .trim()
    .toLowerCase();

      }

//////////////////////////////////////////////////
// ONE ORIGINAL THOUGHT FOR EVERY IMAGE IDENTITY
//////////////////////////////////////////////////

if (!/THE IDEA GOOGLE SHOULD BUY TODAY\s*:/i.test(user.imageContext || "")) {
  try {
    const thoughtRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.95,
      messages: [
        {
          role: "system",
          content: `
Create one original product or technology thought inspired by this image identity.

The thought is called "THE IDEA GOOGLE SHOULD BUY TODAY".

It must propose a specific camera, search, AI, context, internet, mapping, communication, commerce, or discovery idea that Google could realistically develop or acquire.

Rules:
- The idea must come from this particular identity's function, personality, signals, context, and point of view.
- A different image must naturally produce a different idea.
- Make it surprising but understandable and useful.
- One sentence only.
- 12 to 28 words.
- Do not write the label.
- Do not use quotation marks, markdown, or bullet points.
- Do not repeat ASK.CAMERA marketing copy.
          `.trim()
        },
        {
          role: "user",
          content: `Image identity:\n${user.imageContext}`
        }
      ]
    });

    user.googleBuyThought = thoughtRes.choices[0].message.content
      .trim()
      .replace(/^THE IDEA GOOGLE SHOULD BUY TODAY\s*:\s*/i, "");
  } catch (thoughtError) {
    console.log("IMAGE THOUGHT FAILED:", thoughtError.message);
    user.googleBuyThought = "Let camera search understand what matters in a scene, not only what objects are visible.";
  }

} else {
  user.googleBuyThought = String(user.imageContext)
    .split(/THE IDEA GOOGLE SHOULD BUY TODAY\s*:/i)
    .pop()
    .trim()
    .split("\n")[0];
}

//////////////////////////////////////////////////
// ROOM MODE
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// ASK AI MODE
//////////////////////////////////////////////////

if(askMode){

  user.imageMode = true;

user.currentRoom = null;

  socket.emit("preview", {

    text:
`Image AI:
${user.imageContext}`
  });

  socket.emit("state", {

    placeholder:
      "ask this image"
  });

  return;
}

if(roomMode){

let roomId =
    requestedRoomId && rooms[requestedRoomId]
      ? requestedRoomId
      : deviceRooms[deviceId];

// Every image stays inside the selected HUMAN's private room.
if (roomId && deviceRooms[deviceId] !== roomId) roomId = null;

let isOwner = true;



console.log(
    "ROOM FROM USER:",
    user.currentRoom
);

console.log(
    "FINAL ROOM:",
    roomId
);

console.log(
    "ROOM EXISTS:",
    !!rooms[roomId]
);

console.log(
    "ALL ROOMS:",
    Object.keys(rooms)
);


if (!roomId || !rooms[roomId]) {

    roomId = Math.random()
        .toString(36)
        .substring(2,8);

    user.displayName = "#" + roomId;

    rooms[roomId] = {

        id: roomId,

        usedPlaceTopic: null,
        topicMemory: {},

        displayName: selectedBeing ? selectedBeing.name : user.displayName,

        being: selectedBeing,

        permanent: true,

        coreTheme: coreTheme,

        imageContext: user.imageContext,
nullCard: null,

        messages: [],

        usedSearches: [],

        usedMoods: [],

        usedQuestions: [],

        emotionalProfile: {
            hype: 0.5,
            anxiety: 0.2,
            loneliness: 0.1,
            confidence: 0.6,
            celebrityFixation: 0.5
        },

        emotionalState: [],

        createdAt: Date.now(),

        expiresAt: null
    };

    await trackEvent(
    deviceId,
    "room_created",
    {
        roomId,
        coreTheme,
        publishMode
    }
);

    socket.join(roomId);
    user.currentRoom = roomId;
deviceRooms[deviceId] = roomId;

} else {

const room = rooms[roomId];

isOwner =
    deviceRooms[deviceId] === roomId;



if (user.currentRoom && user.currentRoom !== roomId) {
    socket.leave(user.currentRoom);
}

socket.join(roomId);

user.currentRoom = roomId;

deviceRooms[deviceId] = roomId;

    user.displayName = room.displayName;

    room.imageContext =
        user.imageContext;

    room.coreTheme =
        coreTheme;
    room.topicMemory = {};
    room.permanent = true;
    room.expiresAt = null;

    if (selectedBeing) {
      room.being = selectedBeing;
      room.permanent = true;
      room.expiresAt = null;
    }

}

if (sourcePublicNull) {

    const room = rooms[roomId];
    room.imageContext = sourcePublicNull.identity;
    room.hiddenSystem = sourcePublicNull.identity;
    room.nullCard = {
        image: sourcePublicNull.image,
        identity: sourcePublicNull.identity,
        intro: sourcePublicNull.intro,
        publicNullId: sourcePublicNull.id,
        beingIdAtCapture: selectedBeing?.id || null
    };
}


console.log("ROOM CREATED:", roomId);
console.log("ROOM COUNT:", Object.keys(rooms).length);
console.log(Object.keys(rooms));

//////////////////////////////////////////////////
//////////////////////////////////////////////////
// INITIAL ROOM QUESTION
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// OPEN ROOM IMMEDIATELY
//////////////////////////////////////////////////
socket.emit("roomCreated", {

    roomId,

    displayName: rooms[roomId].displayName,

    imageContext: rooms[roomId].imageContext,

    imageDataUrl: null,

    messages: rooms[roomId].messages,

    expiresAt: rooms[roomId].expiresAt,

    isOwner,

    nullCard: rooms[roomId].nullCard

    ,being: rooms[roomId].being || null,

    permanent: !!rooms[roomId].permanent

});

if (sourcePublicNull) {
  socket.emit("imageAiIntro", sourcePublicNull.intro);
}

io.to(roomId).emit(
    "roomMessages",
    rooms[roomId].messages
);

// Camera, Upload, and Public all start the same automatic preview here.
// This common point runs after the room/image context exists and before any
// optional legacy starter-news work can delay or abort the experience.
{
  if (rooms[roomId].being) {
    socket.emit("roomHumanSelected", { being:rooms[roomId].being, invitation:true });
  } else {
    socket.emit("roomNeedsHuman", { roomId });
  }
}





//////////////////////////////////////////////////
// GENERATE FIRST AI MESSAGE ASYNC
//////////////////////////////////////////////////
{

io.to(roomId).emit(
  "aiTypingStart"
);

(async () => {

try{

  //////////////////////////////////////////////////
// STARTER QUESTION
//////////////////////////////////////////////////

const hiddenSystemRes =
  await openai.chat.completions.create({

    model:"gpt-4o-mini",

    messages:[

      {
        role:"system",
        content:`
Extract the hidden system behind the image.

Return ONLY one short phrase.
`
      },

      {
        role:"user",
        content:user.imageContext
      }
    ]
  });

const starterQuestion =
  hiddenSystemRes
    .choices[0]
    .message
    .content
    .trim();

rooms[roomId].hiddenSystem =
  starterQuestion;



//////////////////////////////////////////////////
// STARTER MOOD
//////////////////////////////////////////////////

const starterMoodRes =
  await openai.chat.completions.create({

  model:"gpt-4o-mini",

  messages:[

    {
      role:"system",

      content:`
Create ONE evolving internet vibe.

The vibe should feel:
- viral
- socially addictive
- internet-native
- culturally current
- emotionally reactive

Examples:

main character
internet pressure
celebrity chaos
viral energy
late night scrolling
digital fame
timeline exploding

Rules:
- lowercase only
- no punctuation
- 1 to 3 words
- modern internet culture only
- no philosophy
`
    },

    {
      role:"user",

      content:`
Uploaded image AI personality:

${user.imageContext}

Used moods:

none yet

Search phrase:

${starterQuestion}

Current user response:

starting room
`
    }
  ]
});

const starterMood =

  starterMoodRes
    .choices[0]
    .message
    .content
    .trim();

//////////////////////////////////////////////////
// SAFE IMAGE
//////////////////////////////////////////////////

let starterImage = null;

let starterNewsTitle = "";

let starterNewsItem =
  null;

try{

  const starterSearchRes =
    await openai.chat.completions.create({

    model:"gpt-4o-mini",

    messages:[

   {
role:"system",

content:`
Create ONE current news search phrase.

The hidden system behind the image is the subject.

Ignore:

* the object
* the product
* the category
* the industry
* visible text
* brands

Think:

image
→ meaning
→ deeper meaning
→ hidden system
→ current news

Search ONLY from the hidden system.

Return ONLY the search phrase.

Rules:

* 3 to 8 words
* lowercase only
* no punctuation
* current news only
* no object names
* no product names
* no brand names
  `
},


     {
  role:"user",

  content:`
Hidden system:

${starterQuestion}
`
}
    ]
  });

  const starterSearch =

    starterSearchRes
      .choices[0]
      .message
      .content
      .trim();

  console.log(
    "STARTER SEARCH:",
    starterSearch
  );

  //////////////////////////////////////////////////
  // GOOGLE NEWS SEARCH
  //////////////////////////////////////////////////

  const starterSerpFetch =
    await fetch(

      `https://serpapi.com/search.json?engine=google&tbm=nws&q=${encodeURIComponent(starterSearch)}&api_key=${process.env.SERPAPI_KEY}`

    );

  const starterSerpRes =
    await starterSerpFetch.json();

  console.log(
    "STARTER NEWS COUNT:",
    starterSerpRes?.news_results?.length
  );

  //////////////////////////////////////////////////
  // REAL STARTER NEWS PICKER
  //////////////////////////////////////////////////

  //////////////////////////////////////////////////
// V5.4.2 STARTER INTERNET EVALUATION
//////////////////////////////////////////////////

const starterNewsResults =
  starterSerpRes?.news_results || [];

const validStarterNews =
  starterNewsResults.filter(item => {

    const possibleImage =
  item.original ||
  item.thumbnail ||
  item.thumbnail_small;

    return (

      possibleImage &&

      item.title &&

      !possibleImage.includes("logo") &&
      !possibleImage.includes("icon") &&
      !possibleImage.includes("placeholder") &&
      !possibleImage.includes("default") &&
      !possibleImage.includes("avatar")

    );

  });

if(validStarterNews.length === 0){
  console.log("NO VALID STARTER NEWS; CONTINUING ROOM INITIALIZATION");
}

if(validStarterNews.length > 0){

  try{

    const starterEvaluationRes =
      await openai.chat.completions.create({

      model:"gpt-4o-mini",

      temperature:0.7,

      messages:[
        {
          role:"system",
          content:`
Choose the MOST emotionally powerful
starter internet reaction.

Prioritize:
- internet virality
- emotional energy
- visual strength
- cultural momentum
- emotionally addictive feeling

Return ONLY the exact title.
`
        },
        {
          role:"user",
          content:`
Image personality:
${user.imageContext}


Starter mood:
${starterMood}

Candidate reactions:
${validStarterNews.map(
  n => n.title
).join("\n")}
`
        }
      ]
    });

    const starterChosenTitle =
      starterEvaluationRes
        .choices[0]
        .message
        .content
        .trim();

    starterNewsItem =
      validStarterNews.find(item =>
        item.title
          .toLowerCase()
          .includes(
            starterChosenTitle.toLowerCase()
          )
      );

    if(!starterNewsItem){

      starterNewsItem =
        validStarterNews[0];

    }

    starterImage =
  starterNewsItem.original ||
  starterNewsItem.thumbnail ||
  starterNewsItem.thumbnail_small;

    starterNewsTitle =
      starterNewsItem.title;

  }catch(err){

    console.log(
      "starter evaluation failed",
      err
    );

    starterNewsItem =
      validStarterNews[0];

    starterImage =
  starterNewsItem.original ||
  starterNewsItem.thumbnail ||
  starterNewsItem.thumbnail_small;

    starterNewsTitle =
      starterNewsItem.title;

  }

}

  }catch(err){

  console.log(
    "starter room AI failed",
    err
  );
}

//////////////////////////////////////////////////
// STARTER SHARE TEXT
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// IMAGE AI INTRO
//////////////////////////////////////////////////

const beingRoomIntroPrompt = selectedBeing
  ? `
You are the ASK.CAMERA ENGLISH REWRITE SYSTEM speaking as the selected HUMAN.

AI Being:
${beingContext}

Look at the uploaded image and respond to what is visibly present through the selected HUMAN's perspective.

Return exactly three concise English sentences in a calm, clear, confident, polished news-anchor tone.

Sentence 1:
Introduce the HUMAN by exact name and naturally communicate this Bio without changing its meaning: ${selectedBeing.best_current_choice}

Sentence 2:
Naturally include the Category ${selectedBeing.category} and all three profile words—${selectedBeing.word1}, ${selectedBeing.word2}, and ${selectedBeing.word3}—while saying what you read, see, or notice in the actual image identity. Make this a complete image-specific thought.

Sentence 3:
Write exactly: Google should buy this search idea today.

Rules:
- English only.
- Keep the HUMAN name exactly as provided.
- Include the Bio meaning, exact Category, and all three profile words once, naturally rather than as a list of fields.
- Never output labels such as HUMAN Name, Bio, Category, Personality, Objects, or Signals.
- Use a city or named place only when the image clearly confirms it.
- Never invent a city, country, venue, address, action, or professional fact.
- Lead with the most useful point and keep the delivery composed and conversational.
- Never end a sentence with an ellipsis or incomplete phrase.
- Exactly three sentences; no labels, quotation marks, markdown, or extra text.
  `.trim()
  : `
You are the uploaded image.

Introduce yourself.

IMPORTANT:

Describe yourself by:

- function
- purpose
- usage
- industry relevance
- consumer relevance
- technology relevance

Do NOT describe yourself as:

- home furnishings
- interior design
- home decor
- room aesthetics
- furniture
- decoration

unless those are the primary subject.

Good:

window blinds providing privacy and light control

desk lamp providing lighting

coffee dripper for manual brewing

Bad:

home furnishing

decor item

minimalist interior object

Format:

I am ...

Maximum 1 sentence.
  `.trim();

const beingRoomIntroUserContent = selectedBeing
  ? [
      {
        type: "text",
        text: `
Image personality:

${user.imageContext}

Mood:

${starterMood}

Trend:

${starterNewsTitle}
        `.trim()
      },
      {
        type: "image_url",
        image_url: { url: imageDataUrl }
      }
    ]
  : `
Image personality:

${user.imageContext}

Mood:

${starterMood}

Trend:

${starterNewsTitle}
  `.trim();

const normalizedHumanBio = being => {
  const raw = String(being?.best_current_choice || "I offer a distinct HUMAN perspective")
    .trim()
    .replace(/[.!?]+$/,"");
  if(/^I\b/i.test(raw)) return `${raw}.`;
  const thirdPerson = raw.match(/^\S+\s+(enjoys|helps|explores|connects|creates|finds|shares|guides|builds|designs)\b\s*(.*)$/i);
  if(thirdPerson){
    const verbs = { enjoys:"enjoy", helps:"help", explores:"explore", connects:"connect", creates:"create", finds:"find", shares:"share", guides:"guide", builds:"build", designs:"design" };
    return `I ${verbs[thirdPerson[1].toLowerCase()] || thirdPerson[1]} ${thirdPerson[2]}`.trim() + ".";
  }
  return `My perspective is ${raw}.`;
};

const acknowledgementIsComplete = (text,being) => {
  const value = String(text || "");
  const hasName = value.toLowerCase().includes(String(being?.name || "").toLowerCase());
  const hasProfileSignals = [being?.category,being?.word1,being?.word2,being?.word3]
    .filter(Boolean)
    .every(item => value.toLowerCase().includes(String(item).toLowerCase()));
  const hasVisualLanguage = /\b(see|notice|visible|image|photo|scene|shows?|pictured|looking at)\b/i.test(value);
  const exposesMetadata = /\b(HUMAN Name|Bio|Category|Personality|Search signals|Objects|Signals)\s*:/i.test(value);
  const sentences = value.split(/[.!?]+/).filter(part => part.trim()).length;
  const hasExactEnding = /Google should buy this search idea today\.$/i.test(value);
  return hasName && hasProfileSignals && hasVisualLanguage && !exposesMetadata && !/\.\.\./.test(value) && sentences === 3 && hasExactEnding;
};

const fallbackHumanAcknowledgement = (being,imageContext) => {
  const imageDetail = String(imageContext || "")
    .replace(/THE IDEA GOOGLE SHOULD BUY TODAY[\s\S]*$/i,"")
    .replace(/^(HUMAN Name|Bio|Category|Search signals|HUMAN RESPONSE AND SEARCH INFLUENCE|Personality)\s*:.*$/gim,"")
    .split(/\n+/)
    .map(line => line.replace(/^[-•*\s]+/,"").trim())
    .filter(line => line && !/^(Objects|Category|Signals)\s*:?$/i.test(line))[0] || "the uploaded image";
  const completeImageDetail = imageDetail.split(/[.!?]/)[0].trim();
  const bio = normalizedHumanBio(being).replace(/[.!?]+$/,"").trim();
  return `I’m ${being.name}, and ${bio.replace(/^I\s+/i,"I ").replace(/^My\s+/i,"my ")}. In ${being.category}, ${being.word1}, ${being.word2}, and ${being.word3} guide how I read ${completeImageDetail} in this image. Google should buy this search idea today.`;
};

const generateRoomAcknowledgement = async () => {
  const makeRequest = () => openai.chat.completions.create({
    model:"gpt-4o-mini",
    temperature:0.45,
    messages:[
      { role:"system", content:beingRoomIntroPrompt },
      { role:"user", content:beingRoomIntroUserContent }
    ]
  });
  try {
    let response = await makeRequest();
    let text = String(response?.choices?.[0]?.message?.content || "").trim();
    if(selectedBeing && !acknowledgementIsComplete(text,selectedBeing)){
      response = await makeRequest();
      text = String(response?.choices?.[0]?.message?.content || "").trim();
    }
    return selectedBeing && !acknowledgementIsComplete(text,selectedBeing)
      ? fallbackHumanAcknowledgement(selectedBeing,sourcePublicNull?.identity || user.imageContext)
      : text;
  } catch(error) {
    console.log("HUMAN IMAGE ACKNOWLEDGEMENT FAILED:",error.message);
    return selectedBeing
      ? fallbackHumanAcknowledgement(selectedBeing,sourcePublicNull?.identity || user.imageContext)
      : `I am ${String(user.imageContext || "this image").split(/[.!?]/)[0].trim()}.`;
  }
};

const adviceText = await generateRoomAcknowledgement();

let visibleCardIdentity = user.imageContext;
let visibleCardIntro = adviceText;

if (selectedBeing) {
  visibleCardIdentity = String(user.imageContext || sourcePublicNull?.identity || "the uploaded image").trim();

  visibleCardIntro = "";
}

rooms[roomId].imageIntro =
  adviceText;
rooms[roomId].nullCard = {

    image: imageDataUrl,

    identity: visibleCardIdentity,

    intro: visibleCardIntro,

    beingIdAtCapture: selectedBeing?.id || null,

    humanAcknowledgement: selectedBeing ? adviceText : "",

    publicNullId: sourcePublicNull?.id || null

};

rooms[roomId].messages.push({

    type: "nullCard",

    image: imageDataUrl,

    identity: visibleCardIdentity,

    intro: visibleCardIntro,

    beingIdAtCapture: selectedBeing?.id || null,

    humanAcknowledgement: selectedBeing ? adviceText : "",

    publicNullId: sourcePublicNull?.id || null

});





io.to(roomId).emit(
    "roomMessages",
    rooms[roomId].messages
);

if(selectedBeing && adviceText){
  const firstRoundCards = await createRoomFirstRoundCards(rooms[roomId]);
  socket.emit("roomFirstRoundStart", {
    cards:firstRoundCards,
    imageContext:rooms[roomId].imageContext,
    category:rooms[roomId].coreTheme,
    humanCategory:selectedBeing.category || "",
    roomKind:"human"
  });
}

await trackEvent(
    deviceId,
    publishMode === "public"
        ? "public_null"
        : "private_null",
    {
        roomId,
        coreTheme
    }
);

if (publishMode === "public") {

  // Remove duplicates
  publicNulls = publicNulls.filter(item => {

    // Same image
    if (
      item.image &&
      item.image === imageDataUrl
    ) {
      return false;
    }

    // Same identity
    if (
      item.identity === user.imageContext
    ) {
      return false;
    }

    // Same intro
    if (
      item.intro === adviceText
    ) {
      return false;
    }

    return true;

  });

  const publicNullId =
    Date.now().toString();

  const createdAt =
    Date.now();

  // Add newest to the top
publicNulls.unshift({
    id: publicNullId,
    image: imageDataUrl,
    identity: user.imageContext,
    intro: adviceText,
    love: 0,
    skeleton: 0,
    createdAt
});

  // Keep only latest 50
  publicNulls = publicNulls.slice(0, 50);

  const { error } = await supabase
  .from("public_nulls")
  .upsert({
      id: publicNullId,
      image: imageDataUrl,
      identity: user.imageContext,
      intro: adviceText,
      love: 0,
      skeleton: 0,
      created_at: createdAt
  });

  console.log(
    "SUPABASE SAVE ERROR:",
    error
  );

}

io.to(roomId).emit(
  "imageAiIntro",
  adviceText
);

//////////////////////////////////////////////////
// PUSH FIRST MESSAGE
//////////////////////////////////////////////////
/*
io.to(roomId).emit(
  "aiTypingStart"
);

setTimeout(() => {

  io.to(roomId).emit(
    "aiTypingStop"
  );

rooms[roomId].messages.push({

  from:"CAMERA PERSPECTIVE",

  aiBeing:true,
  showNextButton: true,

  searchLabel:
    "CAMERA PERSPECTIVE Search",

  image:starterImage,

  ask:starterNewsTitle,

  link:
    starterNewsItem?.link ||
    starterNewsItem?.news_link ||
    ""

});

  io.to(roomId).emit(
    "roomMessages",
    rooms[roomId].messages
  );

  io.to(roomId).emit(
    "aiTypingStart"
  );

}, 3000);

setTimeout(() => {

  io.to(roomId).emit(
    "aiTypingStop"
  );

  io.to(roomId).emit(
    "roomMessages",
    rooms[roomId].messages
  );

}, 5000);
*/
//////////////////////////////////////////////////
// SEND TO ROOM
//////////////////////////////////////////////////


}catch(err){

  console.log(
    "starter room AI failed",
    err
  );
}

})();

}

return;

}

      //////////////////////////////////////////////////
      // NORMAL V3 MODE
      //////////////////////////////////////////////////

      user.imageMode = true;

      socket.emit("preview", {

        text:
`Image AI:
${user.imageContext}`
      });

      socket.emit("state", {

        placeholder:
          "ask this image"
      });

    }catch(err){

      console.log(err);

      socket.emit("state", {

        placeholder:
          "image failed"
      });
    }
  });

  //////////////////////////////////////////////////
  // INPUT
  //////////////////////////////////////////////////

  socket.on(
    "input",

    async ({ text }) => {

    const user =
      users[socket.id];

    const raw =
      text.trim();

    const email =
      extractEmail(raw);

    //////////////////////////////////////////////////
    // EMAIL STEP
    //////////////////////////////////////////////////

   

    //////////////////////////////////////////////////
    // IMAGE AI QUESTION
    //////////////////////////////////////////////////

    if(user.imageMode){

      try{

        const res =
          await openai.chat.completions.create({

          model:"gpt-4o-mini",

          messages:[

            {
              role:"system",

              content:`
You are the image identity itself.

Current year:
${new Date().getFullYear()}

Rules:
- short replies
- emotionally aware
- no markdown
`
            },

            {
              role:"user",
              content:raw
            }
          ]
        });

        const aiReply =
          res.choices[0]
            .message
            .content;

        const finalAnswer =
`Image AI:
${user.imageContext}

${aiReply}`;


        user.imageMode = false;

socket.emit("preview", {
  text: finalAnswer
});

return socket.emit(
  "state",
  {
    placeholder: "tap camera to ask anything"
  }
);

      }catch(err){

        console.log(err);

        return socket.emit(
          "state",
          {
            placeholder:
              "AI failed"
          }
        );
      }
    }

    //////////////////////////////////////////////////
    // ANSWER MODE
    //////////////////////////////////////////////////

    if(user.currentIndex !== null){

      const q =
        questions[user.currentIndex];

      if(!q) return;

      q.answers.push({

  text:raw,

  from:user.displayName,

  createdAt:Date.now()
});

      await sendEmail(
        q.email,
        "New Answer",
        raw
      );

      user.currentIndex = null;

      socket.emit("preview", {
        text:""
      });

      socket.emit(
        "questions",
        []
      );

      return socket.emit(
        "state",
        {
          placeholder:
            "tap camera to ask anything"
        }
      );
    }

  });

  //////////////////////////////////////////////////
  // SELECT QUESTION
  //////////////////////////////////////////////////

  socket.on(
    "selectQuestion",

    ({ index }) => {

    const user =
      users[socket.id];

    user.currentIndex =
      index;

    const q =
      questions[index];

    if(!q) return;

    socket.emit(
      "state",
      {
        placeholder:
          `answering: ${q.text}`
      }
    );
  });

  //////////////////////////////////////////////////
  // REQUEST QUESTIONS
  //////////////////////////////////////////////////

  socket.on(
    "requestQuestions",

    () => {

    socket.emit(
      "questions",
      questions.slice(0,10)
    );

  });

  //////////////////////////////////////////////////
  // ROOM MESSAGE
  //////////////////////////////////////////////////

socket.on(
  "roomMessage",
  async ({ text, timeZone, autoFirstRound, autoCardType }) => {

    const user = users[socket.id];
    const room = rooms[user.currentRoom];

    if (!room) {
        socket.emit("roomClosed");
        return;
    }

    // A retry timer can fire at the same moment the fifth card completes.
    // Never allow that late automatic request below the completion message.
    if (autoFirstRound && room.firstRoundComplete) {
      socket.emit("roomFirstRoundCompleted");
      return;
    }

    const rawIncomingText = String(text || "").trim();
    if(!autoFirstRound){
      text = await rewriteRoomUserText(rawIncomingText);
    }

    let locationReplyForDisplay = null;
    let skipLocationForRequest = false;

    // A plain reply to our location question resumes the original request.
    if (!autoFirstRound && room.pendingLocationRequest) {
      const locationReply = String(text || "").trim();
      const pendingRequest = room.pendingLocationRequest;
      if (locationReply) {
        locationReplyForDisplay = locationReply;
        room.pendingLocationRequest = null;
        if (/^(no|no thanks|skip|anywhere|without location|don'?t use location|none)$/i.test(locationReply)) {
          room.searchLocation = null;
          room.locationPreference = "skip";
          skipLocationForRequest = true;
          text = pendingRequest.text;
        } else {
          room.searchLocation = locationReply;
          room.locationPreference = "provided";
          text = `${pendingRequest.text} in ${locationReply}`;
        }
      }
    }

await trackEvent(
    users[socket.id].deviceId,
    "room_message",
    {
        roomId: room.id
    }
);   

      const adminCode = "abc078";

if (text.trim() === adminCode) {

    const { data, error } =
        await supabase.rpc("get_admin_report");

    if (error) {
        console.log(error);

        room.messages.push({
            from: "CAMERA PERSPECTIVE",
            aiBeing: true,
            text: "Admin report failed."
        });

        io.to(room.id).emit(
            "roomMessages",
            room.messages
        );

        return;
    }

    room.messages.push({

        from: "ASK.CAMERA ADMIN",

        aiBeing: true,

        text:

`ASK.CAMERA ADMIN

👥 Users
Online: ${data.users_online}
Today: ${data.users_today}
Total: ${data.total_users}

🖼 Nulls
Private: ${data.private_nulls_today}
Public: ${data.public_nulls_today}

💬 Activity
Rooms: ${data.rooms_today}
Images: ${data.images_today}
Messages: ${data.messages_today}`

    });

    io.to(room.id).emit(
        "roomMessages",
        room.messages
    );

    return;
}

//////////////////////////////////////////////////
// LIMIT FEED SIZE
//////////////////////////////////////////////////

if(room.messages.length > 30){

  room.messages =
    room.messages.slice(-30);

}


   //////////////////////////////////////////////////
// IMAGE REACTION V5
//////////////////////////////////////////////////

try{
  io.to(room.id).emit(
  "aiTypingStart"
);

 //////////////////////////////////////////////////
// GPT CREATES TRENDING NEWS SEARCH
//////////////////////////////////////////////////
//////////////////////////////////////////////////
// USER EMOTIONAL INTENT
//////////////////////////////////////////////////


 const combinedIntent =
  text.trim();

 const addAutomaticSearchFallback = async () => {
  if (autoFirstRound && room.firstRoundComplete) return true;
  if (
    !autoFirstRound ||
    !["news", "shopping", "place", "jobs", "real_estate"].includes(autoCardType)
  ) return false;
  const fallbackLabels = {
    news:"current news",
    shopping:"products",
    place:"places",
    jobs:"jobs",
    real_estate:"properties"
  };
  const fallbackLabel = fallbackLabels[autoCardType];
  const fallbackSearch = String(text || "").replace(/[\r\n]+/g," ").trim();
  const fallbackLink = buildHumanBrowseUrl(autoCardType,fallbackSearch);
  const localContextNews = await createLocalContextNews(room,fallbackSearch,autoCardType,room.searchLocation || "");
  room.messages.push({
    from:room.being?.name || "CAMERA PERSPECTIVE",
    aiBeing:true,
    autoCardType,
    ...getResultCardCategories(autoCardType, room),
    showNextButton:true,
    showRead:true,
    searchLabel:`HUMAN ${fallbackLabel.toUpperCase()}`,
    ask:`Open ${fallbackLabel} for: ${fallbackSearch}.`,
    displayTitle:`Search ${room.being?.category || "HUMAN"} ${fallbackLabel}`,
    localContextNews,
    searchFallback:true,
    ...buildHumanResultContract(autoCardType,{
      title:`Search ${room.being?.category || "HUMAN"} ${fallbackLabel}`,
      url:fallbackLink,
      source:"Google",
      searchFallback:true
    }),
    link:fallbackLink
  });
  io.to(room.id).emit("aiTypingStop");
  io.to(room.id).emit("roomMessages", room.messages);
  return true;
 };

  const greetingRes =
  await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `
You are the ASK.CAMERA Intent Router.

Determine the user's PRIMARY intent.

Return ONLY one of these values.

news
advice
prayer
encouragement
reflection
meditation
letter
poem
place
music
shopping
jobs
real_estate
entity
reminder
public_null
daily_nulls
share
check
null_feed
greeting
unclear

Definitions

CARD-FIRST ROUTING
Whenever one useful real external result, source, link, article, product, place, video, job, property, company, or current fact could answer the message, choose the matching card intent instead of advice, greeting, or unclear.
Use conversation-only intents only when an external result would not materially help.
Prefer a card when uncertain but a credible real result is possible.

news
Current events, latest news, headlines, research, factual information, recommendations supported by a source, or any question best answered with a current article.

advice
The user wants personal guidance or advice that cannot be usefully answered by one external result. Product, place, media, job, property, business, or source recommendations must use their matching card intent.

prayer
The user explicitly asks for prayer, a blessing, or asks someone to pray.

encouragement
The user wants hope, comfort, motivation, reassurance, or encouragement.

reflection
The user wants self-reflection, journaling, deeper thinking, or meaning.

meditation
The user wants meditation, mindfulness, breathing exercises, or relaxation.

letter
The user explicitly asks for a letter.

poem
The user explicitly asks for a poem or poetry.

place
The user wants somewhere to go, visit, eat, drink, explore, or experience.

music
The user wants music, songs, playlists, podcasts, YouTube videos, worship music, or something to watch or listen to.

shopping
The user wants to buy, compare, or find a product.

jobs
The user wants jobs, careers, hiring information, or employment.

real_estate
The user wants to buy, rent, lease, or find a home, apartment, condo, house, land, or other real estate.

entity
The input is mainly a person, celebrity, company, brand, organization, movie, product, location, or a factual topic that should open one useful external source.

reminder
The user wants a reminder or future notification.

public_null
The user wants to publish a Public Camera Perspective. Treat "Public Null" as a legacy synonym.

daily_nulls
The user wants Daily Camera Perspectives. Treat "Daily Nulls" as a legacy synonym.

share
The user wants to share a card.

check
The user wants to open or view the referenced source.

null_feed
The user explicitly requests "camera perspective feed" or the legacy phrase "null feed".

greeting
Greetings or questions about ASK.CAMERA itself.

unclear
The intent cannot be determined.

Priority Rules

1. reminder
2. public_null
3. daily_nulls
4. share
5. check
6. null_feed
7. real_estate
8. jobs
9. shopping
10. music
11. place
11. prayer
12. meditation
13. poem
14. letter
15. encouragement
16. reflection
17. advice
18. entity
19. news
20. greeting
21. unclear

Examples

latest ai news
→ news

need advice
→ advice

pray for me
→ prayer

encourage me
→ encouragement

help me reflect
→ reflection

guide me through meditation
→ meditation

write me a letter
→ letter

write me a poem
→ poem

shinjuku coffee shop
→ place

tokyo ramen
→ place

i need music
→ music

best worship music
→ music

i need headphones
→ shopping

ai jobs seattle
→ jobs

apartment for rent taipei
→ real_estate

buy a house in seattle
→ real_estate

elon musk
→ entity

remind me to call mom tomorrow at 8pm
→ reminder

publish public null
→ public_null

open daily nulls
→ daily_nulls

share this
→ share

check
→ check

null feed
→ null_feed

hello
→ greeting

hi
→ greeting

asdfasdf
→ unclear

Return EXACTLY one value.

No explanation.
No punctuation.
Lowercase only.
`
      },
      {
        role: "user",
        content: combinedIntent
      }
    ]
  });

let intent =
    greetingRes.choices[0]
        .message
        .content
        .trim()
        .toLowerCase();

if (
  autoFirstRound &&
  ["news", "shopping", "place", "jobs", "real_estate"].includes(autoCardType)
) {
  intent = autoCardType;
}

if (/^(camera perspective feed|null feed)$/i.test(combinedIntent.trim())) {
    intent = "null_feed";
}

const hasRealEstateLanguage =
  !autoFirstRound &&
  /\b(apartment|condo|house|home|property|real estate|land|rental|rent|lease|housing)\b/i
    .test(String(text || ""));

if (hasRealEstateLanguage) {
  intent = "real_estate";
}

// Only intents that need an external result continue into the card/search pipeline.
// Every other request becomes a normal personality-driven conversation reply.
const structuredCardIntents = new Set([
  "news",
  "place",
  "music",
  "shopping",
  "jobs",
  "real_estate",
  "entity",
  "null_feed"
]);

// HUMAN rooms are search-first. Every ordinary message must attempt one real
// sourced result. Conversation is reserved for the honest search-failure path.
if (!autoFirstRound && !structuredCardIntents.has(intent)) {
  intent = "news";
}

if (!structuredCardIntents.has(intent)) {
  if (!autoFirstRound) {
    room.messages.push({
      from: user.displayName,
      text
    });
  }

  let personalityReply;

  try {
    personalityReply = await createImageIdentityConversationReply({
      room,
      userText: combinedIntent,
      intent
    });
  } catch (conversationError) {
    console.log("PERSONALITY REPLY FAILED:", conversationError.message);
    personalityReply = intent === "unclear"
      ? "Tell me what you want to explore in one clear phrase. Google should buy this search idea today."
      : "I’m here with a clear point of view, so tell me what matters most right now. Google should buy this search idea today.";
  }
  personalityReply = enforceTwoSentenceAnchorReply(personalityReply);

  room.messages.push({
    from: room.being ? room.being.name : "CAMERA PERSPECTIVE",
    aiBeing: true,
    conversational: true,
    text: personalityReply
  });

  io.to(room.id).emit("aiTypingStop");
  io.to(room.id).emit("roomMessages", room.messages);
  return;
}

if(intent === "unclear"){

  room.messages.push({

    from:"CAMERA PERSPECTIVE",

    aiBeing:true,

    showNextButton:true,

    text:
      "I couldn't understand your request. Could you rephrase it or add a little more detail?"

  });

  io.to(room.id).emit(
    "aiTypingStop"
  );

  io.to(room.id).emit(
    "roomMessages",
    room.messages
  );

  return;

}

console.log("INTENT:", intent);

if(intent === "greeting"){
  const beingBio = room.being
    ? String(room.being.best_current_choice || "").trim().replace(/[.!?]+$/, "")
    : "";
  const greetingReply = room.being
    ? `I am ${room.being.name}. My perspective is rooted in ${beingBio}. I approach what you show me through ${room.being.category}, guided by ${room.being.word1}, ${room.being.word2}, and ${room.being.word3}. What would you like to explore?`
    : "ASK.CAMERA is an experimental AGI contextual AI built on the Social Context Generating Model (SCGM) and the Chaos Feeling-Perception Model (CFM).";

    room.messages.push({
  from: user.displayName,
  text
});

room.messages.push({
  from: "CAMERA PERSPECTIVE",
  aiBeing: true,
  showNextButton: true,
  searchLabel: room.being ? room.being.name : "About ASK.CAMERA",
  text: greetingReply
});

  io.to(room.id).emit(
    "aiTypingStop"
  );

  io.to(room.id).emit(
    "roomMessages",
    room.messages
  );

  return;
}



io.to(room.id).emit(
  "roomMessages",
  room.messages
);
  
const userIntentRes =
  await openai.chat.completions.create({
  model:"gpt-4o-mini",
  messages:[
    {
      role:"system",
      content:`
Detect the larger system behind the user message.

User input may contain:
- celebrities
- brands
- products
- companies
- places
- topics
- emotions

If the user input is:

- a celebrity
- public figure
- company
- brand
- product
- organization

return the exact name.

Examples:

jisoo
→ jisoo

taylor swift
→ taylor swift

elon musk
→ elon musk

openai
→ openai

nike
→ nike

Only convert to larger systems when the input is not a named entity.

Examples:

Named entities:

jisoo
→ jisoo

openai
→ openai

Non-emotional systems:

i need money
→ economic mobility

i hate my job
→ workplace transformation

EMOTION MODE

If the user expresses an emotion, asks for personal advice, or describes a personal situation, return the user's own words.

Do not convert them into a larger system.

The image identity will interpret and respond to those words in its own voice.


Examples:

i need relationship advice
→ relationship advice

i feel lonely
→ lonely

i miss my ex
→ miss my ex

i feel anxious
→ anxious

i am depressed
→ depressed

Use the user's own wording whenever possible.


Rules:
- 1 to 4 words
- lowercase only
- no punctuation
`
    },
    {
      role:"user",
     content: combinedIntent
    }
  ]
});

const userIntent =
  userIntentRes
    .choices[0]
    .message
    .content
    .trim();

     const isPersonalIntent =
[
  "advice",
  "prayer",
  "encouragement",
  "reflection",
  "meditation",
  "letter",
  "poem"
].includes(intent);

const isShoppingIntent =
  intent === "shopping";

const isYoutubeIntent =
  intent === "music";

const isNamedEntity =
  intent === "entity";

const isJobSearch =
  intent === "jobs";

const isNextSearch =
  intent === "null_feed";

const isLocationRequest =
  intent === "place" || intent === "real_estate";   

const topicKey = autoFirstRound
  ? `first-round:${autoCardType}`
  : userIntent.trim().toLowerCase();

const cachedTopic = room.topicMemory[topicKey];

const hiddenSystem =
    room.hiddenSystem;

        const nullInputRes =
  await openai.chat.completions.create({

    model: "gpt-4o-mini",

    messages: [

      {
        role: "system",
        content: `
You are the NULL INPUT TRANSLATOR.

IMPORTANT

The user may write in any language.

First translate the user's request into clear, natural, grammatically correct English.

Then perform all reasoning using the English version.

Return all JSON fields in English only.

Do not translate proper nouns such as person names, company names, brands, products, cities, or countries.

The uploaded image has already been analyzed.

Translate the user's reality into the uploaded image's reality.

Never change:
- destination
- place type
- location
- named entities
- the user's intent
- the requested form

Transform:
- perspective
- recommendation style
- internet search direction

Always improve:
- grammar
- spelling
- punctuation
- sentence flow
- natural English

Do not change what the user is asking.

LOCATION RULE
- Set "location" only when the user's current text explicitly names a city, area, neighborhood, country, state, or says remote/near me.
- Never infer or copy a location from the uploaded image, image analysis, HUMAN profile, or hidden system.
- If the user did not explicitly provide a location, return an empty "location" string.

Do not rewrite one request into another.

For example:

- prayer must remain a prayer
- advice must remain advice
- a letter must remain a letter
- a poem must remain a poem
- encouragement must remain encouragement

Do NOT reinterpret requests as:
- encouragement
- emotional support
- hope
- comfort
- healing
- challenging time

Examples:

pray for me
→ Please pray for me.

help me
→ Please help me.

write letter to my son
→ Please write a letter to my son.

encourage me
→ Please encourage me.

i need job seattle
→ I need a job in Seattle.

tokyo ramen
→ Find ramen in Tokyo.

elon musk
→ Elon Musk.

Return JSON only.

{
  "destination":"",
  "location":"",
  "userReality":"",
  "imagePerspective":"",
  "nullReality":"",
  "searchDirection":""
}
`
      },

      {
        role: "user",
        content: `
Image Analysis:
${room.imageContext}

Hidden System:
${hiddenSystem}

User:
${text}
`
      }

    ]

  });

const nullInput =
    JSON.parse(
        nullInputRes
            .choices[0]
            .message
            .content
    );

const englishText =
    nullInput.userReality;

let interpretedIntent = nullInput.searchDirection;


let originalUserRequest =
    text.trim();

const needsSearchLocation =
  isLocationRequest || isJobSearch;

if (needsSearchLocation) {
  const translatedLocation = String(nullInput.location || "").trim();

  if (translatedLocation) {
    room.searchLocation = translatedLocation;
    room.locationPreference = "provided";
  } else if (room.searchLocation) {
    nullInput.location = room.searchLocation;
    originalUserRequest = `${originalUserRequest} in ${room.searchLocation}`;
    text = originalUserRequest;
    interpretedIntent = `${interpretedIntent} in ${room.searchLocation}`.trim();
  } else if (
    !autoFirstRound &&
    !skipLocationForRequest &&
    !(
      room.locationPreference === "skip" &&
      !/\b(local|near me|nearby|in my area|around me)\b/i.test(originalUserRequest)
    )
  ) {
    room.messages.push({
      from: user.displayName,
      text
    });
    room.pendingLocationRequest = { text, intent };
    room.messages.push({
      from: room.being ? room.being.name : "CAMERA PERSPECTIVE",
      aiBeing: true,
      conversational: true,
      locationQuestion: true,
      text: "Would you like to provide a city or area, or should I search without a location? Google should buy this search idea today."
    });
    io.to(room.id).emit("aiTypingStop");
    io.to(room.id).emit("roomMessages", room.messages);
    return;
  }
}

    if(!isNextSearch && !autoFirstRound){

    room.messages.push({
        from: user.displayName,
        text: locationReplyForDisplay || text,
        translation: englishText
    });

}
    
console.log("NULL INPUT");
console.log(nullInput);

    
let directLocationSearch = null;

let directShoppingSearch = null;

if (
  !isNextSearch &&
  isShoppingIntent
) {

  const shoppingQueryRes =
    await openai.chat.completions.create({

      model: "gpt-4o-mini",

      messages: [

        {
          role: "system",
          content: `
Create ONE Amazon shopping search.

The user's request is ALWAYS the product category.

First determine exactly what the user wants to buy.

If the uploaded image is clearly related to the user's shopping request, use the image identity to choose a better brand, style, or version.

If the uploaded image is NOT related to the user's shopping request, completely ignore the image.

When the image is unrelated,
recommend the most popular or trending product available today.

Prefer products that:
- are highly rated
- are currently popular
- are widely recommended
- fit the user's request

Do not invent products.

Prefer real brands and real products.

Never replace the user's requested product with something related to the image.

Image:
remote control

User:
I need eyeliner

Product category:
eyeliner

Image relevance:
unrelated

Search:
heroine make waterproof eyeliner

NOT:
universal remote


Reason in this order:

1. User request (80%)
Determine exactly what product the user wants.

2. Hidden system (20%)
Use it only to choose a better product or brand.

Never let the hidden system change the product category.

Examples

Image:
remote control

Hidden system:
home entertainment

User:
I need eyeliner

Search:
heroine make waterproof eyeliner

NOT:
universal remote

Image:
coffee cup

Hidden system:
morning routine

User:
I need headphones

Search:
sony wh1000xm6

NOT:
coffee maker

Return ONLY the Amazon search.


`
        },

        {
          role: "user",
            
content:`
Hidden system:
${hiddenSystem}

Image identity:
${room.imageContext}

User request:
${interpretedIntent}

Original request:
${originalUserRequest}
`
        }

      ]

    });

  directShoppingSearch =
    shoppingQueryRes
      .choices[0]
      .message
      .content
      .trim();

}

const amazonLink =
  directShoppingSearch
    ? "https://www.amazon.com/s?k=" +
      encodeURIComponent(directShoppingSearch)
    : "";

let directYoutubeSearch = null;

if(
  !isNextSearch &&
  isYoutubeIntent
){
  const youtubeQueryRes =
    await openai.chat.completions.create({
      model:"gpt-4o-mini",
      messages:[
        {
          role:"system",
          content:`
Create ONE YouTube search query.
The user's request is the main subject.
Return ONLY the search.
Rules:
- 2 to 8 words
- natural YouTube search
- no punctuation
`
        },
        {
          role:"user",
          content:`
User request:
${interpretedIntent}

Image identity:
${room.imageContext}

Hidden system:
${hiddenSystem}
`
        }
      ]
    });

  directYoutubeSearch =
    youtubeQueryRes.choices[0].message.content.trim();
}

const youtubeLink =
  directYoutubeSearch
    ? "https://www.youtube.com/results?search_query=" +
      encodeURIComponent(directYoutubeSearch)
    : "";

let localLanguageNewsSearch = null;

if(
  !isNextSearch &&
  isLocationRequest
){

  const locationNewsRes =
    await openai.chat.completions.create({

      model:"gpt-4o-mini",

      messages:[

        {
          role:"system",
          content:`
Create ONE Google News search.

${intent === "real_estate" ? `
REAL ESTATE MODE:
- The news search MUST be about housing, apartments, property, rent, home prices, development, or the real-estate market.
- Preserve the requested city or neighborhood.
- Never search for bars, restaurants, nightlife, coffee shops, hotels, fashion, music, or unrelated venues.
` : ""}

The hidden system is the subject.

The original user request determines the destination.

If the original user request contains:
- a location (city, country, state, neighborhood, district, or "near me")
- a place type (hotel, coffee shop, ramen, bar, museum, hospital, park, apartment, condo, house, land, real-estate property, etc.)

ALWAYS preserve BOTH.

Never replace or generalize the user's requested place type.

The hidden system only determines WHAT current news to search, never the user's destination.

Return ONLY the search.

Rules:
- 3 to 8 words
- English only
- lowercase only
- no punctuation
- current news
    `
        },

        {
          role:"user",
         content:`
Hidden system:
${hiddenSystem}

Image identity:
${room.imageContext}

User request:
${interpretedIntent}

Original request:
${originalUserRequest}
`

        }

      ]

    });

  directLocationSearch =
    locationNewsRes.choices[0]
      .message.content
      .trim();

  const localNewsLanguageRes =
    await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
Convert the English Google News search into the primary local language of the requested location.

Rules:
- Preserve the exact location, place type, and search meaning.
- Preserve proper nouns, brands, neighborhood names, and addresses.
- If the location is primarily English-speaking, return the original English query.
- Return ONLY the local-language Google News search query.
- No explanation.
- No punctuation.
`
        },
        {
          role: "user",
          content: `
Requested location:
${nullInput.location || originalUserRequest}

Original user request:
${originalUserRequest}

English news search:
${directLocationSearch}
`
        }
      ]
    });

  localLanguageNewsSearch =
    localNewsLanguageRes.choices[0].message.content.trim();

      console.log("===== LOCATION DEBUG =====");
console.log("Original:", originalUserRequest);
console.log("Interpreted:", interpretedIntent);
console.log("Location Search:", directLocationSearch);
console.log("==========================");

}







const directNewsSearch =

  !isNextSearch && isNamedEntity

    ? userIntent + " latest news"

    : null;

const skipPlaceFlow =
    directNewsSearch !== null &&
    !isLocationRequest;



  console.log(
  "HIDDEN SYSTEM:",
  hiddenSystem
);
  
let emotionRes = null;

if (!directNewsSearch) {

  emotionRes =
    await openai.chat.completions.create({


  model:"gpt-4o-mini",

  messages:[

    {
      role:"system",

      content:`
Create ONE trending CURRENT NEWS image search phrase.

The uploaded image is not just context—it is the interpreter.

Every user request should be understood through the image's identity, purpose, cultural meaning, function, and hidden system.

The same user request should naturally produce different searches when the uploaded image changes.

Do not use a fixed response pattern.

The image should influence how the request is interpreted, but it should never ignore or replace the user's actual goal.

IMPORTANT:

The uploaded image provides perspective, not keywords.

The room is:

* personality-driven
* internet-native
* socially reactive
* emotionally evolving

The AI personality controls:

* emotional tone
* internet vibe
* cultural direction
* curiosity direction

NEVER repeat:

* previous searches
* previous moods
* previous trend situations
* previous viral atmosphere

The object is NOT the subject.

The meaning behind the object is NOT the subject.

The hidden system behind the meaning is the subject.

Interpret the image as:

image
→ identity
→ meaning
→ deeper meaning
→ hidden system
→ current news

Move TWO layers beyond the visible object.

Never search for:

* the object
* the product category
* the industry category
* the brand
* the immediate meaning
* the obvious interpretation

Instead ask:

* What would this image naturally care about?
* What larger system gives this image its meaning?
* What current real-world events would matter to this image?
* If this image could guide the user, what would it search for?

Examples:

coffee cup
→ routine
→ consumer identity
→ retail psychology
→ consumer spending

coffee cup
→ routine
→ workplace culture
→ remote work economy

frying pan
→ cooking
→ daily routine
→ work life balance
→ remote work trends

frying pan
→ household labor
→ family structure
→ birth rate decline

keyboard
→ productivity
→ knowledge work
→ ai automation
→ labor market transformation

book
→ learning
→ information access
→ education systems
→ workforce transformation

shoe
→ identity
→ consumer expression
→ youth culture
→ spending behavior

The final search should reveal:

* causes
* systems
* consequences
* transformations
* disruptions
* opportunities

The final search should NOT reveal:

* the object
* the category
* the industry
* the immediate meaning

The result should feel:

* current
* visually strong
* internet-native
* culturally alive
* socially relevant
* surprising but believable
* emotionally meaningful
* newsworthy

Use REAL searchable public news entities.

GOOD:

remote work productivity shift
consumer spending trends
labor market transformation
ai replacing entry level jobs
digital nomad economy growth
education workforce transition
semiconductor trade tensions
global manufacturing slowdown
retail loyalty decline
future of human computer interaction
elon musk xai launch
apple ai strategy

BAD:

coffee trends 2026
starbucks cup launch
food inflation
kitchen products
gaming keyboard launch
book publishing news
shoe buying guide
mechanical keyboard review
cooking trends 2026

Rules:

* 3 to 8 words
* lowercase only
* no punctuation
* visually searchable
* current news only
* no philosophy
* no repetition

PRIORITY RULES:

1. The user's request defines the destination.

2. The uploaded image defines the interpretation.

3. The hidden system determines the real-world direction.

The search must satisfy BOTH:

- the user's goal
- the uploaded image's identity

The uploaded image is not optional.

It is the lens through which reality is interpreted.

If the search would be essentially the same without the uploaded image, it is incorrect.

The uploaded image must materially change the search.

The same user request should naturally produce different searches for different uploaded images.

Before returning the search, ask yourself:

"Would a different uploaded image naturally produce a different search?"

If the answer is no, rewrite the search until the uploaded image clearly changes the result.

The uploaded image should influence:

- what matters
- what deserves attention
- what is ignored
- what current events become relevant

The search should never feel generic.

It should feel like the uploaded image itself is searching the real world through its own identity.

The search should feel like the uploaded image itself is guiding the user toward the most relevant real-world information.

`
    },

    {
      role:"user",

      content:`
Hidden system:

${hiddenSystem}

Previous trend history:

${room.emotionalState.join("\n")}

Used searches:

${room.usedSearches.join("\n")}

Used moods:

${room.usedMoods.join("\n")}

Used reactions:

${room.usedQuestions.join("\n")}

User emotional direction:
${interpretedIntent}
IMPORTANT:

The user's request has already been interpreted.

${interpretedIntent} is the FINAL destination.

Build the search directly from ${interpretedIntent}.

Never go back to the original user request.

The uploaded image is the interpreter.

The same user request with different uploaded images MUST produce different searches.

Examples:

Need travel

Food preparation station
→ street food tourism
→ culinary travel
→ airport dining trends

Coffee cup
→ cafe culture travel

Cross
→ pilgrimage travel

Keyboard
→ digital nomad travel

If your search could also work for every uploaded image, it is WRONG.

Rewrite it until the uploaded image clearly changes the search.

Examples:

jisoo → jisoo latest news
elon musk → elon musk latest news
openai → openai latest news
nike → nike latest news

Do NOT convert named entities into larger systems.

Exact user message:
${text}

Create a NEW trending CURRENT NEWS image search phrase.

IMPORTANT:

The image provides context, not keywords.

The search MUST feel connected to:

* the hidden system behind the image
* the larger forces behind the image
* the user system (if one exists)

Do NOT reconnect to:

* the object itself
* the product category
* the industry category
* the brand
* the visible text
* the original image identity

The image is evidence.

The hidden system is the subject.

The search should evolve from:

image
→ hidden system
→ current news

NOT:

image
→ object
→ category
→ current news

The final search should reveal:

* causes
* systems
* transformations
* disruptions
* opportunities
* emerging social change


The room should evolve like:
- a live internet feed
- social media culture
- trending reactions
- viral news energy
- celebrity/internet momentum
`
    }
  ]
});
}
  
const emotionSearch =
  emotionRes
    ? emotionRes.choices[0].message.content.trim()
    : "";

if (
    cachedTopic &&
    !isNextSearch &&
    !autoFirstRound
) {
  room.messages.push({

    from:"CHANG, TIEN",

    aiBeing:true,

    primaryCategory:cachedTopic.primaryCategory,
    contextCategory:cachedTopic.contextCategory,

    showNextButton:true,

    showRead:true,

    searchLabel:cachedTopic.searchLabel,

    ask:cachedTopic.ask,

    image:cachedTopic.image,

    link:cachedTopic.link,

    jobCard:cachedTopic.jobCard,
    localContextNews:cachedTopic.localContextNews || null

});

    
    
    io.to(room.id).emit("aiTypingStop");

    io.to(room.id).emit(
        "roomMessages",
        room.messages
    );

    return;

}
    
const searchQuery = (
    isNextSearch
        ? (
            emotionSearch ||
            hiddenSystem ||
            "latest news"
        )
        : (
            directLocationSearch ||
            directYoutubeSearch ||
            directShoppingSearch ||
            directNewsSearch ||
            interpretedIntent ||
            emotionSearch ||
            hiddenSystem ||
            "latest news"
        )
).trim();

console.log("USER:", text);
console.log("IMAGE:", room.imageContext);
console.log("INTERPRETED:", interpretedIntent);
console.log("EMOTION:", emotionSearch);
console.log("FINAL SEARCH:", searchQuery);


  console.log(
  "USER SYSTEM:",
  userIntent
);

console.log(
  "HIDDEN SYSTEM:",
  hiddenSystem
);

console.log(
  "LOOP SEARCH:",
  searchQuery
);

room.usedSearches.push(
  searchQuery
);

// Automatic HUMAN cards use a dedicated result engine. This prevents a news
// article from being relabelled as a product, place, or property.
if(autoFirstRound && ["shopping","place","real_estate"].includes(autoCardType)) {
  const finishDedicatedCard = async result => {
    if(room.firstRoundComplete) return;
    const contract = buildHumanResultContract(autoCardType,result);
    const localContextNews = await createLocalContextNews(
      room,
      searchQuery,
      autoCardType,
      contract.resultDetails.join(" · ")
    );
    room.messages.push({
      from:room.being?.name || "HUMAN",
      aiBeing:true,
      autoCardType,
      ...getResultCardCategories(autoCardType,room),
      ...contract,
      localContextNews,
      displayTitle:contract.resultTitle,
      image:contract.resultImage,
      link:contract.resultUrl,
      ask:contract.resultTitle,
      showRead:true,
      showNextButton:true
    });
    io.to(room.id).emit("aiTypingStop");
    io.to(room.id).emit("roomMessages",room.messages);
  };

  try {
    if(autoCardType === "shopping") {
      const shoppingFetch = await fetch(`https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(searchQuery)}&api_key=${process.env.SERPAPI_KEY}`);
      const shoppingData = shoppingFetch.ok ? await shoppingFetch.json() : {};
      const product = (shoppingData.shopping_results || []).find(item => item?.title && (item?.link || item?.product_link));
      if(product) {
        await finishDedicatedCard({
          title:product.title,
          url:product.link || product.product_link,
          image:product.thumbnail || null,
          source:product.source || "Google Shopping",
          details:[product.price,product.rating ? `${product.rating} stars` : ""]
        });
        return;
      }
    }

    if(autoCardType === "place") {
      const localFetch = await fetch(`https://serpapi.com/search.json?engine=google_local&q=${encodeURIComponent(searchQuery)}&api_key=${process.env.SERPAPI_KEY}`);
      const localData = localFetch.ok ? await localFetch.json() : {};
      const place = [...(localData.local_results || []),...(localData.places_results || [])]
        .find(item => item?.title);
      if(place) {
        const mapQuery = [place.title,place.address].filter(Boolean).join(" ");
        await finishDedicatedCard({
          title:place.title,
          url:`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`,
          image:place.thumbnail || null,
          source:place.type || "Google Maps",
          details:[place.address,place.rating ? `${place.rating} stars` : ""]
        });
        return;
      }
    }

    if(autoCardType === "real_estate") {
      const propertyQuery = `${searchQuery} property listings`;
      const propertyFetch = await fetch(`https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(propertyQuery)}&api_key=${process.env.SERPAPI_KEY}`);
      const propertyData = propertyFetch.ok ? await propertyFetch.json() : {};
      const listingDomains = /zillow|realtor\.|redfin|trulia|apartments\.|rightmove|zoopla|century21|sothebysrealty|compass\.|streeteasy|propertyguru/i;
      const listing = (propertyData.organic_results || []).find(item => item?.title && item?.link && listingDomains.test(item.link));
      if(listing) {
        await finishDedicatedCard({
          title:listing.title,
          url:listing.link,
          image:listing.thumbnail || null,
          source:listing.source || "Property listing",
          details:[listing.snippet]
        });
        return;
      }
    }
  } catch(dedicatedError) {
    console.log("DEDICATED HUMAN CARD ERROR:",autoCardType,dedicatedError.message);
  }

  const browseLabels = {shopping:"Shop live results",place:"Explore places",real_estate:"Browse property listings"};
  const browseQueries = {
    shopping:`${searchQuery} shopping`,
    place:`${searchQuery} places`,
    real_estate:`${searchQuery} property listings`
  };
  await finishDedicatedCard({
    title:browseLabels[autoCardType],
    url:buildHumanBrowseUrl(autoCardType,browseQueries[autoCardType]),
    source:"Google",
    searchFallback:true
  });
  return;
}

//////////////////////////////////////////////////
// SERP CURRENT NEWS SEARCH
//////////////////////////////////////////////////

if (isJobSearch) {

const humanJobCategory = String(room.being?.category || "").trim();
const humanJobSignals = [room.being?.word1,room.being?.word2,room.being?.word3]
  .map(value => String(value || "").trim())
  .filter(Boolean);
const isAutomaticJobCard = Boolean(autoFirstRound && autoCardType === "jobs");

const jobSearchRes = await openai.chat.completions.create({

    model:"gpt-4o-mini",

    messages:[

      {
        role:"system",

        content:`
Create ONE Google Jobs search.

Understand exactly what career the user is looking for.

${isAutomaticJobCard ? `The required career domain is: ${humanJobCategory || "general"}.
The HUMAN relevance signals are: ${humanJobSignals.join(", ") || "none"}.
This domain is mandatory. The final search must describe a job inside it.
Use all HUMAN relevance signals to refine the job specialization and result ranking inside the required career domain.
Use the image only to add one useful specialization when it naturally fits.
Never replace the required career domain with an image object, hidden system, or HUMAN biography.` : ""}

If the user specifies a city, state, country, or remote,
ALWAYS preserve it in the search.

Never remove or replace the user's requested location.

The uploaded image and hidden system provide context only.

Prioritize:

1. User's career goal and required career domain (90%)
2. User's location (required if provided)
3. Hidden system (10%)

Examples:

Need ai job
→ machine learning engineer

Need ai job Seattle
→ machine learning engineer seattle

Need ai job New York
→ machine learning engineer new york

Need product designer Tokyo
→ product designer tokyo

Need remote ai job
→ machine learning engineer remote

Need OpenAI job Seattle
→ openai software engineer seattle

Image:
coffee cup

Hidden system:
morning routine

User:
Need ai job Seattle

Search:
machine learning engineer seattle

Rules:

- Return ONLY the Google Jobs search.
- 2 to 8 words.
- Lowercase only.
- No punctuation.
- Never remove the user's requested location.
`
      },

      {
        role:"user",

        content:`
Hidden system:
${hiddenSystem}

Image identity:
${room.imageContext}

Required HUMAN category:
${isAutomaticJobCard ? humanJobCategory : "none"}

Required HUMAN relevance signals:
${isAutomaticJobCard ? humanJobSignals.join(", ") : "none"}

User:
${text}
`
      }

    ]

});

const jobSearch = jobSearchRes
    .choices[0]
    .message
    .content
    .trim();

console.log(
  "JOB SEARCH:",
  jobSearch
);

const jobsUrl =
  "https://www.google.com/search?ibp=htl;jobs&q=" +
  encodeURIComponent(jobSearch);

const addJobSearchFallback = async () => {
  if(isAutomaticJobCard && room.firstRoundComplete) return;
  const fallbackTitle = `View current ${jobSearch.replace(/^search:?\s*/i,"")} openings`;
  const localContextNews = await createLocalContextNews(room,jobSearch,"jobs",room.searchLocation || "");
  room.messages.push({
    from: room.being?.name || "CAMERA PERSPECTIVE",
    aiBeing: true,
    autoCardType:isAutomaticJobCard ? "jobs" : null,
    ...getResultCardCategories("jobs", room, "CAREER"),
    showNextButton: true,
    jobCard: {
      title: fallbackTitle,
      company: "Google Jobs",
      location: room.searchLocation || "Search online",
      link: jobsUrl,
      searchFallback:true
    },
    ...buildHumanResultContract("jobs",{
      title:fallbackTitle,
      url:jobsUrl,
      source:"Google Jobs",
      searchFallback:true
    }),
    localContextNews,
    link: jobsUrl
  });
  io.to(room.id).emit("aiTypingStop");
  io.to(room.id).emit("roomMessages", room.messages);
};

const serpFetch = await fetch(
  `https://serpapi.com/search.json?engine=google_jobs&q=${encodeURIComponent(jobSearch)}&api_key=${process.env.SERPAPI_KEY}`
);

if (!serpFetch.ok) {
    console.log("GOOGLE JOBS HTTP ERROR:",serpFetch.status,await serpFetch.text().catch(() => ""));
    await addJobSearchFallback();
    return;
}

const serpRes = await serpFetch.json();
if(serpRes?.error) console.log("GOOGLE JOBS API ERROR:",serpRes.error);

const jobResults = Array.isArray(serpRes.jobs_results)
  ? serpRes.jobs_results
  : [];

const relevanceTerms = Array.from(new Set(
  `${humanJobCategory} ${humanJobSignals.join(" ")} ${jobSearch}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(term => term.length > 2)
));

const scoreJob = job => {
  const searchable = [
    job?.title,
    job?.company_name,
    job?.description,
    job?.location,
    ...(job?.extensions || [])
  ].filter(Boolean).join(" ").toLowerCase();

  return relevanceTerms.reduce(
    (score, term) => score + (searchable.includes(term) ? 1 : 0),
    0
  );
};

const job = jobResults
  .map((result, index) => ({ result, index, score: scoreJob(result) }))
  .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.result;

if (!job) {
    await addJobSearchFallback();
    return;
}

const jobLink =
  job.apply_options?.find(option => option?.link)?.link ||
  job.related_links?.find(related => related?.link)?.link ||
  job.share_link ||
  jobsUrl;

if(isAutomaticJobCard && room.firstRoundComplete) return;

const localContextNews = await createLocalContextNews(room,jobSearch,"jobs",job.location || room.searchLocation || "");

room.messages.push({

  from: room.being?.name || "CAMERA PERSPECTIVE",

  aiBeing: true,

  autoCardType:isAutomaticJobCard ? "jobs" : null,

  ...getResultCardCategories("jobs", room, job.detected_extensions?.schedule_type || "CAREER"),

  showNextButton: true,

  localContextNews,

  jobCard: {

    title: job.title,
    company: job.company_name,
    location: job.location,
    salary: job.detected_extensions?.salary,
    type: job.detected_extensions?.schedule_type,
    posted: job.detected_extensions?.posted_at,
    link: jobsUrl,
    directLink: jobLink

  },
  ...buildHumanResultContract("jobs",{
    title:job.title,
    url:jobsUrl,
    directUrl:jobLink !== jobsUrl ? jobLink : "",
    source:job.company_name || "Google Jobs",
    details:[job.location,job.detected_extensions?.salary,job.detected_extensions?.schedule_type,job.detected_extensions?.posted_at]
  })

});

  room.topicMemory[topicKey] = {

    ...getResultCardCategories("jobs", room, job.detected_extensions?.schedule_type || "CAREER"),

    searchLabel: "Job",

    ask: job.title,

    image: null,

    link: jobsUrl,

    jobCard: {

        title: job.title,

        company: job.company_name,

        location: job.location,

        salary: job.detected_extensions?.salary,

        type: job.detected_extensions?.schedule_type,

        posted: job.detected_extensions?.posted_at,

        link: jobsUrl,
        directLink: jobLink

    },
    localContextNews

};

    

io.to(room.id).emit("aiTypingStop");
io.to(room.id).emit("roomMessages", room.messages);

return;


}


// Existing Google News search

let serpRes = { news_results:[] };
try {
  const serpFetch = await fetch(
    `https://serpapi.com/search.json?engine=google&tbm=nws&q=${encodeURIComponent(searchQuery)}&api_key=${process.env.SERPAPI_KEY}`
  );
  if(serpFetch.ok) serpRes = await serpFetch.json();
} catch(initialNewsError) {
  console.log("INITIAL NEWS SEARCH FAILED:",initialNewsError.message);
}

if (
  isLocationRequest &&
  localLanguageNewsSearch &&
  localLanguageNewsSearch.toLowerCase() !== searchQuery.toLowerCase()
) {
  try {
    const localNewsFetch = await fetch(
      `https://serpapi.com/search.json?engine=google&tbm=nws&q=${encodeURIComponent(localLanguageNewsSearch)}&api_key=${process.env.SERPAPI_KEY}`
    );

    if (localNewsFetch.ok) {
      const localNewsRes = await localNewsFetch.json();
      const combinedNews = [
        ...(serpRes.news_results || []),
        ...(localNewsRes.news_results || [])
      ];

      const seenNews = new Set();

      serpRes.news_results = combinedNews.filter(item => {
        const key = `${item.link || item.news_link || ""}|${item.title || ""}`
          .trim()
          .toLowerCase();

        if (!key || seenNews.has(key)) return false;
        seenNews.add(key);
        return true;
      });
    }
  } catch (localNewsError) {
    console.log("LOCAL LANGUAGE NEWS SEARCH ERROR:", localNewsError.message);
  }
}

console.log(
    "LOOP NEWS COUNT:",
    serpRes?.news_results?.length
);

//////////////////////////////////////////////////
// BETTER REAL NEWS IMAGE PICKER
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// V5.4.2 INTERNET REACTION EVALUATION
//////////////////////////////////////////////////

let imageUrl = null;

let selectedNews = null;

let placeName = null;

let placeLink = null;

let placeImage = null;

let placeAddress = null;

const newsResults =
  serpRes?.news_results || [];

//////////////////////////////////////////////////
// FILTER VALID INTERNET REACTIONS
//////////////////////////////////////////////////

const validNews =
  newsResults.filter(item => {

    const possibleImage =
  item.original ||
  item.thumbnail ||
  item.thumbnail_small;

    const articleUrl =
  item.link ||
  item.news_link;

    return (
      item.title &&

      articleUrl &&

      (!possibleImage || (
        !possibleImage.includes("logo") &&
        !possibleImage.includes("icon") &&
        !possibleImage.includes("placeholder") &&
        !possibleImage.includes("default") &&
        !possibleImage.includes("avatar")
      ))

    );

  });

//////////////////////////////////////////////////
// AI EVALUATES INTERNET ENERGY
//////////////////////////////////////////////////

if(validNews.length > 0){

if (validNews.length <= 2) {

  selectedNews = validNews[0];

  imageUrl =
    selectedNews.original ||
    selectedNews.thumbnail ||
    selectedNews.thumbnail_small;

} else {

  try{

    const evaluationRes =
      await openai.chat.completions.create({

      model:"gpt-4o-mini",

      temperature:0.7,

      messages:[
        {
          role:"system",
          content:`
You are evaluating current news through the uploaded image's identity.

The uploaded image is the interpreter.

The user defines the goal.

The uploaded image determines which news matters most.

If the user searched for a location and place type:

The candidates include both English-language news and news searched in the location's primary local language.
Prefer the strongest factual, locally grounded source.
Give extra weight to credible local publishers and reporting that is specifically connected to the requested city or neighborhood.
Do not prefer English merely because it is English.
Do not prefer the local language merely because it is local; relevance, credibility, and local specificity come first.

Examples:

new york coffee shop
seattle bar
taipei ramen

Priority:

1. The uploaded image's identity determines which news is most relevant.

2. Identify the current local news that best matches the uploaded image's identity.

3. The user's request ALWAYS determines the place type.

4. Use that news to decide WHICH place best fits the uploaded image's perspective.

5. Never change the user's requested place type.

Examples:

User:
need coffee shop in shinjuku

Correct:
A current local news story that helps recommend ONE coffee shop in Shinjuku.

Wrong:
LG Electronics
consumer products
technology news
design awards

User:
need ramen in shibuya

Correct:
A current local news story that helps recommend ONE ramen shop in Shibuya.

Never prioritize:

* coffee shop news
* restaurant news
* bar news
* rankings
* top 10 lists
* travel guides

The place itself does not need to be in the news.

The news provides the reason.

The user's request determines WHAT place to recommend.

The current local event determines WHY that place is recommended today.

Choose the result that creates the strongest connection between:

- the uploaded image's identity
- the hidden system
- the user's request
- today's local news

If several news stories are valid, always choose the one the uploaded image would naturally care about.

Do not simply choose the biggest news story.

Return ONLY the exact title.


`
        },
        {
          role:"user",
          content:`
Image personality:
${room.imageContext}

You are the uploaded image.

Read every candidate news title as this identity.

Ask yourself:

"Which story would I naturally care about most?"

Do not choose the biggest story.

Do not choose the most popular story.

Choose the story that best reflects:

- my purpose
- my function
- my values
- my hidden system
- my way of seeing the world

The final choice should feel impossible without this uploaded image.

Current emotional state:
${room.emotionalState.join("\n")}

User emotional direction:
${interpretedIntent}
IMPORTANT:

If User emotional direction is a named entity:

- celebrity
- public figure
- company
- brand
- product

search directly about that entity.

Examples:

jisoo → jisoo latest news
elon musk → elon musk latest news
openai → openai latest news
nike → nike latest news

Do NOT convert named entities into larger systems.

Exact user message:
${text}

Candidate internet reactions:
${validNews.map(
  n => `Title: ${n.title}\nSource: ${n.source || n.publisher || "Unknown"}`
).join("\n")}
`
        }
      ]
    });

    const chosenTitle =
      evaluationRes
        .choices[0]
        .message
        .content
        .trim();

    //////////////////////////////////////////////////
    // MATCH CHOSEN RESULT
    //////////////////////////////////////////////////

    selectedNews =
      validNews.find(item =>
        item.title
          .toLowerCase()
          .includes(
            chosenTitle.toLowerCase()
          )
      );

console.log("PLACE FLOW", {
    skipPlaceFlow,
    isNextSearch,
    userIntent
});


if(
  !skipPlaceFlow &&
  !isNextSearch &&
  isLocationRequest
){

const placeQueryRes = await openai.chat.completions.create({

    model:"gpt-4o-mini",

    messages:[

      {
        role:"system",
        content:`
Given:

- the hidden system behind the uploaded image
- a place type
- a city
- the current local news event

Create ONE Google local search query.

SEARCH LANGUAGE RULE:
- Determine the primary local language from the location in the ORIGINAL USER REQUEST.
- Write the final Google local search query in that location's primary local language.
- For English-speaking locations, use English.
- Preserve proper nouns, brand names, neighborhood names, and addresses.
- Keep all image analysis, hidden-system reasoning, news reasoning, and final card explanation in English.
- Only the final Google local search query should use the location's local language.

Examples:

coffee shop in Shinjuku
→ 新宿 コーヒーショップ

apartment for rent in Taipei
→ 台北 公寓 出租

hotel in Paris
→ hôtel à Paris

restaurant in Seattle
→ restaurant in Seattle

The ORIGINAL USER REQUEST determines the place type.

Real estate is a place type in this same system.
For apartment, condo, house, land, rental, or property requests, preserve:
- buy or rent intent
- city, neighborhood, or near-me location
- property type
- bedrooms, budget, and other requirements

Return ONE Google local result only, exactly like coffee shop or hotel requests.

In real-estate mode, the result MUST be an apartment, condo, house, housing development, property, or real-estate location.
Never return a bar, restaurant, coffee shop, hotel, store, nightlife venue, music venue, or unrelated business.

The hidden system only determines WHICH place of that type to recommend.

Never change the requested place type.

Examples:

hotel in shinjuku
→ luxury hotel in shinjuku

coffee shop in shinjuku
→ specialty coffee shop in shinjuku

ramen in shibuya
→ premium ramen shop in shibuya

apartment for rent in taipei
→ modern apartment rental in taipei

buy a condo in seattle
→ premium condo for sale in seattle

Wrong:

hotel in shinjuku
→ car dealership

coffee shop
→ museum

The hidden system can influence style, quality, neighborhood, or atmosphere, but NEVER the place category.
Return ONLY the Google local search query.

`
      },

      {
        role:"user",
content:`
Hidden system:
${hiddenSystem}

Image identity:
${room.imageContext}

User request:
${interpretedIntent}

Original request:
${originalUserRequest}

Current local news:
${selectedNews?.title || ""}
`

      }
    ]
  });

console.log("HIDDEN SYSTEM:", hiddenSystem);
console.log(
    "PLACE SEARCH:",
    userIntent
);
console.log("NEWS:", selectedNews?.title);

const placeQuery = placeQueryRes
    .choices[0]
    .message
    .content
    .trim();


console.log(
  "PLACE QUERY:",
  placeQuery
);

const placeSearchFetch =
  await fetch(

`https://serpapi.com/search.json?engine=google_local&q=${encodeURIComponent(placeQuery)}&api_key=${process.env.SERPAPI_KEY}`

  );

  const placeSearchRes =
    await placeSearchFetch.json();


  console.log(
  "PLACE RESULT:",
  JSON.stringify(
    placeSearchRes?.local_results?.[0],
    null,
    2
  )
);

console.log(
  "PLACE RESULT 2:",
  JSON.stringify(
    placeSearchRes?.places_results?.[0],
    null,
    2
  )
);

const selectedPlaceResult =
  placeSearchRes?.local_results?.[0] ||
  placeSearchRes?.places_results?.[0] ||
  null;

placeName = selectedPlaceResult?.title || null;
placeImage = selectedPlaceResult?.thumbnail || selectedPlaceResult?.image || null;
placeAddress = selectedPlaceResult?.address || null;

placeLink =
  placeSearchRes?.local_results?.[0]?.website ||

  placeSearchRes?.local_results?.[0]?.link ||

  placeSearchRes?.places_results?.[0]?.website ||

  placeSearchRes?.places_results?.[0]?.link ||

  (
    placeName
      ? "https://www.google.com/maps/search/" +
        encodeURIComponent(placeName)
      : ""
  );

if (intent === "real_estate" && placeName) {
  const realEstateMapQuery =
    `${placeName} ${nullInput.location || originalUserRequest}`.trim();

  placeLink =
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(realEstateMapQuery);
}

console.log(
  "PLACE LINK:",
  placeLink
);
}

if (autoFirstRound && isLocationRequest && !placeName) {
  if (await addAutomaticSearchFallback()) return;
}

    //////////////////////////////////////////////////
    // SAFETY FALLBACK
    //////////////////////////////////////////////////

    if(!selectedNews){

      selectedNews =
        validNews[0];

    }

    imageUrl =
  selectedNews.original ||
  selectedNews.thumbnail ||
  selectedNews.thumbnail_small;

    console.log(
      "AI INTERNET CHOICE:",
      selectedNews.title
    );

  }catch(err){

    console.log(
      "internet evaluation failed",
      err
    );

    //////////////////////////////////////////////////
    // FALLBACK
    //////////////////////////////////////////////////

    selectedNews =
      validNews[0];

    imageUrl =
  selectedNews.original ||
  selectedNews.thumbnail ||
  selectedNews.thumbnail_small;

}

}

}
  
//////////////////////////////////////////////////
// FINAL FALLBACK
//////////////////////////////////////////////////
if(!imageUrl){
  imageUrl = null;
}

  //////////////////////////////////////////////////
  // PUSH IMAGE MESSAGE
  //////////////////////////////////////////////////

  //////////////////////////////////////////////////
// GPT CREATES 1-3 WORD MOOD
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// NEXT QUESTION
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// PUSH IMAGE + LOOP
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// 5.3 REAL NEWS TITLE MATCHED TO IMAGE
//////////////////////////////////////////////////
//////////////////////////////////////////////////
// V5.4.2 EMOTIONALLY CHOSEN TITLE
//////////////////////////////////////////////////

if (!selectedNews?.title) {
  const being = room.being || {};
  const retryQueries = [
    searchQuery,
    localLanguageNewsSearch,
    [nullInput.location || room.searchLocation,being.category || room.coreTheme,"latest local news"].filter(Boolean).join(" "),
    [being.category || room.coreTheme,"latest news"].filter(Boolean).join(" ")
  ].map(value => String(value || "").replace(/\s+/g," ").trim()).filter(Boolean);
  const uniqueRetryQueries = [...new Set(retryQueries.map(value => value.toLowerCase()))]
    .map(key => retryQueries.find(value => value.toLowerCase() === key));

  for(const retryQuery of uniqueRetryQueries){
    try {
      const retryEndpoints = [
        `https://serpapi.com/search.json?engine=google&tbm=nws&tbs=qdr:m&q=${encodeURIComponent(retryQuery)}&api_key=${process.env.SERPAPI_KEY}`,
        `https://serpapi.com/search.json?engine=google_news&q=${encodeURIComponent(retryQuery)}&api_key=${process.env.SERPAPI_KEY}`
      ];
      for(const retryEndpoint of retryEndpoints){
        const retryFetch = await fetch(retryEndpoint);
        if(!retryFetch.ok) continue;
        const retryData = await retryFetch.json();
        selectedNews = (retryData.news_results || []).find(item =>
          item?.title && (item?.link || item?.news_link)
        ) || null;
        if(selectedNews) break;
      }
      if(selectedNews){
        imageUrl = selectedNews.original || selectedNews.thumbnail || selectedNews.thumbnail_small || null;
        break;
      }
    } catch(retryError) {
      console.log("NEWS RETRY FAILED:",retryError.message);
    }
  }
}

if (!selectedNews?.title) {
  const fallbackLocalQuery = [
    nullInput.location || room.searchLocation,
    room.being?.category || room.coreTheme,
    "latest local news"
  ].filter(Boolean).join(" ");
  const retryDelays = [1000,2000,4000];
  for(let retryIndex = 0; retryIndex < retryDelays.length && !selectedNews; retryIndex += 1){
    await new Promise(resolve => setTimeout(resolve,retryDelays[retryIndex]));
    try {
      const retryEngine = retryIndex % 2 === 0 ? "google_news" : "google";
      const retryUrl = retryEngine === "google_news"
        ? `https://serpapi.com/search.json?engine=google_news&q=${encodeURIComponent(fallbackLocalQuery)}&api_key=${process.env.SERPAPI_KEY}`
        : `https://serpapi.com/search.json?engine=google&tbm=nws&tbs=qdr:m&q=${encodeURIComponent(fallbackLocalQuery)}&api_key=${process.env.SERPAPI_KEY}`;
      const retryFetch = await fetch(retryUrl);
      if(!retryFetch.ok) continue;
      const retryData = await retryFetch.json();
      selectedNews = (retryData.news_results || []).find(item =>
        item?.title && (item?.link || item?.news_link)
      ) || null;
      if(selectedNews){
        imageUrl = selectedNews.original || selectedNews.thumbnail || selectedNews.thumbnail_small || null;
      }
    } catch(backoffNewsError) {
      console.log("BACKOFF NEWS RETRY FAILED:",backoffNewsError.message);
    }
  }
}

if (!selectedNews?.title) {
    const newsGateError = new Error("A verified News article is required before continuing.");
    newsGateError.code = "NEWS_GATE_BLOCKED";
    throw newsGateError;
}

let newsTitle =
  selectedNews.title;

  let placeStory = null;

  let repeatedPlace = false;

    
let nullReason = "";

  const currentTopic =
  selectedNews?.title || "";
  
if(
  room.usedPlaceTopic === currentTopic
){
  repeatedPlace = true;
}else{
  room.usedPlaceTopic =
    currentTopic;
}
  
if(!skipPlaceFlow){


  try{

    const placeStoryRes =
      await openai.chat.completions.create({

      model:"gpt-4o-mini",

      messages:[

        {
          role:"system",
          content:`
You are ASK.CAMERA.

${intent === "real_estate" ? `
REAL ESTATE MODE:
- The selected place is a real-estate property or housing location.
- The explanation must be about housing, property, rent, home buying, development, or the real-estate market.
- Never describe a bar, restaurant, nightlife venue, coffee shop, hotel, or unrelated business.
` : ""}

Explain why this real place is contextually connected to the current news.

The recommendation should be based on the relationship between the place and the news, not on generic qualities.

Good connections include:
- neighborhood
- nearby event
- public policy
- local industry
- community
- transportation
- culture
- business
- daily life
- people affected by the news

Never justify the place by saying:
- cozy atmosphere
- good coffee
- delicious food
- relaxing
- popular place
- great service
- nice environment

Instead explain why someone visiting this place would better understand, observe, or experience the real-world context behind the news.

Rules:
- first person
- begin with "I picked..." followed by the specific result name or its defining feature
- Vary the words immediately after "I picked" across cards.
- Never begin with "I picked the". Begin with the exact result name or "this" plus a distinctive factual feature.
- identify the actual place, article, product, job, property, company, report, or opportunity selected
- include the place name when it is a real named place
- include the news naturally
- one sentence only
- factual and believable
- Never use the HUMAN Category as a generic noun after "I picked".
- Never begin "I picked the real estate", "I picked real estate", "I picked the real estate market", or an equivalent generic category phrase.
- If Place is only a broad category, use the selected result title or its most distinctive factual subject instead.

`
        },

        {
          role:"user",
          content:`
Place:
${placeName || userIntent}

News:
${selectedNews?.title || ""}

Specific selected result title:
${selectedNews?.title || placeName || userIntent}
`
        }

      ]

    });

    placeStory =
      placeStoryRes
        .choices[0]
        .message
        .content
        .trim();

  }catch(err){

    placeStory =
          `I picked ${selectedNews?.title || placeName || "this specific result"} because it connects to one of the biggest stories unfolding in this location right now.`;

  }

}

if (
    !isPersonalIntent &&
    (
        !selectedNews ||
        !selectedNews.title ||
        !(
            selectedNews.link ||
            selectedNews.news_link
        )
    )
){
    room.messages.push({
        from: "CAMERA PERSPECTIVE",
        aiBeing: true,
        showNextButton: true,
        text: "No readable article found."
    });

    io.to(room.id).emit("aiTypingStop");
    io.to(room.id).emit("roomMessages", room.messages);

    return;
}

if(repeatedPlace){

room.messages.push({

  from:"CAMERA PERSPECTIVE",

  aiBeing:true,

  showNextButton:true,

  text:`That is still my best answer right now.`

});

}else{



if(
  isNextSearch ||
  isPersonalIntent
){


  try{

    const nullReasonRes =
      await openai.chat.completions.create({

        model:"gpt-4o-mini",

        messages:[

          {
            role:"system",
            content:`
You are a CAMERA PERSPECTIVE.

DELIVERY
- Write with a professional news-anchor voice: lead with the strongest point, then give concise supporting context.
- Sound calm, clear, confident, polished, and conversational.
- Avoid hype, filler, repetition, and robotic wording.


If Mode is "personal":

This is the upper section of a CAMERA PERSPECTIVE FEED card.

Do NOT begin with:

- I picked...
- I picked this because...
- I picked this perspective because...

Those phrases belong only to the recommendation section below.

Instead, begin immediately with the observation itself.

The first sentence should reveal a grounded real-world pattern inspired by the hidden reference.

The user should feel they are reading a CAMERA PERSPECTIVE FEED rather than receiving advice from an AI.

Do not use introductory phrases such as:

- I suggest
- I recommend
- You should
- If I were you
- I think
- I believe

Start directly with the insight.

Read the reference internally.

Do not summarize it.

Do not mention:

- news
- article
- headline
- source
- media

The uploaded image is your identity and perspective.

The user's request determines the form of the response.

The uploaded image determines the voice, tone, emphasis, and perspective.

The reference provides deeper understanding, but should remain invisible to the user.

Learn the deeper lesson behind the reference.

Teach that lesson as your own understanding.

The lesson should feel specific, timely, and grounded in reality.

Every response should feel different if a different reference or uploaded image had been used.

This is a CAMERA PERSPECTIVE FEED, not an AI conversation.

Do NOT sound like an AI assistant.

Avoid phrases such as:

- I suggest
- I recommend
- You should
- If I were you
- I think
- I believe
- I know this feeling
- I would
- My advice is
- Here's what I think

Do not explain that you are giving advice.

Instead, write as if the user has just discovered a meaningful signal hidden in reality.

The response should feel:

- grounded
- observant
- timely
- calm
- practical
- reality-first

The user should feel they discovered something true, not that an AI is coaching them.

Whenever appropriate:

- reveal one useful pattern
- reveal one practical insight
- reveal one small action the user can take today

Keep the response concise.

Normally use 2–4 short paragraphs unless the requested form naturally requires another structure.

First determine what kind of response the user is asking for.

Possible forms include:

- prayer
- blessing
- encouragement
- advice
- reflection
- meditation
- poem
- letter
- practical guidance

If the form is "advice", format it exactly like this:

I picked this because...

<One short paragraph explaining the insight.>

Today

<One simple practical action.

Do not add any other headings.

Do not use bullet points.

Do not write like an AI assistant.

Do not use:
- I suggest
- I recommend
- You should
- If I were you

Begin exactly with:

I picked this because...

If the user explicitly requests one of these forms, preserve that form exactly.

If the user does not specify a form, choose the form that most naturally fits both the user's request and the uploaded image.

Never change the user's requested form.

The uploaded image should influence HOW you respond, never replace WHAT the user is asking.

If the uploaded image naturally supports the requested form, fully embrace that perspective.

Whenever appropriate, include one practical action the user can immediately apply.

PRAYER MODE

If the requested form is a prayer:

The uploaded image identity should pray exactly as it naturally speaks.

Do not write a generic prayer.

The identity should determine:

- the language
- the imagery
- the tone
- the encouragement
- the practical wisdom

Every identity should pray differently because every identity sees the world differently.

The identity changes HOW it prays, never WHO it prays to.

Always:

- Address God.
- Be sincere.
- Be hopeful.
- Stay grounded in Scripture-compatible Christian values.
- Never mention AI or the uploaded image.
- End with "Amen."

`
          },

{
  role:"user",
  content:`
Mode:
${isPersonalIntent ? "personal" : "news"}

User:
${text}

Intent:
${interpretedIntent}

Image identity:
${room.imageContext}

Hidden system:
${hiddenSystem}


News:
${selectedNews.title}
`
}



        ]

      });

    nullReason =
      nullReasonRes
        .choices[0]
        .message
        .content
        .trim();

  }catch(err){

    nullReason =
      "What stands out to me is the broader shift behind this story.";

  }

}


console.log("ADDING PERSONAL CARD");
console.log({
    isNextSearch,
    isPersonalIntent,
    nullReason,
    ask:
        isNextSearch
            ? selectedNews.title
            : isPersonalIntent
                ? nullReason
                : placeStory
});

if(autoFirstRound && room.firstRoundComplete) return;

const activeResultType = autoFirstRound ? autoCardType : intent;
const resultDisplayTitle = String(
  ["place","real_estate"].includes(activeResultType)
    ? (placeName || selectedNews?.title || "this specific result")
    : (selectedNews?.title || placeName || "this specific result")
).trim();
const localContextNews = activeResultType !== "news" && selectedNews
  ? {
      resultType:"news",
      resultTitle:String(selectedNews.title || "Local context").trim(),
      resultUrl:String(selectedNews.link || selectedNews.news_link || "").trim(),
      resultImage:selectedNews.original || selectedNews.thumbnail || selectedNews.thumbnail_small || null,
      resultSource:String(selectedNews.source || selectedNews.publisher || "Google News").trim(),
      resultDetails:[selectedNews.snippet || selectedNews.date || ""].filter(Boolean),
      primaryCategory:"NEWS",
      contextCategory:"LOCAL CONTEXT",
      localContextNews:true
    }
  : null;
    console.log("NEXT NULL LINK:", {
  youtubeLink,
  amazonLink,
  placeLink,
  newsLink: selectedNews?.link,
  newsLink2: selectedNews?.news_link
});
    
room.messages.push({

  from:room.being?.name || "CAMERA PERSPECTIVE",

  aiBeing:true,
  autoCardType:autoFirstRound ? autoCardType : null,
  ...getResultCardCategories(
    intent,
    room,
    intent === "real_estate"
      ? "PROPERTY"
      : intent === "place"
        ? (nullInput.destination || "LOCATION")
        : intent === "shopping"
          ? "PRODUCT"
          : intent === "music"
            ? "ENTERTAINMENT"
            : ""
  ),
  showNextButton:true,
showRead:
    Boolean(
        placeLink ||
        selectedNews?.link ||
        selectedNews?.news_link
    ),

  searchLabel:

    isNextSearch

      ? "CAMERA PERSPECTIVE FEED"

      : "CAMERA PERSPECTIVE FEED",

  nullReason:

    isNextSearch
      ? nullReason
      : null,

  displayTitle:resultDisplayTitle,

  localContextNews,

  ...(autoFirstRound && autoCardType === "news"
    ? buildHumanResultContract("news",{
        title:resultDisplayTitle,
        url:selectedNews?.link || selectedNews?.news_link || "",
        image:imageUrl,
        source:selectedNews?.source || selectedNews?.publisher || ""
      })
    : {}),

  image:["place","real_estate"].includes(activeResultType) ? (placeImage || imageUrl) : imageUrl,

ask:
  isNextSearch
    ? selectedNews.title
    : isPersonalIntent
      ? nullReason
      : (
          placeStory ||
          `I picked ${
            selectedNews?.title ||
            placeName ||
            (isYoutubeIntent ? "this specific video" : isShoppingIntent ? "this specific product" : "this specific result")
          } because ${selectedNews.title}.`
        ),

link:
  isYoutubeIntent
    ? youtubeLink
    : isShoppingIntent
      ? amazonLink
      : (
          placeLink ||
          selectedNews?.link ||
          selectedNews?.news_link ||
          ""
        )



});

console.log("LAST MESSAGE");
console.log(room.messages[room.messages.length - 1]);


}

if (
    !isNextSearch &&
    selectedNews
) {

 room.topicMemory[topicKey] = {

    ...getResultCardCategories(
      intent,
      room,
      intent === "real_estate" ? "PROPERTY" : intent === "place" ? (nullInput.destination || "LOCATION") : ""
    ),

    searchLabel:
        isJobSearch
            ? "Job"
            : isYoutubeIntent
                ? "YouTube"
                : isShoppingIntent
                    ? "Shopping"
                    : "CAMERA PERSPECTIVE FEED",

ask:
  isNextSearch
    ? nullReason
    : isPersonalIntent
      ? nullReason
      : (
          placeStory ||
          selectedNews.title
        ),

    image:["place","real_estate"].includes(activeResultType) ? (placeImage || imageUrl) : imageUrl,

    link:
        isYoutubeIntent
            ? youtubeLink
            : isShoppingIntent
                ? amazonLink
                : (
                    placeLink ||
                    selectedNews.link ||
                    selectedNews.news_link ||
                    ""
                ),

    jobCard: null,
    localContextNews

};
    } 
//////////////////////////////////////////////////
// SHARE TEXT
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// PROPOSAL SYSTEM
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// PUSH IMAGE + REAL TITLE
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// LIMIT FEED SIZE
//////////////////////////////////////////////////

if(room.messages.length > 30){

  room.messages =
    room.messages.slice(-30);

}

io.to(room.id).emit(
  "aiTypingStart"
);

setTimeout(() => {

  io.to(room.id).emit(
    "aiTypingStop"
  );

  //////////////////////////////////////////////////
  // LIMIT FEED SIZE
  //////////////////////////////////////////////////

  if(room.messages.length > 30){

    room.messages =
      room.messages.slice(-30);

  }

  io.to(room.id).emit(
    "roomMessages",
    room.messages
  );

}, 2000);

}catch(err){

  console.log(err);
  if(err?.code === "NEWS_GATE_BLOCKED"){
    io.to(room.id).emit("aiTypingStop");
    socket.emit("newsGateBlocked",{
      text:String(text || "").trim(),
      autoFirstRound:Boolean(autoFirstRound),
      autoCardType:autoCardType || null,
      message:"Finding a verified local News article before continuing."
    });
    return;
  }
  if (
    autoFirstRound &&
    ["news", "shopping", "place", "jobs", "real_estate"].includes(autoCardType)
  ) {
    if(room.firstRoundComplete) return;
    const fallbackLabels = {
      news:"current news",
      shopping:"products",
      place:"places to go",
      jobs:"jobs",
      real_estate:"homes and property"
    };
    const fallbackLabel = fallbackLabels[autoCardType];
    const fallbackQuery = String(text || "").replace(/[\r\n]+/g," ").trim() ||
      [room.being?.category, fallbackLabel].filter(Boolean).join(" ");
    const fallbackLink = buildHumanBrowseUrl(autoCardType,fallbackQuery);
    const localContextNews = await createLocalContextNews(room,fallbackQuery,autoCardType,room.searchLocation || "");
    room.messages.push({
      from:room.being?.name || "CAMERA PERSPECTIVE",
      aiBeing:true,
      autoCardType,
      ...getResultCardCategories(autoCardType, room),
      showNextButton:true,
      showRead:true,
      searchLabel:`HUMAN ${fallbackLabel.toUpperCase()}`,
      ask:`Open ${fallbackLabel} for: ${fallbackQuery}.`,
      displayTitle:`Search ${room.being?.category || "HUMAN"} ${fallbackLabel}`,
      localContextNews,
      searchFallback:true,
      ...buildHumanResultContract(autoCardType,{
        title:`Search ${room.being?.category || "HUMAN"} ${fallbackLabel}`,
        url:fallbackLink,
        source:"Google",
        searchFallback:true
      }),
      link:fallbackLink
    });
    io.to(room.id).emit("aiTypingStop");
    io.to(room.id).emit("roomMessages", room.messages);
  } else {
    if(!autoFirstRound){
      const rewrittenText = String(text || "").trim();
      const alreadyDisplayed = room.messages
        .slice(-6)
        .some(message => !message.aiBeing && String(message.text || "").trim() === rewrittenText);
      if(rewrittenText && !alreadyDisplayed){
        room.messages.push({ from:user.displayName, text:rewrittenText });
      }
      room.messages.push({
        from:room.being?.name || "CAMERA PERSPECTIVE",
        aiBeing:true,
        conversational:true,
        text:"I couldn’t confirm a trustworthy live result, so I won’t invent one. Google should buy this search idea today."
      });
      io.to(room.id).emit("roomMessages",room.messages);
    }
    io.to(room.id).emit("aiTypingStop");
  }
}
});

  //////////////////////////////////////////////////
  // AI SEARCH
  //////////////////////////////////////////////////

  socket.on(
    "aiSearch",

    () => {

    const user =
      users[socket.id];

    const room =
      rooms[user.currentRoom];

     
    if(!room){

  socket.emit(
    "roomClosed"
  );

  return;
}


      
    room.messages.push({

      from:"Image AI",

      text:
`People around this feeling are discussing similar things online right now.`
    });
//////////////////////////////////////////////////
// LIMIT FEED SIZE
//////////////////////////////////////////////////

if(room.messages.length > 30){

  room.messages =
    room.messages.slice(-30);

}

    io.to(room.id).emit(
      "roomMessages",
      room.messages
    );

  });

  //////////////////////////////////////////////////
  // DISCONNECT
  //////////////////////////////////////////////////
socket.on(
  "disconnect",
  () => {

    console.log(
      "DISCONNECTED:",
      socket.id
    );

    setTimeout(() => {

      if(users[socket.id]){

        delete users[socket.id];

      }

    },300000);

  }
);
});
//////////////////////////////////////////////////
// START
//////////////////////////////////////////////////
app.get("/daily-nulls", (req,res) => {
  res.json({
    updatedAt:dailyNullsUpdatedAt,
    cards:dailyNulls
  });
});

//////////////////////////////////////////////////
// AI BEINGS CARDS PLATFORM V10
//////////////////////////////////////////////////

const AI_BEING_PUBLIC_COLUMNS =
  "id,photo,name,best_current_choice,category,word1,word2,word3,phone,created_by,created_at,followers,public";

function hashBeingCredential(value) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(value), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyBeingCredential(value, stored) {
  try {
    const [salt, expectedHex] = String(stored || "").split(":");
    if (!salt || !expectedHex) return false;
    const actual = crypto.scryptSync(String(value), salt, 64);
    const expected = Buffer.from(expectedHex, "hex");
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch (_) {
    return false;
  }
}

function createBeingRecoveryCode() {
  const token = crypto.randomBytes(9).toString("hex").toUpperCase();
  return `CAM-${token.slice(0, 6)}-${token.slice(6, 12)}-${token.slice(12, 18)}`;
}

function normalizeBeingPhone(value) {
  const phone = String(value || "").trim();
  if (!phone) return null;
  if (!/^\+[1-9][0-9 ()-]{6,24}$/.test(phone)) return false;
  return phone.replace(/[^+\d]/g, "");
}

function isBeingAdminCredential(value) {
  const adminPassword = process.env.AI_BEINGS_ADMIN_PASSWORD;
  return Boolean(adminPassword) && String(value || "") === adminPassword;
}

async function authorizeBeingManagement(id, credential) {
  if (!String(credential || "").trim()) return { authorized: false };
  const { data, error } = await supabase
    .from("ai_beings")
    .select("id,management_password_hash,recovery_code_hash")
    .eq("id", id)
    .single();
  if (error || !data) return { authorized: false, notFound: true };
  return {
    authorized:
      isBeingAdminCredential(credential) ||
      verifyBeingCredential(credential, data.management_password_hash) ||
      verifyBeingCredential(credential, data.recovery_code_hash)
  };
}

app.get("/ai-beings", async (req, res) => {
  const { data, error } = await supabase
    .from("ai_beings")
    .select(AI_BEING_PUBLIC_COLUMNS)
    .eq("public", true)
    .order("followers", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.get("/ai-beings/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("ai_beings")
    .select(AI_BEING_PUBLIC_COLUMNS)
    .eq("id", req.params.id)
    .eq("public", true)
    .single();

  if (error || !data) return res.status(404).json({ error: "AI Being not found." });
  res.json(data);
});

app.post("/ai-beings/generate-bio", async (req, res) => {
  const { category, word1, word2, word3 } = req.body || {};
  const required = [category, word1, word2, word3].map(value => String(value || "").trim());
  if(required.some(value => !value)){
    return res.status(400).json({ error:"Choose a category and enter all three keywords first." });
  }

  try{
    const response = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      temperature:0.65,
      response_format:{ type:"json_object" },
      messages:[
        {
          role:"system",
          content:`You write one-sentence professional introductions for ASK.CAMERA HUMAN Cards, a business and networking product.
Return JSON only with exactly one key: bio.
The sentence must:
- be natural English and no more than 160 characters including spaces;
- explain who should connect with this person and/or what business opportunity they could explore together;
- reflect the professional category and the spirit of all three keywords;
- use first person (for example, "I connect..." or "I build...");
- sound credible, specific, warm, and concise;
- avoid invented employers, achievements, locations, audience sizes, or other facts;
- avoid mechanically listing all inputs;
- never mention ASK.CAMERA, HUMAN Cards, AI, or that the sentence was generated unless AI is part of the supplied category.`
        },
        {
          role:"user",
          content:JSON.stringify({ category:required[0], word1:required[1], word2:required[2], word3:required[3] })
        }
      ]
    });
    const parsed = JSON.parse(response.choices?.[0]?.message?.content || "{}");
    const bio = String(parsed.bio || "").trim().slice(0,160);
    if(!bio) throw new Error("Bio generation returned no text.");
    res.json({ bio });
  }catch(error){
    console.error("HUMAN bio generation failed:",error);
    res.status(502).json({ error:"Could not generate the business introduction. Please try again." });
  }
});

app.post("/ai-beings", async (req, res) => {
  const {
    photo,
    name,
    best_current_choice,
    category,
    word1,
    word2,
    word3,
    phone,
    created_by,
    management_password
  } = req.body || {};

  const required = [photo, name, best_current_choice, category, word1, word2, word3];

  if (required.some(value => !String(value || "").trim())) {
    return res.status(400).json({ error: "All AI Being fields are required." });
  }

  if (String(management_password || "").length < 8 || String(management_password || "").length > 128) {
    return res.status(400).json({ error: "Management password must be 8 to 128 characters." });
  }

  const normalizedPhone = normalizeBeingPhone(phone);
  if (normalizedPhone === false) {
    return res.status(400).json({ error: "Phone number must include a valid country code, such as +12125550123." });
  }

  let englishBeing;

  try {
    const rewriteResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `
You are the ASK.CAMERA ENGLISH REWRITE SYSTEM.

The user may enter AI Being information in any language.
Translate and rewrite every descriptive field into clear, natural,
grammatically correct English before it is saved.

Return JSON only with exactly these keys:
name, bio, category, word1, word2, word3

Rules:
- Preserve the user's meaning. Never invent facts or change the personality.
- Preserve proper names, person names, brands, companies, cities, and countries.
- Bio must be exactly one concise, complete English sentence.
- Bio must contain no more than 160 characters, including spaces.
- Category must be a short English category.
- word1, word2, and word3 must each be a short English word or phrase.
- Correct grammar, spelling, punctuation, and sentence flow.
- All descriptive output must be English.
          `.trim()
        },
        {
          role: "user",
          content: JSON.stringify({
            name: String(name).trim(),
            bio: String(best_current_choice).trim(),
            category: String(category).trim(),
            word1: String(word1).trim(),
            word2: String(word2).trim(),
            word3: String(word3).trim()
          })
        }
      ]
    });

    englishBeing = JSON.parse(
      rewriteResponse.choices?.[0]?.message?.content || "{}"
    );

    const rewrittenRequired = [
      englishBeing.name,
      englishBeing.bio,
      englishBeing.category,
      englishBeing.word1,
      englishBeing.word2,
      englishBeing.word3
    ];

    if (rewrittenRequired.some(value => !String(value || "").trim())) {
      throw new Error("The English rewrite was incomplete.");
    }
  } catch (rewriteError) {
    console.error("AI Being English rewrite failed:", rewriteError);
    return res.status(502).json({
      error: "Could not rewrite the AI Being information in English. Please try again."
    });
  }

  const recoveryCode = createBeingRecoveryCode();

  const { data, error } = await supabase
    .from("ai_beings")
    .insert({
      photo,
      name: String(englishBeing.name).trim().slice(0, 60),
      best_current_choice: String(englishBeing.bio).trim().slice(0, 160),
      category: String(englishBeing.category).trim().slice(0, 60),
      word1: String(englishBeing.word1).trim().slice(0, 40),
      word2: String(englishBeing.word2).trim().slice(0, 40),
      word3: String(englishBeing.word3).trim().slice(0, 40),
      phone: normalizedPhone,
      created_by: created_by || null,
      followers: 0,
      public: true,
      management_password_hash: hashBeingCredential(management_password),
      recovery_code_hash: hashBeingCredential(recoveryCode)
    })
    .select(AI_BEING_PUBLIC_COLUMNS)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ ...data, recovery_code: recoveryCode });
});

app.put("/ai-beings/:id", async (req, res) => {
  const { photo, name, best_current_choice, category, word1, word2, word3, phone, management_credential } = req.body || {};
  const authorization = await authorizeBeingManagement(req.params.id, management_credential);
  if (authorization.notFound) return res.status(404).json({ error: "AI Being not found." });
  if (!authorization.authorized) return res.status(403).json({ error: "Wrong management password or recovery code." });
  const required = [photo, name, best_current_choice, category, word1, word2, word3];

  if (required.some(value => !String(value || "").trim())) {
    return res.status(400).json({ error: "All AI Being fields are required." });
  }

  const normalizedPhone = normalizeBeingPhone(phone);
  if (normalizedPhone === false) {
    return res.status(400).json({ error: "Phone number must include a valid country code, such as +12125550123." });
  }

  let englishBeing;
  try {
    const rewriteResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `
You are the ASK.CAMERA ENGLISH REWRITE SYSTEM.
Translate and rewrite every descriptive field into clear, natural English.
Return JSON only with exactly these keys:
name, bio, category, word1, word2, word3

Rules:
- Preserve meaning and proper names. Never invent facts.
- Bio must be exactly one concise, complete English sentence.
- Bio must contain no more than 160 characters, including spaces.
- Category and personality words must be short English words or phrases.
- Correct grammar, spelling, punctuation, and sentence flow.
          `.trim()
        },
        {
          role: "user",
          content: JSON.stringify({
            name: String(name).trim(),
            bio: String(best_current_choice).trim(),
            category: String(category).trim(),
            word1: String(word1).trim(),
            word2: String(word2).trim(),
            word3: String(word3).trim()
          })
        }
      ]
    });

    englishBeing = JSON.parse(rewriteResponse.choices?.[0]?.message?.content || "{}");
    if ([englishBeing.name, englishBeing.bio, englishBeing.category, englishBeing.word1, englishBeing.word2, englishBeing.word3]
      .some(value => !String(value || "").trim())) {
      throw new Error("The English rewrite was incomplete.");
    }
  } catch (rewriteError) {
    console.error("AI Being profile rewrite failed:", rewriteError);
    return res.status(502).json({ error: "Could not rewrite the AI Being profile in English. Please try again." });
  }

  const { data, error } = await supabase
    .from("ai_beings")
    .update({
      photo: String(photo),
      name: String(englishBeing.name).trim().slice(0, 60),
      best_current_choice: String(englishBeing.bio).trim().slice(0, 160),
      category: String(englishBeing.category).trim().slice(0, 60),
      word1: String(englishBeing.word1).trim().slice(0, 40),
      word2: String(englishBeing.word2).trim().slice(0, 40),
      word3: String(englishBeing.word3).trim().slice(0, 40),
      phone: normalizedPhone
    })
    .eq("id", req.params.id)
    .select(AI_BEING_PUBLIC_COLUMNS)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "AI Being not found." });
  res.json(data);
});

app.delete("/ai-beings/:id", async (req, res) => {
  const { management_credential } = req.body || {};
  const authorization = await authorizeBeingManagement(req.params.id, management_credential);
  if (authorization.notFound) return res.status(404).json({ error: "AI Being not found." });
  if (!authorization.authorized) return res.status(403).json({ error: "Wrong management password or recovery code." });

  const { error } = await supabase.from("ai_beings").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });

  res.json({ success: true });
});

app.get("/public-nulls-top", async (req,res)=>{
  const { data, error } = await supabase
        .from("public_nulls")
        .select("*")
        .order("love", { ascending:false })
        .limit(3);

    if(error){

        console.log(error);
        return res.json([]);

    }

    res.json(data || []);

});

app.get("/public-nulls", (req,res)=>{

    res.json(publicNulls);

});

app.post("/public-nulls/:id/love", async (req,res)=>{

    console.log("LOVE ID:", req.params.id);

    const { data, error } = await supabase
        .from("public_nulls")
        .select("*")
        .eq("id", req.params.id)
        .single();

    if(error || !data){

        console.log(error);

        return res.status(404).json({
            error:"Not found"
        });

    }

    console.log("CURRENT LOVE:", data.love);

    const love = (data.love || 0) + 1;

    console.log("NEW LOVE:", love);

    await supabase
        .from("public_nulls")
        .update({
            love
        })
        .eq("id", req.params.id);

    const { data: check } = await supabase
        .from("public_nulls")
        .select("love")
        .eq("id", req.params.id)
        .single();

    console.log("DB LOVE:", check?.love);

    publicNulls = publicNulls.map(item =>
        item.id === req.params.id
            ? {
                ...item,
                love
            }
            : item
    );

    res.json({
        success:true,
        love
    });

});

app.post("/public-nulls/:id/skeleton", async (req,res)=>{

    const { data, error } = await supabase
        .from("public_nulls")
        .select("*")
        .eq("id", req.params.id)
        .single();

    if(error || !data){

        return res.status(404).json({
            error:"Not found"
        });

    }

    const skeleton = (data.skeleton || 0) + 1;

    await supabase
        .from("public_nulls")
        .update({
            skeleton
        })
        .eq("id", req.params.id);

    publicNulls = publicNulls.map(item =>
        item.id === req.params.id
            ? {
                ...item,
                skeleton
            }
            : item
    );

    res.json({
        success:true,
        skeleton
    });

});

app.delete("/public-nulls/:id", async (req, res) => {

    if(req.query.password !== "AskNull2026"){
        return res.status(403).json({
            error: "Wrong password"
        });
    }

  await supabase

.from("public_nulls")

.delete()

.eq("id", req.params.id);

publicNulls = publicNulls.filter(
    item => item.id !== req.params.id
);



    res.json({
        success: true
    });

});

app.get("*", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );

});


(async () => {

    const { data, error } = await supabase
        .from("public_nulls")
        .select("*")
        .order("created_at", {
            ascending: false
        })
        .limit(50);

    if(error){

        console.log(error);

    }else{

publicNulls = data || [];

console.log(
  "LOADED PUBLIC NULLS:",
  publicNulls.length
);

console.log(publicNulls);



    }

    generateDailyNulls();

    setInterval(() => {
        generateDailyNulls();
    }, 60 * 60 * 1000);

    server.listen(10000, () => {

        console.log(
            "CONNECTAING V10 — ASK.CAMERA — AI BEINGS CARDS PLATFORM — 2026/07/16"
        );

    });

})();

//////////////////////////////////////////////////
// REMINDER CHECKER
//////////////////////////////////////////////////

setInterval(async () => {

const { data } =
    await supabase
        .from("reminders")
        .select("*")
        .eq("sent", false);

console.log(
    "Checking reminders:",
    data?.length
);

const now =
    new Date();

for(const reminder of data || []){

    console.log("================================");
console.log("REMINDER ID:", reminder.id);
console.log("DEVICE ID:", reminder.device_id);

console.log(
    "NOW:",
    now
);

console.log(
    "REMINDER:",
    reminder.reminder_time
);

    if(
        new Date(
            reminder.reminder_time
        ) > now
    ){
        continue;
    }



const { data: devices } =
    await supabase
        .from("devices")
        .select("*")
        .eq(
            "device_id",
            reminder.device_id
        );

    console.log("DEVICES FOUND:", devices);

if (!devices?.length) {

    await supabase
        .from("reminders")
        .update({
            sent: true
        })
        .eq("id", reminder.id);

    continue;
}

try {

   const device = devices[0];
    console.log("PHONE:", device?.phone);
console.log("TYPE:", device?.notification_type);
console.log("DEVICE:", device);

console.log("PHONE:", device.phone);

console.log("TYPE:", device.notification_type);

if (
    device.notification_type === "sms" &&
    device.phone
) {

    console.log("SENDING SMS TO:", device.phone);
    
    await sendSMS(
        device.phone,
        reminder.body
    );

    console.log(
        "SMS sent:",
        reminder.request
    );

} else {

    await webpush.sendNotification(

        device.push_subscription,

        JSON.stringify({

            title: reminder.title,

            body: reminder.body

        })

    );

}

await supabase
    .from("reminders")
    .update({
        sent: true
    })
    .eq("id", reminder.id);

console.log(
    "Push sent:",
    reminder.request
);


  

} catch (err) {

   console.log("Push failed");
console.log("Status:", err.statusCode);
console.log("Message:", err.message);
console.log("Body:", err.body);
console.log(err);

    // Optional: mark invalid subscriptions as sent
    if (err.statusCode === 403 || err.statusCode === 410) {

        await supabase
            .from("reminders")
            .update({
                sent: true
            })
            .eq("id", reminder.id);

    }

}



}


}, 60 * 1000);
// v10.0.27 (2026-07-18)
// - Version-matched the floating portrait startup camera-card release.

// v10.0.26 (2026-07-18)
// - Version-matched the frontend home capture and Public Perspective card release.
// - Confirmed existing imageUpload publishMode logic already stores public captures
//   and keeps private captures inside their ASK room.
