//////////////////////////////////////////////////////////////
// CHATROOM BACKEND (AI-NATIVE TOPIC, SAME UX)
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
// AI-NATIVE SOCIAL TOPIC (REPLACES SERP)
//////////////////////////////////////////////////////////////
async function getSocialTopic(){

  const r = await openai.chat.completions.create({
    model:"gpt-4o-mini",
    temperature:0.9,
    messages:[
      {
        role:"system",
        content:`
Generate ONE short sentence about something people are talking, arguing, or complaining about online right now.

Rules:
- everyday life topics
- no crypto, nft, marketing, or tech hype
- no celebrity news
- must feel real and current
`
      }
    ]
  });

  return r.choices[0].message.content.trim();
}

//////////////////////////////////////////////////////////////
// STRANGER LOOP (UNCHANGED FLOW)
//////////////////////////////////////////////////////////////
function startStrangerLoop(roomId){

  let chainCount = 0;

  async function loop(){

    const loopDelay = 4000 + Math.random()*4000;

    setTimeout(async () => {

      const room = rooms[roomId];
      if(!room) return;

      const lastMsg = room[room.length - 1];
      const idle = Date.now() - (lastMsg?.time || Date.now());

      if(Math.random() < 0.25){
        return loop();
      }

      if(idle > 2000 && lastMsg?.persona === "AI"){

        if(chainCount > 6){
          chainCount = 0;
          return loop();
        }

        const topic = await getSocialTopic();

        ////////////////////////////////////////////////////////////
        // STRANGER TALKS FIRST
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
- react like comment section
`
            },
            {
              role:"user",
              content:`AI: ${lastMsg.content}\n\nTopic: ${topic}`
            }
          ]
        });

        const strangerText = s.choices[0].message.content.trim();

        const strangerDelay = 1500 + Math.random()*2000;

        setTimeout(async () => {

          rooms[roomId].push({
            role:"assistant",
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
          // AI REPLIES
          ////////////////////////////////////////////////////////////
          const a = await openai.chat.completions.create({
            model:"gpt-4o-mini",
            temperature:0.7,
            messages:[
              {
                role:"system",
                content:`
You are another person in a chatroom.

- 1 short reply
- casual
`
              },
              {
                role:"user",
                content:`${strangerText}\n\nTopic: ${topic}`
              }
            ]
          });

          const aiReply = a.choices[0].message.content.trim();

          const aiDelay = 1500 + Math.random()*2500;

          setTimeout(() => {

            rooms[roomId].push({
              role:"assistant",
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
// JOIN ROOM (UNCHANGED UX)
//////////////////////////////////////////////////////////////
io.on("connection", (socket) => {

  socket.on("joinRoom", (roomId) => {

    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = [];
      startStrangerLoop(roomId);
    }

    const intro = "Welcome to 323LAchat";

    socket.emit("message", {
      role:"ai",
      persona:"AI",
      text:intro
    });

    if (rooms[roomId].length === 0) {
      rooms[roomId].push({
        role:"assistant",
        persona:"AI",
        content:intro,
        time:Date.now()
      });
    }

    ////////////////////////////////////////////////////////
    // USER COUNT (UNCHANGED)
    ////////////////////////////////////////////////////////
    const real = io.sockets.adapter.rooms.get(roomId)?.size || 0;
    const fake = Math.floor(Math.random()*2);
    const count = real + fake;

    io.to(roomId).emit("message", {
      role:"ai",
      persona:"System",
      text:`👥 ${count} ${count === 1 ? "person" : "people"} here`
    });

  });

//////////////////////////////////////////////////////////////
// USER MESSAGE (UNCHANGED FLOW)
//////////////////////////////////////////////////////////////
  socket.on("sendMessage", async ({ roomId, message }) => {

    if (!message) return;

    if (!rooms[roomId]) rooms[roomId] = [];

    rooms[roomId].push({
      role:"user",
      persona:"User",
      content:message,
      time:Date.now()
    });

    io.to(roomId).emit("message", {
      role:"user",
      text:message
    });

    const topic = await getSocialTopic();

    const r = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      temperature:0.7,
      messages:[
        {
          role:"system",
          content:`
You are a random human in a chatroom.

- 1 short sentence
- casual
`
        },
        {
          role:"user",
          content:`User: ${message}\n\nTopic: ${topic}`
        }
      ]
    });

    const aiText = r.choices[0].message.content.trim();

    const aiDelay = 1200 + Math.random()*1500;

    setTimeout(() => {

      rooms[roomId].push({
        role:"assistant",
        persona:"AI",
        content:aiText,
        time:Date.now()
      });

      io.to(roomId).emit("message", {
        role:"ai",
        persona:"AI",
        text:aiText
      });

    }, aiDelay);

  });

  socket.on("disconnect", () => {
    console.log("disconnected:", socket.id);
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
  console.log("CHATROOM RUNNING AI-NATIVE VERSION");
});
