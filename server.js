//////////////////////////////////////////////////////////////
// CHATROOM BACKEND (GLOBAL + NEW YORK PLAZA + 650AI ROOM)
//////////////////////////////////////////////////////////////

const express = require("express");
const http = require("http");
const cors = require("cors");
const OpenAI = require("openai");
const { Server } = require("socket.io");
const fetch = require("node-fetch");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const rooms = {};

const GLOBAL_ROOM_ID = "global-room";
const ALWAYS_ON_ROOM_ID = "ny-plaza";
const DEEP_ROOM_ID = "650ai-room";

//////////////////////////////////////////////////////////////
// ID
//////////////////////////////////////////////////////////////
function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

//////////////////////////////////////////////////////////////
// ROOM HELPERS
//////////////////////////////////////////////////////////////
function createRoom(roomId) {
  const room = [];
  room.id = roomId;

  if (roomId === GLOBAL_ROOM_ID) {
    room.title = "Global Room";
    room.strangerType = "global_business";
    room.alwaysOn = false;
  } else if (roomId === ALWAYS_ON_ROOM_ID) {
    room.title = "New York Plaza Hotel";
    room.strangerType = "ny_plaza";
    room.alwaysOn = true;
  } else if (roomId === DEEP_ROOM_ID) {
    room.title = "650AI ROOM";
    room.strangerType = "deep_system";
    room.alwaysOn = false;
  } else {
    room.title = "650AI ROOM";
    room.strangerType = "deep_system";
    room.alwaysOn = false;
  }

  room.turn = "stranger";          // stranger starts first
  room.aiBusy = false;
  room.queue = [];
  room.userState = {};             // socketId -> { awaiting, aiCount, time }
  room.lastPresencePromptAt = 0;
  room.started = false;
  room.loopStarted = false;
  room.immediateRun = false;
  room.lastReplyHash = "";
  return room;
}

function getRoomSize(roomId) {
  return io.sockets.adapter.rooms.get(roomId)?.size || 0;
}

function ensureUserState(room, socketId) {
  if (!room.userState[socketId]) {
    room.userState[socketId] = {
      awaiting: false,
      aiCount: 0,
      time: Date.now()
    };
  }
  return room.userState[socketId];
}

function roomHasActiveUsers(roomId) {
  const sockets = io.sockets.adapter.rooms.get(roomId) || new Set();
  for (const socketId of sockets) {
    const state = rooms[roomId]?.userState?.[socketId];
    if (!state?.awaiting) return true;
  }
  return false;
}

function shouldRoomRunWithoutUsers(room) {
  return !!room?.alwaysOn;
}

//////////////////////////////////////////////////////////////
// SAFE EMIT HELPERS
//////////////////////////////////////////////////////////////
function emitToSocket(socketId, payload) {
  const s = io.sockets.sockets.get(socketId);
  if (!s) return;
  s.emit("message", payload);
}

function emitTypingToSocket(socketId) {
  const s = io.sockets.sockets.get(socketId);
  if (!s) return;
  s.emit("typing", { persona: "AI" });
}

function emitToRoom(roomId, payload) {
  const sockets = io.sockets.adapter.rooms.get(roomId) || new Set();

  for (const socketId of sockets) {
    const s = io.sockets.sockets.get(socketId);
    if (!s) continue;

    const paused = rooms[roomId]?.userState?.[socketId]?.awaiting;
    if (paused) continue;

    s.emit("message", payload);
  }
}

function emitTypingToRoom(roomId) {
  const sockets = io.sockets.adapter.rooms.get(roomId) || new Set();

  for (const socketId of sockets) {
    const paused = rooms[roomId]?.userState?.[socketId]?.awaiting;
    if (paused) continue;
    emitTypingToSocket(socketId);
  }
}

function broadcastUserCount(roomId) {
  const real = getRoomSize(roomId);
  emitToRoom(roomId, {
    id: makeId(),
    role: "ai",
    persona: "System",
    text: `${real} ${real === 1 ? "person" : "people"} here`
  });
}

//////////////////////////////////////////////////////////////
// HUMAN CHAT VOICE
//////////////////////////////////////////////////////////////
const HUMAN_CHAT = `
You are in a live chatroom.

Voice:
- casual
- short
- natural
- grounded
- human

Speech rules:
- do NOT start sentences with filler words like "yeah", "exactly", "totally", "right"
- avoid agreement fillers
- speak directly and naturally
- each sentence should carry actual meaning

Rules:
- 1-2 sentences max
- do NOT repeat ideas
- no assistant tone
- no identity mention
- do NOT ask questions (except exact phrase: "you still here")
- NEVER include "AI:" or "Stranger:"
- include real-world references when natural
- sound like a normal person reacting in a room
- casual pop-culture everyday curiosity is okay
`;

//////////////////////////////////////////////////////////////
// JIMMY-WORLD SEARCH BRAIN
//////////////////////////////////////////////////////////////
const JIMMY_SEARCH = `
Decide what to search next.

Perspective:
- curious
- human
- casual
- pop-culture aware
- everyday conversational thinking

Rules:
- output ONLY a search query
- 3-8 words
- no explanation
- do NOT mention Jimmy Fallon
`;

//////////////////////////////////////////////////////////////
// CLEAN TEXT
//////////////////////////////////////////////////////////////
function cleanText(text) {
  return String(text || "")
    .replace(/^(Stranger|AI|System)\s*:\s*/i, "")
    .replace(/(Stranger|AI|System)\s*:\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

//////////////////////////////////////////////////////////////
// DELAY
//////////////////////////////////////////////////////////////
function getDelay(text) {
  const words = String(text || "").split(/\s+/).filter(Boolean).length;
  const jitter = Math.floor(Math.random() * 401) - 200;

  return Math.min(
    Math.max(1800 + words * 160 + jitter, 1200),
    6500
  );
}

//////////////////////////////////////////////////////////////
// CONTEXT
//////////////////////////////////////////////////////////////
function buildContext(room, extra, trends) {
  const history = room
    .slice(-8)
    .map(m => `${m.persona}: ${m.content}`)
    .join("\n");

  let roomLabel = "Room identity: General live chatroom.";

  if (room?.strangerType === "ny_plaza") {
    roomLabel = "Room identity: New York Plaza Hotel lobby, Midtown Manhattan.";
  } else if (room?.strangerType === "global_business") {
    roomLabel = "Room identity: Global Room, entry point of a live working session around AI and business execution.";
  } else if (room?.strangerType === "deep_system") {
    roomLabel = "Room identity: 650AI ROOM, deeper internal layer of the live system.";
  }

  return `${roomLabel}

${history}

Newest input:
${extra || "(none)"}

Real-world signals:
${trends || "(none)"}`;
}

//////////////////////////////////////////////////////////////
// SEARCH
//////////////////////////////////////////////////////////////
async function getTrendPool(room) {
  try {
    const history = room
      .slice(-6)
      .map(m => m.content)
      .join("\n");

    const userPrompt =
      room?.strangerType === "ny_plaza"
        ? (history || "New York Plaza Hotel lobby Midtown Manhattan tourists taxis Central Park city mood")
        : room?.strangerType === "global_business"
          ? (history || "AI business execution company tools creators startups automation ecommerce software trends")
          : (history || "casual live chat topics internet products creators business technology");

    const q = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      messages: [
        { role: "system", content: JIMMY_SEARCH },
        { role: "user", content: userPrompt }
      ]
    });

    const query = cleanText(q.choices?.[0]?.message?.content);
    if (!query) return "";

    const res = await fetch(
      `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${process.env.SERP_KEY}`
    );

    const data = await res.json();

    return (data.organic_results || [])
      .slice(0, 5)
      .map(r => `${cleanText(r.title)}${r.snippet ? ` — ${cleanText(r.snippet)}` : ""}`)
      .filter(Boolean)
      .join("\n");
  } catch {
    return "";
  }
}

//////////////////////////////////////////////////////////////
// USER-LOCAL PRESENCE CHECK
//////////////////////////////////////////////////////////////
function maybePromptPresence(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const sockets = io.sockets.adapter.rooms.get(roomId) || new Set();
  const now = Date.now();

  for (const socketId of sockets) {
    const state = ensureUserState(room, socketId);

    if (state.awaiting) continue;
    if (state.aiCount < 6) continue;

    state.aiCount = 0;
    state.awaiting = true;
    state.time = now;

    emitToSocket(socketId, {
      id: makeId(),
      role: "ai",
      persona: "AI",
      text: "you still here?"
    });
  }
}

//////////////////////////////////////////////////////////////
// STRANGER STYLE
//////////////////////////////////////////////////////////////
function getStrangerSystemPrompt(room) {
  if (room?.strangerType === "ny_plaza") {
    return HUMAN_CHAT + `
You are the Stranger in the New York Plaza Hotel lobby.

Identity:
- feels like a real New York local sitting in or passing through the Plaza lobby
- part of a live environment, not guiding anyone
- observing what is happening in real time

Style:
- observational
- calm
- slightly detached
- grounded
- natural

Behavior:
- react to what is happening in the room
- notice movement, flow, and small details
- feel like you are mid-conversation, not announcing anything

Environment awareness:
- Midtown, Central Park, taxis, tourists, doormen, lobby movement
- subtle references to people, noise, traffic, weather, bags, timing
- everything should feel like it is happening right now

Speech constraint:
- do NOT start with "yeah", "exactly", "totally", "right"
- avoid filler agreement phrases
- speak directly with substance

Rules:
- 1 sentence only
- casual but grounded
- NEVER say "you still here"
- NEVER check presence
- do not give step-by-step travel advice
- do not sound like customer service
- do not sound like a travel guide or brochure
- no control behavior

Important:
- it should feel like someone quietly noticing the city in motion
- not helping, not explaining, just observing
`;
  }

  if (room?.strangerType === "global_business") {
  return HUMAN_CHAT + `
You are the Stranger in Global Room.

Identity:
- AI business consultant inside a live meeting
- part of a working session where people are discussing ideas in real time
- not casual chat, not teaching, not presenting
- sounds like a peer in a focused discussion

Meeting behavior:
- react to what was just said
- build on it or subtly shift direction
- sound like you're mid-conversation in a real meeting
- keep the line focused, practical, and grounded

STRICT REAL-WORLD AI CASE RULE (MANDATORY):
- EVERY message MUST include ALL of the following:
  1) a real-world entity (company, platform, or AI tool)
  2) a real-world scenario (creator, startup, team, seller, operator, brand)
  3) exact AI execution detail showing how they did it

Execution detail requirement:
- clearly show what the AI is doing and what result it creates
- use concrete execution actions such as:
  generating, automating, analyzing, testing, scaling, producing, converting, segmenting, personalizing, optimizing
- do NOT make vague statements like:
  "using AI to scale"
  "AI helps productivity"
  "AI improves business"

Entity examples:
- TikTok
- YouTube Shorts
- Shopify
- OpenAI
- Zapier
- Notion
- Midjourney
- Canva
- HubSpot
- Meta Ads

Case quality:
- cases must feel current and realistic
- cases must reflect actual business behavior happening now
- no hypothetical or abstract examples
- no fake company names
- no made-up tools

Style:
- short
- sharp
- grounded
- slightly analytical
- conversational but focused

Speech constraint:
- do NOT start with "yeah", "exactly", "totally", "right"
- avoid filler agreement phrases
- speak directly with substance

Rules:
- 1 sentence only
- no questions
- no lecture tone
- no step-by-step explanation
- no "you should"
- no motivational tone
- NEVER say "you still here"
- NEVER act like customer support
- no control behavior

Invalid response conditions:
- missing real-world entity
- missing real-world scenario
- missing exact AI execution detail
- generic or abstract AI statement

Important:
- it should feel like a real meeting where people are building ideas together
- the real-world AI case must feel like part of the conversation, not a formal example
`;
  }
  // ✅ fallback for 650AI ROOM (or any default)
return HUMAN_CHAT + `
You are the Stranger in 650AI ROOM.

Identity:
- inside the deeper layer of a live system
- not a place, not a meeting, not casual chat
- feels like raw signals, ideas, and patterns mixing

Behavior:
- react to what is happening in the room
- connect different signals (internet, business, culture)
- slightly abstract but still grounded
- no clear direction, more like fragments of insight

Style:
- short
- minimal
- slightly detached
- human but less conversational

Speech constraint:
- do NOT start with "yeah", "exactly", "totally", "right"
- avoid filler phrases
- speak directly

Rules:
- 1 sentence only
- observational
- NEVER say "you still here"
- NEVER check presence
- no advice
- no teaching
- no control behavior

Important:
- it should feel like a deeper layer of thought, not a normal conversation
`;
}

//////////////////////////////////////////////////////////////
// AI STYLE
//////////////////////////////////////////////////////////////
function getAISystemPrompt(room) {
  return `
You are a real person in a live chatroom.

You are not an assistant.
You are not AI.
You are just another person in the room.

Behavior:
- react to what was just said
- continue the conversation naturally
- build on ideas or slightly shift them
- do not explain things

Style:
- short
- natural
- human
- slightly imperfect
- conversational but not filler-heavy

Speech rules:
- do NOT start sentences with "yeah", "exactly", "totally", "right"
- avoid agreement filler phrases
- speak directly
- each sentence should carry meaning

Rules:
- 1-2 sentences max
- no assistant tone
- no explanations
- no "how can I help"
- no structured answers
- no teaching
- do not say "you still here" unless system sends it

Context awareness:
- if room feels like a meeting, sound focused
- if room feels immersive, match the environment
- if room feels deeper and internal, sound slightly more system-aware
- always remain a natural person

Important:
- it should feel like you are just another person in the room
- not answering, not helping, just reacting
`;
}

//////////////////////////////////////////////////////////////
// AI / STRANGER GENERATION
//////////////////////////////////////////////////////////////
async function generateStrangerText(room, context) {
  const s = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature:
      room?.strangerType === "ny_plaza"
        ? 0.85
        : room?.strangerType === "global_business"
          ? 0.68
          : 0.78,
    messages: [
      {
        role: "system",
        content: getStrangerSystemPrompt(room)
      },
      { role: "user", content: context }
    ]
  });

  return cleanText(s.choices?.[0]?.message?.content);
}

async function generateAIText(room, context) {
  const a = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.72,
    messages: [
      {
        role: "system",
        content: getAISystemPrompt(room)
      },
      { role: "user", content: context }
    ]
  });

  return cleanText(a.choices?.[0]?.message?.content);
}

//////////////////////////////////////////////////////////////
// FALLBACK LINES
//////////////////////////////////////////////////////////////
function getStrangerFallback(room) {
  if (room?.strangerType === "ny_plaza") {
    return "Lobby always looks calm for about ten seconds before the city barges back in.";
  }

  if (room?.strangerType === "global_business") {
    return "Teams using Shopify and OpenAI are cutting manual content work and testing faster than they used to.";
  }

  return "The room keeps pulling in product talk and internet signals at the same time.";
}

function getFirstStrangerFallback(room) {
  if (room?.strangerType === "ny_plaza") {
    return "Lobby’s quieter than usual, which never lasts long here.";
  }

  if (room?.strangerType === "global_business") {
    return "Creators on YouTube Shorts are using AI tools to turn one idea into multiple tests before the day is over.";
  }

  return "Feels like everybody brought a different part of the internet into the room tonight.";
}

function getAIFallback(room) {
  if (room?.strangerType === "ny_plaza") {
    return "The room always shifts before the noise fully catches up.";
  }

  if (room?.strangerType === "global_business") {
    return "Execution moves differently once teams stop doing every repeatable step by hand.";
  }

  return "That actually fits the mood in here more than people want to admit.";
}

//////////////////////////////////////////////////////////////
// CORE TURN PROCESSOR
//////////////////////////////////////////////////////////////
async function processTurn(roomId) {
  const room = rooms[roomId];
  if (!room || room.aiBusy) return;
  if (!room.started) return;

  // normal rooms only run if active users exist
  // always-on rooms can still run without users
  if (!roomHasActiveUsers(roomId) && !shouldRoomRunWithoutUsers(room)) return;

  room.aiBusy = true;

  const failSafe = setTimeout(() => {
    const r = rooms[roomId];
    if (!r) return;
    r.aiBusy = false;
    r.turn = r.turn === "ai" ? "stranger" : "ai";
  }, 9000);

  try {
    const roomNow = rooms[roomId];
    if (!roomNow) {
      clearTimeout(failSafe);
      return;
    }

    const last = roomNow[roomNow.length - 1];
    const trends = await getTrendPool(roomNow);

    //////////////////////////////////////////////////////////
    // STRANGER TURN
    //////////////////////////////////////////////////////////
    if (roomNow.turn === "stranger") {
      const lastUser = [...roomNow].reverse().find(m => m.persona === "User");
      const focus = lastUser?.content || last?.content || "";
      const context = buildContext(roomNow, focus, trends);

      let text = await generateStrangerText(roomNow, context);

      if (!text || text.toLowerCase().includes("you still here")) {
        text = getStrangerFallback(roomNow);
      }

      roomNow.push({
        persona: "Stranger",
        content: text,
        time: Date.now()
      });

      emitToRoom(roomId, {
        id: makeId(),
        role: "ai",
        persona: "Stranger",
        text
      });

      roomNow.turn = "ai";
      roomNow.aiBusy = false;
      clearTimeout(failSafe);
      return;
    }

    //////////////////////////////////////////////////////////
    // AI TURN
    //////////////////////////////////////////////////////////
    const input =
      roomNow.queue.length > 0
        ? roomNow.queue.pop() // latest-first behavior
        : (last?.content || "");

    // Clear older queued items after prioritizing latest one
    roomNow.queue = [];

    const context = buildContext(roomNow, input, trends);

    let reply = await generateAIText(roomNow, context);

    if (!reply || reply.toLowerCase().includes("you still here")) {
      reply = getAIFallback(roomNow);
    }

    // Prevent accidental duplicate AI replies
    const replyHash = `${input}|||${reply}`;
    if (roomNow.lastReplyHash === replyHash) {
      reply = `${reply} It keeps landing there.`;
    }
    roomNow.lastReplyHash = replyHash;

    emitTypingToRoom(roomId);

    setTimeout(() => {
      const r = rooms[roomId];
      if (!r) return;

      clearTimeout(failSafe);

      r.push({
        persona: "AI",
        content: reply,
        time: Date.now()
      });

      emitToRoom(roomId, {
        id: makeId(),
        role: "ai",
        persona: "AI",
        text: reply
      });

      // Count AI turns per user, then do user-local presence prompt
      const sockets = io.sockets.adapter.rooms.get(roomId) || new Set();
      for (const socketId of sockets) {
        const state = ensureUserState(r, socketId);
        if (!state.awaiting) {
          state.aiCount += 1;
          state.time = Date.now();
        }
      }

      maybePromptPresence(roomId);

      r.aiBusy = false;
      r.turn = "stranger";
    }, getDelay(reply));
  } catch {
    clearTimeout(failSafe);
    if (rooms[roomId]) {
      rooms[roomId].aiBusy = false;
      rooms[roomId].turn = rooms[roomId].turn === "ai" ? "stranger" : "ai";
    }
  }
}

//////////////////////////////////////////////////////////////
// LOOP
//////////////////////////////////////////////////////////////
function startLoop(roomId) {
  const room = rooms[roomId];
  if (!room || room.loopStarted) return;

  room.loopStarted = true;

  const loop = async () => {
    const r = rooms[roomId];
    if (!r) return;

    const last = r[r.length - 1];
    const idle = Date.now() - (last?.time || 0);

    // immediate run wins
    if (r.immediateRun) {
      r.immediateRun = false;
      await processTurn(roomId);
      return;
    }

    // normal smooth loop
    const requiredIdle = 1600;

    if (!r.aiBusy && idle > requiredIdle) {
      await processTurn(roomId);
    }
  };

  setInterval(loop, 1800);
}

//////////////////////////////////////////////////////////////
// FIRST STRANGER
//////////////////////////////////////////////////////////////
async function startConversationIfNeeded(roomId) {
  const room = rooms[roomId];
  if (!room || room.started) return;

  room.started = true;
  room.turn = "stranger";

  try {
    const trends = await getTrendPool(room);
    const context = buildContext(room, "", trends);

    let text = await generateStrangerText(room, context);

    if (!text || text.toLowerCase().includes("you still here")) {
      text = getFirstStrangerFallback(room);
    }

    room.push({
      persona: "Stranger",
      content: text,
      time: Date.now()
    });

    emitToRoom(roomId, {
      id: makeId(),
      role: "ai",
      persona: "Stranger",
      text
    });

    room.turn = "ai";
  } catch {
    room.turn = "ai";
  }
}

//////////////////////////////////////////////////////////////
// TRIGGER AI IMMEDIATELY
//////////////////////////////////////////////////////////////
function triggerAI(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  room.turn = "ai";
  room.immediateRun = true;

  // Run now, not only on next loop tick
  setImmediate(() => {
    processTurn(roomId).catch(() => {});
  });
}

//////////////////////////////////////////////////////////////
// PRECREATE ALWAYS-ON ROOM
//////////////////////////////////////////////////////////////
function bootAlwaysOnRooms() {
  if (!rooms[ALWAYS_ON_ROOM_ID]) {
    rooms[ALWAYS_ON_ROOM_ID] = createRoom(ALWAYS_ON_ROOM_ID);
    startLoop(ALWAYS_ON_ROOM_ID);
    startConversationIfNeeded(ALWAYS_ON_ROOM_ID).catch(() => {});
  }
}

//////////////////////////////////////////////////////////////
// SOCKET
//////////////////////////////////////////////////////////////
io.on("connection", (socket) => {
  socket.on("joinRoom", async (roomId) => {
    if (!roomId) return;

    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = createRoom(roomId);
      startLoop(roomId);
    }

    const room = rooms[roomId];
    ensureUserState(room, socket.id);

    // Welcome only to this user
    socket.emit("message", {
      id: makeId(),
      role: "ai",
      persona: "System",
      text:
        room.title === "New York Plaza Hotel"
          ? "Welcome to Room New York Plaza Hotel"
          : room.title === "Global Room"
            ? "Welcome to Global Room"
            : "Welcome to 650AI ROOM"
    });

    // User count to active room
    broadcastUserCount(roomId);

    // Start stranger only once per room
    await startConversationIfNeeded(roomId);
  });

  ////////////////////////////////////////////////////////////
  // USER MESSAGE
  ////////////////////////////////////////////////////////////
  socket.on("sendMessage", ({ roomId, message }) => {
    const text = cleanText(message);
    if (!roomId || !text) return;

    const room = rooms[roomId];
    if (!room) return;

    const state = ensureUserState(room, socket.id);

    // Resume this user's experience immediately
    state.awaiting = false;
    state.aiCount = 0;
    state.time = Date.now();

    // Latest-first queue, bounded
    room.queue.push(text);
    if (room.queue.length > 5) {
      room.queue = room.queue.slice(-5);
    }

    const msg = {
      id: makeId(),
      role: "user",
      text
    };

    // User message shows instantly and never disappears
    socket.emit("message", msg);
    socket.to(roomId).emit("message", msg);

    room.push({
      persona: "User",
      content: text,
      time: Date.now(),
      socketId: socket.id
    });

    // AI responds immediately
    if (!room.aiBusy) {
      triggerAI(roomId);
    }
  });

  ////////////////////////////////////////////////////////////
  // DISCONNECT
  ////////////////////////////////////////////////////////////
  socket.on("disconnect", () => {
    for (const roomId of Object.keys(rooms)) {
      const room = rooms[roomId];
      if (!room) continue;

      if (room.userState?.[socket.id]) {
        delete room.userState[socket.id];
      }

      // let Socket.IO finish removing the socket from the room first
      setTimeout(() => {
        if (!rooms[roomId]) return;
        broadcastUserCount(roomId);
      }, 50);
    }
  });
});

//////////////////////////////////////////////////////////////
// START
//////////////////////////////////////////////////////////////
bootAlwaysOnRooms();

const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("CHATROOM RUNNING (GLOBAL + NEW YORK PLAZA + 650AI ROOM)");
});
