//////////////////////////////////////////////////////////////
// CHATROOM BACKEND (FINAL — FULL JIMMY SYSTEM)
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
// 🔥 JIMMY VOICE (LOCKED)
//////////////////////////////////////////////////////////////
const JIMMY_VOICE = `
You are in a live chatroom.

Voice:
- casual, witty, effortless
- like a late-night host talking to a friend

Rules:
- include real people, places, or events
- no formal explanation
- no assistant tone
- no identity mention

Style:
- short
- conversational
`;

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
Interpret everything casually like a conversation.

${history}

New:
${extraText}

Signals:
${trends}
`;
}

//////////////////////////////////////////////////////////////
// 🔥 JIMMY DECIDES SEARCH (KEY FIX)
//////////////////////////////////////////////////////////////
async function getTrendPool(room){

  try{

    const history = room.slice(-5)
      .map(m => m.content)
      .join("\n");

    const qRes = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      temperature:0.9,
      messages:[
        {
          role:"system",
          content:`
Decide what to search next.

- react to conversation
- be curious
- casual thinking

Rules:
- output ONLY a search query
- 3–8 words
- no explanation
`
        },
        {
          role:"user",
          content: history
        }
      ]
    });

    const query = qRes.choices[0].message.content.trim();

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
// LOOP (STRICT TURN)
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

        const trends = await getTrendPool(room);

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
                content: JIMMY_VOICE + `
Extra:
- 1 sentence only
- like a quick comment
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

            rooms[roomId].turn = "ai";

          }, 800);
        }

        ////////////////////////////////////////////////////////////
        // AI TURN (ONE RESPONSE)
        ////////////////////////////////////////////////////////////
        else if(room.turn === "ai"){

          const context = buildContext(room, last?.content || "", trends);

          const a = await openai.chat.completions.create({
            model:"gpt-4o-mini",
            temperature:0.7,
            messages:[
              {
                role:"system",
                content: JIMMY_VOICE
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

            // back to stranger
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

    ////////////////////////////////////////////////////////////
    // FIRST STRANGER (START FLOW)
    ////////////////////////////////////////////////////////////
    (async () => {

      const trends = await getTrendPool(rooms[roomId]);
      const context = buildContext(rooms[roomId], "", trends);

      const first = await openai.chat.completions.create({
        model:"gpt-4o-mini",
        temperature:0.9,
        messages:[
          {
            role:"system",
            content: JIMMY_VOICE + `
Start a topic in 1 short sentence
`
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
// USER MESSAGE (JIMMY REPLIES SAME STYLE)
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

    const trends = await getTrendPool(rooms[roomId]);
    const context = buildContext(rooms[roomId], message, trends);

    const r = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      temperature:0.6,
      messages:[
        {
          role:"system",
          content: JIMMY_VOICE + `
Reply like you're continuing the same conversation.
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
    );

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
  console.log("CHATROOM RUNNING (FULL JIMMY MODE)");
});