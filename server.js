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

     //////////////////////////////////////////////////
// IMAGE AI IDENTITY
//////////////////////////////////////////////////

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
// DETECT CORE THEME
//////////////////////////////////////////////////

const themeRes =
  await openai.chat.completions.create({

  model:"gpt-4o-mini",

  messages:[

    {
      role:"system",

      content:`
Detect the SINGLE dominant philosophical category.

Return ONLY one word.

Possible categories:

religion
technology
celebrity
fashion
music
politics
family
gaming
loneliness
internet
violence
performance
work
relationships
identity
spirituality
culture

Rules:
- lowercase only
- one word only
- no punctuation
- no explanation
`
    },

    {
      role:"user",

      content:user.imageContext
    }
  ]
});

const coreTheme =

  themeRes
    .choices[0]
    .message
    .content
    .trim()
    .toLowerCase();

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

    coreTheme:
      coreTheme,

    imageContext:
      user.imageContext,

    messages:[],

    usedSearches:[],

    usedMoods:[],

    usedQuestions:[],

    emotionalState:[],

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
io.to(roomId).emit(
  "aiTypingStart"
);

(async () => {

try{

  //////////////////////////////////////////////////
// STARTER QUESTION
//////////////////////////////////////////////////

const starterRes =
  await openai.chat.completions.create({

  model:"gpt-4o-mini",

  temperature:1.2,

  messages:[

    {
      role:"system",

      content:`
Create ONE emotionally unique yes/no question.

IMPORTANT:
Never generate generic relationship questions repeatedly.

Avoid:
- is love worth the pain
- fake happiness
- emotional exhaustion clichés

The question should feel:
- psychologically interesting
- socially reflective
- philosophically human
- modern
- emotionally diverse
- internet-native

Focus on different human themes:
- loneliness
- identity
- public behavior
- social media
- ambition
- religion
- family
- addiction
- attention
- performance
- work
- friendship
- emotional numbness
- memory
- aging
- technology
- self-worth

Rules:
- lowercase only
- no punctuation
- yes/no friendly
- 2 to 6 words
- emotionally sharp
- no repetition
`
    },

    {
      role:"user",

      content:`
Uploaded atmosphere:

${user.imageContext}

Create a completely fresh emotional starting question.
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

let starterImage = null;

try{

  const starterSearchRes =
    await openai.chat.completions.create({

    model:"gpt-4o-mini",

    messages:[

      {
        role:"system",

        content:`
Create ONE philosophical CURRENT NEWS image search phrase.

The room MUST remain inside the core philosophical category.
Never drift outside the category.

The result should feel:
- emotionally cinematic
- human
- socially reflective
- current/recent
- real news photography

Rules:
- 3 to 8 words
- lowercase only
- no punctuation
- visually searchable
`
      },

      {
        role:"user",

        content:`
Starter question:

${starterQuestion}

Core philosophical category:

${room.coreTheme}

Create a philosophical CURRENT NEWS visual search phrase.
`
      }
    ]
  });

  const starterSearch =

    starterSearchRes
      .choices[0]
      .message
      .content
      .trim();

  //////////////////////////////////////////////////
  // GOOGLE NEWS SEARCH
  //////////////////////////////////////////////////

  const starterSerpFetch =
    await fetch(

      `https://serpapi.com/search.json?engine=google&tbm=nws&q=${encodeURIComponent(starterSearch)}&api_key=${process.env.SERPAPI_KEY}`

    );

  const starterSerpRes =
    await starterSerpFetch.json();

  //////////////////////////////////////////////////
  // GET NEWS IMAGE
  //////////////////////////////////////////////////

  starterImage =

    starterSerpRes
      ?.news_results?.[0]
      ?.thumbnail ||

    starterSerpRes
      ?.news_results?.[0]
      ?.thumbnail_small;

  //////////////////////////////////////////////////
  // GOOGLE IMAGE FALLBACK
  //////////////////////////////////////////////////

  if(!starterImage){

    try{

      const imageFallbackFetch =
        await fetch(

          `https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(starterSearch)}&api_key=${process.env.SERPAPI_KEY}`

        );

      const imageFallbackRes =
        await imageFallbackFetch.json();

      starterImage =

        imageFallbackRes
          ?.images_results?.[0]
          ?.original ||

        imageFallbackRes
          ?.images_results?.[0]
          ?.thumbnail;

    }catch(err){

      console.log(
        "google image fallback failed",
        err
      );
    }
  }

  //////////////////////////////////////////////////
  // FINAL INTERNET FALLBACK
  //////////////////////////////////////////////////

  if(!starterImage){

    try{

      const fallbackFetch =
        await fetch(

          `https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(room.coreTheme)}&api_key=${process.env.SERPAPI_KEY}`

        );

      const fallbackRes =
        await fallbackFetch.json();

      starterImage =

        fallbackRes
          ?.images_results?.[0]
          ?.original ||

        fallbackRes
          ?.images_results?.[0]
          ?.thumbnail;

    }catch(err){

      console.log(
        "final internet fallback failed",
        err
      );
    }
  }

  //////////////////////////////////////////////////
// ABSOLUTE FINAL INTERNET SAFETY
//////////////////////////////////////////////////

if(!starterImage){

  try{

    const randomThemes = [

      room.coreTheme,

      room.coreTheme + " people",

      room.coreTheme + " emotional",

      room.coreTheme + " modern life",

      room.coreTheme + " atmosphere",

      room.coreTheme + " photography",

      room.coreTheme + " public",

      room.coreTheme + " documentary"
    ];

    const randomQuery =

      randomThemes[
        Math.floor(
          Math.random() *
          randomThemes.length
        )
      ];

    const safetyFetch =
      await fetch(

        `https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(randomQuery)}&api_key=${process.env.SERPAPI_KEY}`

      );

    const safetyRes =
      await safetyFetch.json();

    starterImage =

      safetyRes
        ?.images_results?.[
          Math.floor(
            Math.random() * 5
          )
        ]
        ?.original ||

      safetyRes
        ?.images_results?.[
          Math.floor(
            Math.random() * 5
          )
        ]
        ?.thumbnail;

  }catch(err){

    console.log(
      "absolute internet safety failed",
      err
    );
  }
}

  }catch(err){

  console.log(
    "safe image failed",
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

io.to(roomId).emit(
  "aiTypingStop"
);

}catch(err){

  console.log(
    "starter room AI failed",
    err
  );

  io.to(roomId).emit(
    "aiTypingStop"
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
  io.to(room.id).emit(
  "aiTypingStart"
);

 //////////////////////////////////////////////////
// GPT CREATES PHILOSOPHICAL NEWS SEARCH
//////////////////////////////////////////////////

const emotionRes =
  await openai.chat.completions.create({

  model:"gpt-4o-mini",

  messages:[

    {
      role:"system",

      content:`
Create ONE philosophical CURRENT NEWS image search phrase.

The system should evolve emotionally over time.

NEVER repeat:
- previous searches
- previous moods
- previous emotional situations
- previous social atmospheres

The search result should feel:
- human
- socially reflective
- emotionally cinematic
- psychologically evolving
- visually different over time
- grounded in real current-news photography

Focus on:
- public behavior
- social pressure
- relationships
- loneliness
- identity
- attention
- emotional fatigue
- modern society
- internet culture
- human tension

Rules:
- 3 to 8 words
- lowercase only
- no punctuation
- visually searchable
- must describe visible human situations
- no fantasy
- no abstract-only concepts
- no repeated emotional framing

Emotional progression matters.
Avoid emotional loops.
`
    },

    {
      role:"user",

      content:`
Uploaded image atmosphere:

${room.imageContext}

Core philosophical category:

${room.coreTheme}

Conversation emotional history:

${room.emotionalState.join("\n")}

Already used searches:

${room.usedSearches.join("\n")}

Already used moods:

${room.usedMoods.join("\n")}

Already used questions:

${room.usedQuestions.join("\n")}

Current user response:

${text}

Create a NEW philosophical CURRENT NEWS visual search phrase
that emotionally evolves the room.
`
    }
  ]
});

const searchQuery =

  emotionRes
    .choices[0]
    .message
    .content
    .trim();

room.usedSearches.push(
  searchQuery
);

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

//////////////////////////////////////////////////
// GET NEWS IMAGE
//////////////////////////////////////////////////

let imageUrl =

  serpRes
    ?.news_results?.[0]
    ?.thumbnail ||

  serpRes
    ?.news_results?.[0]
    ?.thumbnail_small;

//////////////////////////////////////////////////
// GOOGLE IMAGE FALLBACK
//////////////////////////////////////////////////

if(!imageUrl){

  try{

    const imageFallbackFetch =
      await fetch(

        `https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(searchQuery)}&api_key=${process.env.SERPAPI_KEY}`

      );

    const imageFallbackRes =
      await imageFallbackFetch.json();

    imageUrl =

      imageFallbackRes
        ?.images_results?.[0]
        ?.original ||

      imageFallbackRes
        ?.images_results?.[0]
        ?.thumbnail;

  }catch(err){

    console.log(
      "google image fallback failed",
      err
    );
  }
}

//////////////////////////////////////////////////
// FINAL FALLBACK
//////////////////////////////////////////////////

if(!imageUrl){

  imageUrl =
    user.lastImage;
}

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
Create ONE emotionally evolving 1 to 3 word mood phrase.

NEVER repeat previous moods.

The mood should:
- evolve emotionally
- match the philosophical news image
- reflect modern human tension
- feel cinematic
- feel psychologically alive

Rules:
- lowercase only
- no punctuation
- 1 to 3 words only
- no repetition
`
    },

    {
      role:"user",

      content:`
Uploaded atmosphere:

${room.imageContext}

Used moods:

${room.usedMoods.join("\n")}

Search phrase:

${searchQuery}

Current user response:

${text}
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

room.usedMoods.push(
  moodText
);

room.emotionalState.push(
  moodText
);

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
Create ONE emotionally evolving yes/no question.

NEVER repeat:
- previous emotional framing
- previous social tension
- previous philosophical direction

The room should psychologically evolve over time.

The question should feel:
- human
- socially reflective
- emotionally cinematic
- psychologically direct
- existential
- internet-native

Rules:
- lowercase only
- no punctuation
- 2 to 6 words
- natural yes/no response
- no repetition
`
    },

    {
      role:"user",

      content:`
Uploaded atmosphere:

${room.imageContext}

Used questions:

${room.usedQuestions.join("\n")}

Conversation emotional history:

${room.emotionalState.join("\n")}

Mood:

${moodText}

Search phrase:

${searchQuery}

Current user response:

${text}

Create a NEW emotionally evolving yes/no question.
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

room.usedQuestions.push(
  nextQuestion
);

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
  io.to(room.id).emit(
  "aiTypingStop"
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
