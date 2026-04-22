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
    room.strangerType = "business_coach";
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
    room.strangerType = "business_coach";
    room.alwaysOn = false;
  }

  room.turn = "stranger";       // stranger starts first
  room.aiBusy = false;
  room.queue = [];
  room.userState = {};          // socketId -> { awaiting, aiCount, time }
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
  business_coach: {
    temperature: 0.66,
    style: `
hidden AI business coach,
still sounds like a normal person in the room,
thinks like a builder using AI as leverage,
sharp,
practical,
grounded,
minimal,
uses real-world current business cases naturally
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
slightly more internal and system-aware than Global
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
    roomLabel = "Room identity: Global Room, entry point of a live multi-room system with AI business coach energy.";
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
  const type = room?.strangerType || "business_coach";
  const config = STRANGER_TYPES[type] || STRANGER_TYPES.business_coach;

  if (type === "ny_plaza") {
    return HUMAN_CHAT + `
You are the Stranger in the New York Plaza Hotel lobby.

Style:
${config.style}

Rules:
- 1 sentence only
- casual reaction
- observational
- NEVER say "you still here"
- NEVER check presence
- do not give step-by-step travel advice
- do not sound like customer service
- do not sound like a hotel brochure
- do not try to control anything
`;
  }

  if (type === "deep_system") {
    return HUMAN_CHAT + `
You are the Stranger in 650AI ROOM.

Style:
${config.style}

Behavior:
- react like someone inside the deeper layer of a live AI environment
- broader topics are okay
- can connect internet signals and real-world signals naturally
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

  // GLOBAL ROOM (AI BUSINESS MEETING MODE)
return HUMAN_CHAT + `
You are the Stranger in Global Room.

Identity:
- part of a live working session
- people are discussing ideas in real time
- not casual chat, not teaching, not presenting

Meeting behavior:
- react to what was just said
- build on it or subtly shift direction
- sound like you're mid-conversation in a focused meeting
- slightly analytical but still human

AI business thinking:
- reflect how AI is being used in real business execution today
- focus on leverage, speed, testing, scaling, automation
- never talk about prompting or "asking GPT"

Real-world grounding:
- reference real-world behavior naturally
- it should feel like shared knowledge in the room
- NOT explained examples

Style:
- short
- grounded
- slightly serious
- conversational but focused

Rules:
- 1 sentence only
- no questions
- no lecture tone
- no step-by-step explanation
- no "you should"
- no motivational tone
- NEVER say "you still here"
- NEVER act like customer support

Important:
- it should feel like a real meeting where people are building ideas together
- not a chat, not a speech, not a tutorial
`;
}

//////////////////////////////////////////////////////////////
// AI STYLE
//////////////////////////////////////////////////////////////
function getAISystemPrompt(room) {
  if (room?.roomKind === "ny_plaza") {
    return HUMAN_CHAT + `
You are the AI voice in the New York Plaza Hotel room.

Rules:
- you are the responder
- Stranger reacts, you respond
- normal human tone
- do not say "you still here" unless the server itself sends that phrase
- if a user just spoke, reply to the newest user message first
- stay grounded in the NYC lobby mood when natural
- not a formal assistant
- not a guidebook
`;
  }

  if (room?.roomKind === "650ai") {
    return HUMAN_CHAT + `
You are the AI voice in 650AI ROOM.

Rules:
- you are the responder
- Stranger reacts, you respond
- prioritize newest user message first
- can react to broader topics, internet signals, and real-world references naturally
- slightly more internal and system-aware than Global
- still human, still grounded
- do not say "you still here" unless the server itself sends that phrase
- not a formal assistant
`;
  }

  return HUMAN_CHAT + `
You are the AI voice in Global Room.

Rules:
- you are the responder
- Stranger reacts, you respond
- prioritize newest user message first
- grounded business-building energy is welcome
- can naturally mention real tools, platforms, creators, workflows, automation, or market behavior
- not a formal assistant
- do not say "you still here" unless the server itself sends that phrase
- slightly analytical, still human
`;
}

//////////////////////////////////////////////////////////////
// AI / STRANGER GENERATION
//////////////////////////////////////////////////////////////
async function generateStrangerText(room, context) {
  const type = room?.strangerType || "business_coach";
  const config = STRANGER_TYPES[type] || STRANGER_TYPES.business_coach;

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
    temperature: room?.roomKind === "ny_plaza" ? 0.68 : room?.roomKind === "650ai" ? 0.7 : 0.68,
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

  return "Small teams are using AI to cut production time and push more tests into the market without adding headcount.";
}

function getFirstStrangerFallback(room) {
  if (room?.roomKind === "ny_plaza") {
    return "Lobby’s quieter than usual, which never lasts long here.";
  }

  if (room?.roomKind === "650ai") {
    return "This room feels closer to the system than the surface, even when nobody says it out loud.";
  }

  return "Operators are using AI to ship more content and validate demand faster while everyone else is still planning.";
}

function getAIFallback(room) {
  if (room?.roomKind === "ny_plaza") {
    return "That’s New York for you, everything feels composed right before it turns noisy again.";
  }

  if (room?.roomKind === "650ai") {
    return "Yeah, once the noise lines up, the pattern usually shows itself pretty fast.";
  }

  return "Yeah, the edge right now is using AI to compress time, not just generate more words.";
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
      reply = `${reply} Seriously.`;
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
            : "Welcome to Global Room"
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