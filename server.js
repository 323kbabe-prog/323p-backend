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
// ROOM
//////////////////////////////////////////////////////////////

function createRoom() {
  const room = [];
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

//////////////////////////////////////////////////////////////
// USER STATE
//////////////////////////////////////////////////////////////

function ensureUserState(room, socketId) {
  if (!room.userState[socketId]) {
    room.userState[socketId] = {
      awaiting: false,
      aiCount: 0
    };
  }
  return room.userState[socketId];
}

//////////////////////////////////////////////////////////////
// HUMAN VOICE
//////////////////////////////////////////////////////////////

const HUMAN_CHAT = `
You are in a live chatroom.

Rules:
- 1–2 sentences
- no filler
- no assistant tone
- no visible AI identity
`;

//////////////////////////////////////////////////////////////
// STRANGER PROMPT
//////////////////////////////////////////////////////////////

function getStrangerSystemPrompt() {
  return HUMAN_CHAT + `
You are the Stranger.

Behavior:
- ALWAYS give direct answers
- NEVER ask questions
- provide practical suggestions
- include real examples when possible

Tone:
- calm
- cost-aware
- realistic
`;
}

//////////////////////////////////////////////////////////////
// AI PROMPT (FIXED)
//////////////////////////////////////////////////////////////

function getAISystemPrompt() {
  return `
You are a real person in a live chatroom.

Behavior:
- ALWAYS provide a direct answer
- NEVER ask questions
- NEVER request more information

Decision:
- give 2–3 concrete options immediately
- assume missing info if needed
- prioritize speed if urgent

Style:
- short
- direct
- practical

Output:
- 1–2 sentences
- include real names when relevant
`;
}

//////////////////////////////////////////////////////////////
// GENERATION
//////////////////////////////////////////////////////////////

async function generateStrangerText(context) {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.8,
    messages: [
      { role: "system", content: getStrangerSystemPrompt() },
      { role: "user", content: context }
    ]
  });

  return res.choices[0].message.content;
}

async function generateAIText(context) {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    messages: [
      { role: "system", content: getAISystemPrompt() },
      { role: "user", content: context }
    ]
  });

  return res.choices[0].message.content;
}

//////////////////////////////////////////////////////////////
// LOOP
//////////////////////////////////////////////////////////////

async function processTurn(roomId) {
  const room = rooms[roomId];
  if (!room || room.aiBusy) return;

  room.aiBusy = true;

  const last = room[room.length - 1];
  const input = last?.content || "";

  let text;

  if (room.turn === "stranger") {
    text = await generateStrangerText(input);

    room.push({ persona: "Stranger", content: text });

    io.to(roomId).emit("message", {
      id: makeId(),
      role: "ai",
      persona: "Stranger",
      text
    });

    room.turn = "ai";
  } else {
    text = await generateAIText(input);

    room.push({ persona: "AI", content: text });

    io.to(roomId).emit("message", {
      id: makeId(),
      role: "ai",
      persona: "AI",
      text
    });

    room.turn = "stranger";
  }

  room.aiBusy = false;
}

function startLoop(roomId) {
  setInterval(() => processTurn(roomId), 1800);
}

//////////////////////////////////////////////////////////////
// SOCKET
//////////////////////////////////////////////////////////////

io.on("connection", (socket) => {

  socket.on("joinRoom", async () => {
    const roomId = ASIAN_ROOM_ID;

    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = createRoom();
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
        "Welcome to ASIAN AI CHAT — Our AI model is smart, good at math, and practical, skeptical, and grounded in real-world decisions. Contact: chang@asianaichat.com"
    });

    // SYSTEM MESSAGE 2
    socket.emit("message", {
      id: makeId(),
      role: "ai",
      persona: "System",
      text:
        "People ask about AI ideas, travel plans, email replies, and everyday decisions."
    });
  });

  socket.on("sendMessage", ({ message }) => {
    const roomId = ASIAN_ROOM_ID;

    const room = rooms[roomId];
    if (!room) return;

    room.push({
      persona: "User",
      content: message
    });

    io.to(roomId).emit("message", {
      id: makeId(),
      role: "user",
      text: message
    });
  });

});

//////////////////////////////////////////////////////////////
// START
//////////////////////////////////////////////////////////////

const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("ASIAN AI CHAT RUNNING");
});