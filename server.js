//////////////////////////////////////////////////////////////
// CHATROOM BACKEND (FINAL — CLEAN STABLE VERSION)
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
// 🔥 ID HELPER
//////////////////////////////////////////////////////////////
function makeId(){
  return Date.now() + Math.random();
}

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

  return `${history}\n\nNew:\n${extraText}\n\nSignals:\n${trends}`;
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
// LOOP
//////////////////////////////////////////////////////////////
function startLoop(roomId){

  async function loop(){

    const delay = 1800 + Math.random()*1200;

    setTimeout(async () => {

      const room = rooms[roomId];
      if(!room) return;

      if(room.turn === "paused") return;

      const last = room[room.length - 1];
      const idle = Date.now() - (last?.time || Date.now());

      if(idle > 1000 && !room.aiBusy && !room.awaitingUser){

        const trends = await getTrendPool(room);

        ////////////////////////////////////////////////////////////
        // STRANGER
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

            room.push({ persona:"Stranger", content:strangerText, time:Date.now() });

            io.to(roomId).emit("message", {
              id: makeId(),
              role:"ai",
              persona:"Stranger",
              text:strangerText
            });

            room.turn = "ai";

          }, 800);
        }

        ////////////////////////////////////////////////////////////
        // AI
        ////////////////////////////////////////////////////////////
        else if(room.turn === "ai"){

          room.aiBusy = true;

          let input = room.queue.length > 0
            ? room.queue.shift()
            : last?.content || "";

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

            room.push({ persona:"AI", content:aiReply, time:Date.now() });

            io.to(roomId).emit("message", {
              id: makeId(),
              role:"ai",
              persona:"AI",
              text:aiReply
            });

            ////////////////////////////////////////////////////////////
            // ROUND COUNT
            ////////////////////////////////////////////////////////////
            room.rounds++;

            ////////////////////////////////////////////////////////////
            // ASK AFTER 5
            ////////////////////////////////////////////////////////////
            if(room.rounds >= 5 && !room.awaitingUser){

              room.awaitingUser = true;

              setTimeout(() => {

                const ask = "you still here";

                room.push({ persona:"AI", content:ask, time:Date.now() });

                io.to(roomId).emit("message", {
                  id: makeId(),
                  role:"ai",
                  persona:"AI",
                  text:ask
                });

                setTimeout(() => {
                  if(room.awaitingUser && Date.now() - room.lastUserTime > 8000){
                    room.turn = "paused";
                  }
                }, 8000);

              }, 500);
            }

            room.aiBusy = false;

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
      rooms[roomId].queue = [];
      rooms[roomId].rounds = 0;
      rooms[roomId].awaitingUser = false;
      rooms[roomId].lastUserTime = Date.now();
      startLoop(roomId);
    }

    socket.emit("message", {
      id: makeId(),
      role:"ai",
      persona:"System",
      text:"Welcome to 323LAchat"
    });

    const real = io.sockets.adapter.rooms.get(roomId)?.size || 0;
    const fake = Math.floor(Math.random()*2);

    io.to(roomId).emit("message", {
      id: makeId(),
      role:"ai",
      persona:"System",
      text:`${real + fake} ${real + fake === 1 ? "person" : "people"} here`
    });

  });

//////////////////////////////////////////////////////////////
// USER MESSAGE (FINAL)
//////////////////////////////////////////////////////////////
  socket.on("sendMessage", ({ roomId, message }) => {

    if (!message) return;

    const room = rooms[roomId];
    if (!room) return;

    room.lastUserTime = Date.now();

    ////////////////////////////////////////////////////////////
    // RESUME FIX
    ////////////////////////////////////////////////////////////
    if(room.awaitingUser){
      room.awaitingUser = false;
      room.rounds = 0;
      room.turn = "ai";
      room.queue.unshift(message);
    } else {
      room.queue.push(message);
    }

    ////////////////////////////////////////////////////////////
    // ALWAYS SHOW USER MESSAGE
    ////////////////////////////////////////////////////////////
    const msg = {
      id: makeId(),
      role:"user",
      text:message
    };

    socket.emit("message", msg);
    socket.to(roomId).emit("message", msg);

    room.push({
      persona:"User",
      content:message,
      time:Date.now()
    });

  });

});

//////////////////////////////////////////////////////////////
// START
//////////////////////////////////////////////////////////////
const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("CHATROOM RUNNING (FINAL)");
});