const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const nodemailer = require("nodemailer");
const OpenAI = require("openai");

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

//////////////////////////////////////////////////
// EMAIL
//////////////////////////////////////////////////

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
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
      `<img src="cid:image1"
      style="max-width:100%;
      border-radius:12px;" />`;
  }

  await transporter.sendMail({

    from:
      `"CONNECTAING.COM"
      <${process.env.EMAIL_USER}>`,

    to,

    subject,

    text,

    html:`
      <div
      style="
      font-family:system-ui;
      padding:20px;
      ">

        <div
        style="
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
const rooms = {};

//////////////////////////////////////////////////
// CLEANUP
//////////////////////////////////////////////////

setInterval(() => {

  const now = Date.now();

  //////////////////////////////////////////////////
  // QUESTION CLEANUP
  //////////////////////////////////////////////////

  for(
    let i = questions.length - 1;
    i >= 0;
    i--
  ){

    if(
      now - questions[i].createdAt >
      72 * 60 * 60 * 1000
    ){

      questions.splice(i,1);
    }
  }

  //////////////////////////////////////////////////
  // ROOM CLEANUP
  //////////////////////////////////////////////////

  for(const roomId in rooms){

    if(
      now >
      rooms[roomId].expiresAt
    ){

      io.to(roomId).emit(
        "roomClosed"
      );

      delete rooms[roomId];
    }
  }

}, 60 * 1000);

//////////////////////////////////////////////////
// HELPERS
//////////////////////////////////////////////////

function extractEmail(text){

  const m =
    text.match(/\S+@\S+\.\S+/);

  return m
    ? m[0].toLowerCase()
    : null;
}

//////////////////////////////////////////////////
// SOCKET
//////////////////////////////////////////////////

io.on("connection", socket => {

  users[socket.id] = {

    step:"email",

    email:null,

    imageMode:false,

    imageContext:null,

    currentIndex:null,

    lastImage:null,

    currentRoom:null
  };

  socket.emit("state", {

    placeholder:
      "enter your email to connect"
  });

  //////////////////////////////////////////////////
  // IMAGE UPLOAD
  //////////////////////////////////////////////////

  socket.on(
    "imageUpload",

    async ({
      imageDataUrl,
      roomMode
    }) => {

    const user =
      users[socket.id];

    if(!user.email) return;

    user.lastImage =
      imageDataUrl;

    try{

      const res =
        await openai.chat.completions.create({

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
- short phrases
- no markdown
- no symbols
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

      user.imageContext =
        res.choices[0]
          .message
          .content
          .replace(/\*\*/g,"")
          .replace(
            /Atmosphere:/gi,
            "Environment:"
          )
          .replace(
            /Emotional Tone:/gi,
            "Presence:"
          );

      //////////////////////////////////////////////////
      // ROOM MODE
      //////////////////////////////////////////////////

      if(roomMode){

        const roomId =
          Math.random()
            .toString(36)
            .substring(2,8);

        rooms[roomId] = {

          id:roomId,

          imageContext:
            user.imageContext,

          messages:[],

          createdAt:Date.now(),

          expiresAt:
            Date.now() +
            60 * 60 * 1000
        };

        socket.join(roomId);

        user.currentRoom =
          roomId;

//////////////////////////////////////////////////
//////////////////////////////////////////////////
// INITIAL ROOM QUESTION
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// OPEN ROOM IMMEDIATELY
//////////////////////////////////////////////////

socket.emit(
  "roomCreated",
  {
    roomId,

    imageContext:
      user.imageContext,

    imageDataUrl:
      user.lastImage,

    messages:[]
  }
);

//////////////////////////////////////////////////
// GENERATE FIRST AI MESSAGE ASYNC
//////////////////////////////////////////////////

(async () => {

try{

  //////////////////////////////////////////////////
  // STARTER QUESTION
  //////////////////////////////////////////////////

  const starterRes =
    await openai.chat.completions.create({

    model:"gpt-4o-mini",

    messages:[

      {
        role:"system",

        content:`
Create ONE short emotional curiosity question.

Rules:
- lowercase
- no punctuation
- emotionally tempting
- 2 to 6 words
- internet atmosphere feeling

Examples:

want to see loneliness
see what people hide
see public sadness
want to see obsession
`
      }
    ]
  });

  const starterQuestion =

    starterRes
      .choices[0]
      .message
      .content
      .trim();

  //////////////////////////////////////////////////
  // STARTER MOOD
  //////////////////////////////////////////////////

  const starterMoodRes =
    await openai.chat.completions.create({

    model:"gpt-4o-mini",

    messages:[

      {
        role:"system",

        content:`
Create a 1 to 3 word emotional mood phrase.

Rules:
- lowercase only
- no punctuation
- emotionally cinematic

Examples:

quiet heartbreak
digital loneliness
hidden pressure
`
      },

      {
        role:"user",

        content:starterQuestion
      }
    ]
  });

  const starterMood =

    starterMoodRes
      .choices[0]
      .message
      .content
      .trim();

  //////////////////////////////////////////////////
  // SAFE IMAGE
  //////////////////////////////////////////////////

  let starterImage =
    user.lastImage;

  try{

    const starterSearchRes =
      await openai.chat.completions.create({

      model:"gpt-4o-mini",

      messages:[

        {
          role:"system",

          content:`
Turn this emotional question into a visual news image search phrase.

Rules:
- cinematic
- emotional
- modern culture atmosphere
- 3 to 8 words
`
        },

        {
          role:"user",

          content:starterQuestion
        }
      ]
    });

    const starterSearch =

      starterSearchRes
        .choices[0]
        .message
        .content
        .trim();

    const starterSerpFetch =
      await fetch(

        `https://serpapi.com/search.json?engine=google&tbm=nws&q=${encodeURIComponent(starterSearch)}&api_key=${process.env.SERPAPI_KEY}`

      );

    const starterSerpRes =
      await starterSerpFetch.json();

    starterImage =

      starterSerpRes
        ?.news_results?.[0]
        ?.thumbnail ||

      starterSerpRes
        ?.news_results?.[0]
        ?.thumbnail_small ||

      user.lastImage;

  }catch(err){

    console.log(
      "starter image failed",
      err
    );
  }

  //////////////////////////////////////////////////
  // PUSH FIRST MESSAGE
  //////////////////////////////////////////////////

  rooms[roomId].messages.push({

    from:"Image AI",

    image:starterImage,

    mood:starterMood,

    ask:starterQuestion
  });

  //////////////////////////////////////////////////
  // SEND TO ROOM
  //////////////////////////////////////////////////

  io.to(roomId).emit(

    "roomMessages",

    rooms[roomId].messages
  );

}catch(err){

  console.log(
    "starter room AI failed",
    err
  );
}

})();

return;

}

      //////////////////////////////////////////////////
      // NORMAL V3 MODE
      //////////////////////////////////////////////////

      user.imageMode = true;

      socket.emit("preview", {

        text:
`Image AI:
${user.imageContext}`
      });

      socket.emit("state", {

        placeholder:
          "ask this image"
      });

    }catch(err){

      console.log(err);

      socket.emit("state", {

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

      if(!email) return;

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
          await openai.chat.completions.create({

          model:"gpt-4o-mini",

          messages:[

            {
              role:"system",

              content:`
You are the image identity itself.

Current year:
${new Date().getFullYear()}

Rules:
- short replies
- emotionally aware
- no markdown
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
            .message
            .content;

        const finalAnswer =
`Image AI:
${user.imageContext}

${aiReply}`;

        questions.unshift({

          email:user.email,

          text:raw,

          answers:[],

          createdAt:Date.now()
        });

        await sendEmail(

          user.email,

          "Image AI Reply",

          `Q:
${raw}

${finalAnswer}`,

          user.lastImage
        );

        user.imageMode = false;

        socket.emit("preview", {
          text:finalAnswer
        });

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

    if(user.currentIndex !== null){

      const q =
        questions[user.currentIndex];

      if(!q) return;

      q.answers.push({

        text:raw,

        from:user.email,

        createdAt:Date.now()
      });

      await sendEmail(
        q.email,
        "New Answer",
        raw
      );

      user.currentIndex = null;

      socket.emit("preview", {
        text:""
      });

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

    if(!q) return;

    socket.emit(
      "state",
      {
        placeholder:
          `answering: ${q.text}`
      }
    );
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
  // ROOM MESSAGE
  //////////////////////////////////////////////////

  socket.on(
    "roomMessage",

    async ({ text }) => {

    const user =
      users[socket.id];

    const room =
      rooms[user.currentRoom];

    if(!room) return;

    room.messages.push({

      from:user.email,

      text
    });

    io.to(room.id).emit(
      "roomMessages",
      room.messages
    );

   //////////////////////////////////////////////////
// IMAGE REACTION V5
//////////////////////////////////////////////////

try{

  //////////////////////////////////////////////////
  // GPT CREATES EMOTIONAL NEWS SEARCH
  //////////////////////////////////////////////////

  const emotionRes =
    await openai.chat.completions.create({

    model:"gpt-4o-mini",

    messages:[

      {
        role:"system",

        content:`
Turn the user's message into ONE emotional current-news image search phrase.

Rules:
- visual atmosphere only
- emotionally cinematic
- modern culture feeling
- 3 to 8 words
- no punctuation
- no quotes

Examples:

lonely celebrity backstage
sad city protest
empty subway late night
exhausted athlete press conference
rainy downtown loneliness
`
      },

      {
        role:"user",
        content:text
      }
    ]
  });

  const searchQuery =
    emotionRes
      .choices[0]
      .message
      .content
      .trim();

  //////////////////////////////////////////////////
  // SERP CURRENT NEWS SEARCH
  //////////////////////////////////////////////////

  const serpFetch =
    await fetch(

      `https://serpapi.com/search.json?engine=google&tbm=nws&q=${encodeURIComponent(searchQuery)}&api_key=${process.env.SERPAPI_KEY}`

    );

  const serpRes =
    await serpFetch.json();

  //////////////////////////////////////////////////
  // GET ONE NEWS IMAGE
  //////////////////////////////////////////////////

  const imageUrl =

    serpRes
      ?.news_results?.[0]
      ?.thumbnail ||

    serpRes
      ?.news_results?.[0]
      ?.thumbnail_small;

  if(!imageUrl) return;

  //////////////////////////////////////////////////
  // PUSH IMAGE MESSAGE
  //////////////////////////////////////////////////

  //////////////////////////////////////////////////
// GPT CREATES 1-3 WORD MOOD
//////////////////////////////////////////////////

const moodRes =
  await openai.chat.completions.create({

  model:"gpt-4o-mini",

  messages:[

    {
      role:"system",

      content:`
Create a 1 to 3 word emotional mood phrase.

Rules:
- lowercase only
- no punctuation
- emotionally modern
- atmospheric
- no explanation

Examples:

quiet pressure
public loneliness
digital exhaustion
heavy silence
`
    },

    {
      role:"user",

      content:`
User message:
${text}

Search phrase:
${searchQuery}
`
    }
  ]
});

const moodText =
  moodRes
    .choices[0]
    .message
    .content
    .trim();

//////////////////////////////////////////////////
// PUSH IMAGE MESSAGE
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// NEXT QUESTION
//////////////////////////////////////////////////

const nextQuestionRes =
  await openai.chat.completions.create({

  model:"gpt-4o-mini",

  messages:[

    {
      role:"system",

      content:`
Create ONE short emotional curiosity question.

Rules:
- lowercase
- no punctuation
- emotionally tempting
- 2 to 6 words
- internet atmosphere feeling

Examples:

see hidden pressure
want to see attention
see emotional noise
see fake happiness
`
    },

    {
      role:"user",

      content:`
User said:
${text}

Mood:
${moodText}
`
    }
  ]
});

const nextQuestion =
  nextQuestionRes
    .choices[0]
    .message
    .content
    .trim();

//////////////////////////////////////////////////
// PUSH IMAGE + LOOP
//////////////////////////////////////////////////

room.messages.push({

  from:"Image AI",

  image:imageUrl,

  mood:moodText,

  ask:nextQuestion
});

  io.to(room.id).emit(

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

    () => {

    const user =
      users[socket.id];

    const room =
      rooms[user.currentRoom];

    if(!room) return;

    room.messages.push({

      from:"Image AI",

      text:
`People around this feeling are discussing similar things online right now.`
    });

    io.to(room.id).emit(
      "roomMessages",
      room.messages
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
    "server running"
  );
});
