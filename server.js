const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const nodemailer = require("nodemailer");
const OpenAI = require("openai");
const fetch = global.fetch;

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
  roomMode,
  askMode
}) => {

    const user =
      users[socket.id];

 if(!user.email){

  socket.emit(
    "state",
    {
      placeholder:
        "enter your email to connect"
    }
  );

  return;
}
      console.log(
  "UPLOAD USER:",
  user.email
);

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
Detect the SINGLE dominant internet trend category.

Return ONLY one word.

Possible categories:

celebrity
fashion
music
sports
internet
technology
gaming
luxury
politics
ai
fitness
streetwear
dating
viral
entertainment
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

//////////////////////////////////////////////////
// ASK AI MODE
//////////////////////////////////////////////////

if(askMode){

  user.imageMode = true;

user.currentRoom = null;

  socket.emit("preview", {

    text:
`Image AI:
${user.imageContext}`
  });

  socket.emit("state", {

    placeholder:
      "ask this image"
  });

  return;
}

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

emotionalProfile:{
  hype:0.5,
  anxiety:0.2,
  loneliness:0.1,
  confidence:0.6,
  celebrityFixation:0.5
},

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

  temperature:0.8,

messages:[

    {
      role:"system",

      content:`
Create ONE trending social reaction line.

The line should feel:
- viral
- socially reactive
- internet-native
- emotionally engaging
- culturally current

Rules:
- lowercase only
- no punctuation
- 2 to 7 words
- no philosophy
- no existential tone
- feel like live internet culture
`
    },

    {
      role:"user",

      content:`
Uploaded image AI personality:

${user.imageContext}

Create a completely fresh trending social reaction line.
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
Create ONE evolving internet vibe.

The vibe should feel:
- viral
- socially addictive
- internet-native
- culturally current
- emotionally reactive

Examples:

main character
internet pressure
celebrity chaos
viral energy
late night scrolling
digital fame
timeline exploding

Rules:
- lowercase only
- no punctuation
- 1 to 3 words
- modern internet culture only
- no philosophy
`
    },

    {
      role:"user",

      content:`
Uploaded image AI personality:

${user.imageContext}

Used moods:

none yet

Search phrase:

${starterQuestion}

Current user response:

starting room
`
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

let starterNewsTitle =
  starterQuestion;

let starterNewsItem =
  null;

try{

  const starterSearchRes =
    await openai.chat.completions.create({

    model:"gpt-4o-mini",

    messages:[

      {
        role:"system",

        content:`
Create ONE trending CURRENT NEWS image search phrase.

IMPORTANT:
The search MUST still match the uploaded image AI personality.

The room is:
- personality-driven
- internet-native
- socially reactive
- emotionally evolving

The AI personality controls:
- trend taste
- celebrity focus
- emotional tone
- internet vibe
- cultural direction

Focus ONLY on trends DIRECTLY connected to the uploaded image identity.

The search MUST visually and semantically match:
- the objects
- the environment
- the emotional presence
- the product category
- the lifestyle category
- the aesthetic direction

If the image is:
- fashion → search fashion trends
- food → search food trends
- books → search learning/book trends
- fitness → search fitness trends
- technology → search tech trends
- sneakers → search sneaker trends

NEVER jump to unrelated celebrity or TikTok drama unless the uploaded image itself suggests that category.

The result should feel:
- current
- visually strong
- internet-native
- culturally alive
- socially relevant
- emotionally aligned with the uploaded image identity

The uploaded image personality
must guide the emotional and cultural direction.

IMPORTANT:
Use REAL searchable public news entities.

GOOD:
taylor swift grammys
elon musk tesla
openai sora launch
nike nba deal
coachella crowd
kanye west controversy
met gala fashion
apple vision pro

BAD:
internet loneliness
digital pressure
modern emotions

Rules:
- 3 to 8 words
- lowercase only
- no punctuation
- visually searchable
- current-news energy only
- no philosophy
- no abstract concepts
- no repetition

The uploaded image personality MUST shape the trend direction.
`
      },

      {
        role:"user",

        content:`
Uploaded image AI personality:

${room.imageContext}

Current room emotional profile:

${JSON.stringify(
  room.emotionalProfile,
  null,
  2
)}

Trend personality category:

${room.coreTheme}

Previous trend history:

none yet

Used searches:

none yet

Used moods:

${starterMood}

Used reactions:

${starterQuestion}

Current user reaction:

starting room

Create a NEW trending CURRENT NEWS image search phrase.

IMPORTANT:
The search MUST still feel connected to the uploaded image personality.

The room should evolve like:
- a live internet feed
- social media culture
- trending reactions
- viral news energy
- celebrity/internet momentum
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

  console.log(
    "STARTER SEARCH:",
    starterSearch
  );

  //////////////////////////////////////////////////
  // GOOGLE NEWS SEARCH
  //////////////////////////////////////////////////

  const starterSerpFetch =
    await fetch(

      `https://serpapi.com/search.json?engine=google&tbm=nws&q=${encodeURIComponent(starterSearch)}&api_key=${process.env.SERPAPI_KEY}`

    );

  const starterSerpRes =
    await starterSerpFetch.json();

  console.log(
    "STARTER NEWS COUNT:",
    starterSerpRes?.news_results?.length
  );

  //////////////////////////////////////////////////
  // REAL STARTER NEWS PICKER
  //////////////////////////////////////////////////

  //////////////////////////////////////////////////
// V5.4.2 STARTER INTERNET EVALUATION
//////////////////////////////////////////////////

const starterNewsResults =
  starterSerpRes?.news_results || [];

const validStarterNews =
  starterNewsResults.filter(item => {

    const possibleImage =
      item.thumbnail ||
      item.thumbnail_small;

    return (

      possibleImage &&

      item.title &&

      !possibleImage.includes("logo") &&
      !possibleImage.includes("icon") &&
      !possibleImage.includes("placeholder") &&
      !possibleImage.includes("default") &&
      !possibleImage.includes("avatar")

    );

  });

if(validStarterNews.length > 0){

  try{

    const starterEvaluationRes =
      await openai.chat.completions.create({

      model:"gpt-4o-mini",

      temperature:0.7,

      messages:[
        {
          role:"system",
          content:`
Choose the MOST emotionally powerful
starter internet reaction.

Prioritize:
- internet virality
- emotional energy
- visual strength
- cultural momentum
- emotionally addictive feeling

Return ONLY the exact title.
`
        },
        {
          role:"user",
          content:`
Image personality:
${user.imageContext}

Starter mood:
${starterMood}

Candidate reactions:
${validStarterNews.map(
  n => n.title
).join("\n")}
`
        }
      ]
    });

    const starterChosenTitle =
      starterEvaluationRes
        .choices[0]
        .message
        .content
        .trim();

    starterNewsItem =
  validStarterNews.find(item => {

    const a =
      item.title
        .toLowerCase()
        .replace(/[^\w\s]/g,"")
        .trim();

    const b =
      starterChosenTitle
        .toLowerCase()
        .replace(/[^\w\s]/g,"")
        .trim();

    return (
      a.includes(b) ||
      b.includes(a)
    );

  });

    if(!starterNewsItem){

      starterNewsItem =
        validStarterNews[0];

    }

    starterImage =
      starterNewsItem.thumbnail ||
      starterNewsItem.thumbnail_small;

    starterNewsTitle =
      starterNewsItem.title;

  }catch(err){

    console.log(
      "starter evaluation failed",
      err
    );

    starterNewsItem =
      validStarterNews[0];

    starterImage =
      starterNewsItem.thumbnail ||
      starterNewsItem.thumbnail_small;

    starterNewsTitle =
      starterNewsItem.title;

  }

}

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

      console.log(
        "FALLBACK THEME:",
        rooms[roomId].coreTheme
      );

      const fallbackFetch =
        await fetch(

          `https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(rooms[roomId].coreTheme)}&api_key=${process.env.SERPAPI_KEY}`

        );

      const fallbackRes =
        await fallbackFetch.json();

      console.log(
        "FALLBACK IMAGE COUNT:",
        fallbackRes?.images_results?.length
      );

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

        rooms[roomId].coreTheme,

        rooms[roomId].coreTheme + " trending",

        rooms[roomId].coreTheme + " viral",

        rooms[roomId].coreTheme + " culture",

        rooms[roomId].coreTheme + " social media",

        rooms[roomId].coreTheme + " breaking news",

        rooms[roomId].coreTheme + " internet culture"
      ];

      const randomQuery =

        randomThemes[
          Math.floor(
            Math.random() *
            randomThemes.length
          )
        ];

      console.log(
        "SAFETY QUERY:",
        randomQuery
      );

      const safetyFetch =
        await fetch(

          `https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(randomQuery)}&api_key=${process.env.SERPAPI_KEY}`

        );

      const safetyRes =
        await safetyFetch.json();

      console.log(
        "SAFETY IMAGE COUNT:",
        safetyRes?.images_results?.length
      );

      starterImage =

        safetyRes
          ?.images_results?.[
            Math.floor(
              Math.min(
                5,
                safetyRes?.images_results?.length || 1
              ) * Math.random()
            )
          ]
          ?.original ||

        safetyRes
          ?.images_results?.[
            Math.floor(
              Math.min(
                5,
                safetyRes?.images_results?.length || 1
              ) * Math.random()
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
    "starter room AI failed",
    err
  );
}

//////////////////////////////////////////////////
// TRUE FINAL FALLBACK
//////////////////////////////////////////////////

if(!starterImage){

  starterImage =
    "https://picsum.photos/900/1200?random=" +
    Math.floor(Math.random()*100000);
}

//////////////////////////////////////////////////
// STARTER SHARE TEXT
//////////////////////////////////////////////////

const starterShareRes =
  await openai.chat.completions.create({

  model:"gpt-4o-mini",

  messages:[

    {
      role:"system",

      content:`
Create ONE short social-media-ready share caption.

The caption should feel:
- emotionally reactive
- internet native
- socially addictive
- current
- viral

Rules:
- 1 sentence only
- lowercase preferred
- no hashtags
- no markdown
- max 16 words
- feel repostable
`
    },

    {
      role:"user",

      content:`
Mood:
${starterMood}

Trend:
${starterNewsTitle}

Image personality:
${user.imageContext}
`
    }
  ]
});

const starterShareText =
  starterShareRes
    .choices[0]
    .message
    .content
    .trim();

//////////////////////////////////////////////////
// PUSH FIRST MESSAGE
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// PUSH FIRST MESSAGE
//////////////////////////////////////////////////

let starterTitle =
  starterNewsItem?.title ||
  starterNewsTitle;

let starterLink =
  starterNewsItem?.link ||
  starterNewsItem?.news_link;

if(
  !starterLink ||
  !starterLink.startsWith("http")
){

  starterLink =
    "https://google.com/search?q=" +
    encodeURIComponent(starterTitle);

}

rooms[roomId].messages.push({

  from:"Image AI",

  image:starterImage,

  mood:starterMood,

  ask:starterTitle,

  shareText:starterShareText,

  link:starterLink

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

//////////////////////////////////////////////////
// V5.5 EMOTIONAL EVOLUTION
//////////////////////////////////////////////////

const lowerText =
  text.toLowerCase();

//////////////////////////////////////////////////
// HYPE
//////////////////////////////////////////////////

if(

  lowerText.includes("crazy") ||
  lowerText.includes("viral") ||
  lowerText.includes("fire") ||
  lowerText.includes("insane")

){

  room.emotionalProfile.hype += 0.1;

}

//////////////////////////////////////////////////
// ANXIETY
//////////////////////////////////////////////////

if(

  lowerText.includes("scared") ||
  lowerText.includes("stress") ||
  lowerText.includes("worried") ||
  lowerText.includes("anxiety")

){

  room.emotionalProfile.anxiety += 0.1;

}

//////////////////////////////////////////////////
// LONELINESS
//////////////////////////////////////////////////

if(

  lowerText.includes("alone") ||
  lowerText.includes("lonely") ||
  lowerText.includes("empty")

){

  room.emotionalProfile.loneliness += 0.1;

}

//////////////////////////////////////////////////
// CONFIDENCE
//////////////////////////////////////////////////

if(

  lowerText.includes("power") ||
  lowerText.includes("winning") ||
  lowerText.includes("confident")

){

  room.emotionalProfile.confidence += 0.1;

}

//////////////////////////////////////////////////
// CELEBRITY FIXATION
//////////////////////////////////////////////////

if(

  lowerText.includes("celebrity") ||
  lowerText.includes("famous") ||
  lowerText.includes("idol")

){

  room.emotionalProfile.celebrityFixation += 0.1;

}

//////////////////////////////////////////////////
// CLAMP VALUES
//////////////////////////////////////////////////

Object.keys(
  room.emotionalProfile
).forEach(key => {

  room.emotionalProfile[key] =
    Math.max(
      0,
      Math.min(
        1,
        room.emotionalProfile[key]
      )
    );

});

console.log(
  "ROOM EMOTIONS:",
  room.emotionalProfile
);

    
    room.messages.push({

      from:user.email,

      text
    });
//////////////////////////////////////////////////
// LIMIT FEED SIZE
//////////////////////////////////////////////////

if(room.messages.length > 30){

  room.messages =
    room.messages.slice(-30);

}

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
// GPT CREATES TRENDING NEWS SEARCH
//////////////////////////////////////////////////

const emotionRes =
  await openai.chat.completions.create({

  model:"gpt-4o-mini",

  messages:[

    {
      role:"system",

      content:`
Create ONE trending CURRENT NEWS image search phrase.

IMPORTANT:
The search MUST still match the uploaded image AI personality.

The room is:
- personality-driven
- internet-native
- socially reactive
- emotionally evolving

The AI personality controls:
- trend taste
- celebrity focus
- emotional tone
- internet vibe
- cultural direction

NEVER repeat:
- previous searches
- previous moods
- previous trend situations
- previous viral atmosphere

Focus ONLY on trends DIRECTLY connected to the uploaded image identity.

The search MUST visually and semantically match:
- the objects
- the environment
- the emotional presence
- the product category
- the lifestyle category
- the aesthetic direction

If the image is:
- fashion → search fashion trends
- food → search food trends
- books → search learning/book trends
- fitness → search fitness trends
- technology → search tech trends
- sneakers → search sneaker trends

NEVER jump to unrelated celebrity or TikTok drama unless the uploaded image itself suggests that category.

The result should feel:
- current
- visually strong
- internet-native
- culturally alive
- socially relevant
- emotionally aligned with the uploaded image identity

The uploaded image personality
must guide the emotional and cultural direction.

IMPORTANT:
Use REAL searchable public news entities.

GOOD:
taylor swift grammys
elon musk tesla
openai sora launch
nike nba deal
coachella crowd
kanye west controversy
met gala fashion
apple vision pro

BAD:
internet loneliness
digital pressure
modern emotions

Rules:
- 3 to 8 words
- lowercase only
- no punctuation
- visually searchable
- current-news energy only
- no philosophy
- no abstract concepts
- no repetition

The uploaded image personality MUST shape the trend direction.
`
    },

    {
      role:"user",

      content:`
Uploaded image AI personality:

${room.imageContext}

Current room emotional profile:

${JSON.stringify(
  room.emotionalProfile,
  null,
  2
)}

Trend personality category:

${room.coreTheme}

Previous trend history:

${room.emotionalState.join("\n")}

Used searches:

${room.usedSearches.join("\n")}

Used moods:

${room.usedMoods.join("\n")}

Used reactions:

${room.usedQuestions.join("\n")}

Current user reaction:

${text}

Create a NEW trending CURRENT NEWS image search phrase.

IMPORTANT:
The search MUST still feel connected to the uploaded image personality.

The room should evolve like:
- a live internet feed
- social media culture
- trending reactions
- viral news energy
- celebrity/internet momentum
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
  
  console.log(
  "LOOP SEARCH:",
  searchQuery
);

console.log(
  "LOOP NEWS COUNT:",
  serpRes?.news_results?.length
);

//////////////////////////////////////////////////
// BETTER REAL NEWS IMAGE PICKER
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// V5.4.2 INTERNET REACTION EVALUATION
//////////////////////////////////////////////////

let imageUrl = null;

let selectedNews =
  null;

const newsResults =
  serpRes?.news_results || [];

//////////////////////////////////////////////////
// FILTER VALID INTERNET REACTIONS
//////////////////////////////////////////////////

const validNews =
  newsResults.filter(item => {

    const possibleImage =
      item.thumbnail ||
      item.thumbnail_small;

    return (

      possibleImage &&

      item.title &&

      !possibleImage.includes("logo") &&
      !possibleImage.includes("icon") &&
      !possibleImage.includes("placeholder") &&
      !possibleImage.includes("default") &&
      !possibleImage.includes("avatar")

    );

  });

//////////////////////////////////////////////////
// AI EVALUATES INTERNET ENERGY
//////////////////////////////////////////////////

if(validNews.length > 0){

  try{

    const evaluationRes =
      await openai.chat.completions.create({

      model:"gpt-4o-mini",

      temperature:0.7,

      messages:[
        {
          role:"system",
          content:`
You are evaluating internet reactions.

Choose the MOST emotionally powerful result.

Prioritize:
- emotional intensity
- internet virality
- visual energy
- social momentum
- emotional alignment
- internet-native feeling

The result MUST:
- emotionally match the image personality
- feel culturally alive
- feel socially addictive

Return ONLY the exact title.
`
        },
        {
          role:"user",
          content:`
Image personality:
${room.imageContext}

Current emotional state:
${room.emotionalState.join("\n")}

Current user reaction:
${text}

Candidate internet reactions:
${validNews.map(
  n => n.title
).join("\n")}
`
        }
      ]
    });

    const chosenTitle =
      evaluationRes
        .choices[0]
        .message
        .content
        .trim();

    //////////////////////////////////////////////////
    // MATCH CHOSEN RESULT
    //////////////////////////////////////////////////

    selectedNews =
      validNews.find(item =>
        item.title
          .toLowerCase()
          .includes(
            chosenTitle.toLowerCase()
          )
      );

    //////////////////////////////////////////////////
    // SAFETY FALLBACK
    //////////////////////////////////////////////////

    if(!selectedNews){

      selectedNews =
        validNews[0];

    }

    imageUrl =
      selectedNews.thumbnail ||
      selectedNews.thumbnail_small;

    console.log(
      "AI INTERNET CHOICE:",
      selectedNews.title
    );

  }catch(err){

    console.log(
      "internet evaluation failed",
      err
    );

    //////////////////////////////////////////////////
    // FALLBACK
    //////////////////////////////////////////////////

    selectedNews =
      validNews[0];

    imageUrl =
      selectedNews.thumbnail ||
      selectedNews.thumbnail_small;

  }

}

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
Create ONE evolving internet vibe.

The vibe should feel:
- viral
- socially addictive
- internet-native
- culturally current
- emotionally reactive

Examples:

main character
internet pressure
celebrity chaos
viral energy
late night scrolling
digital fame
timeline exploding

Rules:
- lowercase only
- no punctuation
- 1 to 3 words
- modern internet culture only
- no philosophy
`
    },

    {
      role:"user",

      content:`
Uploaded image AI personality:

${room.imageContext}

Current emotional profile:

${JSON.stringify(
  room.emotionalProfile,
  null,
  2
)}

Used moods:

${room.usedMoods.join("\n")}

Search phrase:

${searchQuery}

Current user response:

${text}

Create ONE evolving internet vibe.

The vibe should feel:
- emotionally reactive
- internet-native
- socially addictive
- culturally current
- emotionally aligned with the room state

The mood should evolve from:
- the room emotional profile
- the current internet atmosphere
- the current user reaction
- the current search direction

Avoid repeating previous moods.
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
Create ONE trending social reaction line.

The line should feel:
- viral
- socially reactive
- internet-native
- emotionally engaging
- culturally current

Rules:
- lowercase only
- no punctuation
- 2 to 7 words
- no philosophy
- no existential tone
- feel like live internet culture
`
    },

    {
      role:"user",

      content:`
Uploaded image AI personality:

${room.imageContext}

Current emotional profile:

${JSON.stringify(
  room.emotionalProfile,
  null,
  2
)}

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

Create a NEW trending social reaction line.
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

//////////////////////////////////////////////////
// 5.3 REAL NEWS TITLE MATCHED TO IMAGE
//////////////////////////////////////////////////
//////////////////////////////////////////////////
// V5.4.2 EMOTIONALLY CHOSEN TITLE
//////////////////////////////////////////////////

let newsTitle =
  selectedNews?.title ||
  nextQuestion;

//////////////////////////////////////////////////
// SHARE TEXT
//////////////////////////////////////////////////

const shareRes =
  await openai.chat.completions.create({

  model:"gpt-4o-mini",

  messages:[

    {
      role:"system",

      content:`
Create ONE short social-media-ready share caption.

The caption should feel:
- emotionally reactive
- internet native
- socially addictive
- current
- viral

Rules:
- 1 sentence only
- lowercase preferred
- no hashtags
- no markdown
- max 16 words
- feel repostable
`
    },

    {
      role:"user",

      content:`
Mood:
${moodText}

Trend:
${newsTitle}

Image personality:
${room.imageContext}
`
    }
  ]
});

const shareText =
  shareRes
    .choices[0]
    .message
    .content
    .trim();

//////////////////////////////////////////////////
// PUSH IMAGE + REAL TITLE
//////////////////////////////////////////////////

room.messages.push({

  from:"Image AI",

  image:imageUrl,

  mood:moodText,

  ask:newsTitle,

  shareText,

  link:
  selectedNews?.link ||
  selectedNews?.news_link ||
  ""

});

//////////////////////////////////////////////////
// LIMIT FEED SIZE
//////////////////////////////////////////////////

if(room.messages.length > 30){

  room.messages =
    room.messages.slice(-30);

}

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
//////////////////////////////////////////////////
// LIMIT FEED SIZE
//////////////////////////////////////////////////

if(room.messages.length > 30){

  room.messages =
    room.messages.slice(-30);

}

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
    "CONNECTAING V5.5 running"
  );
});
