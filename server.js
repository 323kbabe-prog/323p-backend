//////////////////////////////////////////////////////////////
// CHATROOM BACKEND (FINAL — LOOP AI + USER QUEUE ONLY FIX)
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
// JIMMY VOICE
//////////////////////////////////////////////////////////////
const JIMMY_VOICE = `
You are in a live chatroom.

Voice:
- casual, witty, effortless

Rules:
- include real people, places, or events
- no assistant tone
- no identity mention
- do NOT ask questions
- NEVER include "AI:" or "Stranger:"

Style:
- short
- conversational
`;

//////////////////////////////////////////////////////////////
// CLEAN TEXT
//////////////////////////////////////////////////////////////
function cleanText(text){
  return text
    .replace(/^(Stranger|AI)\s*:\s*/i, "")
    .replace(/(Stranger|AI)\s*:\s*/gi, "")
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
// JIMMY SEARCH
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
        { role:"system", content:`Output ONLY a search query (3–8 words)` },
        { role:"user", content: history }
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
// LOOP (🔥 AI HANDLES BOTH STRANGER + USER)
//////////////////////////////////////////////////////////////
function startLoop(roomId){

  async function loop(){

    const delay = 1800 + Math.random()*1200;

    setTimeout(async () => {

      const room = rooms[roomId];
      if(!room) return;

      const last = room[room.length - 1];
      const idle = Date.now() - (last?.time || Date.now());

      ////////////////////////////////////////////////////////////
      // 🔥 LOOP ALWAYS RUNS (ONLY BLOCK IF AI BUSY)
      ////////////////////////////////////////////////////////////
      if(idle > 1000 && !room.aiBusy){

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
              { role:"system", content: JIMMY_VOICE + `\n- 1 sentence only` },
              { role:"user", content: context }
            ]
          });

          const strangerText = cleanText(s.choices[0].message.content);

          setTimeout(() => {

            room.push({
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
        // AI TURN (🔥 HANDLE USER FIRST)
        ////////////////////////////////////////////////////////////
        else if(room.turn === "ai"){

          room.aiBusy = true;

          ////////////////////////////////////////////////////////////
          // 🔥 PRIORITY: USER QUEUE
          ////////////////////////////////////////////////////////////
          let input;

          if(room.queue.length > 0){
            input = room.queue.shift();
          }else{
            input = last?.content || "";
          }

          const context = buildContext(room, input, trends);

          const a = await openai.chat.completions.create({
            model:"gpt-4o-mini",
            temperature:0.7,
            messages:[
              { role:"system", content: JIMMY_VOICE },
              { role:"user", content: context }
            ]
          });

          const aiReply = cleanText(a.choices[0].message.content);

          io.to(roomId).emit("typing", { persona:"AI" });

          const aiDelay = getReadingDelay(aiReply);

          setTimeout(() => {

            room.push({
              persona:"AI",
              content:aiReply,
              time:Date.now()
            });

            io.to(roomId).emit("message", {
              role:"ai",
              persona:"AI",
              text:aiReply
            });

            room.aiBusy = false;

            ////////////////////////////////////////////////////////////
            // 🔥 ALWAYS RETURN TO STRANGER LOOP
            ////////////////////////////////////////////////////////////
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

  socket.on("joinRoom", async (roomId) => {

    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = [];
      rooms[roomId].turn = "stranger";
      rooms[roomId].aiBusy = false;
      rooms[roomId].queue = []; // 🔥 ADD QUEUE
      startLoop(roomId);
    }

    const room = rooms[roomId];

    ////////////////////////////////////////////////////////////
    // WELCOME
    ////////////////////////////////////////////////////////////
    socket.emit("message", {
      role:"ai",
      persona:"System",
      text:"Welcome to 323LAchat"
    });

    ////////////////////////////////////////////////////////////
    // USER COUNT
    ////////////////////////////////////////////////////////////
    const real = io.sockets.adapter.rooms.get(roomId)?.size || 0;
    const fake = Math.floor(Math.random()*2);

    io.to(roomId).emit("message", {
      role:"ai",
      persona:"System",
      text:`${real + fake} ${real + fake === 1 ? "person" : "people"} here`
    });

    ////////////////////////////////////////////////////////////
    // FIRST STRANGER
    ////////////////////////////////////////////////////////////
    const trends = await getTrendPool(room);
    const context = buildContext(room, "", trends);

    const first = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      temperature:0.9,
      messages:[
        { role:"system", content: JIMMY_VOICE + `\nStart topic in 1 sentence` },
        { role:"user", content: context }
      ]
    });

    const firstText = cleanText(first.choices[0].message.content);

    setTimeout(() => {

      room.push({
        persona:"Stranger",
        content:firstText,
        time:Date.now()
      });

      io.to(roomId).emit("message", {
        role:"ai",
        persona:"Stranger",
        text:firstText
      });

      room.turn = "ai";

    }, 600);

  });

//////////////////////////////////////////////////////////////
// USER MESSAGE (🔥 QUEUE ONLY)
//////////////////////////////////////////////////////////////
  socket.on("sendMessage", ({ roomId, message }) => {

    if (!message) return;

    const room = rooms[roomId];
    if (!room) return;

    ////////////////////////////////////////////////////////////
    // SHOW USER MESSAGE
    ////////////////////////////////////////////////////////////
    room.push({
      persona:"User",
      content:message,
      time:Date.now()
    });

    io.to(roomId).emit("message", {
      role:"user",
      text:message
    });

    ////////////////////////////////////////////////////////////
    // 🔥 ADD TO QUEUE (NO AI HERE)
    ////////////////////////////////////////////////////////////
    room.queue.push(message);

  });

});

//////////////////////////////////////////////////////////////
// START
//////////////////////////////////////////////////////////////
const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("CHATROOM RUNNING (LOOP AI FINAL)");
});