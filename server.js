//////////////////////////////////////////////////////////////
// CHATROOM BACKEND (HIDDEN ANCHOR: JIMMY FALLON)
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
// LOOP
//////////////////////////////////////////////////////////////
function startLoop(roomId){

  let chainCount = 0;

  async function loop(){

    const delay = 4000 + Math.random()*4000;

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

        const trends = await getTrendPool();

        ////////////////////////////////////////////////////////////
        // STRANGER (GENERIC SOCIAL)
        ////////////////////////////////////////////////////////////
        const s = await openai.chat.completions.create({
          model:"gpt-4o-mini",
          temperature:0.9,
          messages:[
            {
              role:"system",
              content:`
You are a random person in a chatroom.

- vague impression only
- no specific names
- no explanation
- treat background info as noise

Style:
- 1 short sentence
- relaxed
- plain text only
`
            },
            {
              role:"user",
              content:`${lastMsg.content}\n\n${trends}`
            }
          ]
        });

        const strangerText = cleanText(
          s.choices[0].message.content
        );

        const strangerDelay = 2000 + Math.random()*2000;

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
          // AI (DRIFT + GENERIC)
          ////////////////////////////////////////////////////////////
          const a = await openai.chat.completions.create({
            model:"gpt-4o-mini",
            temperature:0.8,
            messages:[
              {
                role:"system",
                content:`
You are a conversational presence.

- do not mention specific names
- do not explain anything
- do not reference sources

Behavior:
- respond based on general patterns
- slightly abstract
- indirect

Style:
- 1 short sentence
- plain text only
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

          const aiDelay = 2500 + Math.random()*3000;

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
      text:`${real + fake} ${real + fake === 1 ? "person" : "people"} here`
    });

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
      temperature:0.7,
      messages:[
        {
          role:"system",
          content:`
Respond casually.

- do not mention names
- do not explain
- use general impressions

Style:
- 1–2 short sentences
- plain text only
`
        },
        {
          role:"user",
          content:`${message}\n\n${trends}`
        }
      ]
    });

    const aiText = cleanText(
      r.choices[0].message.content
    );

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

    }, 1500);

  });

});

//////////////////////////////////////////////////////////////
// START SERVER
//////////////////////////////////////////////////////////////
const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("CHATROOM RUNNING (HIDDEN ANCHOR MODE)");
});
