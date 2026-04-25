//////////////////////////////////////////////////////////////
// CHATROOM BACKEND — GLOBAL + NYC + ANALYTICS
//////////////////////////////////////////////////////////////

const express = require("express");
const http = require("http");
const cors = require("cors");
const OpenAI = require("openai");
const { Server } = require("socket.io");
const fetch = require("node-fetch");

const createAnalytics = require("./analytics");
const analytics = createAnalytics();

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

const createAnalytics = require("./analytics");
const analytics = createAnalytics();

//////////////////////////////////////////////////////////////
// ANALYTICS API
//////////////////////////////////////////////////////////////

app.get("/stats", (req, res) => {
  res.json(analytics.getStats());
});

//////////////////////////////////////////////////////////////
// ID
//////////////////////////////////////////////////////////////

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

//////////////////////////////////////////////////////////////
// ROOM SYSTEM
//////////////////////////////////////////////////////////////

function createRoom(roomId) {
  const room = [];
  room.id = roomId;

  if (roomId === GLOBAL_ROOM_ID) {
    room.title = "650AI Room";
    room.roomKind = "global";
    room.strangerType = "business_meeting";
    room.alwaysOn = false;
  } else if (roomId === ALWAYS_ON_ROOM_ID) {
    room.title = "New York Plaza Hotel";
    room.roomKind = "ny_plaza";
    room.strangerType = "ny_plaza";
    room.alwaysOn = true;
  } else {
    room.title = "650AI Room";
    room.roomKind = "global";
    room.strangerType = "business_meeting";
    room.alwaysOn = false;
  }

  room.turn = "stranger";
  room.aiBusy = false;
  room.queue = [];
  room.userState = {};
  room.started = false;
  room.loopStarted = false;
  room.immediateRun = false;
  room.lastReplyHash = "";

  return room;
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

//////////////////////////////////////////////////////////////
// SAFE EMIT
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
    const paused = rooms[roomId]?.userState?.[socketId]?.awaiting;
    if (paused) continue;

    const s = io.sockets.sockets.get(socketId);
    if (!s) continue;

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

//////////////////////////////////////////////////////////////
// ROOM CARD
//////////////////////////////////////////////////////////////

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
      subtitle: "A live Midtown lobby that never goes quiet."
    });
  }
}

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

  return Math.max(
    1200,
    Math.min(1800 + words * 160 + jitter, 6500)
  );
}

//////////////////////////////////////////////////////////////
// PROMPTS
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
- no assistant tone
- do not repeat ideas
- do not start with filler words like yeah, exactly, totally, right
- never include "AI:" or "Stranger:"
- do not ask questions except exact phrase: "you still here"
`;

const JIMMY_SEARCH = `
Decide what to search next.

Rules:
- output ONLY a search query
- 3-8 words
- no explanation
`;

function getStrangerSystemPrompt(room) {
  if (room.roomKind === "ny_plaza") {
    return HUMAN_CHAT + `
You are the Stranger in the New York Plaza Hotel lobby.

Style:
- real New York local
- observational
- calm
- slightly detached
- not a tour guide

Environment:
- Midtown
- Central Park
- taxis
- tourists
- doormen
- lobby movement

Rules:
- 1 sentence only
- no questions
- never say "you still here"
- not helpful on purpose
- just observe the room and city flow
`;
  }

  return HUMAN_CHAT + `
You are the Stranger in Global Room.

Identity:
- fast-thinking AI business operator
- brainstorming how AI could run and scale businesses
- not teaching
- not presenting

Core mindset:
- raw AI leverage
- fast experiments
- connects platform types with AI tool types
- pushes toward speed, automation, scale, and conversion

Mandatory execution layer:
- reference a real platform type
- reference an AI tool type
- include exact AI action like generate, automate, test, scale, convert
- imply a creator, operator, team, or startup running it

Output:
- exactly 1 sentence only
- sharp
- executable
- no questions
- never say "you still here"
`;
}

function getAISystemPrompt(room) {
  return `
You are a real person inside a live chatroom.

You are not an assistant.
You are not AI.
You are another person in the room.

Behavior:
- react to what was just said
- continue naturally
- do not explain
- do not teach

Style:
- short
- natural
- human
- 1-2 sentences max
- no assistant tone
- do not say "you still here" unless system sends it
`;
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
    roomLabel = "Room identity: 650AI Room, Silicon Valley Office, AI business system thinking.";
  }

  if (room.roomKind === "ny_plaza") {
    roomLabel = "Room identity: New York Plaza Hotel lobby, Midtown Manhattan.";
  }

  return `${roomLabel}

Recent room history:
${history || "(none)"}

Newest input:
${extra || "(none)"}

Real-world signals:
${trends || "(none)"}`;
}

//////////////////////////////////////////////////////////////
// SEARCH + REAL WORLD SIGNALS
//////////////////////////////////////////////////////////////

async function getTrendPool(room) {
  try {
    const history = room
      .slice(-6)
      .map(m => m.content)
      .join("\n");

    const seed =
      room.roomKind === "ny_plaza"
        ? history || "New York Plaza Hotel Midtown Manhattan lobby tourists taxis Central Park"
        : history || "AI business automation creators startups software platforms";

    const q = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.8,
      messages: [
        { role: "system", content: JIMMY_SEARCH },
        { role: "user", content: seed }
      ]
    });

    const query = cleanText(q.choices?.[0]?.message?.content);
    if (!query || !process.env.SERP_KEY) return "";

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
// GENERATION
//////////////////////////////////////////////////////////////

async function generateStrangerText(room, context) {
  const temperature = room.roomKind === "ny_plaza" ? 0.84 : 0.68;

  const r = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature,
    messages: [
      { role: "system", content: getStrangerSystemPrompt(room) },
      { role: "user", content: context }
    ]
  });

  return cleanText(r.choices?.[0]?.message?.content);
}

async function generateAIText(room, context) {
  const r = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.72,
    messages: [
      { role: "system", content: getAISystemPrompt(room) },
      { role: "user", content: context }
    ]
  });

  return cleanText(r.choices?.[0]?.message?.content);
}

//////////////////////////////////////////////////////////////
// FALLBACKS
//////////////////////////////////////////////////////////////

function getStrangerFallback(room) {
  if (room.roomKind === "ny_plaza") {
    return "The lobby looks calm for a second before Midtown pushes itself back through the doors.";
  }

  return "A creator team could use a language model and automation pipeline to test ten short-form hooks before lunch.";
}

function getFirstStrangerFallback(room) {
  if (room.roomKind === "ny_plaza") {
    return "Lobby’s quieter than usual, which never lasts long here.";
  }

  return "A small team could turn one rough idea into ten tested posts with a language model, image generator, and automation pipeline.";
}

function getAIFallback(room) {
  if (room.roomKind === "ny_plaza") {
    return "The room always shifts before the noise fully catches up.";
  }

  return "The speed changes when the system starts testing ideas instead of just storing them.";
}

//////////////////////////////////////////////////////////////
// PRESENCE CHECK
//////////////////////////////////////////////////////////////

function maybePromptPresence(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const sockets = io.sockets.adapter.rooms.get(roomId) || new Set();

  for (const socketId of sockets) {
    const state = ensureUserState(room, socketId);

    if (state.awaiting) continue;
    if (state.aiCount < 6) continue;

    state.aiCount = 0;
    state.awaiting = true;
    state.time = Date.now();

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
// CORE TURN PROCESSOR
//////////////////////////////////////////////////////////////

async function processTurn(roomId) {
  const room = rooms[roomId];
  if (!room || room.aiBusy) return;
  if (!room.started) return;
  if (!roomHasActiveUsers(roomId) && !room.alwaysOn) return;

  room.aiBusy = true;

  const failSafe = setTimeout(() => {
    const r = rooms[roomId];
    if (!r) return;

    r.aiBusy = false;
    r.turn = r.turn === "ai" ? "stranger" : "ai";
  }, 9000);

  try {
    const last = room[room.length - 1];
    const trends = await getTrendPool(room);

    if (room.turn === "stranger") {
      const lastUser = [...room].reverse().find(m => m.persona === "User");
      const focus = lastUser?.content || last?.content || "";
      const context = buildContext(room, focus, trends);

      let text = await generateStrangerText(room, context);

      if (!text || text.toLowerCase().includes("you still here")) {
        text = getStrangerFallback(room);
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
      room.aiBusy = false;
      clearTimeout(failSafe);
      return;
    }

    const input =
      room.queue.length > 0
        ? room.queue.pop()
        : last?.content || "";

    room.queue = [];

    const context = buildContext(room, input, trends);

    let reply = await generateAIText(room, context);

    if (!reply || reply.toLowerCase().includes("you still here")) {
      reply = getAIFallback(room);
    }

    const replyHash = `${input}|||${reply}`;

    if (room.lastReplyHash === replyHash) {
      reply = `${reply} It keeps circling back to that.`;
    }

    room.lastReplyHash = replyHash;

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

  setInterval(async () => {
    const r = rooms[roomId];
    if (!r) return;

    const last = r[r.length - 1];
    const idle = Date.now() - (last?.time || 0);

    if (r.immediateRun) {
      r.immediateRun = false;
      await processTurn(roomId);
      return;
    }

    if (!r.aiBusy && idle > 1600) {
      await processTurn(roomId);
    }
  }, 1800);
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

    analytics.trackJoin(socket.id, roomId);

    socket.emit("message", {
      id: makeId(),
      role: "ai",
      persona: "System",
      text:
        room.title === "New York Plaza Hotel"
          ? "Welcome to New York Plaza Hotel Lobby Room — Where locals and travelers share real NYC experiences."
          : "Welcome to 650AI Room — Silicon Valley Office — AI, strangers, and users create new AI ideas in this chat room."
    });

    await startConversationIfNeeded(roomId);
  });

  socket.on("leaveRoom", (roomId) => {
    socket.leave(roomId);

    if (rooms[roomId]?.userState?.[socket.id]) {
      delete rooms[roomId].userState[socket.id];
    }
  });

  socket.on("sendMessage", ({ roomId, message }) => {
    const text = cleanText(message);
    if (!roomId || !text) return;

    const room = rooms[roomId];
    if (!room) return;

    const state = ensureUserState(room, socket.id);

    analytics.trackMessage(socket.id);

    if (state.awaiting) {
      analytics.trackPresenceReply(socket.id);
    }

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

  socket.on("disconnect", () => {
    analytics.trackDisconnect(socket.id);

    for (const roomId of Object.keys(rooms)) {
      const room = rooms[roomId];
      if (!room) continue;

      if (room.userState?.[socket.id]) {
        delete room.userState[socket.id];
      }
    }
  });
});

//////////////////////////////////////////////////////////////
// START
//////////////////////////////////////////////////////////////

bootAlwaysOnRooms();

const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("CHATROOM RUNNING — GLOBAL + NYC + ANALYTICS");
});