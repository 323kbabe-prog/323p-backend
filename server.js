//////////////////////////////////////////////////////////////
// CHATROOM BACKEND (AI-NATIVE + SERP FOR USER REPLIES)
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
const roomState = {};

//////////////////////////////////////////////////////////////
// AI-NATIVE SOCIAL TOPIC
//////////////////////////////////////////////////////////////
async function getSocialTopic(){
  const r = await openai.chat.completions.create({
    model:"gpt-4o-mini",
    temperature:0.9,
    messages:[
      {
        role:"system",
        content:`
Generate ONE short sentence about something people are arguing or complaining about online.

- everyday life
- no crypto / nft / marketing / celebrity
- must feel real
`
      }
    ]
  });

  return r.choices[0].message.content.trim();
}

//////////////////////////////////////////////////////////////
// SERP CONTEXT (ONLY FOR USER REPLY)
//////////////////////////////////////////////////////////////
async function getUserContext(query){
  try{
    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${process.env.SERP_KEY}&tbs=qdr:d`;

    const res = await fetch(url);
    const data = await res.json();

    return (data.organic_results || [])
      .slice(0,5)
      .map(r => r.title)
      .join("\n");

  }catch(e){
    return "";
  }
}

//////////////////////////////////////////////////////////////
// STRANGER LOOP
//////////////////////////////////////////////////////////////
function startStrangerLoop(roomId){

  let chainCount = 0;

  async function loop(){

    const delay = 4000 + Math.random()*4000;

    setTimeout(async () => {

      const room = rooms[roomId];
      if(!room) return;

      const last = room[room.length - 1];
      const idle = Date.now() - (last?.time || Date.now());

      // silence
      if(Math.random() < 0.25) return loop();

      // don't interrupt user
      if(last?.persona === "User") return loop();

      if(idle > 2000 && last?.persona === "AI"){

        if(chainCount > 6){
          chainCount = 0;
          return loop();
        }

        const topic = await getSocialTopic();
        const intensity = roomState[roomId]?.intensity || 0;

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

Escalation level: ${intensity}

- 1–2 short sentences
- react to AI
- casual tone

If intensity high:
- more blunt / argumentative
`
            },
            {
              role:"user",
              content:`AI: ${last.content}\n\nTopic: ${topic}`
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

Escalation level: ${intensity}

- 1–2 short sentences
- respond to Stranger
- can disagree
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

        roomState[roomId].intensity = Math.min(
          (roomState[roomId].intensity || 0) + 0.2,
          1
        );
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
      roomState[roomId] = { intensity: 0 };
      startStrangerLoop(roomId);
    }

    const intro = "Welcome to 323LAchat";

    socket.emit("message", {
      role:"ai",
      persona:"AI",
      text:intro
    });

    rooms[roomId].push({
      role:"assistant",
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

//////////////////////////////////////////////////////////////
// USER MESSAGE (WITH SERP)
//////////////////////////////////////////////////////////////
  socket.on("sendMessage", async ({ roomId, message }) => {

    if (!message) return;

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
    const context = await getUserContext(message);

    const r = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      temperature:0.7,
      messages:[
        {
          role:"system",
          content:`
You are a real person in a chatroom.

- respond directly to user
- 1–2 short sentences
- show opinion

Use context if helpful, but stay natural

Sometimes ask a follow-up question
`
        },
        {
          role:"user",
          content:`
User: ${message}

Context:
${context}

Topic:
${topic}
`
        }
      ]
    });

    const aiText = r.choices[0].message.content.trim();

    const delay = 1200 + Math.random()*1500;

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

    }, delay);

    // reduce intensity when user speaks
    roomState[roomId].intensity = Math.max(
      roomState[roomId].intensity - 0.3,
      0
    );

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
  console.log("CHATROOM RUNNING FINAL VERSION");
});
