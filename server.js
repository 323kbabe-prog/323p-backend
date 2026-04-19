//////////////////////////////////////////////////////////////
// CHATROOM BACKEND (FINAL — FIX DOUBLE AI REPLY ONLY)
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
// 🔥 JIMMY VOICE
//////////////////////////////////////////////////////////////
const JIMMY_VOICE = `
You are in a live chatroom.

Voice:
- casual, witty, effortless
- like a late-night host talking to a friend

Rules:
- include real people, places, or events
- no formal explanation
- no assistant tone
- no identity mention
- do NOT ask questions

Style:
- short
- conversational
`;

//////////////////////////////////////////////////////////////
// CLEAN TEXT
//////////////////////////////////////////////////////////////
function cleanText(text){
  return text
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

//////////////////////////////////////////////////////////////
// READING DELAY
//////////////////////////////////////////////////////////////
function getReadingDelay(text){
  const words = text.split(" ").length;
  return Math.min(1200 + words * 120, 5000);
}

//////////////////////////////////////////////////////////////
// BUILD CONTEXT
//////////////////////////////////////////////////////////////
function buildContext(room, extraText, trends){
  const history = room.slice(-6)
    .map(m => `${m.persona}: ${m.content}`)
    .join("\n");

  return `
${history}

New:
${extraText}

Signals:
${trends}
`;
}

//////////////////////////////////////////////////////////////
// 🔥 JIMMY SEARCH
//////////////////////////////////////////////////////////////
async function getTrendPool(room){

  try{

    const history = room.slice(-5)
      .map(m => m.content)
      .join("\n");

    const qRes = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      temperature:0.9,
      messages:[
        {
          role:"system",
          content:`Output ONLY a search query (3–8 words)`
        },
        {
          role:"user",
          content: history
        }
      ]
    });

    const query = qRes.choices[0].message.content.trim();

    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${process.env.SERP_KEY}&tbs=qdr:d`;

    const res = await fetch(url);
    const data = await res.json();

    const items = (data.organic_results || []).slice(0,5);

    return items.map(r => r.title).join("\n");

  }catch(e){
    console.log("SERP error:", e);
    return "";
  }
}

//////////////////////////////////////////////////////////////
// LOOP (FIXED WITH AI LOCK)
//////////////////////////////////////////////////////////////
function startLoop(roomId){

  async function loop(){

    const delay = 1800 + Math.random()*1200;

    setTimeout(async () => {

      const room = rooms[roomId];
      if(!room) return;

      const last = room[room.length - 1];
      const idle = Date.now() - (last?.time || Date.now());

      if(idle > 1000){

        const trends = await getTrendPool(room);

        ////////////////////////////////////////////////////////////
        // STRANGER TURN
        ////////////////////////////////////////////////////////////
        if(room.turn === "stranger"){

          const context = buildContext(room, last?.content || "", trends);

          const s = await openai.chat.completions.create({
            model:"gpt-4o-mini",
            temperature:0.9,
            messages:[
              {
                role:"system",
                content: JIMMY_VOICE + `
- 1 sentence only
`
              },
              {
                role:"user",
                content: context
              }
            ]
          });

          const strangerText = cleanText(s.choices[0].message.content);

          setTimeout(() => {

            rooms[roomId].push({
              persona:"Stranger",
              content:strangerText,
              time:Date.now()
            });

            io.to(roomId).emit("message", {
              role:"ai",
              persona:"Stranger",
              text:strangerText
            });

            room.turn = "ai";

          }, 800);
        }

        ////////////////////////////////////////////////////////////
        // AI TURN (LOCKED)
        ////////////////////////////////////////////////////////////
        else if(room.turn === "ai" && !room.aiBusy){

          room.aiBusy = true; // 🔥 LOCK

          const context = buildContext(room, last?.content || "", trends);

          const a = await openai.chat.completions.create({
            model:"gpt-4o-mini",
            temperature:0.7,
            messages:[
              {
                role:"system",
                content: JIMMY_VOICE
              },
              {
                role:"user",
                content: context
              }
            ]
          });

          const aiReply = cleanText(a.choices[0].message.content);

          io.to(roomId).emit("typing", { persona:"AI" });

          const aiDelay = getReadingDelay(aiReply);

          setTimeout(() => {

            rooms[roomId].push({
              persona:"AI",
              content:aiReply,
              time:Date.now()
            });

            io.to(roomId).emit("message", {
              role:"ai",
              persona:"AI",
              text:aiReply
            });

            room.aiBusy = false; // 🔓 UNLOCK

            setTimeout(() => {
              room.turn = "stranger";
            }, 1200 + Math.random()*800);

          }, aiDelay);
        }
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
      rooms[roomId].turn = "stranger";
      rooms[roomId].aiBusy = false; // 🔥 INIT
      startLoop(roomId);
    }

    socket.emit("message", {
      role:"ai",
      persona:"System",
      text:"Welcome to 323LAchat"
    });

  });

//////////////////////////////////////////////////////////////
// USER MESSAGE (BLOCK IF AI BUSY)
//////////////////////////////////////////////////////////////
  socket.on("sendMessage", async ({ roomId, message }) => {

    if (!message) return;

    const room = rooms[roomId];

    if(room.aiBusy) return; // 🔥 BLOCK DOUBLE AI

    room.aiBusy = true;

    room.push({
      persona:"User",
      content:message,
      time:Date.now()
    });

    io.to(roomId).emit("message", {
      role:"user",
      text:message
    });

    const trends = await getTrendPool(room);
    const context = buildContext(room, message, trends);

    const r = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      temperature:0.6,
      messages:[
        {
          role:"system",
          content: JIMMY_VOICE
        },
        {
          role:"user",
          content: context
        }
      ]
    });

    const aiText = cleanText(r.choices[0].message.content);

    io.to(roomId).emit("typing", {
      persona:"AI"
    });

    const aiDelay = getReadingDelay(aiText);

    setTimeout(() => {

      room.push({
        persona:"AI",
        content:aiText,
        time:Date.now()
      });

      io.to(roomId).emit("message", {
        role:"ai",
        persona:"AI",
        text:aiText
      });

      room.aiBusy = false; // 🔓 UNLOCK

    }, aiDelay);

  });

});

//////////////////////////////////////////////////////////////
// START
//////////////////////////////////////////////////////////////
const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("CHATROOM RUNNING (AI DOUBLE FIXED)");
});