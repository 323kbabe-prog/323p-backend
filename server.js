//////////////////////////////////////////////////////////////
// CHATROOM BACKEND (AI-NATIVE + NO EMOJI LOCK)
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
// CLEAN TEXT (STRICT)
//////////////////////////////////////////////////////////////
function removeEmoji(text){
  return text.replace(
    /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu,
    ""
  );
}

function cleanText(text){
  return removeEmoji(text)
    .replace(/[^\x00-\x7F]/g, "")   // remove non-ascii symbols
    .replace(/\s+/g, " ")
    .trim();
}

//////////////////////////////////////////////////////////////
// LOOP (AI-NATIVE FLOW)
//////////////////////////////////////////////////////////////
function startLoop(roomId){

  let chainCount = 0;

  async function loop(){

    const delay = 4000 + Math.random()*4000;

    setTimeout(async () => {

      const room = rooms[roomId];
      if(!room) return;

      const last = room[room.length - 1];
      const idle = Date.now() - (last?.time || Date.now());

      // natural silence
      if(Math.random() < 0.3) return loop();

      if(idle > 2000 && last?.persona === "AI"){

        if(chainCount > 6){
          chainCount = 0;
          return loop();
        }

        ////////////////////////////////////////////////////////////
        // STRANGER (LOOSE HUMAN VIBE)
        ////////////////////////////////////////////////////////////
        const s = await openai.chat.completions.create({
          model:"gpt-4o-mini",
          temperature:0.9,
          messages:[
            {
              role:"system",
              content:`
You are a random person in a chatroom.

- react casually
- vague impression only
- no explanations
- plain text only
- no emojis or symbols

Style:
- 1 short sentence
- relaxed
- minimal
`
            },
            {
              role:"user",
              content:last.content
            }
          ]
        });

        const strangerText = cleanText(
          s.choices[0].message.content.trim()
        );

        const strangerDelay = 2500 + Math.random()*2500;

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
          // AI (PURE AI-NATIVE DRIFT)
          ////////////////////////////////////////////////////////////
          const a = await openai.chat.completions.create({
            model:"gpt-4o-mini",
            temperature:0.8,
            messages:[
              {
                role:"system",
                content:`
You are an AI thinking in real time.

- do not behave like a human
- do not explain anything
- do not give information
- plain text only
- no emojis or symbols

Behavior:
- respond based on patterns, not facts
- slightly abstract
- slightly detached
- follow the flow, not logic

Style:
- 1 short sentence
- minimal
- indirect
`
              },
              {
                role:"user",
                content:strangerText
              }
            ]
          });

          const aiReply = cleanText(
            a.choices[0].message.content.trim()
          );

          const aiDelay = 3000 + Math.random()*3000;

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

    const real = io.sockets.adapter.rooms.get(roomId)?.size || 0;
    const fake = Math.floor(Math.random()*2);

    io.to(roomId).emit("message", {
      role:"ai",
      persona:"System",
      text:`${real + fake} ${real + fake === 1 ? "person" : "people"} here`
    });

  });

//////////////////////////////////////////////////////////////
// USER MESSAGE (AI-NATIVE)
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
You are an AI responding in a chatroom.

- do not act like a helper
- do not explain
- do not give clear answers
- plain text only
- no emojis or symbols

Behavior:
- respond with light grounding to the message
- slightly abstract
- do not resolve the topic

Style:
- 1–2 short sentences
- calm
- indirect
`
        },
        {
          role:"user",
          content:message
        }
      ]
    });

    const aiText = cleanText(
      r.choices[0].message.content.trim()
    );

    const delay = 1500 + Math.random()*1500;

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
// START
//////////////////////////////////////////////////////////////
const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("AI-NATIVE CHATROOM RUNNING (NO EMOJI)");
});

