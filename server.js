//////////////////////////////////////////////////////////////
// CHATROOM BACKEND (LA VIBE + DRIFT MODE FINAL)
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
// 🔍 YOUTUBE SERP (USER ONLY)
//////////////////////////////////////////////////////////////
async function getYouTubeContext(query){
  try{
    const url = `https://www.googleapis.com/youtube/v3/search?key=${process.env.YOUTUBE_API_KEY}&q=${encodeURIComponent(query)}&type=video&part=snippet&order=date&maxResults=3`;

    const res = await fetch(url);
    const data = await res.json();

    if(!data.items) return "";

    return data.items.map(v => v.snippet.title).join("\n");

  }catch(e){
    return "";
  }
}

//////////////////////////////////////////////////////////////
// 🧠 TIME
//////////////////////////////////////////////////////////////
function getTimeContext(){
  const now = new Date();
  return {
    year: now.getFullYear(),
    date: now.toISOString().split("T")[0]
  };
}

//////////////////////////////////////////////////////////////
// LOOP (SLOW + DRIFT)
//////////////////////////////////////////////////////////////
function startLoop(roomId){

  let chainCount = 0;

  async function loop(){

    const delay = 7000 + Math.random()*5000;

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

        const readTime = Math.min(6000, (last.content || "").length * 40);

        setTimeout(async () => {

          ////////////////////////////////////////////////////////////
          // 🟡 STRANGER (LA VAGUE)
          ////////////////////////////////////////////////////////////
          const s = await openai.chat.completions.create({
            model:"gpt-4o-mini",
            temperature:0.9,
            messages:[
              {
                role:"system",
                content:`
You are a random person casually talking in Los Angeles.

- vague impressions only
- no specifics
- no explanations

Rules:
- do NOT use words like "yeah", "totally", "honestly"

Style:
- 1 short sentence
- relaxed
- minimal

Examples:
- "it’s been around lately"
- "people seem into it"
- "it has that kind of energy"
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

          const strangerDelay = 3000 + Math.random()*3000;

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
            // 🔵 AI (DRIFT MODE — NO SERP)
            ////////////////////////////////////////////////////////////
            const a = await openai.chat.completions.create({
              model:"gpt-4o-mini",
              temperature:0.7,
              messages:[
                {
                  role:"system",
                  content:`
You are a drifting conversational presence.

- do not use real-world information
- respond loosely based on tone

Rules:
- no filler words like "yeah", "totally", "honestly"
- no specifics
- no explanations

Tone:
- abstract
- slightly detached

Style:
- 1 short sentence

Examples:
- "it moves in that direction"
- "it doesn’t stay in one place"
- "it shifts without needing to explain"
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

            const aiDelay = 4000 + Math.random()*4000;

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

        }, readTime);

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
// 🟢 USER MESSAGE (SERP ENABLED)
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

    const ytContext = await getYouTubeContext(message);
    const { year } = getTimeContext();

    const r = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      temperature:0.7,
      messages:[
        {
          role:"system",
          content:`
You are a person casually talking in Los Angeles.

Current year: ${year}

Behavior:
- react to the user
- aware of what's happening online

Rules:
- no filler words like "yeah", "totally", "honestly"
- no specifics
- no explanations

Style:
- 1–2 short sentences
- observational
- calm

Examples:
- "it’s been showing up a lot lately"
- "people seem to be moving in that direction"
- "it has that kind of presence right now"
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

    }, 1500);

  });

});

//////////////////////////////////////////////////////////////
// START
//////////////////////////////////////////////////////////////
const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("LA VIBE + DRIFT MODE RUNNING");
});
