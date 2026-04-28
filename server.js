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

// ✅ FIXED
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

//////////////////////////////////////////////////////////////
// SOCKET
//////////////////////////////////////////////////////////////

io.on("connection", (socket) => {
  ensureUser(socket.id);

  socket.on("joinRoom", async () => {
    socket.join(ROOM_ID);

    if (!rooms[ROOM_ID]) {
      rooms[ROOM_ID] = createRoom();
    }

    socket.emit("message", {
      id: makeId(),
      role: "ai",
      persona: "System",
      text:
        "Welcome. I am ASIAN AI CHAT. I match you with people based on what others have already tried."
    });
  });

  socket.on("sendMessage", async ({ message }) => {
    const text = cleanText(message);
    if (!text) return;

    // ✅ ADDED (REAL TIME)
    const lower = text.toLowerCase();

    if (
      lower === "time" ||
      lower === "what time is now" ||
      lower === "current time" ||
      lower === "year" ||
      lower === "what year is now" ||
      lower === "current year" ||
      lower === "date" ||
      lower === "today date"
    ) {
      const now = new Date();

      let reply;
      if (lower.includes("year")) reply = `The current year is ${now.getFullYear()}.`;
      else if (lower.includes("date")) reply = `Today is ${now.toDateString()}.`;
      else reply = `The current time is ${now.toLocaleTimeString()}.`;

      io.to(ROOM_ID).emit({
        id: makeId(),
        role: "ai",
        persona: "AI",
        text: reply
      });

      return;
    }

    const room = rooms[ROOM_ID] || createRoom();
    rooms[ROOM_ID] = room;

    const user = ensureUser(socket.id);

    io.to(ROOM_ID).emit({
      id: makeId(),
      role: "user",
      text
    });

    //////////////////////////////////////////////////////////
    // YES HANDLER (no duplicate lower)
    //////////////////////////////////////////////////////////

    if (
      lower === "yes" ||
      lower === "yes connect" ||
      lower === "connect me" ||
      lower === "match me"
    ) {
      user.awaitingEmail = true;
      user.wantsMatch = true;

      socket.emit({
        id: makeId(),
        role: "ai",
        persona: "System",
        text: "Send your email."
      });

      return;
    }

    //////////////////////////////////////////////////////////
    // AI RESPONSE
    //////////////////////////////////////////////////////////

    room.aiBusy = true;

    try {
      user.lastUserMessage = text;

      const aiAnswer = await generateAIAnswer(text);
      user.lastAIAnswer = aiAnswer;

      io.to(ROOM_ID).emit({
        id: makeId(),
        role: "ai",
        persona: "AI",
        text: aiAnswer
      });

      const strangerReply = await generateStrangerReply(text, aiAnswer);

      io.to(ROOM_ID).emit({
        id: makeId(),
        role: "ai",
        persona: "Stranger",
        text: strangerReply
      });

      // ✅ IMPROVED TRIGGER
      if (
        shouldOfferConnection(text) ||
        shouldOfferConnection(aiAnswer)
      ) {
        socket.emit({
          id: makeId(),
          role: "ai",
          persona: "System",
          text: "Type 'yes' to connect."
        });
      }

    } finally {
      room.aiBusy = false;
    }
  });

  socket.on("disconnect", () => {
    delete users[socket.id];
  });
});

//////////////////////////////////////////////////////////////
// START
//////////////////////////////////////////////////////////////

server.listen(10000, () => {
  console.log("ASIAN AI CHAT RUNNING — FIXED");
});