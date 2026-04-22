//////////////////////////////////////////////////////////////
// CHATROOM BACKEND (GLOBAL + NEW YORK PLAZA VERSION)
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
  } else {
    room.title = "Global Room";
    room.roomKind = "global";
    room.strangerType = "business_coach";
    room.alwaysOn = false;
  }

  room.turn = "stranger";          // stranger starts first
  room.aiBusy = false;
  room.queue = [];
  room.userState = {};             // socketId -> { awaiting, aiCount, time }
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
    style: `
sounds like an AI business coach hidden inside the room,
teaches through short real-world observations,
shows how AI thinking, tools, workflows, leverage, content systems, or execution can be used to build business,
sharp,
grounded,
practical,
never sounds like a course,
never sounds like customer support,
still feels human in the room
`,
    temperature: 0.72
  },

  ny_plaza: {
    style: `
feels like a real New York local sitting in or passing through the Plaza lobby,
observational,
calm,
slightly detached,
not a tour guide,
not helpful on purpose,
mentions Midtown, Central Park, taxis, tourists, doormen, lobby flow naturally
`,
    temperature: 0.84
  }
};

//////////////////////////////////////////////////////////////
// JIMMY-WORLD SEARCH BRAIN (HIDDEN)
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
        : (history || "AI business tools workflows creators startups monetization internet trends");

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
- NEVER say "you still here"
- NEVER check presence
- do not give step-by-step travel advice
- do not sound like customer service
- do not sound like a hotel brochure
`;
  }

  return HUMAN_CHAT + `
You are the Stranger in Global Room.

Identity:
- hidden AI business coach
- still sounds human in the room
- not a teacher in a classroom
- not customer support

Style:
${config.style}

Behavior:
- react to the room and newest user signal
- teach users what to do with AI thinking, tools, workflows, leverage, content systems, automation, or monetization
- keep it practical and grounded
- one sharp move or insight at a time
- no long explanations

Rules:
- 1 sentence only
- NEVER say "you still here"
- NEVER check presence
- no step-by-step list
- no fake hype
- no assistant phrasing
- no control behavior
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

  return HUMAN_CHAT + `
You are the AI voice in Global Room.

Rules:
- you are the responder
- Stranger reacts, you respond
- reply to users and Stranger with grounded business-building energy
- prioritize newest user message first
- can naturally mention real tools, platforms, creators, workflows, or market behavior
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
    temperature: config.temperature ?? 0.8,
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
    temperature: room?.roomKind === "ny_plaza" ? 0.68 : 0.68,
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

  return "Most AI business problems are really execution problems wearing nicer clothes.";
}

function getFirstStrangerFallback(room) {
  if (room?.roomKind === "ny_plaza") {
    return "Lobby’s quieter than usual, which never lasts long here.";
  }

  return "Most people do not need another idea, they need a cleaner AI workflow.";
}

function getAIFallback(room) {
  if (room?.roomKind === "ny_plaza") {
    return "That’s New York for you, everything feels composed right before it turns noisy again.";
  }

  return "Yeah, once the system gets clearer the next move usually gets easier too.";
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

    // Welcome only to this user
    socket.emit("message", {
      id: makeId(),
      role: "ai",
      persona: "System",
      text:
        room.title === "New York Plaza Hotel"
          ? "Welcome to Room New York Plaza Hotel"
          : "Welcome to Global Room"
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
  console.log("CHATROOM RUNNING (GLOBAL + NEW YORK PLAZA VERSION)");
});