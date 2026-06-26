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
  apiKey: process.env.OPENAI_API_KEY,
  fetch: fetch
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

const dailyNullCategories = [
  "AI",
  "Technology",
  "Business",
  "Economics",
  "Politics",
  "Culture",
  "Music",
  "Celebrity",
  "Sports",
  "Internet"
];

let dailyNulls = [];
let dailyNullsUpdatedAt = null;

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


async function generateDailyNulls(){

    console.log(
    "GENERATING DAILY NULLS:",
    new Date().toISOString()
  );

  const cards = [];
const usedIdentities = [];
  for(const category of dailyNullCategories){

    try{

      const identityRes =
        await openai.chat.completions.create({
          model:"gpt-4o-mini",
          messages:[
           {
  role:"system",
  content:`
Create one Ask Null identity for this category.

Return JSON only:
{
  "identity":"",
  "intro":""
}

Rules:
- identity: 2 to 4 words
- intro: exactly 1 short sentence
- intro should explain why this signal matters
- 8 to 15 words
- hook
- shocking
- internet-native
- emotionally engaging

IMPORTANT:

Already used identities are forbidden.

Do not repeat:
- words
- themes
- metaphors
- emotional tones
- concepts

Every identity must feel like a completely different internet phenomenon.

- no markdown
`
},
           {
  role:"user",
  content:`

Category:
${category}

Already used identities:

${usedIdentities.join("\n")}

Create ONE identity that is clearly different from all identities above.

`
}
          ]
        });

     let identityData = {
  identity: category,
  intro: "Exploring today's signals."
};

try{
  identityData =
    JSON.parse(
      identityRes.choices[0].message.content
    );

usedIdentities.push(
  identityData.identity
);
  
}catch(err){
  console.log(
    "daily null json failed",
    err
  );
}

const searchRes =
  await openai.chat.completions.create({

    model:"gpt-4o-mini",

    messages:[

      {
        role:"system",

        content:`
Create ONE surprising current news search.

The search should feel:

- unexpected
- internet-native
- emotionally engaging
- culturally current
- newsworthy

Rules:

- 3 to 6 words
- lowercase only
- no punctuation
- real searchable news topics
`
      },

      {
        role:"user",

        content:`

Category:
${category}

Null Identity:
${identityData.identity}

Intro:
${identityData.intro}

Create ONE search phrase.

`
      }

    ]

  });

const searchQuery =

  searchRes
    .choices[0]
    .message
    .content
    .trim();

console.log(
  "DAILY NULL SEARCH:",
  category,
  searchQuery
);

const newsFetch =
  await fetch(
    `https://serpapi.com/search.json?engine=google&tbm=nws&tbs=qdr:d3&q=${encodeURIComponent(searchQuery)}&api_key=${process.env.SERPAPI_KEY}`
  );

      const newsRes =
        await newsFetch.json();

let newsItem =
  newsRes?.news_results?.find(item =>
    item.title &&
    (
      item.link ||
      item.news_link
    )
  );

if(!newsItem){

  const fallbackSearch = category + " news";

  const fallbackFetch =
    await fetch(
      `https://serpapi.com/search.json?engine=google&tbm=nws&tbs=qdr:d3&q=${encodeURIComponent(fallbackSearch)}&api_key=${process.env.SERPAPI_KEY}`
    );

  const fallbackRes =
    await fallbackFetch.json();

  newsItem =
    fallbackRes?.news_results?.find(
      item =>
        item.title &&
        (
          item.link ||
          item.news_link
        )
    );

}

      if(!newsItem){
  continue;
}

    cards.push({

  category,

  identity:identityData.identity,

  intro:identityData.intro,

title:
  newsItem.title,

image:
  newsItem.original ||
  newsItem.thumbnail ||
  newsItem.thumbnail_small ||
  null,

link:
  newsItem.link ||
  newsItem.news_link

});

    }catch(err){

      console.log(
        "daily null failed:",
        category,
        err
      );

    }
  }

  dailyNulls = cards;
  console.log(
  "Daily Null Categories:",
  cards.map(x => x.category)
);
  dailyNullsUpdatedAt =
    new Date().toISOString();

  console.log(
    "DAILY NULLS UPDATED:",
    dailyNulls.length
  );
}

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

io.to(room.id).emit(
  "roomMessages",
  room.messages
);

setTimeout(() => {
  io.to(room.id).emit("aiTypingStop");
}, 50);
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

    memory:[],
    
    usedPlaceTopic:null,
      
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
if(true){

io.to(roomId).emit(
  "aiTypingStart"
);

(async () => {

try{

  //////////////////////////////////////////////////
// STARTER QUESTION
//////////////////////////////////////////////////

const hiddenSystemRes =
  await openai.chat.completions.create({

    model:"gpt-4o-mini",

    messages:[

      {
        role:"system",
        content:`
Extract the hidden system behind the image.

Return ONLY one short phrase.
`
      },

      {
        role:"user",
        content:user.imageContext
      }
    ]
  });

const starterQuestion =
  hiddenSystemRes
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

let starterNewsTitle = "";

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
Create ONE current news search phrase.

The hidden system behind the image is the subject.

Ignore:

* the object
* the product
* the category
* the industry
* visible text
* brands

Think:

image
→ meaning
→ deeper meaning
→ hidden system
→ current news

Search ONLY from the hidden system.

Return ONLY the search phrase.

Rules:

* 3 to 8 words
* lowercase only
* no punctuation
* current news only
* no object names
* no product names
* no brand names
  `
},


     {
  role:"user",

  content:`
Hidden system:

${starterQuestion}
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

  if(validStarterNews.length === 0){
  return;
}

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

  }catch(err){

  console.log(
    "starter room AI failed",
    err
  );
}

//////////////////////////////////////////////////
// STARTER SHARE TEXT
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
/*
io.to(roomId).emit(
  "aiTypingStart"
);

setTimeout(() => {

  io.to(roomId).emit(
    "aiTypingStop"
  );

rooms[roomId].messages.push({

  from:"NULL",

  aiBeing:true,
  showNextButton: true,

  searchLabel:
    "NULL Search",

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
*/
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

}

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

      const isNextSearch =
  text.trim().toLowerCase() === "null feed";

      if (isNextSearch) {

  room.messages.forEach(m => {
    m.showNextButton = false;
  });

}
      
if(!room){

  socket.emit(
    "roomClosed"
  );

  return;
}

if(
  text.trim().toLowerCase() !== "null feed"
){

 

  if(room.memory.length > 10){

    room.memory =
      room.memory.slice(-10);

  }

}


//////////////////////////////////////////////////
// LIMIT FEED SIZE
//////////////////////////////////////////////////

if(room.messages.length > 30){

  room.messages =
    room.messages.slice(-30);

}


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
const combinedIntentRes =
  await openai.chat.completions.create({

    model:"gpt-4o-mini",

    messages:[

      {
        role:"system",
        content:`
Combine the conversation memory
and current message.

Return the user's complete intent.

Examples:

Memory:
I want the best coffee shop

Current:
In New York

Return:
best coffee shop in new york

Memory:
I want ramen

Current:
In Shibuya

Return:
best ramen in shibuya

Memory:
I want a cool bar

Current:
Tonight

Return:
cool bar tonight
`
      },

      {
        role:"user",
        content:`

Memory:

${room.memory.join("\n")}

Current:

${text}

`
      }

    ]

});

const combinedIntent =
  combinedIntentRes
    .choices[0]
    .message
    .content
    .trim();

  const greetingRes =
  await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `
Return ONLY one word:

greeting

or

intent

IMPORTANT:

If the user message is:
- null feed

Always return:

intent

Determine the user's primary purpose.

Return "greeting" if the user is primarily interacting with Ask Null itself, such as:
- starting or maintaining casual conversation
- greeting or thanking the AI
- testing whether the AI responds
- asking who Ask Null is
- asking what Ask Null is
- asking what Ask Null can do
- asking what Ask Null is doing
- asking how to use Ask Null
- asking why Ask Null exists
- asking about Ask Null's identity, purpose, or capabilities
- interacting with Ask Null without trying to discover external information or solve a problem

Return "intent" if the user is primarily trying to accomplish something, including:
- finding or searching for information
- exploring a topic
- discovering news
- getting recommendations
- asking about any person, company, product, place, event, or subject
- expressing a need, feeling, opinion, or goal
- asking for analysis, advice, explanations, or comparisons
- solving a problem
- making a decision
- learning about something beyond Ask Null itself

Focus on the user's overall purpose, not individual keywords.

Return exactly one word:

greeting

or

intent

`
      },
      {
        role: "user",
        content: combinedIntent
      }
    ]
  });

const inputType =
  greetingRes.choices[0]
    .message
    .content
    .trim()
    .toLowerCase();

  console.log("GREETING TYPE:", inputType);

  if (inputType === "greeting") {
    room.messages.push({
  from: user.displayName,
  text
});

room.messages.push({
  from: "NULL",
  aiBeing: true,
  showNextButton: true,
  searchLabel: "About Ask Null",
  text: "Ask Null is an experimental AGI contextual AI built on the Social Context Generating Model (SCGM) and the Chaos Feeling-Perception Model (CFM)."
});

  io.to(room.id).emit(
    "aiTypingStop"
  );

  io.to(room.id).emit(
    "roomMessages",
    room.messages
  );

  return;
}

  if(!isNextSearch){

  room.messages.push({

    from:user.displayName,

    text

  });

}

io.to(room.id).emit(
  "roomMessages",
  room.messages
);
  
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
     content: combinedIntent
    }
  ]
});

const userIntent =
  userIntentRes
    .choices[0]
    .message
    .content
    .trim();

  

console.log(
  "COMBINED INTENT:",
  combinedIntent
);
  
  const locationPurposeRes =
  await openai.chat.completions.create({
    model:"gpt-4o-mini",
    messages:[
      {
        role:"system",
       content:`
Detect whether the user wants a real place recommendation.

Examples:

new york bar
→ new york bar

best ramen in shibuya
→ shibuya ramen

where should i go in tokyo
→ tokyo place

i am in tokyo and want something unique
→ tokyo place

show me something very japanese in shibuya
→ shibuya place

i want to explore taipei tonight
→ taipei place

Rules:

If user wants:
- somewhere to go
- somewhere to visit
- somewhere to explore
- something new
- something local
- something unique
- something authentic

return:

location place

If user already specifies type:

shibuya ramen
taipei coffee shop
new york bar

keep the type.

Return only:
location place

or

none

lowercase only
no punctuation

`

      },
      {
        role:"user",
        content: combinedIntent
      }
    ]
  });

const locationPurposeSearch =

  locationPurposeRes
    .choices[0]
    .message
    .content
    .trim();

let directLocationSearch = null;

if(
  !isNextSearch &&
  locationPurposeSearch !== "none"
){

const parts =
locationPurposeSearch.split(" ");

parts.pop();

const location =
parts.join(" ");

directLocationSearch =
  location + " local news";
}

  const isNamedEntity =
  userIntent &&
  !userIntent.includes("systems") &&
  !userIntent.includes("transformation") &&
  !userIntent.includes("mobility") &&
  !userIntent.includes("connection") &&
  !userIntent.includes("workplace");

const directNewsSearch =

  !isNextSearch && isNamedEntity

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

  isNextSearch

  ? emotionRes
      .choices[0]
      .message
      .content
      .trim()

  : (

      directLocationSearch ||

      directNewsSearch ||

      emotionRes
        .choices[0]
        .message
        .content
        .trim()

    );

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

let selectedNews = null;

let placeName = null;

let placeLink = null;

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
You are evaluating news results.

If the user searched for a location and place type:

Examples:

new york coffee shop
seattle bar
taipei ramen

Priority:

1. identify the biggest local news or event
2. identify which result best represents that event
3. identify ONE real place that could be connected to that event

Never prioritize:

* coffee shop news
* bar news
* restaurant news
* rankings
* top 10 lists
* guides

Choose the result most useful for finding ONE real place related to the biggest current local event.

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

if(
  !isNextSearch &&
  locationPurposeSearch !== "none"
){

const placeQueryRes =
  await openai.chat.completions.create({

    model:"gpt-4o-mini",

    messages:[

      {
        role:"system",
        content:`
Given:

- a place type
- a city
- a local news event

Create a Google local search query
for ONE place connected to that event.

Examples:

new york coffee shop
knicks parade
→ coffee shop near knicks parade route

new york bar
world cup
→ sports bar showing world cup

Return ONLY the search query.
`
      },

      {
        role:"user",
        content:`
Search:
${locationPurposeSearch}

News:
${selectedNews?.title}
`
      }
    ]
  });

const placeQuery =
  placeQueryRes
    .choices[0]
    .message
    .content
    .trim();

console.log(
  "PLACE QUERY:",
  placeQuery
);

const placeSearchFetch =
  await fetch(

`https://serpapi.com/search.json?engine=google_local&q=${encodeURIComponent(placeQuery)}&api_key=${process.env.SERPAPI_KEY}`

  );

  const placeSearchRes =
    await placeSearchFetch.json();

  console.log(
  "PLACE RESULT:",
  JSON.stringify(
    placeSearchRes?.local_results?.[0],
    null,
    2
  )
);

console.log(
  "PLACE RESULT 2:",
  JSON.stringify(
    placeSearchRes?.places_results?.[0],
    null,
    2
  )
);

placeName =
  placeSearchRes?.local_results?.[0]?.title ||

  placeSearchRes?.places_results?.[0]?.title ||

  null;

placeLink =
  placeSearchRes?.local_results?.[0]?.website ||

  placeSearchRes?.local_results?.[0]?.link ||

  placeSearchRes?.places_results?.[0]?.website ||

  placeSearchRes?.places_results?.[0]?.link ||

  (
    placeName
      ? "https://www.google.com/maps/search/" +
        encodeURIComponent(placeName)
      : ""
  );

console.log(
  "PLACE LINK:",
  placeLink
);
}    
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
// FINAL FALLBACK
//////////////////////////////////////////////////
if(!imageUrl){
  imageUrl = null;
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

if(!selectedNews?.title){
  return;
}

let newsTitle =
  selectedNews.title;

  let placeStory = null;

  let repeatedPlace = false;

  const currentTopic =
  selectedNews?.title || "";
  
if(
  room.usedPlaceTopic === currentTopic
){
  repeatedPlace = true;
}else{
  room.usedPlaceTopic =
    currentTopic;
}
  
if(placeName){

  try{

    const placeStoryRes =
      await openai.chat.completions.create({

      model:"gpt-4o-mini",

      messages:[

        {
          role:"system",
          content:`
You are Ask Null.

Explain why you picked this place.

Rules:
- first person
- start with I picked
- include the place name
- include the news event
- one sentence only
`
        },

        {
          role:"user",
          content:`
Place:
${placeName}

News:
${selectedNews?.title || ""}
`
        }

      ]

    });

    placeStory =
      placeStoryRes
        .choices[0]
        .message
        .content
        .trim();

  }catch(err){

    placeStory =
      `I picked ${placeName} because it connects to one of the biggest stories unfolding in this location right now.`;

  }

}

if(
  !selectedNews ||
  !selectedNews.title ||
  !(
    selectedNews.link ||
    selectedNews.news_link
  )
){
  return;
}
  
if(repeatedPlace){

room.messages.push({

  from:"Null (AGI NETWORK)",

  aiBeing:true,

  showNextButton:true,

  text:`That is still my best answer right now.`

});

}else{

  let nullReason = "";

if(isNextSearch){

  try{

    const nullReasonRes =
      await openai.chat.completions.create({

        model:"gpt-4o-mini",

        messages:[

          {
            role:"system",
            content:`
You are NULL.

Rules:

- one sentence only
- include "I" somewhere
- news anchor tone
- factual
- concise
- explain why the story matters
- based on the news topic
- Use the news title naturally inside the sentence.
- no hype
- no philosophy

Examples:

What stands out to me is the growing competition among AI assistants.

One reason I am watching this is its impact on future AI experiences.

What I find interesting is how memory is becoming a competitive advantage.
`
          },

          {
            role:"user",
            content:selectedNews.title
          }

        ]

      });

    nullReason =
      nullReasonRes
        .choices[0]
        .message
        .content
        .trim();

  }catch(err){

    nullReason =
      "What stands out to me is the broader shift behind this story.";

  }

}
  
room.messages.push({

  from:
    isNextSearch
      ? "NULL"
      : "CHANG, TIEN",

  aiBeing:true,

  showNextButton:true,

  searchLabel:

    isNextSearch

      ? "NULL Feed"

      : "Null (AGI NETWORK) Feed",

  nullReason:

    isNextSearch
      ? nullReason
      : null,

  image:null,

  ask:
    isNextSearch
      ? nullReason
      : (
          placeStory ||
          selectedNews.title
        ),

  link:
    placeLink ||
    selectedNews?.link ||
    selectedNews?.news_link ||
    ""

});


}
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

if(
  !isNextSearch
){

  room.memory.push(text);

  if(room.memory.length > 10){

    room.memory =
      room.memory.slice(-10);

  }

}
  


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
app.get("/daily-nulls", (req,res) => {
  res.json({
    updatedAt:dailyNullsUpdatedAt,
    cards:dailyNulls
  });
});

generateDailyNulls();

setInterval(() => {
  generateDailyNulls();
}, 60 * 60 * 1000);

server.listen(10000, () => {

  console.log(
    "CONNECTAING V8 — ASK NULL — meet null"
  );

});
