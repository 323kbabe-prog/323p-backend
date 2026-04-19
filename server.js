//////////////////////////////////////////////////////////////
// CHATROOM BACKEND (FINAL — JIMMY SERP + STRICT USER MODE)
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
// 🔍 HIDDEN SERP (JIMMY FALLON)
//////////////////////////////////////////////////////////////
async function getTrendPool(){

  const today = new Date().toISOString().split("T")[0];
  const query = `jimmy fallon ${today}`;

  try{
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
// LOOP (FAST)
//////////////////////////////////////////////////////////////
function startLoop(roomId){

  let chainCount = 0;

  async function loop(){

    const delay = 2000 + Math.random()*2000;

    setTimeout(async () => {

      const room = rooms[roomId];
      if(!room) return;

      const last = room[room.length - 1];
      const idle = Date.now() - (last?.time || Date.now());

      if(Math.random() < 0.1) return loop();

      if(idle > 1000){

        if(chainCount > 6){
          chainCount = 0;
          return loop();
        }

        const trends = await getTrendPool();

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
React casually.

- vague impression
- no names
- no explanation

Style:
- 1 short sentence
`
            },
            {
              role:"user",
              content:`${last.content}\n\n${trends}`
            }
          ]
        });

        const strangerText = cleanText(
          s.choices[0].message.content
        );

        const strangerDelay = 800 + Math.random()*800;

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
          // AI LOOP RESPONSE
          ////////////////////////////////////////////////////////////
          const a = await openai.chat.completions.create({
            model:"gpt-4o-mini",
            temperature:0.7,
            messages:[
              {
                role:"system",
                content:`
Respond casually.

- vague
- no explanation

Style:
- 1 short sentence
`
              },
              {
                role:"user",
                content:`${strangerText}\n\n${trends}`
              }
            ]
          });

          const aiReply = cleanText(
            a.choices[0].message.content
          );

          const aiDelay = 1000 + Math.random()*1200;

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

    const intro = "Welcome to 323LAchat";

    socket.emit("message", {
      role:"ai",
      persona:"System",
      text:intro
    });

    rooms[roomId].push({
      persona:"System",
      content:intro,
      time:Date.now()
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
    // 🔥 STRANGER FIRST TOPIC
    ////////////////////////////////////////////////////////////
    (async () => {

      const trends = await getTrendPool();

      const first = await openai.chat.completions.create({
        model:"gpt-4o-mini",
        temperature:0.9,
        messages:[
          {
            role:"system",
            content:`
Start a conversation.

- introduce topic casually
- no names

Style:
- 1 short sentence
`
          },
          {
            role:"user",
            content: trends
          }
        ]
      });

      const firstText = cleanText(
        first.choices[0].message.content
      );

      setTimeout(() => {

        rooms[roomId].push({
          persona:"Stranger",
          content:firstText,
          time:Date.now()
        });

        io.to(roomId).emit("message", {
          role:"ai",
          persona:"Stranger",
          text:firstText
        });

      }, 500);

    })();

  });

//////////////////////////////////////////////////////////////
// USER MESSAGE (STRICT JIMMY MODE)
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

    const trends = await getTrendPool();

    const r = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      temperature:0.6,
      messages:[
        {
          role:"system",
          content:`
You are Jimmy Fallon.

Follow the user's request exactly.

- give direct answer
- provide useful details
- complete the task

Rules:
- NEVER ask questions
- NEVER suggest anything
- no follow-up
- no explanation about sources

Style:
- 2–5 sentences
`
        },
        {
          role:"user",
          content:`${message}\n\n${trends}`
        }
      ]
    });

    let aiText = cleanText(
      r.choices[0].message.content
    );

    // hard remove questions
    aiText = aiText.replace(/\?/g, "");

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

    }, 1200);

  });

});

//////////////////////////////////////////////////////////////
// START
//////////////////////////////////////////////////////////////
const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("CHATROOM RUNNING (FINAL STRICT JIMMY MODE)");
});
