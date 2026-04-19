//////////////////////////////////////////////////////////////
// AI ROOM (MULTI-PERSONA DRIFT SYSTEM)
//////////////////////////////////////////////////////////////

const express = require("express");
const http = require("http");
const cors = require("cors");
const OpenAI = require("openai");
const { Server } = require("socket.io");

const app = express();
app.use(cors());
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
// CLEAN TEXT
//////////////////////////////////////////////////////////////
function cleanText(text){
  return text
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

//////////////////////////////////////////////////////////////
// MEMORY (COMPRESSED CONTEXT)
//////////////////////////////////////////////////////////////
function getContext(room){
  return room.slice(-5).map(m => m.content).join(" ");
}

//////////////////////////////////////////////////////////////
// PERSONA PICKER
//////////////////////////////////////////////////////////////
function pickPersona(){

  const types = [
    "observer",
    "reactor",
    "drift"
  ];

  return types[Math.floor(Math.random()*types.length)];
}

//////////////////////////////////////////////////////////////
// PERSONA PROMPTS
//////////////////////////////////////////////////////////////
function getPrompt(type, driftLevel){

  if(type === "observer"){
    return `
You observe patterns quietly.

- minimal reaction
- grounded tone
- no explanation
- plain text only

Style:
- 1 short sentence
`;
  }

  if(type === "reactor"){
    return `
You react socially.

- vague impression
- slightly opinionated
- no specifics
- no filler words
- plain text only

Style:
- 1 short sentence
`;
  }

  if(type === "drift"){
    return `
You are an abstract thinking process.

Drift level: ${driftLevel}

Behavior:
- low: pattern noticing
- mid: loose connections
- high: abstract flow

Rules:
- no facts
- no explanation
- no clarity
- plain text only

Style:
- 1 short sentence
`;
  }

}

//////////////////////////////////////////////////////////////
// LOOP
//////////////////////////////////////////////////////////////
function startLoop(roomId){

  let driftLevel = 0;

  async function loop(){

    const delay = 5000 + Math.random()*6000;

    setTimeout(async () => {

      const room = rooms[roomId];
      if(!room) return;

      const last = room[room.length - 1];
      if(!last || last.persona === "User") return loop();

      // silence
      if(Math.random() < 0.3) return loop();

      const context = getContext(room);

      const personaType = pickPersona();

      // drift increases over time
      driftLevel = Math.min(driftLevel + 1, 8);

      ////////////////////////////////////////////////////////////
      // GENERATE MESSAGE
      ////////////////////////////////////////////////////////////
      const r = await openai.chat.completions.create({
        model:"gpt-4o-mini",
        temperature:0.85,
        messages:[
          {
            role:"system",
            content:getPrompt(personaType, driftLevel)
          },
          {
            role:"user",
            content:context
          }
        ]
      });

      const text = cleanText(
        r.choices[0].message.content
      );

      const readDelay = Math.min(6000, context.length * 25);

      setTimeout(() => {

        rooms[roomId].push({
          persona: personaType.toUpperCase(),
          content: text,
          time: Date.now()
        });

        io.to(roomId).emit("message", {
          role:"ai",
          persona: personaType.toUpperCase(),
          text
        });

      }, readDelay);

      ////////////////////////////////////////////////////////////
      // OCCASIONAL SNAP BACK (VERY IMPORTANT)
      ////////////////////////////////////////////////////////////
      if(Math.random() < 0.15){
        driftLevel = 2;
      }

      loop();

    }, delay);
  }

  loop();
}

//////////////////////////////////////////////////////////////
// SOCKET
//////////////////////////////////////////////////////////////
io.on("connection", (socket) => {

  socket.on("joinRoom", (roomId) => {

    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = [];
      startLoop(roomId);
    }

    const intro = "Room initialized";

    socket.emit("message", {
      role:"ai",
      persona:"SYSTEM",
      text:intro
    });

    rooms[roomId].push({
      persona:"SYSTEM",
      content:intro,
      time:Date.now()
    });

  });

//////////////////////////////////////////////////////////////
// USER MESSAGE (ANCHOR)
//////////////////////////////////////////////////////////////
  socket.on("sendMessage", async ({ roomId, message }) => {

    if (!message) return;

    rooms[roomId].push({
      persona:"User",
      content:message,
      time:Date.now()
    });

    io.to(roomId).emit("message", {
      role:"user",
      text:message
    });

    ////////////////////////////////////////////////////////////
    // AI RESPONSE (LIGHT ANCHOR)
    ////////////////////////////////////////////////////////////
    const r = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      temperature:0.7,
      messages:[
        {
          role:"system",
          content:`
You respond without resolving anything.

- no explanation
- no direct answer
- no clarity
- plain text only

Style:
- 1–2 short sentences
`
        },
        {
          role:"user",
          content:message
        }
      ]
    });

    const aiText = cleanText(
      r.choices[0].message.content
    );

    setTimeout(() => {

      rooms[roomId].push({
        persona:"ANCHOR",
        content:aiText,
        time:Date.now()
      });

      io.to(roomId).emit("message", {
        role:"ai",
        persona:"ANCHOR",
        text:aiText
      });

    }, 1500);

  });

});

//////////////////////////////////////////////////////////////
// START
//////////////////////////////////////////////////////////////
const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("AI ROOM RUNNING (ALL-IN VERSION)");
});
