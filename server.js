//////////////////////////////////////////////////////////////
// CHATROOM BACKEND (FINAL — USER-LOCAL PRESENCE VERSION)
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

//////////////////////////////////////////////////////////////
// ID
//////////////////////////////////////////////////////////////
function makeId() {
  return Date.now() + Math.random();
}

//////////////////////////////////////////////////////////////
// SAFE EMIT HELPERS
//////////////////////////////////////////////////////////////
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
    const s = io.sockets.sockets.get(socketId);
    if (!s) continue;

    const paused = rooms[roomId]?.userState?.[socketId]?.awaiting;
    if (paused) continue;

    s.emit("typing", { persona: "AI" });
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

Rules:
- 1–2 sentences max
- do NOT repeat ideas
- no assistant tone
- no identity mention
- do NOT ask questions (except "you still here")
- NEVER include "AI:" or "Stranger:"
- include real-world references when natural
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
    .replace(/^(Stranger|AI)\s*:\s*/i, "")
    .replace(/(Stranger|AI)\s*:\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

//////////////////////////////////////////////////////////////
// DELAY
//////////////////////////////////////////////////////////////
function getDelay(text) {
  return Math.min(1200 + String(text || "").split(" ").length * 120, 5000);
}

//////////////////////////////////////////////////////////////
// CONTEXT
//////////////////////////////////////////////////////////////
function buildContext(room, extra, trends) {
  const history = room
    .slice(-6)
    .map(m => `${m.persona}: ${m.content}`)
    .join("\n");

  return `${history}\n\nNew:\n${extra}\n\nSignals:\n${trends}`;
}

//////////////////////////////////////////////////////////////
// SEARCH
//////////////////////////////////////////////////////////////
async function getTrendPool(room) {
  try {
    const history = room
      .slice(-5)
      .map(m => m.content)
      .join("\n");

    const q = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      messages: [
        { role: "system", content: JIMMY_SEARCH },
        { role: "user", content: history }
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
      .map(r => r.title)
      .join("\n");
  } catch {
    return "";
  }
}

//////////////////////////////////////////////////////////////
// TRIGGER AI
//////////////////////////////////////////////////////////////
function triggerAI(roomId) {
  const room = rooms[roomId];
  if (!room || room.aiBusy) return;
  room.turn = "ai";
}

//////////////////////////////////////////////////////////////
// LOOP
//////////////////////////////////////////////////////////////
function startLoop(roomId) {
  async function loop() {
    setTimeout(async () => {
      const room = rooms[roomId];
      if (!room) {
        loop();
        return;
      }

      const last = room[room.length - 1];
      const lastText = (last?.content || "").toLowerCase();

      //////////////////////////////////////////////////////////
      // GLOBAL STOP RIGHT AFTER "you still here"
      //////////////////////////////////////////////////////////
      if (lastText.includes("you still here")) {
        loop();
        return;
      }

      const idle = Date.now() - (last?.time || Date.now());

      if (idle > 800 && !room.aiBusy) {
        const trends = await getTrendPool(room);

        ////////////////////////////////////////////////////////
        // STRANGER
        ////////////////////////////////////////////////////////
        if (room.turn === "stranger") {
          const context = buildContext(room, last?.content || "", trends);

          try {
            const s = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              temperature: 0.9,
              messages: [
                {
                  role: "system",
                  content: HUMAN_CHAT + `
1 sentence only
casual reaction
NEVER say "you still here"
NEVER check presence
Speak like a normal human in the room.
`
                },
                { role: "user", content: context }
              ]
            });

            let text = cleanText(s.choices?.[0]?.message?.content);

            if (!text || text.toLowerCase().includes("you still here")) {
              loop();
              return;
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

        ////////////////////////////////////////////////////////
        // AI
        ////////////////////////////////////////////////////////
        else if (room.turn === "ai") {
          room.aiBusy = true;

          const failSafe = setTimeout(() => {
            room.aiBusy = false;
            room.turn = "stranger";
          }, 7000);

          const input =
            room.queue.length > 0
              ? room.queue.pop()
              : last?.content || "";

          const context = buildContext(room, input, trends);

          try {
            const a = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              temperature: 0.7,
              messages: [
                {
                  role: "system",
                  content: HUMAN_CHAT + `
You are the more responsive voice in the room.
Speak like a normal human, not like Jimmy Fallon.
`
                },
                { role: "user", content: context }
              ]
            });

            const reply = cleanText(a.choices?.[0]?.message?.content);

            emitTypingToRoom(roomId);

            setTimeout(() => {
              clearTimeout(failSafe);

              room.push({
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

              ////////////////////////////////////////////////////
              // USER-LOCAL "you still here"
              ////////////////////////////////////////////////////
              room.rounds++;

              if (room.rounds >= 6) {
                room.rounds = 0;

                const socketsInRoom = io.sockets.adapter.rooms.get(roomId) || new Set();

                for (const socketId of socketsInRoom) {
                  const s = io.sockets.sockets.get(socketId);
                  if (!s) continue;

                  s.emit("message", {
                    id: makeId(),
                    role: "ai",
                    persona: "AI",
                    text: "you still here"
                  });

                  room.userState[socketId] = {
                    awaiting: true,
                    time: Date.now()
                  };
                }
              }

              room.aiBusy = false;
              room.turn = "stranger";
            }, getDelay(reply));
          } catch {
            clearTimeout(failSafe);
            room.aiBusy = false;
            room.turn = "stranger";
          }
        }
      }

      loop();
    }, 1200);
  }

  loop();
}

//////////////////////////////////////////////////////////////
// SOCKET
//////////////////////////////////////////////////////////////
io.on("connection", (socket) => {
  socket.on("joinRoom", async (roomId) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = [];
      rooms[roomId].turn = "stranger";
      rooms[roomId].aiBusy = false;
      rooms[roomId].queue = [];
      rooms[roomId].rounds = 0;
      rooms[roomId].userState = {};
      startLoop(roomId);
    }

    const room = rooms[roomId];

    socket.emit("message", {
      id: makeId(),
      role: "ai",
      persona: "System",
      text: "Welcome to 323LAchat"
    });

    const real = io.sockets.adapter.rooms.get(roomId)?.size || 0;

    emitToRoom(roomId, {
      id: makeId(),
      role: "ai",
      persona: "System",
      text: `${real} ${real === 1 ? "person" : "people"} here`
    });

    ////////////////////////////////////////////////////////////
    // FIRST STRANGER
    ////////////////////////////////////////////////////////////
    try {
      const trends = await getTrendPool(room);
      const context = buildContext(room, "", trends);

      const first = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.9,
        messages: [
          {
            role: "system",
            content: HUMAN_CHAT + `
1 sentence only
Start a topic naturally.
Speak like a normal human in a room.
NEVER say "you still here"
`
          },
          { role: "user", content: context }
        ]
      });

      let text = cleanText(first.choices?.[0]?.message?.content);

      if (!text || text.toLowerCase().includes("you still here")) {
        text = "Feels like everyone has something random on their mind tonight.";
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
  });

  ////////////////////////////////////////////////////////////
  // USER MESSAGE
  ////////////////////////////////////////////////////////////
  socket.on("sendMessage", ({ roomId, message }) => {
    if (!message) return;

    const room = rooms[roomId];
    if (!room) return;

    if (room.userState?.[socket.id]) {
      room.userState[socket.id].awaiting = false;
      room.userState[socket.id].time = Date.now();
    }

    room.queue.push(message);
    if (room.queue.length > 5) {
      room.queue.shift();
    }

    const msg = {
      id: makeId(),
      role: "user",
      text: message
    };

    socket.emit("message", msg);
    socket.to(roomId).emit("message", msg);

    room.push({
      persona: "User",
      content: message,
      time: Date.now()
    });

    triggerAI(roomId);
  });

  socket.on("disconnect", () => {
    for (const roomId of Object.keys(rooms)) {
      const room = rooms[roomId];
      if (room?.userState?.[socket.id]) {
        delete room.userState[socket.id];
      }
    }
  });
});

//////////////////////////////////////////////////////////////
// START
//////////////////////////////////////////////////////////////
const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("CHATROOM RUNNING (FINAL USER-LOCAL PRESENCE)");
});