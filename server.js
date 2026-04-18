//////////////////////////////////////////////////////////////
// 🔥 CHATROOM BACKEND (FINAL — HUMAN TIMING VERSION)
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

const rooms = {};

//////////////////////////////////////////////////////////////
// 🔍 SERP TREND FETCH
//////////////////////////////////////////////////////////////
async function getTrendPool(){

const queries = [
  "online arguments trending",
  "people complaining about things",
  "random social posts today"
];
  let all = [];

  for(const q of queries){
    try{
      const url = `https://serpapi.com/search.json?q=${encodeURIComponent(q)}&api_key=${process.env.SERP_KEY}&tbs=qdr:d`;

      const res = await fetch(url);
      const data = await res.json();

      const items = (data.organic_results || []).slice(0,5);

      items.forEach(r => {
        all.push(r.title);
      });

    }catch(e){
      console.log("SERP error:", e);
    }
  }

  return all.slice(0,10).join("\n");
}

//////////////////////////////////////////////////////////////
// SOCKET CHATROOM
//////////////////////////////////////////////////////////////
io.on("connection", (socket) => {

//////////////////////////////////////////////////////////////
// 🤖 HUMAN-LIKE LOOP
//////////////////////////////////////////////////////////////
function startLoop(roomId){

  let chainCount = 0;

  async function loop(){

    // 🔥 slower base loop
    const loopDelay = 1000 + Math.random()*1500;

    setTimeout(async () => {

      const room = rooms[roomId];
      if(!room) return;

      const lastMsg = room[room.length - 1];
      const idle = Date.now() - (lastMsg?.time || Date.now());

      // 🔥 skip sometimes (real silence)
      if(Math.random() < 0.25){
        return loop();
      }

      if(idle > 2000 && lastMsg?.persona === "AI"){

        if(chainCount > 6){
          chainCount = 0;
          return loop();
        }

        const trends = await getTrendPool();

        ////////////////////////////////////////////////////////////
        // 👻 STRANGER (DELAYED)
        ////////////////////////////////////////////////////////////
        const s = await openai.chat.completions.create({
          model:"gpt-4o-mini",
          temperature:0.9,
          messages:[
            {
              role:"system",
              content:`
You are a random human in a chatroom.

- 1 short sentence
- casual, slightly cold
- MUST reference real trends
`
            },
            {
              role:"user",
              content:`AI: ${lastMsg.content}\n\n${trends}`
            }
          ]
        });

        const strangerText = s.choices[0].message.content.trim();

        const strangerDelay = 1500 + Math.random()*2000;

        setTimeout(async () => {

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

          ////////////////////////////////////////////////////////////
          // 🤖 AI REPLY (DELAYED)
          ////////////////////////////////////////////////////////////
          const a = await openai.chat.completions.create({
            model:"gpt-4o-mini",
            temperature:0.7,
            messages:[
              {
                role:"system",
                content:`
You are a real person.

- 1 short reply
- casual
- slightly opinionated
- reference trends
`
              },
              {
                role:"user",
                content:`${strangerText}\n\n${trends}`
              }
            ]
          });

          const aiReply = a.choices[0].message.content.trim();

          const aiDelay = 1500 + Math.random()*2500;

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

          }, aiDelay);

        }, strangerDelay);

        chainCount++;
      }

      loop();

    }, loopDelay);
  }

  loop();
}

//////////////////////////////////////////////////////////////
// JOIN ROOM
//////////////////////////////////////////////////////////////
socket.on("joinRoom", (roomId) => {

  socket.join(roomId);

  if (!rooms[roomId]) {
    rooms[roomId] = [];
    startLoop(roomId);
  }

  const intro = "Welcome to 323LAchat";

  socket.emit("message", {
    role:"ai",
    persona:"AI",
    text:intro
  });

  rooms[roomId].push({
    persona:"AI",
    content:intro,
    time:Date.now()
  });

  // 👥 user count
  const real = io.sockets.adapter.rooms.get(roomId)?.size || 0;
  const fake = Math.floor(Math.random()*2);

  io.to(roomId).emit("message", {
    role:"ai",
    persona:"System",
    text:`👥 ${real + fake} people here`
  });

});

//////////////////////////////////////////////////////////////
// USER MESSAGE
//////////////////////////////////////////////////////////////
socket.on("sendMessage", async ({ roomId, message }) => {

  if (!message) return;

  if (!rooms[roomId]) rooms[roomId] = [];

  rooms[roomId].push({
    persona:"User",
    content:message,
    time:Date.now()
  });

  io.to(roomId).emit("message", {
    role:"user",
    text:message
  });

  const trends = await getTrendPool();

  const r = await openai.chat.completions.create({
    model:"gpt-4o-mini",
    temperature:0.7,
    messages:[
      {
        role:"system",
        content:"1 short casual reply using real trends"
      },
      {
        role:"user",
        content:`${message}\n\n${trends}`
      }
    ]
  });

  const aiText = r.choices[0].message.content.trim();

  const delay = 1200 + Math.random()*1500;

  setTimeout(() => {

    rooms[roomId].push({
      persona:"AI",
      content:aiText,
      time:Date.now()
    });

    io.to(roomId).emit("message", {
      role:"ai",
      persona:"AI",
      text:aiText
    });

  }, delay);

});

socket.on("disconnect", () => {
  console.log("🔴 disconnected:", socket.id);
});

});

//////////////////////////////////////////////////////////////
// ROOT
//////////////////////////////////////////////////////////////
app.get("/", (_, res) => res.send("OK"));

//////////////////////////////////////////////////////////////
// START SERVER
//////////////////////////////////////////////////////////////
const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("🔥 CHATROOM RUNNING HUMAN VERSION");
});
