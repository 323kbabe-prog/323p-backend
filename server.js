//////////////////////////////////////////////////////////////
// ASIAN AI CHAT — HYBRID MATCH SYSTEM (FULL)
//////////////////////////////////////////////////////////////

const express = require("express");
const http = require("http");
const cors = require("cors");
const OpenAI = require("openai");
const { Server } = require("socket.io");

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ROOM_ID = "asian-room";
const rooms = {};
const users = {};

//////////////////////////////////////////////////////////////
// TOPIC QUEUES
//////////////////////////////////////////////////////////////

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

function ensureUser(id) {
  if (!users[id]) {
    users[id] = {
      email: "",
      awaitingEmail: false,
      wantsMatch: false,
      matched: false,
      lastUserMessage: "",
      lastTopic: "general"
    };
  }
  return users[id];
}

function getTopic(text) {
  const t = text.toLowerCase();

  if (t.includes("hotel") || t.includes("travel")) return "travel";
  if (t.includes("email") || t.includes("reply")) return "email";
  if (t.includes("startup") || t.includes("product")) return "ai_product";
  if (t.includes("money") || t.includes("budget")) return "money";

  return "general";
}

function isEmail(text) {
  return /\S+@\S+\.\S+/.test(text);
}

//////////////////////////////////////////////////////////////
// AI PROMPTS
//////////////////////////////////////////////////////////////

function getAIPrompt() {
  return `
You are Asian AI.

Rules:
- ALWAYS answer directly
- NEVER ask questions
- give 2–3 concrete options
- include short reason WHY

Keep answer short and practical.
`;
}

function getStrangerPrompt() {
  return `
You are a real person.

Rules:
- NEVER ask questions
- react to AI answer
- add realism, cost, or risk
- suggest alternative if needed
`;
}

//////////////////////////////////////////////////////////////
// AI GENERATION
//////////////////////////////////////////////////////////////

async function generateAI(text) {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.7,
    messages: [
      { role: "system", content: getAIPrompt() },
      { role: "user", content: text }
    ]
  });

  return res.choices[0].message.content;
}

async function generateStranger(text) {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.8,
    messages: [
      { role: "system", content: getStrangerPrompt() },
      { role: "user", content: text }
    ]
  });

  return res.choices[0].message.content;
}

//////////////////////////////////////////////////////////////
// HYBRID MATCH LOGIC
//////////////////////////////////////////////////////////////

function addToQueue(socketId, topic) {
  topicQueues[topic].push(socketId);
}

function removeFromQueue(id, topic) {
  topicQueues[topic] = topicQueues[topic].filter(x => x !== id);
}

function fastMatch(topic) {
  const queue = topicQueues[topic];

  if (queue.length < 2) return false;

  const a = queue.shift();
  const b = queue.shift();

  users[a].matched = true;
  users[b].matched = true;

  sendMatch(a, b);

  return true;
}

async function aiMatch(topic) {
  const queue = topicQueues[topic];

  if (queue.length < 3) return false;

  const candidates = queue.slice(0, 5);

  const prompt = `
Match best pair:

${candidates.map(id => `${id}: ${users[id].lastUserMessage}`).join("\n")}

Return two ids only.
`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }]
  });

  const ids = res.choices[0].message.content.match(/\d+/g);
  if (!ids || ids.length < 2) return false;

  const [a, b] = ids;

  removeFromQueue(a, topic);
  removeFromQueue(b, topic);

  users[a].matched = true;
  users[b].matched = true;

  sendMatch(a, b);

  return true;
}

function sendMatch(a, b) {
  io.to(a).emit("message", {
    role: "ai",
    persona: "System",
    text: `Matched. Contact: ${users[b].email}`
  });

  io.to(b).emit("message", {
    role: "ai",
    persona: "System",
    text: `Matched. Contact: ${users[a].email}`
  });
}

//////////////////////////////////////////////////////////////
// SOCKET
//////////////////////////////////////////////////////////////

io.on("connection", (socket) => {
  ensureUser(socket.id);

  socket.on("joinRoom", () => {
    socket.join(ROOM_ID);

    socket.emit("message", {
      role: "ai",
      persona: "System",
      text: "Welcome to ASIAN AI CHAT"
    });
  });

  socket.on("sendMessage", async ({ message }) => {
    const user = ensureUser(socket.id);
    const text = message.trim();

    io.to(ROOM_ID).emit({
      role: "user",
      text
    });

    //////////////////////////////////////////////////////////
    // EMAIL FLOW
    //////////////////////////////////////////////////////////

    if (user.awaitingEmail) {
      if (!isEmail(text)) return;

      user.email = text;
      user.awaitingEmail = false;
      user.wantsMatch = true;

      addToQueue(socket.id, user.lastTopic);

      if (!fastMatch(user.lastTopic)) {
        await aiMatch(user.lastTopic);
      }

      return;
    }

    if (text.toLowerCase() === "yes") {
      user.awaitingEmail = true;

      socket.emit("message", {
        role: "ai",
        persona: "System",
        text: "Send your email to match."
      });

      return;
    }

    //////////////////////////////////////////////////////////
    // NORMAL FLOW
    //////////////////////////////////////////////////////////

    user.lastUserMessage = text;
    user.lastTopic = getTopic(text);

    const aiReply = await generateAI(text);

    io.to(ROOM_ID).emit({
      role: "ai",
      persona: "AI",
      text: aiReply
    });

    const strangerReply = await generateStranger(aiReply);

    io.to(ROOM_ID).emit({
      role: "ai",
      persona: "Stranger",
      text: strangerReply
    });

    if (["travel", "email", "ai_product", "money"].includes(user.lastTopic)) {
      socket.emit("message", {
        role: "ai",
        persona: "System",
        text: "Type 'yes' to connect with someone."
      });
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
  console.log("HYBRID MATCH SYSTEM RUNNING");
});