//////////////////////////////////////////////////////////////
// ASIAN AI CHAT — AI + STRANGER + HYBRID EMAIL MATCHING
//////////////////////////////////////////////////////////////
const express = require("express");
const http = require("http");
const cors = require("cors");
const OpenAI = require("openai");
const { Server } = require("socket.io");

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

const ROOM_ID = "asian-room";
const rooms = {};
const users = {};

const topicQueues = {
  travel: [],
  email: [],
  ai_product: [],
  money: [],
  general: []
};

//////////////////////////////////////////////////////////////
// TIME HELPER (ADDED)
//////////////////////////////////////////////////////////////
function getCurrentTime() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

//////////////////////////////////////////////////////////////
// HELPERS
//////////////////////////////////////////////////////////////
function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function cleanText(text) {
  return String(text || "")
    .replace(/^(AI|Stranger|System)\s*:\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isEmail(text) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(text || "").trim());
}

function createRoom() {
  return {
    history: [],
    aiBusy: false
  };
}

function ensureUser(socketId) {
  if (!users[socketId]) {
    users[socketId] = {
      email: "",
      awaitingEmail: false,
      wantsMatch: false,
      matched: false,
      lastTopic: "",
      lastUserMessage: "",
      lastAIAnswer: ""
    };
  }
  return users[socketId];
}

function shouldOfferConnection(text) {
  const t = String(text || "").toLowerCase();
  const keywords = [
    "hotel","travel","trip","flight",
    "email","reply",
    "ai product","startup","business",
    "money","rent","job","decision","plan"
  ];
  return keywords.some(k => t.includes(k));
}

function getTopic(text) {
  const t = String(text || "").toLowerCase();

  if (t.includes("hotel") || t.includes("travel") || t.includes("trip") || t.includes("flight")) return "travel";
  if (t.includes("email") || t.includes("reply")) return "email";
  if (t.includes("ai product") || t.includes("startup") || t.includes("business")) return "ai_product";
  if (t.includes("money") || t.includes("rent") || t.includes("budget")) return "money";

  return "general";
}

function emitToSocket(socketId, payload) {
  const s = io.sockets.sockets.get(socketId);
  if (!s) return;
  s.emit("message", payload);
}

function removeFromAllQueues(socketId) {
  for (const topic of Object.keys(topicQueues)) {
    topicQueues[topic] = topicQueues[topic].filter(id => id !== socketId);
  }
}

function addToTopicQueue(socketId, topic) {
  if (!topicQueues[topic]) topicQueues[topic] = [];
  removeFromAllQueues(socketId);
  if (!topicQueues[topic].includes(socketId)) {
    topicQueues[topic].push(socketId);
  }
}

//////////////////////////////////////////////////////////////
// PROMPTS (unchanged)
//////////////////////////////////////////////////////////////
function getAIPrompt() {
  return `
You are Asian AI in a public AI chat room.
- ALWAYS provide a direct answer.
- NEVER ask questions.
- NEVER request more information.
- If missing info, assume and proceed.
- 1–3 short sentences.
- Practical, direct.
`;
}

function getStrangerPrompt() {
  return `
You are the Stranger.
- React to AI answer
- No questions
- 1–2 short sentences
- Practical + cautious
`;
}

async function generateAIAnswer(userMessage) {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: getAIPrompt() },
      { role: "user", content: userMessage }
    ]
  });
  return cleanText(res.choices?.[0]?.message?.content);
}

async function generateStrangerReply(userMessage, aiAnswer) {
  const context = `User: ${userMessage}\nAI: ${aiAnswer}`;
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: getStrangerPrompt() },
      { role: "user", content: context }
    ]
  });
  return cleanText(res.choices?.[0]?.message?.content);
}

//////////////////////////////////////////////////////////////
// SOCKET
//////////////////////////////////////////////////////////////
io.on("connection", (socket) => {

  ensureUser(socket.id);

  ////////////////////////////////////////////////////////////
  // JOIN ROOM
  ////////////////////////////////////////////////////////////
  socket.on("joinRoom", async () => {

    socket.join(ROOM_ID);

    if (!rooms[ROOM_ID]) {
      rooms[ROOM_ID] = createRoom();
    }

    socket.emit("message", {
      id: makeId(),
      role: "ai",
      persona: "System",
      text: `Welcome. Current time: ${getCurrentTime()}`
    });

    socket.emit("message", {
      id: makeId(),
      role: "ai",
      persona: "System",
      text: "People ask about AI, travel, email, and decisions."
    });

  });

  ////////////////////////////////////////////////////////////
  // MESSAGE
  ////////////////////////////////////////////////////////////
  socket.on("sendMessage", async ({ message }) => {

    const text = cleanText(message);
    if (!text) return;

    const room = rooms[ROOM_ID] || createRoom();
    rooms[ROOM_ID] = room;

    if (room.aiBusy) return;
    room.aiBusy = true;

    try {

      io.to(ROOM_ID).emit("message", {
        id: makeId(),
        role: "user",
        text
      });

      const aiAnswer = await generateAIAnswer(text);

      io.to(ROOM_ID).emit("message", {
        id: makeId(),
        role: "ai",
        persona: "AI",
        text: aiAnswer
      });

      const strangerReply = await generateStrangerReply(text, aiAnswer);

      io.to(ROOM_ID).emit("message", {
        id: makeId(),
        role: "ai",
        persona: "Stranger",
        text: strangerReply
      });

    } finally {
      room.aiBusy = false;
    }

  });

  ////////////////////////////////////////////////////////////
  // DISCONNECT
  ////////////////////////////////////////////////////////////
  socket.on("disconnect", () => {
    removeFromAllQueues(socket.id);
    delete users[socket.id];
  });

});

//////////////////////////////////////////////////////////////
// START
//////////////////////////////////////////////////////////////
const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("ASIAN AI CHAT RUNNING — TIME ENABLED");
});