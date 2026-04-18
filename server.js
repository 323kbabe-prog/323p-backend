//////////////////////////////////////////////////////////////
// CHATROOM BACKEND (PURE HUMAN VIBE VERSION)
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
// REMOVE EMOJI
//////////////////////////////////////////////////////////////
function removeEmoji(text){
  return text.replace(
    /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu,
    ""
  );
}

//////////////////////////////////////////////////////////////
// LOOP (PURE FLOW)
//////////////////////////////////////////////////////////////
function startLoop(roomId){

  let chainCount = 0;

  async function loop(){

    const delay = 3000 + Math.random()*3000;

    setTimeout(async () => {

      const room = rooms[roomId];
      if(!room) return;

      const last = room[room.length - 1];
      const idle = Date.now() - (last?.time || Date.now());

      // silence sometimes
      if(Math.random() < 0.3) return loop();

      // only continue if AI spoke
      if(idle > 2000 && last?.persona === "AI"){

        if(chainCount > 6){
          chainCount = 0;
          return loop();
        }

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

- react to what was just said
- 1–2 short sentences
- casual, slightly opinionated
- plain text only
- no emojis
`
            },
            {
              role:"user",
              content:last.content
            }
          ]
        });

        const strangerText = removeEmoji(
          s.choices[0].message.content.trim()
        );

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
You are another random person in a chatroom.

- respond to the message
- 1–2 short sentences
- casual
- plain text only
- no emojis
`
              },
              {
                role:"user",
                content:strangerText
              }
            ]
          });

          const aiReply = removeEmoji(
            a.choices[0].message.content.trim()
          );

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
      role:"assistant",
      persona:"AI",
      content:intro,
      time:Date.now()
    });

    // user count
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
      role:"user",
      persona:"User",
      content:message,
      time:Date.now()
    });

    io.to(roomId).emit("message", {
      role:"user",
      text:message
    });

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
- casual
- sometimes ask a follow-up question
- plain text only
- no emojis
`
        },
        {
          role:"user",
          content:message
        }
      ]
    });

    const aiText = removeEmoji(
      r.choices[0].message.content.trim()
    );

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
  console.log("CHATROOM RUNNING PURE HUMAN VERSION");
});
