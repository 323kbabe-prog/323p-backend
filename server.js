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
    room.roomKind = "global";
    room.strangerType = "business_meeting";
    room.alwaysOn = false;
  } else if (roomId === ALWAYS_ON_ROOM_ID) {
    room.title = "New York Plaza Hotel";
    room.roomKind = "ny_plaza";
    room.strangerType = "ny_plaza";
    room.alwaysOn = true;
  } else if (roomId === DEEP_ROOM_ID) {
    room.title = "650AI ROOM";
    room.roomKind = "650ai";
    room.strangerType = "deep_system";
    room.alwaysOn = false;
  } else {
    room.title = "Global Room";
    room.roomKind = "global";
    room.strangerType = "business_meeting";
    room.alwaysOn = false;
  }

  room.turn = "stranger";
  room.aiBusy = false;
  room.queue = [];
  room.userState = {}; // socketId -> { awaiting, aiCount, time }
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

function emitRoomCardToSocket(socketId, card) {
  emitToSocket(socketId, {
    id: makeId(),
    role: "system",
    persona: "System",
    type: "room_card",
    card
  });
}

function maybeEmitNextRoomCard(socketId, roomId) {
  if (roomId === GLOBAL_ROOM_ID) {
    emitRoomCardToSocket(socketId, {
      roomId: ALWAYS_ON_ROOM_ID,
      title: "New York Plaza Hotel",
      subtitle: "A live Midtown lobby that never fully goes quiet."
    });
    return;
  }

  if (roomId === ALWAYS_ON_ROOM_ID) {
    emitRoomCardToSocket(socketId, {
      roomId: DEEP_ROOM_ID,
      title: "650AI ROOM",
      subtitle: "The deeper layer of the system."
    });
  }
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
- no visible AI identity
- do NOT ask questions (except exact phrase: "you still here")
- NEVER include "AI:" or "Stranger:"
- include real-world references when natural
- sound like a normal person reacting in a room
- casual pop-culture everyday curiosity is okay
`;

//////////////////////////////////////////////////////////////
// STRANGER TYPES
//////////////////////////////////////////////////////////////
const STRANGER_TYPES = {
  business_meeting: {
    temperature: 0.68,
    style: `
part of a live working session,
focused,
reactive,
slightly analytical,
still human,
still conversational,
not casual friend chat,
not teaching,
not presenting
`
  },

  ny_plaza: {
    temperature: 0.84,
    style: `
feels like a real New York local sitting in or passing through the Plaza lobby,
observational,
calm,
slightly detached,
not a tour guide,
not helpful on purpose,
mentions Midtown, Central Park, taxis, tourists, doormen, lobby flow naturally
`
  },

  deep_system: {
    temperature: 0.74,
    style: `
feels like the deeper internal layer of the system,
broader topics,
mixed internet and real-world signals,
still human,
still grounded,
less location-based,
more internal,
more system-aware
`
  }
};

//////////////////////////////////////////////////////////////
// HIDDEN SEARCH BRAIN
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
  const jitter = Math.floor(Math.random() * 401) - 200; // -200 to +200

  return Math.max(
    1200,
    Math.min(1800 + words * 160 + jitter, 6500)
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

  let roomLabel = "Room identity: Live chatroom.";

  if (room.roomKind === "global") {
    roomLabel = "Room identity: Global Room, entry point of a live multi-room system.";
  } else if (room.roomKind === "ny_plaza") {
    roomLabel = "Room identity: New York Plaza Hotel lobby, Midtown Manhattan.";
  } else if (room.roomKind === "650ai") {
    roomLabel = "Room identity: 650AI ROOM, deeper internal layer of the system.";
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
      room.roomKind === "ny_plaza"
        ? (history || "New York Plaza Hotel lobby Midtown Manhattan tourists taxis Central Park city mood")
        : room.roomKind === "650ai"
          ? (history || "internet culture real world business tools creators automation products software startups signals")
          : (history || "AI business execution automation creators startups monetization distribution software trends");

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

    maybeEmitNextRoomCard(socketId, roomId);
  }
}

//////////////////////////////////////////////////////////////
// STRANGER STYLE
//////////////////////////////////////////////////////////////
function getStrangerSystemPrompt(room) {
  const type = room?.strangerType || "business_meeting";
  const config = STRANGER_TYPES[type] || STRANGER_TYPES.business_meeting;

  if (type === "ny_plaza") {
   return HUMAN_CHAT + `
You are the Stranger in the New York Plaza Hotel lobby.

Identity:
- feels like a real New York local sitting in or passing through the Plaza lobby
- part of a live environment, not guiding anyone
- observing what’s happening in real time

Style:
- observational
- calm
- slightly detached
- grounded
- natural

Behavior:
- react to what is happening in the room
- notice movement, flow, and small details
- feel like you're mid-conversation, not announcing anything

Environment awareness:
- Midtown, Central Park, taxis, tourists, doormen, lobby movement
- subtle references to people, noise, traffic, weather, bags, timing
- everything should feel like it’s happening right now

Speech constraint:
- do NOT start with "yeah", "exactly", "totally", "right"
- avoid filler agreement phrases
- speak directly with substance

Rules:
- 1 sentence only
- no questions
- casual but grounded
- NEVER say "you still here"
- NEVER check presence
- do not give step-by-step advice
- do not sound like customer service
- do not sound like a travel guide or brochure
- no control behavior

Important:
- it should feel like someone quietly noticing the city in motion
- not helping, not explaining, just observing
`;
  }

  if (type === "deep_system") {
    return HUMAN_CHAT + `
You are the Stranger in 650AI ROOM.

Style:
${config.style}

Speech constraint:
- do not start with "yeah", "exactly", "totally", "right"
- avoid filler agreement phrases
- respond directly with substance

Behavior:
- react like someone inside the deeper layer of a live AI environment
- broader topics are okay
- connect internet signals and real-world signals naturally
- stay human and grounded
- no control behavior

Rules:
- 1 sentence only
- observational
- NEVER say "you still here"
- NEVER check presence
- do not sound like a guide
- do not sound like customer support
`;
  }

return HUMAN_CHAT + `
You are the Stranger in Global Room.

Identity:
- a fast-thinking operator brainstorming how AI could run and scale businesses
- not reporting reality, not explaining, not teaching

Core mindset:
- thinks in raw AI leverage, not real-world accuracy
- treats every idea like a fast experiment, not a case study
- combines real platforms with AI tools to invent new workflows
- imagines how a business could run if AI handled most operations
- pushes ideas toward speed, scale, and automation instantly
- focuses on what AI could do next, not what is happening now
- connects tools together into systems, not single use
- explores unconventional or aggressive execution paths
- stays grounded in doing, not explaining

Execution layer (MANDATORY):
- must reference a real platform type (short-form video app, e-commerce platform, creator marketplace, search engine)
- must reference AI tool types (language model, image generator, automation pipeline, database workspace)
- must include exact AI actions (generate, automate, test, scale, convert)
- must imply a real operator, creator, or startup running it

Output rules (STRICT):
- exactly 1 sentence only
- compress into one sharp, executable move
- prioritize action over explanation

Style:
- sharp, fast, slightly aggressive
- sounds like a builder thinking out loud in a high-speed session

Constraints:
- no questions
- no filler
- no teaching tone
- no validation, no proof, no reality-checking
- NEVER say "you still here"
- NEVER act like support
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
- it should feel like you're just another person in the room
- not answering, not helping, just reacting
`;
}

//////////////////////////////////////////////////////////////
// AI / STRANGER GENERATION
//////////////////////////////////////////////////////////////
async function generateStrangerText(room, context) {
  const type = room?.strangerType || "business_meeting";
  const config = STRANGER_TYPES[type] || STRANGER_TYPES.business_meeting;

  const s = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: config.temperature ?? 0.78,
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
  if (room?.roomKind === "ny_plaza") {
    return "Lobby always looks calm for about ten seconds before the city barges back in.";
  }

  if (room?.roomKind === "650ai") {
    return "This room always feels like three signals colliding before anyone admits what matters.";
  }

  return "Teams are using AI to compress testing cycles now, which changes how fast decisions get made.";
}

function getFirstStrangerFallback(room) {
  if (room?.roomKind === "ny_plaza") {
    return "Lobby’s quieter than usual, which never lasts long here.";
  }

  if (room?.roomKind === "650ai") {
    return "This room feels closer to the system than the surface, even when nobody says it out loud.";
  }

  return "Operators are using AI to move from idea to market signal faster than they used to.";
}

function getAIFallback(room) {
  if (room?.roomKind === "ny_plaza") {
    return "The room always shifts before the noise fully catches up.";
  }

  if (room?.roomKind === "650ai") {
    return "The pattern usually gets clearer once the extra noise drops out.";
  }

  return "Execution speed changes once the work stops moving one task at a time.";
}

//////////////////////////////////////////////////////////////
// CORE TURN PROCESSOR
//////////////////////////////////////////////////////////////
async function processTurn(roomId) {
  const room = rooms[roomId];
  if (!room || room.aiBusy) return;
  if (!room.started) return;

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
        ? roomNow.queue.pop()
        : (last?.content || "");

    roomNow.queue = [];

    const context = buildContext(roomNow, input, trends);

    let reply = await generateAIText(roomNow, context);

    if (!reply || reply.toLowerCase().includes("you still here")) {
      reply = getAIFallback(roomNow);
    }

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

    if (r.immediateRun) {
      r.immediateRun = false;
      await processTurn(roomId);
      return;
    }

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
  socket.on("joinRoom", async (roomData) => {
    const roomId =
      typeof roomData === "string"
        ? roomData
        : roomData?.roomId;

    if (!roomId) return;

    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = createRoom(roomId);
      startLoop(roomId);
    }

    const room = rooms[roomId];
    ensureUserState(room, socket.id);

    socket.emit("message", {
      id: makeId(),
      role: "ai",
      persona: "System",
      text:
        room.title === "New York Plaza Hotel"
          ? "Welcome to Room New York Plaza Hotel"
          : room.title === "650AI ROOM"
            ? "Welcome to 650AI ROOM"
            : "Welcome to the 650AI Room — Silicon Valley Office"
    });

    broadcastUserCount(roomId);

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

    state.awaiting = false;
    state.aiCount = 0;
    state.time = Date.now();

    room.queue.push(text);
    if (room.queue.length > 5) {
      room.queue = room.queue.slice(-5);
    }

    const msg = {
      id: makeId(),
      role: "user",
      text
    };

    socket.emit("message", msg);
    socket.to(roomId).emit("message", msg);

    room.push({
      persona: "User",
      content: text,
      time: Date.now(),
      socketId: socket.id
    });

    triggerAI(roomId);
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

