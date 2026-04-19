//////////////////////////////////////////////////////////////
// CHATROOM BACKEND (FINAL — STRICT TURN FIXED)
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
// LOOP (TURN-BASED FIX)
//////////////////////////////////////////////////////////////
function startLoop(roomId){

  async function loop(){

    const delay = 1800 + Math.random()*1200;

    setTimeout(async () => {

      const room = rooms[roomId];
      if(!room) return;

      const last = room[room.length - 1];
      const idle = Date.now() - (last?.time || Date.now());

      if(idle > 1000){

        const trends = await getTrendPool();

        ////////////////////////////////////////////////////////////
        // STRANGER TURN
        ////////////////////////////////////////////////////////////
        if(room.turn === "stranger"){

          const context = buildContext(room, last?.content || "", trends);

          const s = await openai.chat.completions.create({
            model:"gpt-4o-mini",
            temperature:0.9,
            messages:[
              {
                role:"system",
                content:`
You are a random person in a chatroom.

- include real person/place/event
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

          const strangerText = cleanText(s.choices[0].message.content);

          setTimeout(() => {

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

            // switch to AI
            rooms[roomId].turn = "ai";

          }, 800);
        }

        ////////////////////////////////////////////////////////////
        // AI TURN (ONLY ONCE)
        ////////////////////////////////////////////////////////////
        else if(room.turn === "ai"){

          const context = buildContext(room, last?.content || "", trends);

          const a = await openai.chat.completions.create({
            model:"gpt-4o-mini",
            temperature:0.7,
            messages:[
              {
                role:"system",
                content:`
You are an AI in a chatroom.

- react to Stranger or User
- include real-world context
- no questions

Style:
- 1–3 sentences
`
              },
              {
                role:"user",
                content: context
              }
            ]
          });

          const aiReply = cleanText(a.choices[0].message.content);

          io.to(roomId).emit("typing", { persona:"AI" });

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

            // back to stranger after cooldown
            setTimeout(() => {
              rooms[roomId].turn = "stranger";
            }, 1200 + Math.random()*800);

          }, aiDelay);
        }
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
      rooms[roomId].turn = "stranger";
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
            content:`Start a real-world topic in 1 short sentence`
          },
          {
            role:"user",
            content: context
          }
        ]
      });

      const firstText = cleanText(first.choices[0].message.content);

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
// USER MESSAGE (AI RESPONDS BUT DOESN’T BREAK LOOP)
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
- consider Stranger context
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
  console.log("CHATROOM RUNNING (TURN SYSTEM FIXED)");
});