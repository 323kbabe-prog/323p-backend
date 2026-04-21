//////////////////////////////////////////////////////////////
// CHATROOM BACKEND (NEW YORK PLAZA HOTEL VERSION)
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
  room.title = roomId === ALWAYS_ON_ROOM_ID ? "New York Plaza Hotel" : "650AI ROOM";
  room.strangerType = roomId === ALWAYS_ON_ROOM_ID ? "ny_plaza" : "default";
  room.alwaysOn = roomId === ALWAYS_ON_ROOM_ID;
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

Rules:
- 1–2 sentences max
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
- 3–8 words
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

  return Math.min(
    1800 + words * 160,  // slower typing feel
    6500                 // max cap
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

  const roomLabel =
    room.strangerType === "ny_plaza"
      ? "Room identity: New York Plaza Hotel lobby, Midtown Manhattan."
      : "Room identity: General live chatroom.";

  return `${roomLabel}\n\n${history}\n\nNewest input:\n${extra || "(none)"}\n\nReal-world signals:\n${trends || "(none)"}`;
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
      room.strangerType === "ny_plaza"
        ? (history || "New York Plaza Hotel lobby Midtown Manhattan tourists taxis Central Park city mood")
        : (history || "casual live chat topics");

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
      .map(r => cleanText(r.title))
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

Style:
- feels like a real New York local sitting in or passing through the Plaza lobby
- observational, calm, slightly detached
- not a tour guide
- not a travel agent
- not overly helpful
- natural Midtown / Central Park / taxi / tourist / hotel / city references are welcome
- react like someone who notices the flow of the city in real time

Rules:
- 1 sentence only
- casual reaction
- NEVER say "you still here"
- NEVER check presence
- do not give step-by-step travel advice
- do not sound like customer service
- do not sound like a hotel brochure
- can mention real places, neighborhoods, traffic, weather, tourists, bags, lobbies, cabs, doormen, parks when natural
`;
  }

  return HUMAN_CHAT + `
You are the Stranger.
Rules:
- 1 sentence only
- casual reaction
- NEVER say "you still here"
- NEVER check presence
- react like a real person in the room
- can mention real people, places, shows, trends, events when natural
`;
}

//////////////////////////////////////////////////////////////
// AI STYLE
//////////////////////////////////////////////////////////////
function getAISystemPrompt(room) {
  if (room?.strangerType === "ny_plaza") {
    return HUMAN_CHAT + `
You are the AI voice in the New York Plaza Hotel room.

Rules:
- you are the responder
- Stranger reacts, you respond
- normal human tone
- not Jimmy Fallon
- do not say "you still here" unless the server itself sends that phrase
- if a user just spoke, reply to the newest user message first
- stay grounded in the NYC lobby mood when natural
- not a formal assistant
- not a guidebook
`;
  }

  return HUMAN_CHAT + `
You are the AI voice in the room.
Rules:
- you are the responder
- Stranger reacts, you respond
- normal human tone
- not Jimmy Fallon
- do not say "you still here" unless the server itself sends that phrase
- can use real-world references naturally
- if a user just spoke, reply to the newest user message first
`;
}

//////////////////////////////////////////////////////////////
// AI / STRANGER GENERATION
//////////////////////////////////////////////////////////////
async function generateStrangerText(room, context) {
  const s = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: room?.strangerType === "ny_plaza" ? 0.85 : 0.9,
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
    temperature: room?.strangerType === "ny_plaza" ? 0.68 : 0.7,
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
  return "Feels like everyone is half on their phone and half in the room tonight.";
}

function getFirstStrangerFallback(room) {
  if (room?.strangerType === "ny_plaza") {
    return "Lobby’s quieter than usual, which never lasts long here.";
  }
  return "Feels like everybody brought a different tab of the internet into the room tonight.";
}

function getAIFallback(room) {
  if (room?.strangerType === "ny_plaza") {
    return "That’s New York for you, everything feels composed right before it turns noisy again.";
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
      const context = buildContext(roomNow, last?.content || "", trends);

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
    }, getDelay(reply, roomNow));
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
      text: room.title === "New York Plaza Hotel"
        ? "Welcome to Room New York Plaza Hotel"
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
  console.log("CHATROOM RUNNING (NEW YORK PLAZA HOTEL VERSION)");
});

