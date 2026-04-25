//////////////////////////////////////////////////////////////
// BASIC SETUP
//////////////////////////////////////////////////////////////

const express = require("express");
const http = require("http");
const cors = require("cors");
const OpenAI = require("openai");
const { Server } = require("socket.io");
const fetch = require("node-fetch"); // ✅ FIXED

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

//////////////////////////////////////////////////////////////
// GLOBAL CONSTANTS
//////////////////////////////////////////////////////////////

const rooms = {};

const GLOBAL_ROOM_ID = "global-room";
const ALWAYS_ON_ROOM_ID = "ny-plaza";

//////////////////////////////////////////////////////////////
// ANALYTICS API
//////////////////////////////////////////////////////////////

app.get("/stats", (req, res) => {
  res.json(analytics.getStats());
});

app.get("/", (req, res) => {
  res.send("650AI backend running");
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
  room.turn = "stranger";
  room.aiBusy = false;
  room.queue = [];
  room.userState = {};
  room.started = false;
  room.loopStarted = false;
  room.immediateRun = false;
  room.lastReplyHash = "";

  if (roomId === GLOBAL_ROOM_ID) {
    room.title = "650AI Room";
    room.roomKind = "global";
    room.strangerType = "business_meeting";
    room.alwaysOn = false;
  } else {
    room.title = "New York Plaza Hotel";
    room.roomKind = "ny_plaza";
    room.strangerType = "ny_plaza";
    room.alwaysOn = true;
  }

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
  if (s) s.emit("message", payload);
}

function emitToRoom(roomId, payload) {
  const sockets = io.sockets.adapter.rooms.get(roomId) || new Set();

  for (const socketId of sockets) {
    const paused = rooms[roomId]?.userState?.[socketId]?.awaiting;
    if (!paused) {
      const s = io.sockets.sockets.get(socketId);
      if (s) s.emit("message", payload);
    }
  }
}

//////////////////////////////////////////////////////////////
// SIMPLE AI (SAFE)
//////////////////////////////////////////////////////////////

async function generateText(input) {
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a human in a chatroom. 1 sentence." },
        { role: "user", content: input || "Say something natural." }
      ]
    });

    return res.choices?.[0]?.message?.content || "Something shifted.";
  } catch {
    return "Something shifted.";
  }
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

    if (!state.awaiting && state.aiCount >= 6) {
      state.awaiting = true;
      state.aiCount = 0;

      emitToSocket(socketId, {
        id: makeId(),
        role: "ai",
        text: "you still here?"
      });
    }
  }
}

//////////////////////////////////////////////////////////////
// LOOP
//////////////////////////////////////////////////////////////

async function processTurn(roomId) {
  const room = rooms[roomId];
  if (!room || room.aiBusy) return;
  if (!room.started) return;
  if (!roomHasActiveUsers(roomId) && !room.alwaysOn) return;

  room.aiBusy = true;

  const last = room[room.length - 1]?.content || "";
  const reply = await generateText(last);

  room.push({
    persona: "AI",
    content: reply,
    time: Date.now()
  });

  emitToRoom(roomId, {
    id: makeId(),
    role: "ai",
    text: reply
  });

  const sockets = io.sockets.adapter.rooms.get(roomId) || new Set();

  for (const socketId of sockets) {
    const state = ensureUserState(room, socketId);
    if (!state.awaiting) state.aiCount++;
  }

  maybePromptPresence(roomId);

  room.aiBusy = false;
}

function startLoop(roomId) {
  const room = rooms[roomId];
  if (!room || room.loopStarted) return;

  room.loopStarted = true;

  setInterval(() => {
    processTurn(roomId);
  }, 1800);
}

//////////////////////////////////////////////////////////////
// START CONVERSATION
//////////////////////////////////////////////////////////////

function startConversation(roomId) {
  const room = rooms[roomId];
  if (!room || room.started) return;

  room.started = true;

  room.push({
    persona: "Stranger",
    content: "Something is already moving here.",
    time: Date.now()
  });

  emitToRoom(roomId, {
    id: makeId(),
    role: "ai",
    text: "Something is already moving here."
  });
}

//////////////////////////////////////////////////////////////
// SOCKET
//////////////////////////////////////////////////////////////

io.on("connection", (socket) => {

  socket.on("joinRoom", ({ roomId }) => {

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
      text:
        roomId === ALWAYS_ON_ROOM_ID
          ? "Welcome to New York Plaza Hotel Lobby Room — Where locals and travelers share real NYC experiences."
          : "Welcome to 650AI Room — Silicon Valley Office — AI, strangers, and users create new AI ideas."
    });

    startConversation(roomId);
  });

  socket.on("leaveRoom", (roomId) => {
    socket.leave(roomId);
  });

  socket.on("sendMessage", ({ roomId, message }) => {

    const text = String(message || "").trim();
    if (!text) return;

    const room = rooms[roomId];
    if (!room) return;

    const state = ensureUserState(room, socket.id);

    analytics.trackMessage(socket.id);

    if (state.awaiting) {
      analytics.trackPresenceReply(socket.id);
    }

    state.awaiting = false;
    state.aiCount = 0;

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
      time: Date.now()
    });

    processTurn(roomId);
  });

  socket.on("disconnect", () => {
    analytics.trackDisconnect(socket.id);

    for (const roomId in rooms) {
      delete rooms[roomId]?.userState?.[socket.id];
    }
  });

});

//////////////////////////////////////////////////////////////
// START SERVER
//////////////////////////////////////////////////////////////

const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("SERVER RUNNING ✅");
});