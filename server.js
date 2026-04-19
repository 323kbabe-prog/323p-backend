//////////////////////////////////////////////////////////////
// CHATROOM BACKEND (FINAL — STRICT TURN SYSTEM)
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
Recent chat:
${history}

New input:
${extraText}

Live signals:
${trends}
`;
}

//////////////////////////////////////////////////////////////
// SERP
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
// LOOP WITH TURN CONTROL
//////////////////////////////////////////////////////////////
function startLoop(roomId){

  async function loop(){

    const delay = 1800 + Math.random()*1200;

    setTimeout(async () => {

      const room = rooms[roomId];
      if(!room) return;

      const last = room[room.length - 1];
      const idle = Date.now() - (last?.time || Date.now());

      // 🔥 ONLY STRANGER CAN START
      if(idle > 1000 && room.turn === "stranger"){

        const trends = await getTrendPool();

        ////////////////////////////////////////////////////////////
        // STRANGER SPEAKS
        ////////////////////////////////////////////////////////////
        const strangerContext = buildContext(room, last?.content || "", trends);

        const s = await openai.chat.completions.create({
          model:"gpt-4o-mini",
          temperature:0.9,
          messages:[
            {
              role:"system",
              content:`
You are a random person in a chatroom.

Rules:
- react naturally
- include real person/place/event
- no explanation

Style:
- 1 short sentence
`
            },
            {
              role:"user",
              content: strangerContext
            }
          ]
        });

        const strangerText = cleanText(
          s.choices[0].message.content
        );

        const strangerDelay = 1000 + Math.random()*1000;

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

          // 🔥 SWITCH TO AI TURN
          rooms[roomId].turn = "ai";

          ////////////////////////////////////////////////////////////
          // AI RESPONDS ONCE
          ////////////////////////////////////////////////////////////
          const aiContext = buildContext(rooms[roomId], strangerText, trends);

          const a = await openai.chat.completions.create({
            model:"gpt-4o-mini",
            temperature:0.7,
            messages:[
              {
                role:"system",
                content:`
You are an AI in a chatroom.

Behavior:
- respond to Stranger and any user context

Rules:
- include real-world entities
- no questions
- no identity mention

Style:
- 1–3 sentences
`
              },
              {
                role:"user",
                content: aiContext
              }
            ]
          });

          const aiReply = cleanText(
            a.choices[0].message.content
          );

          const thinkingDelay = 600 + Math.random()*800;

          setTimeout(() => {

            io.to(roomId).emit("typing", {
              persona:"AI"
            });

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

              // 🔥 BACK TO STRANGER AFTER COOLDOWN
              const cooldown = 1200 + Math.random()*800;

              setTimeout(() => {
                rooms[roomId].turn = "stranger";
              }, cooldown);

            }, aiDelay);

          }, thinkingDelay);

        }, strangerDelay);
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
      rooms[roomId].turn = "stranger"; // 🔥 INIT TURN
      startLoop(roomId);
    }

    ////////////////////////////////////////////////////////////
    // INTRO
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

      const context = buildContext(rooms[roomId], "", trends);

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
- 1 short sentence
`
          },
          {
            role:"user",
            content: context
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

        rooms[roomId].turn = "ai";

      }, 800);

    })();

  });

//////////////////////////////////////////////////////////////
// USER MESSAGE (AI STILL RESPONDS)
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

    const context = buildContext(rooms[roomId], message, trends);

    const r = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      temperature:0.6,
      messages:[
        {
          role:"system",
          content:`
You are a fast AI in a chatroom.

- respond to user
- also consider Stranger

Rules:
- include real-world entities
- no questions

Style:
- 2–4 sentences
`
        },
        {
          role:"user",
          content: context
        }
      ]
    });

    const aiText = cleanText(
      r.choices[0].message.content
    ).replace(/\?/g, "");

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
  console.log("CHATROOM RUNNING (STRICT TURN MODE)");
});