//////////////////////////////////////////////////////////////
// 🔥 CLEAN CHATROOM SERVER (AI ↔ STRANGER + HUMAN TIMING)
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
// 🔍 SERP TREND FETCH
//////////////////////////////////////////////////////////////
async function getTrendPool(){

  const queries = [
    "coachella 2026",
    "music trending now",
    "tiktok viral",
    "celebrity news today"
  ];

  let all = [];

  for(const q of queries){
    try{
      const url = `https://serpapi.com/search.json?q=${encodeURIComponent(q)}&api_key=${process.env.SERP_KEY}&tbs=qdr:d`;

      const res = await fetch(url);
      const data = await res.json();

      (data.organic_results || [])
        .slice(0,5)
        .forEach(r => all.push(r.title));

    }catch(e){
      console.log("SERP error:", e);
    }
  }

  return all.slice(0,10).join("\n");
}

//////////////////////////////////////////////////////////////
// 🤖 AI ↔ STRANGER LOOP (HUMAN STYLE)
//////////////////////////////////////////////////////////////
function startLoop(roomId){

  let chain = 0;

  async function loop(){

    const delay = 4000 + Math.random()*4000;

    setTimeout(async () => {

      const room = rooms[roomId];
      if(!room) return;

      const last = room[room.length - 1];
      const idle = Date.now() - (last?.time || Date.now());

      // 🔥 natural silence
      if(Math.random() < 0.25) return loop();

      if(idle > 2000 && last?.persona === "AI"){

        if(chain > 6){
          chain = 0;
          return loop();
        }

        const trends = await getTrendPool();

        ////////////////////////////////////////////////////////////
        // 👻 STRANGER
        ////////////////////////////////////////////////////////////
        const s = await openai.chat.completions.create({
          model:"gpt-4o-mini",
          temperature:0.9,
          messages:[
            {
              role:"system",
              content:"1 short casual comment using real trending names"
            },
            {
              role:"user",
              content:`AI: ${last.content}\n\n${trends}`
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
          // 🤖 AI REPLY
          ////////////////////////////////////////////////////////////
          const a = await openai.chat.completions.create({
            model:"gpt-4o-mini",
            temperature:0.7,
            messages:[
              {
                role:"system",
                content:"1 short casual reply using trends"
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

        chain++;
      }

      loop();

    }, delay);
  }

  loop();
}

//////////////////////////////////////////////////////////////
// SOCKET EVENTS
//////////////////////////////////////////////////////////////
io.on("connection", (socket) => {

  socket.on("joinRoom", (roomId) => {

    socket.join(roomId);

    if(!rooms[roomId]){
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

    const real = io.sockets.adapter.rooms.get(roomId)?.size || 0;
    const fake = Math.floor(Math.random()*2);

    io.to(roomId).emit("message", {
      role:"ai",
      persona:"System",
      text:`👥 ${real + fake} people here`
    });
  });

  ////////////////////////////////////////////////////////////
  // USER MESSAGE
  ////////////////////////////////////////////////////////////
  socket.on("sendMessage", async ({ roomId, message }) => {

    if(!message) return;

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

});

//////////////////////////////////////////////////////////////
// BASIC ROUTE
//////////////////////////////////////////////////////////////
app.get("/", (_, res) => res.send("OK"));

//////////////////////////////////////////////////////////////
// START
//////////////////////////////////////////////////////////////
const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("🔥 CLEAN CHATROOM RUNNING");
});
