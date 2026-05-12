// ==================================================
// CONNECTAING V4 BACKEND
// server.js
// ==================================================

const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const { Server } = require("socket.io");
const nodemailer = require("nodemailer");
const OpenAI = require("openai");

const app = express();

app.use(cors({ origin: "*" }));

app.use(express.json({
  limit: "15mb"
}));

app.use(
  express.static(
    path.join(__dirname,"public")
  )
);

const server =
  http.createServer(app);

const io = new Server(server,{
  cors:{ origin:"*" }
});

const openai = new OpenAI({
  apiKey:
    process.env.OPENAI_API_KEY
});

const APP_URL =
  process.env.APP_URL ||
  "https://YOUR-RENDER-URL.onrender.com";

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
      <div style="
        font-family:system-ui;
        padding:20px;
      ">
        <div style="
          white-space:pre-wrap;
          line-height:1.6;
        ">
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

const imageRooms = {};

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

function makeRoomId(){

  return Math.random()
    .toString(36)
    .substring(2,7)
    .toUpperCase();
}

function makeRoomUrl(roomId){

  return `${APP_URL}/room/${roomId}`;
}

function detectEmotion(text){

  const t =
    String(text || "")
      .toLowerCase();

  if(t.includes("lonely"))
    return "loneliness";

  if(t.includes("love"))
    return "romance";

  if(t.includes("miss"))
    return "nostalgia";

  if(t.includes("fear"))
    return "anxiety";

  if(t.includes("justin"))
    return "celebrity fixation";

  return "general";
}

//////////////////////////////////////////////////
// CLEANUP
//////////////////////////////////////////////////

setInterval(() => {

  const now = Date.now();

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

  Object.keys(imageRooms)
    .forEach(roomId => {

    if(
      now -
      imageRooms[roomId]
        .createdAt >

      72 * 60 * 60 * 1000
    ){

      delete imageRooms[roomId];
    }

  });

},60000);

//////////////////////////////////////////////////
// ROOM PAGE
//////////////////////////////////////////////////

app.get(
  "/room/:roomId",
  (req,res) => {

  res.sendFile(
    path.join(
      __dirname,
      "public",
      "room.html"
    )
  );

});

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

    imageTitle:null,

    imagePersona:null,

    currentIndex:null,

    lastImage:null
  };

  socket.emit(
    "state",
    {
      placeholder:
        "enter your email to connect"
    }
  );

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
You are the uploaded image itself.

Return:

Image AI:
Persona:

Short natural phrasing only.
            `
          },

          {
            role:"user",

            content:[

              {
                type:"text",
                text:"Analyze image"
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

      const imageContext =
        res.choices[0]
          .message.content;

      const titleMatch =
        imageContext.match(
          /Image AI:\s*([\s\S]*?)(Persona:|$)/i
        );

      const personaMatch =
        imageContext.match(
          /Persona:\s*([\s\S]*)/i
        );

      user.imageContext =
        imageContext;

      user.imageTitle =
        titleMatch
          ? titleMatch[1].trim()
          : "Image AI";

      user.imagePersona =
        personaMatch
          ? personaMatch[1].trim()
          : "quiet observer";

      user.imageMode =
        true;

      socket.emit(
        "preview",
        {
          text:
`Image AI:
${user.imageTitle}

Persona:
${user.imagePersona}`
        }
      );

      socket.emit(
        "state",
        {
          placeholder:
            "ask this image"
        }
      );

    }catch(err){

      console.log(err);

      socket.emit(
        "state",
        {
          placeholder:
            "image failed"
        }
      );
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
    // EMAIL
    //////////////////////////////////////////////////

    if(user.step === "email"){

      if(!email)
        return;

      user.email =
        email;

      user.step =
        "active";

      return socket.emit(
        "state",
        {
          placeholder:
            "tap camera to ask anything"
        }
      );
    }

    //////////////////////////////////////////////////
    // IMAGE QUESTION
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
You ARE the image itself.

Stay in identity permanently.

Speak naturally.
              `
            },

            {
              role:"user",
              content:raw
            }

          ]
        });

        const aiReply =
          res.choices[0]
            .message.content;

        const finalAnswer =
`Image AI:
${user.imageTitle}

Persona:
${user.imagePersona}

${aiReply}`;

        questions.unshift({

          email:
            user.email,

          text:
            raw,

          answers:[],

          createdAt:
            Date.now()
        });

        await sendEmail(

          user.email,

          "Image AI Reply",

          `Q:
${raw}

${finalAnswer}`,

          user.lastImage
        );

        user.imageMode =
          false;

        user.currentIndex =
          null;

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

        socket.emit(
          "state",
          {
            placeholder:
              "tap a question to answer"
          }
        );

      }catch(err){

        console.log(err);
      }

      return;
    }

    //////////////////////////////////////////////////
    // ANSWER
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

      user.currentIndex =
        null;

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

      socket.emit(
        "state",
        {
          placeholder:
            "tap camera to ask anything"
        }
      );

    }

  });

  //////////////////////////////////////////////////
  // QUESTIONS
  //////////////////////////////////////////////////

  socket.on(
    "requestQuestions",
    () => {

    socket.emit(
      "questions",
      questions.slice(0,10)
    );

  });

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

    socket.emit(
      "state",
      {
        placeholder:
          `answering: ${q.text}`
      }
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
      makeRoomId();

    imageRooms[roomId] = {

      roomId,

      imageDataUrl:
        user.lastImage,

      imageTitle:
        user.imageTitle,

      persona:
        user.imagePersona,

      imageContext:
        user.imageContext,

      emotionalState:
        "general",

      messages:[

        {
          from:"Image AI",

          text:
            "This image is live now. Say something worth noticing.",

          createdAt:
            Date.now()
        }

      ],

      createdAt:
        Date.now()
    };

    socket.emit(
      "roomCreated",
      {

        roomId,

        roomUrl:
          makeRoomUrl(roomId)

      }
    );

  });

  //////////////////////////////////////////////////
  // ROOM
  //////////////////////////////////////////////////

  socket.on(
    "joinImageRoom",
    ({ roomId }) => {

    const room =
      imageRooms[roomId];

    if(!room){

      return socket.emit(
        "roomState",
        null
      );
    }

    socket.join(roomId);

    socket.emit(
      "roomState",
      room
    );

  });

  socket.on(
    "roomMessage",
    async ({ roomId, text }) => {

    const room =
      imageRooms[roomId];

    if(!room)
      return;

    const cleanText =
      String(text || "")
        .trim();

    if(!cleanText)
      return;

    room.messages.push({

      from:"Stranger",

      text:cleanText,

      createdAt:
        Date.now()
    });

    room.emotionalState =
      detectEmotion(cleanText);

    io.to(roomId)
      .emit(
        "roomMessages",
        room.messages
      );

    try{

      const res =
        await openai
          .chat.completions.create({

        model:"gpt-4o-mini",

        messages:[

          {
            role:"system",

            content:`
You are the Image AI host.

Image AI:
${room.imageTitle}

Persona:
${room.persona}

Emotion:
${room.emotionalState}

Speak naturally.
            `
          },

          {
            role:"user",
            content:cleanText
          }

        ]
      });

      const aiText =
        res.choices[0]
          .message.content;

      room.messages.push({

        from:"Image AI",

        text:aiText,

        createdAt:
          Date.now()
      });

      io.to(roomId)
        .emit(
          "roomMessages",
          room.messages
        );

    }catch(err){

      console.log(err);
    }

  });

  //////////////////////////////////////////////////
  // AI SEARCH
  //////////////////////////////////////////////////

  socket.on(
    "aiSearch",
    ({ roomId }) => {

    const room =
      imageRooms[roomId];

    if(!room)
      return;

    io.to(roomId)
      .emit(
        "aiSearchResult",
        {

          intro:
            `People around ${room.emotionalState} are reading this.`,

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

        }
      );

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
    "CONNECTAING V4 running"
  );

});
