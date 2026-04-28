//////////////////////////////////////////////////////////////
// ASIAN AI CHAT — AI + STRANGER + EMAIL MATCHING
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
// socketId -> {
//   email,
//   awaitingEmail,
//   wantsMatch,
//   matched,
//   lastTopic,
//   lastUserMessage,
//   lastAIAnswer
// }

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
    "hotel",
    "travel",
    "trip",
    "flight",
    "email",
    "reply",
    "ai product",
    "startup",
    "business",
    "money",
    "rent",
    "job",
    "decision",
    "plan"
  ];

  return keywords.some(k => t.includes(k));
}

function getTopic(text) {
  const t = String(text || "").toLowerCase();

  if (t.includes("hotel") || t.includes("travel") || t.includes("trip") || t.includes("flight")) {
    return "travel";
  }

  if (t.includes("email") || t.includes("reply")) {
    return "email";
  }

  if (t.includes("ai product") || t.includes("startup") || t.includes("business")) {
    return "ai_product";
  }

  if (t.includes("money") || t.includes("rent") || t.includes("budget")) {
    return "money";
  }

  return "general";
}

function emitToSocket(socketId, payload) {
  const s = io.sockets.sockets.get(socketId);
  if (!s) return;
  s.emit("message", payload);
}

//////////////////////////////////////////////////////////////
// PROMPTS
//////////////////////////////////////////////////////////////

function getAIPrompt() {
  return `
You are Asian AI in a public AI chat room.

Core behavior:
- ALWAYS provide a direct answer.
- NEVER ask questions.
- NEVER request more information.
- If information is missing, make a reasonable assumption and proceed.
- If the user asks for names, places, tools, examples, or recommendations, give concrete examples.
- If the user sounds urgent, answer immediately with practical options.

Answer style:
- 1–3 short sentences.
- Practical, direct, cost-aware, grounded.
- Give the answer first.
- Include a short reason why.

For recommendations:
- Give 2–3 options.
- Include why each option makes sense.
- Avoid vague advice.

For emails:
- Draft or improve the email directly.
- Do not ask for more details.
- Make a reasonable version.

For AI product ideas:
- Give concrete product direction, target user, and why it may work.

Never say:
- "What's your budget?"
- "Can you clarify?"
- "It depends."
- "How can I help?"
`;
}

function getStrangerPrompt() {
  return `
You are the Stranger in ASIAN AI CHAT.

Identity:
- A real person in the public chat room.
- Practical, skeptical, observant, cost-aware, reserved, analytical, grounded, efficient, cautious, and realistic.

Behavior:
- React to the AI answer.
- NEVER ask questions.
- Add practical pressure, caution, or a better angle.
- If the AI gave options, point out which one feels safest or most realistic.
- Keep it grounded in cost, timing, effort, and real-life impact.

Style:
- 1–2 short sentences.
- Calm, direct, slightly skeptical.
- No sarcasm.
- No playful tone.
- No assistant tone.
`;
}

async function generateAIAnswer(userMessage) {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.65,
    messages: [
      { role: "system", content: getAIPrompt() },
      { role: "user", content: userMessage }
    ]
  });

  return cleanText(res.choices?.[0]?.message?.content);
}

async function generateStrangerReply(userMessage, aiAnswer) {
  const context = `
User said:
${userMessage}

AI answered:
${aiAnswer}
`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.78,
    messages: [
      { role: "system", content: getStrangerPrompt() },
      { role: "user", content: context }
    ]
  });

  return cleanText(res.choices?.[0]?.message?.content);
}

//////////////////////////////////////////////////////////////
// MATCHING
//////////////////////////////////////////////////////////////

function tryMatchUsers() {
  const waiting = Object.entries(users).filter(([socketId, u]) => {
    return u.email && u.wantsMatch && !u.matched;
  });

  if (waiting.length < 2) return;

  const [aId, a] = waiting[0];
  const [bId, b] = waiting[1];

  a.matched = true;
  b.matched = true;

  emitToSocket(aId, {
    id: makeId(),
    role: "ai",
    persona: "System",
    text:
      `Matched. Someone else here may be useful for this topic. Contact: ${b.email}`
  });

  emitToSocket(bId, {
    id: makeId(),
    role: "ai",
    persona: "System",
    text:
      `Matched. Someone else here may be useful for this topic. Contact: ${a.email}`
  });
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
      text:
        "Welcome. I am ASIAN AI CHAT. I match you with people based on what others have already tried, and I find results using my designed Scarcity Awareness search model. me:chang@asianaichat.com"
    });

    socket.emit("message", {
      id: makeId(),
      role: "ai",
      persona: "System",
      text:
        "People ask about AI ideas, travel plans, email replies, and everyday decisions."
    });
  });

  ////////////////////////////////////////////////////////////
  // LEAVE ROOM
  ////////////////////////////////////////////////////////////

  socket.on("leaveRoom", () => {
    socket.leave(ROOM_ID);
  });

  ////////////////////////////////////////////////////////////
  // USER MESSAGE
  ////////////////////////////////////////////////////////////

  socket.on("sendMessage", async ({ message }) => {
    const text = cleanText(message);
    if (!text) return;

    const room = rooms[ROOM_ID] || createRoom();
    rooms[ROOM_ID] = room;

    const user = ensureUser(socket.id);

    //////////////////////////////////////////////////////////
    // SHOW USER MESSAGE
    //////////////////////////////////////////////////////////

    io.to(ROOM_ID).emit("message", {
      id: makeId(),
      role: "user",
      text
    });

    //////////////////////////////////////////////////////////
    // EMAIL CAPTURE
    //////////////////////////////////////////////////////////

    if (user.awaitingEmail) {
      if (!isEmail(text)) {
        socket.emit("message", {
          id: makeId(),
          role: "ai",
          persona: "System",
          text:
            "That does not look like an email. Send one email address if you want to be matched."
        });
        return;
      }

      user.email = text;
      user.awaitingEmail = false;
      user.wantsMatch = true;

      socket.emit("message", {
        id: makeId(),
        role: "ai",
        persona: "System",
        text:
          "Got it. I’ll try to match you with someone relevant in this room."
      });

      tryMatchUsers();
      return;
    }

    //////////////////////////////////////////////////////////
    // YES / CONNECT HANDLER
    //////////////////////////////////////////////////////////

    const lower = text.toLowerCase();

    if (
      lower === "yes" ||
      lower === "yes connect" ||
      lower === "connect me" ||
      lower === "match me"
    ) {
      user.awaitingEmail = true;
      user.wantsMatch = true;

      socket.emit("message", {
        id: makeId(),
        role: "ai",
        persona: "System",
        text:
          "Send your email and I’ll try to connect you with someone relevant. Only send it if you want to be matched."
      });

      return;
    }

    //////////////////////////////////////////////////////////
    // AI BUSY CHECK
    //////////////////////////////////////////////////////////

    if (room.aiBusy) {
      socket.emit("message", {
        id: makeId(),
        role: "ai",
        persona: "System",
        text:
          "One response is still being generated. Send again in a moment."
      });
      return;
    }

    room.aiBusy = true;

    try {
      user.lastUserMessage = text;
      user.lastTopic = getTopic(text);

      ////////////////////////////////////////////////////////
      // AI ANSWERS FIRST
      ////////////////////////////////////////////////////////

      const aiAnswer = await generateAIAnswer(text);

      user.lastAIAnswer = aiAnswer;

      io.to(ROOM_ID).emit("message", {
        id: makeId(),
        role: "ai",
        persona: "AI",
        text: aiAnswer || "The safest move is to compare cost, timing, and effort before committing."
      });

      ////////////////////////////////////////////////////////
      // STRANGER REACTS
      ////////////////////////////////////////////////////////

      const strangerReply = await generateStrangerReply(text, aiAnswer);

      io.to(ROOM_ID).emit("message", {
        id: makeId(),
        role: "ai",
        persona: "Stranger",
        text: strangerReply || "That answer works, but the real test is whether the cost and timing still make sense."
      });

      ////////////////////////////////////////////////////////
      // OPTIONAL CONNECTION OFFER
      ////////////////////////////////////////////////////////

      if (shouldOfferConnection(text)) {
        socket.emit("message", {
          id: makeId(),
          role: "ai",
          persona: "System",
          text:
            "Someone here may have useful real experience with this. Type “yes” if you want to be matched by email."
        });
      }

    } catch (err) {
      socket.emit("message", {
        id: makeId(),
        role: "ai",
        persona: "System",
        text:
          "The system had trouble answering. Try again with one clear sentence."
      });
    } finally {
      room.aiBusy = false;
    }
  });

  ////////////////////////////////////////////////////////////
  // DISCONNECT
  ////////////////////////////////////////////////////////////

  socket.on("disconnect", () => {
    delete users[socket.id];
  });
});

//////////////////////////////////////////////////////////////
// START
//////////////////////////////////////////////////////////////

const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("ASIAN AI CHAT RUNNING — AI + STRANGER + MATCHING");
});
