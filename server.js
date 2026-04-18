//////////////////////////////////////////////////////////////
// CHATROOM BACKEND (NATURAL FLOW VERSION)
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
// GENERATE STARTING TOPIC (ONLY ONCE)
//////////////////////////////////////////////////////////////
async function getStartTopic(){

  const r = await openai.chat.completions.create({
    model:"gpt-4o-mini",
    temperature:0.9,
    messages:[
      {
        role:"system",
        content:`
Generate ONE short sentence about something people are casually talking or arguing about.

- everyday life
- no crypto, nft, marketing, celebrity
- plain text only
- no emojis
- natural tone
`
      }
    ]
  });

  return removeEmoji(r.choices[0].message.content.trim());
}

//////////////////////////////////////////////////////////////
// STRANGER LOOP (PURE FLOW)
//////////////////////////////////////////////////////////////
function startStrangerLoop(roomId){

  let chainCount = 0;

  async function loop(){

    const loopDelay = 3000 + Math.random()*3000;

    setTimeout(async () => {

      const room = rooms[roomId];
      if(!room) return;

      const lastMsg = room[room.length - 1];
      const idle = Date.now() - (lastMsg?.time || Date.now());

      // silence sometimes
      if(Math.random() < 0.3) return loop();

      if(idle > 2000 && lastMsg?.persona === "AI"){

        if(chainCount > 6){
          chainCount = 0;
          return loop();
        }

        const vibes = [
          "quiet room",
          "low energy",
          "late night scrolling",
          "nobody talking",
          "background noise"
        ];

        const vibe = vibes[Math.floor(Math.random()*vibes.length)];

        ////////////////////////////////////////////////////////////
        // STRANGER (reacts ONLY to last message)
        ////////////////////////////////////////////////////////////
        const s = await openai.chat.completions.create({
          model:"gpt-4o-mini",
          temperature:0.9,
          messages:[
            {
              role:"system",
              content:`
You are a random person in a chatroom.

- react to what the AI just said
- 1–2 short sentences
- casual, slightly opinionated
- plain text only
- no emojis
`
            },
            {
              role:"user",
              content:`
AI said: ${lastMsg.content}

Room vibe: ${vibe}
`
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
          // AI REPLY (reacts ONLY to Stranger)
          ////////////////////////////////////////////////////////////
          const a = await openai.chat.completions.create({
            model:"gpt-4o-mini",
            temperature:0.7,
            messages:[
              {
                role:"system",
                content:`
You are another random person in a chatroom.

- respond to the Stranger message
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

    }, loopDelay);
  }

  loop();
}

//////////////////////////////////////////////////////////////
// SOCKET
//////////////////////////////////////////////////////////////
io.on("connection", (socket) => {

  socket.on("joinRoom", async (roomId) => {

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

    rooms[roomId].push({
      role:"assistant",
      persona:"AI",
      content:intro,
      time:Date.now()
    });

    ////////////////////////////////////////////////////////////
    // STARTING TOPIC (NEW)
    ////////////////////////////////////////////////////////////
    const topic = await getStartTopic();

    setTimeout(() => {

      rooms[roomId].push({
        role:"assistant",
        persona:"AI",
        content:topic,
        time:Date.now()
      });

      io.to(roomId).emit("message", {
        role:"ai",
        persona:"AI",
        text:topic
      });

    }, 1000);

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
- casual tone
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
// START SERVER
//////////////////////////////////////////////////////////////
const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("CHATROOM RUNNING NATURAL FLOW VERSION");
});
