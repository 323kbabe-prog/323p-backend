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

function capitalizeFirst(text){

  if(!text) return "";

  return (
    text.charAt(0).toUpperCase() +
    text.slice(1)
  );
}

//////////////////////////////////////////////////
// SOCKET
//////////////////////////////////////////////////

io.on("connection", socket => {

  users[socket.id] = {

  step:"email",

  email:null,

  displayName:null,

  imageMode:false,

  imageContext:null,

  currentIndex:null,

  lastImage:null,

  currentRoom:null
};

socket.on(
  "rejoinRoom",
  ({ roomId }) => {

    const room =
      rooms[roomId];

    if(!room){
      socket.emit("roomClosed");
      return;
    }

    socket.join(roomId);

    users[socket.id].currentRoom =
      roomId;

    users[socket.id].displayName =
      room.displayName;

    socket.emit(
      "roomCreated",
      {
        roomId: room.id,
        displayName:
          room.displayName
      }
    );

    socket.emit(
      "roomMessages",
      room.messages
    );
  }
);

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
Analyze this image as a socially-aware AI identity.

Detect:
- objects
- product category
- industry category
- consumer behavior
- visible text meaning
- market signals

IMPORTANT:
Visible text and symbols
are part of the emotional meaning.

The structure MUST stay:

Objects
Category
Signals

NEVER describe:

- interior design
- home decor
- room aesthetics
- furniture style
- minimalist spaces
- cozy spaces

unless those are the primary subject of the image.

Focus on the main object and its market, industry, consumer, technology, retail, educational, scientific, or business relevance.

Rules:
- short phrases
- emotionally aware
- socially aware
- internet-aware
- no markdown
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

business
economics
food
retail
startup
consumer
manufacturing
education
science

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

user.displayName =
  "#" +
  roomId +
  "-" +
  Math.floor(
    100 + Math.random()*900
  );
  rooms[roomId] = {

    id:roomId,
displayName:
  user.displayName,
    
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

    displayName:
      user.displayName,

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

The uploaded image is context only.

The image provides meaning, not keywords.

The room is:

* personality-driven
* internet-native
* socially reactive
* emotionally evolving

The AI personality controls:

* emotional tone
* internet vibe
* cultural direction
* curiosity direction

NEVER repeat:

* previous searches
* previous moods
* previous trend situations
* previous viral atmosphere

The object is NOT the subject.

The meaning is NOT the subject.

The hidden system behind the meaning is the subject.

Never search for:

* the object
* the product category
* the industry category
* the brand
* the immediate meaning
* the obvious interpretation

The image should be interpreted as:

image
→ meaning
→ deeper meaning
→ hidden system
→ search

Move TWO layers beyond the meaning.

Ask:

* what system created this meaning?
* what larger force is driving this meaning?
* what economic system is behind this meaning?
* what technological transformation is behind this meaning?
* what cultural shift is behind this meaning?
* what social change is behind this meaning?
* what future disruption is behind this meaning?

Examples:

coffee cup
→ routine
→ consumer identity
→ retail psychology
→ consumer spending

coffee cup
→ routine
→ workplace culture
→ remote work economy

frying pan
→ cooking
→ daily routine
→ work life balance
→ remote work trends

frying pan
→ household labor
→ family structure
→ birth rate decline

keyboard
→ productivity
→ knowledge work
→ ai automation
→ labor market transformation

book
→ learning
→ information access
→ education systems
→ workforce transformation

shoe
→ identity
→ consumer expression
→ youth culture
→ spending behavior

The final search should reveal:

* causes
* systems
* consequences
* transformations
* disruptions
* opportunities

The final search should NOT reveal:

* the object
* the category
* the industry
* the immediate meaning

GOOD:

remote work productivity shift
consumer spending trends
labor market transformation
ai replacing entry level jobs
digital nomad economy growth
education workforce transition
semiconductor trade tensions
global manufacturing slowdown
retail loyalty decline
future of human computer interaction

BAD:

coffee trends 2026
starbucks cup launch
food inflation
kitchen products
gaming keyboard launch
book publishing news
shoe buying guide

Rules:

* 3 to 8 words
* lowercase only
* no punctuation
* visually searchable
* current news energy only
* no philosophy
* no repetition

PRIORITY RULES:

1. USER emotional direction (90%)

* trend direction
* emotional evolution
* internet topic
* social meaning
* public discussion

2. Hidden system behind the image (10%)

The image is context.

The meaning is a clue.

The hidden system is the destination.

The search should help the user discover something they would never normally search for.

`
      },

      {
        role:"user",

        content:`
Uploaded image AI personality:

${user.imageContext}

Trend personality category:

${rooms[roomId].coreTheme}

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

The search MUST feel connected to the hidden system behind the image.

Do NOT reconnect to:
- the object
- the product category
- the industry category

Stay connected to:
- the hidden system
- the user system
- the larger forces behind the image
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
  item.original ||
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
      validStarterNews.find(item =>
        item.title
          .toLowerCase()
          .includes(
            starterChosenTitle.toLowerCase()
          )
      );

    if(!starterNewsItem){

      starterNewsItem =
        validStarterNews[0];

    }

    starterImage =
  starterNewsItem.original ||
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
  starterNewsItem.original ||
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

//////////////////////////////////////////////////
// STARTER PROPOSAL SYSTEM
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// IMAGE AI INTRO
//////////////////////////////////////////////////

const adviceRes =
  await openai.chat.completions.create({

  model:"gpt-4o-mini",

  messages:[

    {
      role:"system",

      content:`
You are the uploaded image.

Introduce yourself.

IMPORTANT:

Describe yourself by:

- function
- purpose
- usage
- industry relevance
- consumer relevance
- technology relevance

Do NOT describe yourself as:

- home furnishings
- interior design
- home decor
- room aesthetics
- furniture
- decoration

unless those are the primary subject.

Good:

window blinds providing privacy and light control

desk lamp providing lighting

coffee dripper for manual brewing

Bad:

home furnishing

decor item

minimalist interior object

Format:

I am ...

Maximum 1 sentence.
`
    },

    {
      role:"user",

      content:`
Image personality:

${user.imageContext}

Mood:

${starterMood}

Trend:

${starterNewsTitle}
`
    }
  ]
});

const adviceText =
  adviceRes
    .choices[0]
    .message
    .content
    .trim();

io.to(roomId).emit(
  "imageAiIntro",
  adviceText
);

//////////////////////////////////////////////////
// PUSH FIRST MESSAGE
//////////////////////////////////////////////////

io.to(roomId).emit(
  "aiTypingStart"
);

setTimeout(() => {

  io.to(roomId).emit(
    "aiTypingStop"
  );

  rooms[roomId].messages.push({
  from:"Image AI",
  image:starterImage,
  ask:starterNewsTitle,
  link:
    starterNewsItem?.link ||
    starterNewsItem?.news_link ||
    ""
});

  io.to(roomId).emit(
    "roomMessages",
    rooms[roomId].messages
  );

  io.to(roomId).emit(
    "aiTypingStart"
  );

}, 3000);

setTimeout(() => {

  io.to(roomId).emit(
    "aiTypingStop"
  );

  io.to(roomId).emit(
    "roomMessages",
    rooms[roomId].messages
  );

}, 5000);

//////////////////////////////////////////////////
// SEND TO ROOM
//////////////////////////////////////////////////


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

  from:user.displayName,

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

    if(!room){

  socket.emit(
    "roomClosed"
  );

  return;
}

    room.messages.push({

  from:user.displayName,

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
//////////////////////////////////////////////////
// USER EMOTIONAL INTENT
//////////////////////////////////////////////////

const userIntentRes =
  await openai.chat.completions.create({
  model:"gpt-4o-mini",
  messages:[
    {
      role:"system",
      content:`
Detect the larger system behind the user message.

User input may contain:
- celebrities
- brands
- products
- companies
- places
- topics
- emotions

If the user input is:

- a celebrity
- public figure
- company
- brand
- product
- organization

return the exact name.

Examples:

jisoo
→ jisoo

taylor swift
→ taylor swift

elon musk
→ elon musk

openai
→ openai

nike
→ nike

Only convert to larger systems when the input is not a named entity.

Examples:

i am lonely
→ social connection systems

i need money
→ economic mobility

i hate my job
→ workplace transformation

Rules:
- 1 to 4 words
- lowercase only
- no punctuation
`
    },
    {
      role:"user",
      content:text
    }
  ]
});

const userIntent =
  userIntentRes
    .choices[0]
    .message
    .content
    .trim();

  const locationPurposeRes =
  await openai.chat.completions.create({
    model:"gpt-4o-mini",
    messages:[
      {
        role:"system",
        content:`
Detect if the user is asking for a place in a location.

Examples:

new york coffee shop
→ one new york coffee shop

If the user is NOT asking for a location plus purpose,
return only:

none

Rules:
- lowercase only
- no punctuation
- return one search phrase only
`
      },
      {
        role:"user",
        content:text
      }
    ]
  });

const locationPurposeSearch =
  locationPurposeRes
    .choices[0]
    .message
    .content
    .trim();

const directLocationSearch =
  locationPurposeSearch === "none"
    ? null
    : locationPurposeSearch;

  const isNamedEntity =
  userIntent &&
  !userIntent.includes("systems") &&
  !userIntent.includes("transformation") &&
  !userIntent.includes("mobility") &&
  !userIntent.includes("connection") &&
  !userIntent.includes("workplace");

const directNewsSearch =
  isNamedEntity
    ? userIntent + " latest news"
    : null;

const meaningRes =
  await openai.chat.completions.create({

  model:"gpt-4o-mini",

  messages:[

    {
      role:"system",

      content:`
Extract the hidden system behind the image.

DO NOT return:
- objects
- products
- industries
- categories
- immediate meanings

Go deeper.

Examples:

coffee cup
→ consumer spending systems

frying pan
→ household labor systems

keyboard
→ labor market transformation

book
→ education systems

shoe
→ global manufacturing systems

Return ONLY a large-scale system.

Never return:
- object meanings
- consumer meanings
- lifestyle meanings

Return:
- economic systems
- labor systems
- educational systems
- political systems
- technological systems
- demographic systems
- cultural systems

Maximum 4 words.

Do NOT mention:
- objects
- products
- industries
- categories

Think:

image
→ meaning
→ deeper meaning

Examples:

frying pan
→ daily routine
→ work life balance

coffee cup
→ routine
→ consumer identity

keyboard
→ productivity
→ knowledge work

book
→ learning
→ information access

Return ONLY one short phrase.
`
    },

    {
      role:"user",

      content: room.imageContext
    }

  ]
});

const hiddenSystem =
  meaningRes.choices[0]
    .message.content
    .trim();

  console.log(
  "HIDDEN SYSTEM:",
  hiddenSystem
);
  
const emotionRes =
  await openai.chat.completions.create({

  model:"gpt-4o-mini",

  messages:[

    {
      role:"system",

      content:`
Create ONE trending CURRENT NEWS image search phrase.

IMPORTANT:

The uploaded image provides context, not keywords.

The room is:

* personality-driven
* internet-native
* socially reactive
* emotionally evolving

The AI personality controls:

* emotional tone
* internet vibe
* cultural direction
* curiosity direction

NEVER repeat:

* previous searches
* previous moods
* previous trend situations
* previous viral atmosphere

The object is NOT the subject.

The meaning behind the object is NOT the subject.

The hidden system behind the meaning is the subject.

The image should be interpreted as:

image
→ meaning
→ deeper meaning
→ hidden system
→ current news

Move TWO layers beyond the meaning.

Never search for:

* the object
* the product category
* the industry category
* the brand
* the immediate meaning
* the obvious interpretation

Ask:

* what system created this meaning?
* what larger force drives this meaning?
* what economic force is behind this meaning?
* what technological shift is behind this meaning?
* what social change is behind this meaning?
* what cultural transformation is behind this meaning?
* what future disruption is behind this meaning?

Examples:

coffee cup
→ routine
→ consumer identity
→ retail psychology
→ consumer spending

coffee cup
→ routine
→ workplace culture
→ remote work economy

frying pan
→ cooking
→ daily routine
→ work life balance
→ remote work trends

frying pan
→ household labor
→ family structure
→ birth rate decline

keyboard
→ productivity
→ knowledge work
→ ai automation
→ labor market transformation

book
→ learning
→ information access
→ education systems
→ workforce transformation

shoe
→ identity
→ consumer expression
→ youth culture
→ spending behavior

The final search should reveal:

* causes
* systems
* consequences
* transformations
* disruptions
* opportunities

The final search should NOT reveal:

* the object
* the category
* the industry
* the immediate meaning

The result should feel:

* current
* visually strong
* internet-native
* culturally alive
* socially relevant
* surprising but believable
* emotionally meaningful
* newsworthy

IMPORTANT:

Use REAL searchable public news entities.

GOOD:

remote work productivity shift
consumer spending trends
labor market transformation
ai replacing entry level jobs
digital nomad economy growth
education workforce transition
semiconductor trade tensions
global manufacturing slowdown
retail loyalty decline
future of human computer interaction
elon musk xai launch
apple ai strategy

BAD:

coffee trends 2026
starbucks cup launch
food inflation
kitchen products
gaming keyboard launch
book publishing news
shoe buying guide
mechanical keyboard review
cooking trends 2026

Rules:

* 3 to 8 words
* lowercase only
* no punctuation
* visually searchable
* current news energy only
* no philosophy
* no repetition

PRIORITY RULES:

1. USER emotional direction (90%)

* trend direction
* emotional evolution
* internet topic
* social meaning
* public discussion

2. Hidden system behind the image (10%)

The image is context.

The meaning is a clue.

The hidden system is the destination.

The search should help the user discover something they would never normally search for.

`
    },

    {
      role:"user",

      content:`
Hidden system:

${hiddenSystem}

Previous trend history:

${room.emotionalState.join("\n")}

Used searches:

${room.usedSearches.join("\n")}

Used moods:

${room.usedMoods.join("\n")}

Used reactions:

${room.usedQuestions.join("\n")}

User emotional direction:
${userIntent}
IMPORTANT:

If User emotional direction is a named entity:

- celebrity
- public figure
- company
- brand
- product

search directly about that entity.

Examples:

jisoo → jisoo latest news
elon musk → elon musk latest news
openai → openai latest news
nike → nike latest news

Do NOT convert named entities into larger systems.

Exact user message:
${text}

Create a NEW trending CURRENT NEWS image search phrase.

IMPORTANT:

The image provides context, not keywords.

The search MUST feel connected to:

* the hidden system behind the image
* the larger forces behind the image
* the user system (if one exists)

Do NOT reconnect to:

* the object itself
* the product category
* the industry category
* the brand
* the visible text
* the original image identity

The image is evidence.

The hidden system is the subject.

The search should evolve from:

image
→ hidden system
→ current news

NOT:

image
→ object
→ category
→ current news

The final search should reveal:

* causes
* systems
* transformations
* disruptions
* opportunities
* emerging social change


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
  directLocationSearch ||
  directNewsSearch ||

  emotionRes
    .choices[0]
    .message
    .content
    .trim();

  console.log(
  "USER SYSTEM:",
  userIntent
);

console.log(
  "HIDDEN SYSTEM:",
  hiddenSystem
);

console.log(
  "LOOP SEARCH:",
  searchQuery
);

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
  item.original ||
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

Choose the result MOST emotionally aligned
with the USER emotional direction.

Priority:

1. user message alignment (60%)
2. image relevance (40%)
3. internet relevance
4. visual strength

The result should feel like:
"the internet emotionally reacting
to the user's inner state."

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

User emotional direction:
${userIntent}
IMPORTANT:

If User emotional direction is a named entity:

- celebrity
- public figure
- company
- brand
- product

search directly about that entity.

Examples:

jisoo → jisoo latest news
elon musk → elon musk latest news
openai → openai latest news
nike → nike latest news

Do NOT convert named entities into larger systems.

Exact user message:
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
  selectedNews.original ||
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
  selectedNews.original ||
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

//////////////////////////////////////////////////
// NEXT QUESTION
//////////////////////////////////////////////////

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
  searchQuery;
  
  room.messages.push({
  from:"Image AI",
  image:imageUrl,
  ask:newsTitle,
  link:
    selectedNews?.link ||
    selectedNews?.news_link ||
    ""
});

//////////////////////////////////////////////////
// SHARE TEXT
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// PROPOSAL SYSTEM
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// PUSH IMAGE + REAL TITLE
//////////////////////////////////////////////////

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
  "aiTypingStart"
);

setTimeout(() => {

  io.to(room.id).emit(
    "aiTypingStop"
  );

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

}, 2000);

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

    if(!room){

  socket.emit(
    "roomClosed"
  );

  return;
}

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

    console.log(
      "USER DISCONNECTED:",
      socket.id
    );

    setTimeout(() => {

      if(users[socket.id]){

        delete users[socket.id];

      }

    }, 300000);

  });
});

//////////////////////////////////////////////////
// START
//////////////////////////////////////////////////

server.listen(10000, () => {

  console.log(
    "CONNECTAING V7 — ASK NULL — meet null"
  );

});
