//////////////////////////////////////////////////////////////
// CHATROOM BACKEND (WITH ANALYTICS)
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

//////////////////////////////////////////////////////////////
// ANALYTICS API
//////////////////////////////////////////////////////////////

app.get("/stats", (req, res) => {
  res.json(analytics.getStats());
});

//////////////////////////////////////////////////////////////
// ROOMS
//////////////////////////////////////////////////////////////

const rooms = {};

const GLOBAL_ROOM_ID = "global-room";
const ALWAYS_ON_ROOM_ID = "ny-plaza";

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

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
  if (s) s.emit("message", payload);
}

function emitToRoom(roomId, payload) {
  const sockets = io.sockets.adapter.rooms.get(roomId) || new Set();

  for (const socketId of sockets) {
    const paused = rooms[roomId]?.userState?.[socketId]?.awaiting;
    if (paused) continue;

    const s = io.sockets.sockets.get(socketId);
    if (s) s.emit("message", payload);
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

    if (state.awaiting) continue;
    if (state.aiCount < 6) continue;

    state.aiCount = 0;
    state.awaiting = true;

    emitToSocket(socketId, {
      id: makeId(),
      role: "ai",
      persona: "AI",
      text: "you still here?"
    });
  }
}

//////////////////////////////////////////////////////////////
// SIMPLE AI (kept minimal)
//////////////////////////////////////////////////////////////

async function generateText(prompt) {
  const r = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    messages: [
      { role: "system", content: "You are a human in a chatroom. 1 sentence." },
      { role: "user", content: prompt }
    ]
  });

  return r.choices?.[0]?.message?.content || "Something shifted.";
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

  try {
    const last = room[room.length - 1]?.content || "";

    const text = await generateText(last);

    room.push({
      persona: "AI",
      content: text,
      time: Date.now()
    });

    emitToRoom(roomId, {
      id: makeId(),
      role: "ai",
      persona: "AI",
      text
    });

    const sockets = io.sockets.adapter.rooms.get(roomId) || new Set();

    for (const socketId of sockets) {
      const state = ensureUserState(room, socketId);

      if (!state.awaiting) {
        state.aiCount += 1;
      }
    }

    maybePromptPresence(roomId);

    room.aiBusy = false;
  } catch {
    room.aiBusy = false;
  }
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
    persona: "Stranger",
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

    //////////////////////////////////////////////////////////
    // ANALYTICS
    //////////////////////////////////////////////////////////
    analytics.trackJoin(socket.id, roomId);

    //////////////////////////////////////////////////////////
    // WELCOME
    //////////////////////////////////////////////////////////
    socket.emit("message", {
      id: makeId(),
      role: "ai",
      persona: "System",
      text:
        room.title === "New York Plaza Hotel"
          ? "Welcome to New York Plaza Hotel Lobby Room — Where locals and travelers share real NYC experiences."
          : "Welcome to 650AI Room — Silicon Valley Office — AI, strangers, and users create new AI ideas."
    });

    startConversation(roomId);
  });

  ////////////////////////////////////////////////////////////
  // LEAVE ROOM
  ////////////////////////////////////////////////////////////

  socket.on("leaveRoom", (roomId) => {
    socket.leave(roomId);

    if (rooms[roomId]?.userState?.[socket.id]) {
      delete rooms[roomId].userState[socket.id];
    }
  });

  ////////////////////////////////////////////////////////////
  // USER MESSAGE
  ////////////////////////////////////////////////////////////

  socket.on("sendMessage", ({ roomId, message }) => {

    const text = String(message || "").trim();
    if (!text) return;

    const room = rooms[roomId];
    if (!room) return;

    const state = ensureUserState(room, socket.id);

    //////////////////////////////////////////////////////////
    // ANALYTICS
    //////////////////////////////////////////////////////////
    analytics.trackMessage(socket.id);

    if (state.awaiting) {
      analytics.trackPresenceReply(socket.id);
    }

    //////////////////////////////////////////////////////////
    // RESET STATE
    //////////////////////////////////////////////////////////
    state.awaiting = false;
    state.aiCount = 0;

    //////////////////////////////////////////////////////////
    // MESSAGE
    //////////////////////////////////////////////////////////
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

  ////////////////////////////////////////////////////////////
  // DISCONNECT
  ////////////////////////////////////////////////////////////

  socket.on("disconnect", () => {

    analytics.trackDisconnect(socket.id);

    for (const roomId of Object.keys(rooms)) {
      if (rooms[roomId]?.userState?.[socket.id]) {
        delete rooms[roomId].userState[socket.id];
      }
    }
  });

});

//////////////////////////////////////////////////////////////
// START SERVER
//////////////////////////////////////////////////////////////

const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("CHATROOM RUNNING WITH ANALYTICS");
});