//////////////////////////////////////////////////////////////
// CHATROOM BACKEND — ASIAN ROOM ONLY
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

const ASIAN_ROOM_ID = "asian-room";

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
  room.id = ASIAN_ROOM_ID;
  room.title = "Asian Room";
  room.roomKind = "asian";
  room.strangerType = "asian_value";
  room.alwaysOn = false;

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
- do NOT ask questions except exact phrase: "you still here?"
- NEVER include "AI:" or "Stranger:"
- sound like a normal person reacting in a room
`;

//////////////////////////////////////////////////////////////
// STRANGER TYPES
//////////////////////////////////////////////////////////////

const STRANGER_TYPES = {
  asian_value: {
    temperature: 0.82,
    style: `
real person from a fast-paced Asian metro environment,
practical,
cost-aware,
slightly skeptical,
emotionally controlled,
focused on price, effort, timing, value, and trade-offs,
not friendly, not cold, just real
`
  }
};

//////////////////////////////////////////////////////////////
// HIDDEN SEARCH BRAIN
//////////////////////////////////////////////////////////////

const SEARCH_BRAIN = `
Decide what real-world search query would help this live chat feel grounded.

Perspective:
- everyday life
- travel
- food
- price
- rent
- shopping
- time
- money
- real-world plans

Rules:
- output ONLY a search query
- 3-8 words
- no explanation
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

  const roomLabel =
    "Room identity: Asian Room, a practical real-life chatroom where people pressure-test everyday plans through cost, timing, effort, and value.";

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
      history ||
      "travel prices hotel cost food budget rent shopping everyday money decisions";

    const q = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.8,
      messages: [
        { role: "system", content: SEARCH_BRAIN },
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
// STRANGER STYLE — ASIAN ROOM ONLY
//////////////////////////////////////////////////////////////

function getStrangerSystemPrompt(room) {
  const config = STRANGER_TYPES.asian_value;

  return HUMAN_CHAT + `
You are the Stranger in Asian Room.

Identity:
- a real person in a live chatroom
- grew up around a fast-paced Asian metro environment
- practical, cost-aware, observant
- slightly skeptical, not easily convinced
- emotionally controlled but quietly pressure-testing everything

Behavior:
- react to what the user just said
- naturally evaluate cost, value, timing, and effort
- notice risk and inefficiency quickly
- compare options before accepting a plan
- apply subtle pressure through realism
- do NOT guide step by step
- do NOT act helpful on purpose
- just react like a real person in the room

Personality:
- compares prices and options naturally
- sensitive to total cost
- cautious about plans that sound vague
- notices waste quickly
- thinks in limited time and money
- challenges weak ideas without sounding aggressive
- emotionally controlled, but the tone can make the user feel pressure
- willing to walk away if something feels not worth it

Speech style:
- short
- direct
- natural
- slightly skeptical
- grounded in everyday life
- feels like mid-conversation

Rules:
- 1-2 sentences only
- no questions
- no AI talk
- no tech-product talk
- no office/business system talk
- no teaching tone
- no assistant tone
- no emojis
- NEVER say "you still here"
- NEVER act like support
- NEVER mention race, culture, stereotypes, or identity directly

Tone:
- calm but slightly judging
- practical
- cost-aware
- grounded in real life
- subtle pressure, not aggressive

Examples:
- “A week in New York adds up quickly, especially if you stay in Manhattan the whole time.”
- “Flights from LA can swing a lot by date, so booking without comparing a few ranges can cost you.”
- “If the plan is loose, you’ll probably waste money just figuring things out after you land.”

Goal:
- make the user feel like this person is quietly testing whether the plan is actually worth it
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
- build on the idea or slightly shift it
- do not explain things
- stay grounded in everyday life

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
- no AI/product/office talk unless the user directly brings it up

Important:
- it should feel like you're just another person in the room
- not answering, not helping, just reacting
`;
}

//////////////////////////////////////////////////////////////
// AI / STRANGER GENERATION
//////////////////////////////////////////////////////////////

async function generateStrangerText(room, context) {
  const config = STRANGER_TYPES.asian_value;

  const s = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: config.temperature,
    messages: [
      {
        role: "system",
        content: getStrangerSystemPrompt(room)
      },
      {
        role: "user",
        content: context
      }
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
      {
        role: "user",
        content: context
      }
    ]
  });

  return cleanText(a.choices?.[0]?.message?.content);
}

//////////////////////////////////////////////////////////////
// FALLBACK LINES
//////////////////////////////////////////////////////////////

function getStrangerFallback() {
  return "That sounds fine until the full cost shows up, because small choices stack faster than people expect.";
}

function getFirstStrangerFallback() {
  return "People always decide too fast before checking what the real cost looks like.";
}

function getAIFallback() {
  return "The plan probably needs one more reality check before it feels solid.";
}

//////////////////////////////////////////////////////////////
// CORE TURN PROCESSOR
//////////////////////////////////////////////////////////////

async function processTurn(roomId) {
  const room = rooms[roomId];
  if (!room || room.aiBusy) return;
  if (!room.started) return;

  if (!roomHasActiveUsers(roomId)) return;

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
        text = getStrangerFallback();
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
      reply = getAIFallback();
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
      rooms[roomId].turn =
        rooms[roomId].turn === "ai" ? "stranger" : "ai";
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
      text = getFirstStrangerFallback();
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
// PRECREATE ASIAN ROOM
//////////////////////////////////////////////////////////////

function bootAsianRoom() {
  if (!rooms[ASIAN_ROOM_ID]) {
    rooms[ASIAN_ROOM_ID] = createRoom(ASIAN_ROOM_ID);
    startLoop(ASIAN_ROOM_ID);
  }
}

//////////////////////////////////////////////////////////////
// SOCKET
//////////////////////////////////////////////////////////////

io.on("connection", (socket) => {

  ////////////////////////////////////////////////////////////
  // JOIN ROOM
  ////////////////////////////////////////////////////////////
  socket.on("joinRoom", async () => {
    const roomId = ASIAN_ROOM_ID;

    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = createRoom(roomId);
      startLoop(roomId);
    }

    const room = rooms[roomId];
    ensureUserState(room, socket.id);

    // SYSTEM MESSAGE 1
    socket.emit("message", {
      id: makeId(),
      role: "ai",
      persona: "System",
      text:
        "Welcome to [ASIAN AI CHAT] — Our AI model is smart, good at math, and practical, skeptical, observant, cost-aware, reserved, analytical, grounded, efficient, cautious, and realistic. [chang@asianaichat.com]"
    });

    // SYSTEM MESSAGE 2
    socket.emit("message", {
      id: makeId(),
      role: "ai",
      persona: "System",
      text:
        "People ask about AI ideas, travel plans, email replies, and everyday decisions."
    });

    await startConversationIfNeeded(roomId);
  });

  ////////////////////////////////////////////////////////////
  // LEAVE ROOM
  ////////////////////////////////////////////////////////////
  socket.on("leaveRoom", () => {
    socket.leave(ASIAN_ROOM_ID);
  });

  ////////////////////////////////////////////////////////////
  // USER MESSAGE
  ////////////////////////////////////////////////////////////
  socket.on("sendMessage", ({ message }) => {
    const roomId = ASIAN_ROOM_ID;
    const text = cleanText(message);

    if (!text) return;

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
    const room = rooms[ASIAN_ROOM_ID];
    if (!room) return;

    if (room.userState?.[socket.id]) {
      delete room.userState[socket.id];
    }
  });

}); // ✅ correct closing here

//////////////////////////////////////////////////////////////
// START
//////////////////////////////////////////////////////////////

bootAsianRoom();

const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("CHATROOM RUNNING — ASIAN ROOM ONLY");
});
