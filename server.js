//////////////////////////////////////////////////////////////
// CHATROOM BACKEND (FINAL — REAL SERP + HUMAN TIMING)
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
    .replace(/\s+/g, " ")
    .trim();
}

//////////////////////////////////////////////////////////////
// 🧠 READING DELAY (KEY FIX)
//////////////////////////////////////////////////////////////
function getReadingDelay(text){
  const words = text.split(" ").length;

  const base = 1200;     // minimum wait
  const perWord = 120;   // ms per word

  return Math.min(base + words * perWord, 5000); // cap 5s
}

//////////////////////////////////////////////////////////////
// 🔍 REAL SERP (MULTI ANGLE)
//////////////////////////////////////////////////////////////
async function getTrendPool(){

  const today = new Date().toISOString().split("T")[0];

  const queries = [
    `world news ${today}`,
    `entertainment news ${today}`,
    `celebrity news ${today}`,
    `tiktok trends ${today}`,
    `music trends ${today}`
  ];

  const query = queries[Math.floor(Math.random() * queries.length)];

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
// 🔁 LOOP
//////////////////////////////////////////////////////////////
function startLoop(roomId){

  let chainCount = 0;

  async function loop(){

    const delay = 1800 + Math.random()*1200;

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
        // 🧍 STRANGER
        ////////////////////////////////////////////////////////////
        const s = await openai.chat.completions.create({
          model:"gpt-4o-mini",
          temperature:0.9,
          messages:[
            {
              role:"system",
              content:`
React like a real person.

Rules:
- include a real person/place/event
- casual
- no explanation

Style:
- 1 short sentence
`
            },
            {
              role:"user",
              content:`${last?.content || ""}\n\n${trends}`
            }
          ]
        });

        const strangerText = cleanText(
          s.choices[0].message.content
        );

        const strangerDelay = 1200 + Math.random()*1200;

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
          // 🤖 AI (WITH TYPING + READING DELAY)
          ////////////////////////////////////////////////////////////
          const a = await openai.chat.completions.create({
            model:"gpt-4o-mini",
            temperature:0.7,
            messages:[
              {
                role:"system",
                content:`
Respond with real-world context.

Rules:
- include real names (people/place/time)
- clear and direct
- no questions

Style:
- 1–3 sentences
- never mention identity
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

          ////////////////////////////////////////////////////////////
          // ✨ THINKING GAP
          ////////////////////////////////////////////////////////////
          const thinkingDelay = 600 + Math.random()*800;

          setTimeout(() => {

            ////////////////////////////////////////////////////////////
            // ✨ TYPING EVENT
            ////////////////////////////////////////////////////////////
            io.to(roomId).emit("typing", {
              persona:"AI"
            });

            ////////////////////////////////////////////////////////////
            // 📖 READING DELAY
            ////////////////////////////////////////////////////////////
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

            }, aiDelay);

          }, thinkingDelay);

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

    ////////////////////////////////////////////////////////////
    // SYSTEM INTRO
    ////////////////////////////////////////////////////////////
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
    // FIRST STRANGER
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
Start a real-world topic.

- include person or place
- casual

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

      }, 800);

    })();

  });

//////////////////////////////////////////////////////////////
// USER MESSAGE
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
You are a fast, sharp AI.

Rules:
- follow user request exactly
- include real-world entities
- no questions

Style:
- 2–4 sentences
- no identity mention
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

    aiText = aiText.replace(/\?/g, "");

    ////////////////////////////////////////////////////////////
    // TYPING BEFORE USER RESPONSE
    ////////////////////////////////////////////////////////////
    io.to(roomId).emit("typing", {
      persona:"AI"
    });

    const aiDelay = getReadingDelay(aiText);

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

    }, aiDelay);

  });

});

//////////////////////////////////////////////////////////////
// START
//////////////////////////////////////////////////////////////
const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("CHATROOM RUNNING (HUMAN TIMING MODE)");
});
