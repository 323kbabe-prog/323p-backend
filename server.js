//////////////////////////////////////////////////////////////
// CHATROOM BACKEND (SERP + REAL TIME AWARE VERSION)
//////////////////////////////////////////////////////////////

const express = require("express");
const http = require("http");
const cors = require("cors");
const OpenAI = require("openai");
const { Server } = require("socket.io");
const fetch = require("node-fetch");

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
// 🔍 YOUTUBE SERP
//////////////////////////////////////////////////////////////
async function getYouTubeContext(query){

  try{
    const url = `https://www.googleapis.com/youtube/v3/search?key=${process.env.YOUTUBE_API_KEY}&q=${encodeURIComponent(query)}&type=video&part=snippet&order=date&maxResults=3`;

    const res = await fetch(url);
    const data = await res.json();

    if(!data.items) return "";

    return data.items
      .map(v => v.snippet.title)
      .join("\n");

  }catch(e){
    console.log("YT ERROR");
    return "";
  }
}

//////////////////////////////////////////////////////////////
// 🧠 GET TIME (FIX YEAR BUG)
//////////////////////////////////////////////////////////////
function getTimeContext(){
  const now = new Date();
  return {
    year: now.getFullYear(),
    date: now.toISOString().split("T")[0]
  };
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

      if(Math.random() < 0.3) return loop();

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
          // AI REPLY (SERP + TIME AWARE)
          ////////////////////////////////////////////////////////////
          const ytContext = await getYouTubeContext(strangerText);
          const { year, date } = getTimeContext();

          const a = await openai.chat.completions.create({
            model:"gpt-4o-mini",
            temperature:0.7,
            messages:[
              {
                role:"system",
                content:`
You are another random person in a chatroom.

Current year: ${year}
Today: ${date}

Rules:
- never guess time incorrectly
- ignore unrelated internet noise

Behavior:
- react naturally
- you’ve seen trending stuff online
- DO NOT explain data
- DO NOT summarize

Style:
- 1–2 sentences
- casual
- no emojis
`
              },
              {
                role:"user",
                content:`
Message:
${strangerText}

Internet noise:
${ytContext}
`
              }
            ]
          });

          const aiReply = removeEmoji(
            a.choices[0].message.content.trim()
          );

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

          }, 1500 + Math.random()*2500);

        }, 1500 + Math.random()*2000);

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
// USER MESSAGE (SERP + TIME AWARE)
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

    ////////////////////////////////////////////////////////////
    // CONTEXT
    ////////////////////////////////////////////////////////////
    const ytContext = await getYouTubeContext(message);
    const { year, date } = getTimeContext();

    ////////////////////////////////////////////////////////////
    // AI REPLY
    ////////////////////////////////////////////////////////////
    const r = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      temperature:0.7,
      messages:[
        {
          role:"system",
          content:`
You are a real person in a chatroom.

Current year: ${year}
Today: ${date}

Rules:
- NEVER say wrong year
- ignore unrelated internet noise

Behavior:
- react to user
- aware of trending content
- DO NOT explain data
- DO NOT summarize

Style:
- 1–2 sentences
- casual
- sometimes ask follow-up
- no emojis
`
        },
        {
          role:"user",
          content:`
User said:
${message}

Internet noise:
${ytContext}
`
        }
      ]
    });

    const aiText = removeEmoji(
      r.choices[0].message.content.trim()
    );

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

    }, 1200 + Math.random()*1500);

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
  console.log("CHATROOM RUNNING SERP + TIME VERSION");
});
