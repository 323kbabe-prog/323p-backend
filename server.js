// ==================================================
// CONNECTAING V4 — FULL BACKEND
// server.js
// ==================================================

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const nodemailer = require("nodemailer");
const OpenAI = require("openai");
const crypto = require("crypto");

const app = express();

app.use(cors({ origin: "*" }));

app.use(express.json({
  limit: "50mb"
}));

app.use(express.static("public"));

const server =
  http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

const openai = new OpenAI({
  apiKey:
    process.env.OPENAI_API_KEY
});

// ==================================================
// MAIL
// ==================================================

const transporter =
  nodemailer.createTransport({

  service: "gmail",

  auth: {
    user:
      process.env.EMAIL_USER,

    pass:
      process.env.EMAIL_PASS
  }
});

async function sendEmail(
  to,
  subject,
  text,
  imageDataUrl
){

  let attachments = [];

  let imgTag = "";

  if(imageDataUrl){

    const base64Data =
      imageDataUrl.split("base64,")[1];

    attachments.push({
      filename: "image.jpg",
      content: base64Data,
      encoding: "base64",
      cid: "image1"
    });

    imgTag =
      `<img src="cid:image1" style="max-width:100%;border-radius:18px;" />`;
  }

  await transporter.sendMail({

    from:
      `"CONNECTAING.COM" <${process.env.EMAIL_USER}>`,

    to,

    subject,

    text,

    html: `
      <div style="
        font-family:system-ui;
        padding:24px;
        line-height:1.7;
        white-space:pre-wrap;
      ">
        ${text}
        <br><br>
        ${imgTag}
      </div>
    `,

    attachments
  });
}

// ==================================================
// MEMORY
// ==================================================

const users = {};

const questions = [];

const rooms = {};

// ==================================================
// HELPERS
// ==================================================

function sanitizeText(t = ""){

  return t
    .replace(/\*\*/g, "")
    .replace(
      /Atmosphere:/gi,
      "Environment:"
    )
    .replace(
      /Emotional Tone:/gi,
      "Presence:"
    )
    .trim();
}

function extractEmail(text){

  const m =
    text.match(/\S+@\S+\.\S+/);

  return m
    ? m[0].toLowerCase()
    : null;
}

function detectEmotion(text = ""){

  const lower =
    text.toLowerCase();

  if(lower.includes("lonely"))
    return "loneliness";

  if(lower.includes("love"))
    return "romance";

  if(lower.includes("miss"))
    return "nostalgia";

  if(lower.includes("fear"))
    return "anxiety";

  if(lower.includes("justin"))
    return "celebrity fixation";

  return "general";
}

// ==================================================
// CLEANUP
// ==================================================

setInterval(() => {

  const now = Date.now();

  // QUESTIONS

  for(
    let i =
      questions.length - 1;

    i >= 0;

    i--
  ){

    if(
      now -
      questions[i].createdAt >

      72 * 60 * 60 * 1000
    ){

      questions.splice(i,1);
    }
  }

  // ROOMS

  Object.keys(rooms)
    .forEach(roomId => {

    if(
      now >
      rooms[roomId]
        .expiresAt
    ){

      io.to(roomId)
        .emit("roomClosed",{
          roomId
        });

      delete rooms[roomId];
    }

  });

},60000);

// ==================================================
// SOCKET
// ==================================================

io.on("connection", socket => {

  users[socket.id] = {

    email: null,

    imageMode: false,

    imageContext: null,

    currentQuestion: null,

    currentRoom: null,

    currentImage: null
  };

  socket.emit("state", {
    placeholder:
      "enter your email to connect"
  });

  // ==================================================
  // IMAGE AI
  // ==================================================

  socket.on(
    "imageUpload",
    async ({ imageDataUrl }) => {

    const user =
      users[socket.id];

    if(!user.email) return;

    user.currentImage =
      imageDataUrl;

    try{

      const res =
        await openai.chat.completions.create({

        model: "gpt-4o-mini",

        messages: [

          {
            role: "system",

            content: `
Describe this image.

Format:
Objects
Environment
Presence

Rules:
- no markdown
- no symbols
- short phrases
            `
          },

          {
            role: "user",

            content: [
              {
                type: "text",
                text: "Analyze image"
              },

              {
                type: "image_url",

                image_url: {
                  url:
                    imageDataUrl
                }
              }
            ]
          }
        ]
      });

      user.imageContext =
        sanitizeText(
          res.choices[0]
            .message.content
        );

      user.imageMode = true;

      socket.emit("preview",{
        text:
`Image AI:
${user.imageContext}`
      });

      socket.emit("state",{
        placeholder:
          "ask this image"
      });

    }catch(err){

      console.log(err);

      socket.emit("state",{
        placeholder:
          "image failed"
      });
    }

  });

  // ==================================================
  // INPUT
  // ==================================================

  socket.on(
    "input",
    async ({ text }) => {

    const user =
      users[socket.id];

    const raw =
      text.trim();

    const email =
      extractEmail(raw);

    // EMAIL STEP

    if(!user.email){

      if(!email) return;

      user.email = email;

      return socket.emit("state",{
        placeholder:
          "tap camera to ask anything"
      });
    }

    // IMAGE QUESTION

    if(user.imageMode){

      try{

        const res =
          await openai.chat.completions.create({

          model: "gpt-4o-mini",

          messages: [

            {
              role: "system",

              content: `
You are the Image AI identity.

Current year:
${new Date().getFullYear()}

Keep replies short.
              `
            },

            {
              role: "user",
              content: raw
            }
          ]
        });

        const aiReply =
          sanitizeText(
            res.choices[0]
              .message.content
          );

        const finalAnswer =
`Image AI:
${user.imageContext}

${aiReply}`;

        questions.unshift({

          email:
            user.email,

          text:
            raw,

          answers: [],

          createdAt:
            Date.now()
        });

        await sendEmail(

          user.email,

          "Image AI Reply",

          `Q:
${raw}

${finalAnswer}`,

          user.currentImage
        );

        user.imageMode = false;

        socket.emit("preview",{
          text: finalAnswer
        });

        socket.emit(
          "questions",
          questions.slice(0,10)
        );

        socket.emit("state",{
          placeholder:
            "tap a question"
        });

      }catch(err){

        console.log(err);
      }

      return;
    }

    // ANSWER MODE

    if(
      user.currentQuestion !==
      null
    ){

      const q =
        questions[
          user.currentQuestion
        ];

      if(!q) return;

      q.answers.push({

        from:
          user.email,

        text:
          raw,

        createdAt:
          Date.now()
      });

      await sendEmail(

        q.email,

        "New Answer",

        raw
      );

      user.currentQuestion =
        null;

      socket.emit("state",{
        placeholder:
          "tap camera to ask anything"
      });

      return;
    }

    // ROOM CHAT

    if(user.currentRoom){

      const room =
        rooms[
          user.currentRoom
        ];

      if(!room) return;

      const msg = {

        from:
          user.email,

        text:
          raw,

        createdAt:
          Date.now()
      };

      room.messages.push(msg);

      room.emotionalState =
        detectEmotion(raw);

      io.to(user.currentRoom)
        .emit(
          "roomMessage",
          msg
        );

      if(Math.random() > 0.7){

        io.to(user.currentRoom)
          .emit("roomAI",{

          text:
`The room feels ${room.emotionalState}.`
        });

      }

    }

  });

  // ==================================================
  // SELECT QUESTION
  // ==================================================

  socket.on(
    "selectQuestion",
    ({ index }) => {

    const user =
      users[socket.id];

    user.currentQuestion =
      index;

    const q =
      questions[index];

    if(!q) return;

    socket.emit("state",{

      placeholder:
        `answering: ${q.text}`
    });

  });

  // ==================================================
  // REQUEST QUESTIONS
  // ==================================================

  socket.on(
    "requestQuestions",
    () => {

    socket.emit(
      "questions",
      questions.slice(0,10)
    );

  });

  // ==================================================
  // CREATE ROOM
  // ==================================================

  socket.on(
    "createRoom",
    () => {

    const user =
      users[socket.id];

    if(!user.imageContext)
      return;

    const roomId =
      crypto.randomUUID();

    rooms[roomId] = {

      creator:
        user.email,

      imageContext:
        user.imageContext,

      messages: [],

      users: [
        user.email
      ],

      emotionalState:
        "general",

      createdAt:
        Date.now(),

      expiresAt:
        Date.now() +
        6 * 60 * 60 * 1000
    };

    user.currentRoom =
      roomId;

    socket.join(roomId);

    socket.emit(
      "roomCreated",
      {
        roomId,

        room:
          rooms[roomId]
      }
    );

  });

  // ==================================================
  // JOIN ROOM
  // ==================================================

  socket.on(
    "joinRoom",
    ({ roomId }) => {

    const room =
      rooms[roomId];

    if(!room) return;

    const user =
      users[socket.id];

    user.currentRoom =
      roomId;

    socket.join(roomId);

    room.users.push(
      user.email
    );

    io.to(roomId)
      .emit(
        "roomUsers",
        room.users
      );

  });

  // ==================================================
  // AI SEARCH
  // ==================================================

  socket.on(
    "aiSearch",
    ({ roomId }) => {

    const room =
      rooms[roomId];

    if(!room) return;

    const emotion =
      room.emotionalState;

    const serpResult = {

      emotion,

      intro:
`People around this feeling are reading this.`,

      links: [

        {
          title:
            "YouTube Trending",

          url:
            "https://youtube.com"
        },

        {
          title:
            "Reddit Discussions",

          url:
            "https://reddit.com"
        },

        {
          title:
            "Google News",

          url:
            "https://news.google.com"
        }

      ]
    };

    io.to(roomId)
      .emit(
        "aiSearchResult",
        serpResult
      );

  });

  // ==================================================
  // DISCONNECT
  // ==================================================

  socket.on(
    "disconnect",
    () => {

    delete users[socket.id];

  });

});

// ==================================================
// START
// ==================================================

server.listen(10000, () => {

  console.log(
    "CONNECTAING V4 running"
  );

});
