//////////////////////////////////////////////////////////////
// CHATROOM BACKEND (SERP + TIME + EVOLVING TOPIC)
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
// 🧠 BUILD EVOLVING QUERY (NEW CORE 🔥)
//////////////////////////////////////////////////////////////
function buildSearchQuery(roomId){

  const room = rooms[roomId] || [];

  // original topic (first user message)
  const base = room.find(m => m.role === "user")?.content || "";

  // last few messages
  const recent = room.slice(-4).map(m => m.content).join(" ");

  return `${base} ${recent}`;
}

//////////////////////////////////////////////////////////////
// LOOP (EVOLVING FLOW)
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

- react casually
- 1–2 short sentences
- slightly opinionated
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
            // 🤖 AI (EVOLVING SERP 🔥)
            ////////////////////////////////////////////////////////////

            const query = buildSearchQuery(roomId);
            const ytContext = await getYouTubeContext(query);
            const { year, date } = getTimeContext();

            const a = await openai.chat.completions.create({
              model:"gpt-4o-mini",
              temperature:0.7,
              messages:[
                {
                  role:"system",
                  content:`
You are a real person in a chatroom.

Current year: ${year}
Today: ${date}

Behavior:
- keep the topic going naturally
- build on previous messages
- react like you've seen trends online

Rules:
- DO NOT explain data
- DO NOT summarize
- DO NOT reset topic

Style:
- 1–2 sentences
- casual
- no emojis
`
                },
                {
                  role:"user",
                  content:`
Conversation:
${query}

Internet noise:
${ytContext}
`
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

    const query = buildSearchQuery(roomId);
    const ytContext = await getYouTubeContext(query);
    const { year, date } = getTimeContext();

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

- respond to user
- keep topic evolving
- aware of trends

Style:
- 1–2 sentences
- casual
- no emojis
`
        },
        {
          role:"user",
          content:`
Conversation:
${query}

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
  console.log("CHATROOM RUNNING EVOLVING TOPIC VERSION");
});
