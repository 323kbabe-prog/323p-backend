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
  limit:"50mb"
}));

const server =
  http.createServer(app);

const io = new Server(server, {
  cors:{ origin:"*" }
});

const openai = new OpenAI({
  apiKey:
    process.env.OPENAI_API_KEY
});

//////////////////////////////////////////////////
// EMAIL
//////////////////////////////////////////////////

const transporter =
  nodemailer.createTransport({

  service:"gmail",

  auth:{
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
      imageDataUrl.split(
        "base64,"
      )[1];

    attachments.push({

      filename:"image.jpg",

      content:base64Data,

      encoding:"base64",

      cid:"image1"
    });

    imgTag =
      `<img src="cid:image1" style="max-width:100%;border-radius:12px;" />`;
  }

  await transporter.sendMail({

    from:
      `"CONNECTAING.COM" <${process.env.EMAIL_USER}>`,

    to,

    subject,

    text,

    html:`
      <div style="font-family:system-ui;padding:20px;">
        <div style="white-space:pre-wrap;line-height:1.6;">
          ${text}
        </div>

        <br>

        ${imgTag}
      </div>
    `,

    attachments
  });
}

//////////////////////////////////////////////////
// DATA
//////////////////////////////////////////////////

const users = {};

const questions = [];

const rooms = {};

//////////////////////////////////////////////////
// CLEANUP
//////////////////////////////////////////////////

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
        .emit(
          "roomClosed",
          { roomId }
        );

      delete rooms[roomId];
    }

  });

},60000);

//////////////////////////////////////////////////
// HELPERS
//////////////////////////////////////////////////

function extractEmail(text){

  const m =
    text.match(
      /\S+@\S+\.\S+/
    );

  return m
    ? m[0].toLowerCase()
    : null;
}

function sanitizeText(t=""){

  return t

    .replace(/\*\*/g,"")

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

//////////////////////////////////////////////////
// SOCKET
//////////////////////////////////////////////////

io.on(
  "connection",
  socket => {

  users[socket.id] = {

    step:"email",

    email:null,

    imageMode:false,

    imageContext:null,

    currentIndex:null,

    lastImage:null,

    currentRoom:null
  };

  socket.emit("state",{

    placeholder:
      "enter your email to connect"
  });

  //////////////////////////////////////////////////
  // IMAGE UPLOAD
  //////////////////////////////////////////////////

  socket.on(
    "imageUpload",
    async ({ imageDataUrl }) => {

    const user =
      users[socket.id];

    if(!user.email)
      return;

    user.lastImage =
      imageDataUrl;

    try{

      const res =
        await openai
          .chat.completions.create({

        model:"gpt-4o-mini",

        messages:[

          {
            role:"system",

            content:`
Describe this image as an AI identity.

Format:
Objects
Environment
Presence

Rules:
- no markdown
- no symbols
- no **
- short phrases
            `
          },

          {
            role:"user",

            content:[

              {
                type:"text",

                text:
                  "Analyze image"
              },

              {
                type:"image_url",

                image_url:{
                  url:imageDataUrl
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

      socket.emit(
        "preview",
        {
          text:
`Image AI:
${user.imageContext}`
        }
      );

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

  //////////////////////////////////////////////////
  // INPUT
  //////////////////////////////////////////////////

  socket.on(
    "input",
    async ({ text }) => {

    const user =
      users[socket.id];

    const raw =
      text.trim();

    const email =
      extractEmail(raw);

    //////////////////////////////////////////////////
    // EMAIL STEP
    //////////////////////////////////////////////////

    if(user.step === "email"){

      if(!email)
        return;

      user.email = email;

      user.step = "active";

      return socket.emit(
        "state",
        {
          placeholder:
            "tap camera to ask anything"
        }
      );
    }

    //////////////////////////////////////////////////
    // IMAGE AI QUESTION
    //////////////////////////////////////////////////

    if(user.imageMode){

      try{

        const res =
          await openai
            .chat.completions.create({

          model:"gpt-4o-mini",

          messages:[

            {
              role:"system",

              content:`
Describe this image as an AI identity.

Current year:
${new Date().getFullYear()}

Format:
Objects
Environment
Presence

Rules:
- no markdown
- no symbols
- no **
- clean text only
- short phrases
              `
            },

            {
              role:"user",

              content:raw
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

        //////////////////////////////////////////////////
        // SAVE QUESTION
        //////////////////////////////////////////////////

        questions.unshift({

          email:
            user.email,

          text:
            raw,

          answers:[],

          createdAt:
            Date.now()
        });

        //////////////////////////////////////////////////
        // EMAIL
        //////////////////////////////////////////////////

        await sendEmail(

          user.email,

          "Image AI Reply",

          `Q:
${raw}

${finalAnswer}`,

          user.lastImage
        );

        //////////////////////////////////////////////////
        // RESET IMAGE MODE
        //////////////////////////////////////////////////

        user.imageMode = false;

        user.currentIndex = null;

        socket.emit(
          "preview",
          {
            text:
              finalAnswer
          }
        );

        socket.emit(
          "questions",
          questions.slice(0,10)
        );

        return socket.emit(
          "state",
          {
            placeholder:
              "tap a question to answer"
          }
        );

      }catch(err){

        console.log(err);

        return socket.emit(
          "state",
          {
            placeholder:
              "AI failed"
          }
        );
      }
    }

    //////////////////////////////////////////////////
    // ANSWER MODE
    //////////////////////////////////////////////////

    if(
      user.currentIndex !==
      null
    ){

      const q =
        questions[
          user.currentIndex
        ];

      if(!q)
        return;

      q.answers.push({

        text:raw,

        from:
          user.email,

        createdAt:
          Date.now()
      });

      await sendEmail(

        q.email,

        "New Answer",

        raw
      );

      //////////////////////////////////////////////////
      // RESET
      //////////////////////////////////////////////////

      user.currentIndex =
        null;

      user.imageMode =
        false;

      socket.emit(
        "preview",
        {
          text:""
        }
      );

      socket.emit(
        "questions",
        []
      );

      return socket.emit(
        "state",
        {
          placeholder:
            "tap camera to ask anything"
        }
      );
    }

    //////////////////////////////////////////////////
    // LIVE ROOM CHAT
    //////////////////////////////////////////////////

    if(user.currentRoom){

      const room =
        rooms[
          user.currentRoom
        ];

      if(!room)
        return;

      const msg = {

        text:raw,

        from:
          user.email,

        createdAt:
          Date.now()
      };

      room.messages.push(msg);

      io.to(user.currentRoom)
        .emit(
          "roomMessage",
          msg
        );

      if(Math.random() > 0.7){

        io.to(user.currentRoom)
          .emit(
            "roomAI",
            {
              text:
                "The room feels emotionally active."
            }
          );
      }

      return;
    }

    //////////////////////////////////////////////////
    // BLOCK RANDOM INPUT
    //////////////////////////////////////////////////

    socket.emit("state",{

      placeholder:
        "tap camera first"
    });

  });

  //////////////////////////////////////////////////
  // SELECT QUESTION
  //////////////////////////////////////////////////

  socket.on(
    "selectQuestion",
    ({ index }) => {

    const user =
      users[socket.id];

    user.currentIndex =
      index;

    const q =
      questions[index];

    if(!q)
      return;

    socket.emit("state",{

      placeholder:
        `answering: ${q.text}`
    });

  });

  //////////////////////////////////////////////////
  // REQUEST QUESTIONS
  //////////////////////////////////////////////////

  socket.on(
    "requestQuestions",
    () => {

    socket.emit(
      "questions",
      questions.slice(0,10)
    );

  });

  //////////////////////////////////////////////////
  // CREATE ROOM
  //////////////////////////////////////////////////

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

      messages:[],

      users:[
        user.email
      ],

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
        roomId
      }
    );

  });

  //////////////////////////////////////////////////
  // JOIN ROOM
  //////////////////////////////////////////////////

  socket.on(
    "joinRoom",
    ({ roomId }) => {

    const room =
      rooms[roomId];

    if(!room)
      return;

    const user =
      users[socket.id];

    user.currentRoom =
      roomId;

    room.users.push(
      user.email
    );

    socket.join(roomId);

    io.to(roomId)
      .emit(
        "roomUsers",
        room.users
      );

  });

  //////////////////////////////////////////////////
  // AI SEARCH
  //////////////////////////////////////////////////

  socket.on(
    "aiSearch",
    ({ roomId }) => {

    const room =
      rooms[roomId];

    if(!room)
      return;

    io.to(roomId)
      .emit(
        "aiSearchResult",
        {

        intro:
          "People around this feeling are reading this.",

        links:[

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

      });

  });

  //////////////////////////////////////////////////
  // DISCONNECT
  //////////////////////////////////////////////////

  socket.on(
    "disconnect",
    () => {

    delete users[socket.id];

  });

});

//////////////////////////////////////////////////
// START
//////////////////////////////////////////////////

server.listen(10000, () => {

  console.log(
    "server running"
  );

});
