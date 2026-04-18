//////////////////////////////////////////////////////////////
// CLEAN CHATROOM SERVER (AI-NATIVE SOCIAL VERSION)
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
// AI SOCIAL TOPIC (NO SERP)
//////////////////////////////////////////////////////////////
async function getSocialTopic(){

  const r = await openai.chat.completions.create({
    model:"gpt-4o-mini",
    temperature:0.9,
    messages:[
      {
        role:"system",
        content:`
Generate ONE short sentence about something people are arguing or complaining about online right now.

Rules:
- everyday life topics only
- no crypto, nft, marketing, or tech hype
- no celebrity news
- must feel real and current
- examples:
  - people arguing about tipping culture again
  - everyone complaining about job interviews
  - debate about texting etiquette getting weird
`
      }
    ]
  });

  return r.choices[0].message.content.trim();
}

//////////////////////////////////////////////////////////////
// LOOP (AI ↔ STRANGER)
//////////////////////////////////////////////////////////////
function startLoop(roomId){

  let chain = 0;

  async function loop(){

    const delay = 5000 + Math.random()*5000;

    setTimeout(async () => {

      const room = rooms[roomId];
      if(!room) return;

      const last = room[room.length - 1];
      const idle = Date.now() - (last?.time || Date.now());

      // natural silence
      if(Math.random() < 0.3) return loop();

      if(idle > 2000 && last?.persona === "AI"){

        if(chain > 6){
          chain = 0;
          return loop();
        }

        const topic = await getSocialTopic();

        ////////////////////////////////////////////////////////////
        // STRANGER
        ////////////////////////////////////////////////////////////
        const s = await openai.chat.completions.create({
          model:"gpt-4o-mini",
          temperature:0.9,
          messages:[
            {
              role:"system",
              content:`
You are a random person in a chatroom.

- 1 short sentence
- casual, slightly negative or critical
- react like a comment section
`
            },
            {
              role:"user",
              content:`
AI: ${last.content}

Topic: ${topic}
`
            }
          ]
        });

        const strangerText = s.choices[0].message.content.trim();

        const strangerDelay = 2000 + Math.random()*3000;

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
          // AI REPLY
          ////////////////////////////////////////////////////////////
          const a = await openai.chat.completions.create({
            model:"gpt-4o-mini",
            temperature:0.7,
            messages:[
              {
                role:"system",
                content:`
You are a real person.

- 1 short sentence
- slightly opinionated
- continue the conversation
`
              },
              {
                role:"user",
                content:`
Stranger: ${strangerText}

Topic: ${topic}
`
              }
            ]
          });

          const aiReply = a.choices[0].message.content.trim();

          const aiDelay = 2000 + Math.random()*3500;

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
// SOCKET
//////////////////////////////////////////////////////////////
io.on("connection", (socket) => {

  socket.on("joinRoom", (roomId) => {

    socket.join(roomId);

    if(!rooms[roomId]){
      rooms[roomId] = [];
      startLoop(roomId);
    }

    // FIRST MESSAGE (fast)
    setTimeout(() => {
      io.to(roomId).emit("message", {
        role:"ai",
        persona:"AI",
        text:"people always arguing about something"
      });
    }, 800);

  });

//////////////////////////////////////////////////////////////
// USER MESSAGE
//////////////////////////////////////////////////////////////
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

    const topic = await getSocialTopic();

    const r = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      temperature:0.7,
      messages:[
        {
          role:"system",
          content:`
You are a real person.

- 1 short reply
- react like you're in a chatroom
`
        },
        {
          role:"user",
          content:`
User: ${message}

Topic: ${topic}
`
        }
      ]
    });

    const aiText = r.choices[0].message.content.trim();

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

    }, 1500 + Math.random()*2000);

  });

});

//////////////////////////////////////////////////////////////
// ROOT
//////////////////////////////////////////////////////////////
app.get("/", (_, res) => res.send("OK"));

//////////////////////////////////////////////////////////////
// START
//////////////////////////////////////////////////////////////
const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("CHATROOM RUNNING AI NATIVE");
});
