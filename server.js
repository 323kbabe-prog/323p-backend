//////////////////////////////////////////////////////////////
// ASIAN AI CHAT — EMAIL TRIGGER + HYBRID MATCHING
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

//////////////////////////////////////////////////////////////
// STATE
//////////////////////////////////////////////////////////////

const ROOM_ID = "asian-room";

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

function isEmail(text) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(text || "").trim());
}

function ensureUser(id) {
  if (!users[id]) {
    users[id] = {
      email: "",
      awaitingEmail: false,
      wantsMatch: false,
      matched: false,
      lastTopic: "",
      lastUserMessage: "",
      lastAIAnswer: ""
    };
  }
  return users[id];
}

function getTopic(text) {
  const t = text.toLowerCase();

  if (t.includes("travel") || t.includes("hotel")) return "travel";
  if (t.includes("email") || t.includes("reply")) return "email";
  if (t.includes("startup") || t.includes("ai")) return "ai_product";
  if (t.includes("money") || t.includes("rent")) return "money";

  return "general";
}

function emitToSocket(id, payload) {
  const s = io.sockets.sockets.get(id);
  if (s) s.emit("message", payload);
}

function removeFromAllQueues(id) {
  Object.keys(topicQueues).forEach(topic => {
    topicQueues[topic] = topicQueues[topic].filter(x => x !== id);
  });
}

function addToQueue(id, topic) {
  removeFromAllQueues(id);
  if (!topicQueues[topic]) topicQueues[topic] = [];
  if (!topicQueues[topic].includes(id)) {
    topicQueues[topic].push(id);
  }
}

//////////////////////////////////////////////////////////////
// MATCHING CORE
//////////////////////////////////////////////////////////////

function sendMatch(aId, bId) {
  const a = users[aId];
  const b = users[bId];

  if (!a || !b) return;

  a.matched = true;
  b.matched = true;

  removeFromAllQueues(aId);
  removeFromAllQueues(bId);

  emitToSocket(aId, {
    id: makeId(),
    role: "ai",
    persona: "System",
    text: `Matched. Contact: ${b.email}`
  });

  emitToSocket(bId, {
    id: makeId(),
    role: "ai",
    persona: "System",
    text: `Matched. Contact: ${a.email}`
  });
}

//////////////////////////////////////////////////////////////
// AI MATCH SELECTION
//////////////////////////////////////////////////////////////

async function chooseBestPair(topic, ids) {

  const list = ids.map((id, i) => {
    const u = users[id];
    return `${i + 1}. ${id}
Topic: ${u.lastTopic}
Message: ${u.lastUserMessage}`;
  }).join("\n\n");

  const prompt = `
Match 2 users based on same need and usefulness.

Topic: ${topic}

${list}

Return JSON only:
{"a":"id","b":"id"}
`;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }]
    });

    const raw = res.choices?.[0]?.message?.content || "";
    const json = raw.match(/\{[\s\S]*\}/);

    if (!json) return null;

    const parsed = JSON.parse(json[0]);

    if (
      parsed.a &&
      parsed.b &&
      ids.includes(parsed.a) &&
      ids.includes(parsed.b) &&
      parsed.a !== parsed.b
    ) {
      return [parsed.a, parsed.b];
    }

  } catch {}

  return null;
}

//////////////////////////////////////////////////////////////
// MATCH FLOW
//////////////////////////////////////////////////////////////

async function tryMatch(socketId) {

  const user = users[socketId];
  if (!user) return;

  const topic = user.lastTopic || "general";

  addToQueue(socketId, topic);

  const queue = topicQueues[topic].filter(id => {
    const u = users[id];
    return u && u.email && u.wantsMatch && !u.matched;
  });

  topicQueues[topic] = queue;

  if (queue.length < 2) {
    emitToSocket(socketId, {
      id: makeId(),
      role: "ai",
      persona: "System",
      text: "Waiting for someone similar..."
    });
    return;
  }

  if (queue.length === 2) {
    sendMatch(queue[0], queue[1]);
    return;
  }

  const pair = await chooseBestPair(topic, queue.slice(0, 6));

  if (pair) {
    sendMatch(pair[0], pair[1]);
    return;
  }

  sendMatch(queue[0], queue[1]);
}

//////////////////////////////////////////////////////////////
// SOCKET
//////////////////////////////////////////////////////////////

io.on("connection", (socket) => {

  const user = ensureUser(socket.id);

  ////////////////////////////////////////////////////////////
  // JOIN
  ////////////////////////////////////////////////////////////

  socket.on("joinRoom", () => {
    socket.join(ROOM_ID);

    socket.emit("message", {
      id: makeId(),
      role: "ai",
      persona: "System",
      text: "Welcome. Type your problem. Type 'yes' to connect with someone."
    });
  });

  ////////////////////////////////////////////////////////////
  // MESSAGE
  ////////////////////////////////////////////////////////////

  socket.on("sendMessage", async ({ message }) => {

    const text = cleanText(message);
    if (!text) return;

    const user = ensureUser(socket.id);

    ////////////////////////////////////////////////////////////
    // SHOW USER
    ////////////////////////////////////////////////////////////

    io.to(ROOM_ID).emit({
      id: makeId(),
      role: "user",
      text
    });

    ////////////////////////////////////////////////////////////
    // EMAIL INPUT MODE
    ////////////////////////////////////////////////////////////

    if (user.awaitingEmail) {

      if (!isEmail(text)) {
        socket.emit("message", {
          id: makeId(),
          role: "ai",
          persona: "System",
          text: "Invalid email. Try again."
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
        text: "Email saved. Matching..."
      });

      await tryMatch(socket.id);
      return;
    }

    ////////////////////////////////////////////////////////////
    // TRIGGER CONNECT
    ////////////////////////////////////////////////////////////

    const lower = text.toLowerCase();

    if (
      lower === "yes" ||
      lower === "connect" ||
      lower === "match"
    ) {
      user.awaitingEmail = true;
      user.wantsMatch = true;

      socket.emit("message", {
        id: makeId(),
        role: "ai",
        persona: "System",
        text: "Send your email to connect."
      });

      return;
    }

    ////////////////////////////////////////////////////////////
    // STORE CONTEXT
    ////////////////////////////////////////////////////////////

    user.lastUserMessage = text;
    user.lastTopic = getTopic(text);

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
  console.log("EMAIL MATCH SYSTEM RUNNING");
});