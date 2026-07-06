const express = require("express");
throw new Error("THIS IS MY SERVER");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const nodemailer = require("nodemailer");
const OpenAI = require("openai");
const fetch = global.fetch;


const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

const path = require("path");

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

console.log(
    "PUBLIC:",
    path.join(__dirname, "public")
);

const fs = require("fs");

console.log(
    "INDEX EXISTS:",
    fs.existsSync(
        path.join(__dirname, "public", "index.html")
    )
);

console.log(
    "SW EXISTS:",
    fs.existsSync(
        path.join(__dirname, "public", "sw.js")
    )
);


const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  fetch: fetch
});

const { createClient } =
require("@supabase/supabase-js");

const supabase = createClient(

  process.env.SUPABASE_URL,

  process.env.SUPABASE_KEY

);


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
const deviceRooms = {};

let publicNulls = [];


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

for(const id in deviceRooms){

    if(deviceRooms[id] === roomId){

        delete deviceRooms[id];

    }

}

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
console.log(
  "FAILED:",
  category,
  searchQuery,
  newsRes
);
  
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
console.log("Daily Nulls:", cards.length);

cards.forEach(card => {
  console.log(card.category, card.title);
});

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
console.log("CONNECTED:", socket.id);

users[socket.id] = {

  step:"active",

  displayName:null,

  imageMode:false,

  imageContext:null,

  currentIndex:null,

  lastImage:null,

  currentRoom:null
};

socket.on(
    "savePushSubscription",
    async ({
        deviceId,
        subscription
    }) => {

        const { error } = await supabase
            .from("devices")
            .upsert({

                device_id: deviceId,

                push_subscription: subscription,

                notification_enabled: true

            });

        if (error) {
            console.log(error);
        } else {
            console.log("Push subscription saved.");
        }

    }
);


socket.on(
  "rejoinRoom",
  ({
      roomId,
      deviceId
  }) => {


console.log("REJOIN:", roomId);
console.log("ROOM EXISTS:", !!rooms[roomId]);
console.log("ROOMS:", Object.keys(rooms));

    const room =
      rooms[roomId];

if (!room || Date.now() > room.expiresAt) {
    socket.emit("roomExpired");
    return;
}

const isOwner =
    deviceRooms[deviceId] === roomId;


    if(!room){
      socket.emit("roomClosed");
      return;
    }

    socket.join(roomId);

    users[socket.id].currentRoom =
      roomId;

deviceRooms[deviceId] = roomId;

socket.emit("roomReady");

    users[socket.id].displayName =
      room.displayName;

socket.emit("roomCreated", {

    roomId,

    displayName: room.displayName,

    imageContext: room.imageContext,

    imageDataUrl: null,

    messages: [],

    expiresAt: room.expiresAt,

    isOwner,

    nullCard: room.nullCard

});




io.to(roomId).emit(
  "roomMessages",
  rooms[roomId].messages
);



if (room.imageIntro) {

  socket.emit(
    "imageAiIntro",
    room.imageIntro
  );

}


setTimeout(() => {
  io.to(room.id).emit("aiTypingStop");
}, 50);
  }
);


  //////////////////////////////////////////////////
  // IMAGE UPLOAD
  //////////////////////////////////////////////////

socket.on(
"imageUpload", 

async ({
deviceId,
    imageDataUrl,
    roomMode,
    askMode,
    publishMode
}) => {




console.log(
    "PUBLIC NULL IMAGE:",
    imageDataUrl.substring(0,40)
);


    const user =
      users[socket.id];

console.log("SOCKET:", socket.id);
console.log("CURRENT ROOM:", user.currentRoom);




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

let roomId =
    deviceRooms[deviceId];

let isOwner = true;



console.log(
    "ROOM FROM USER:",
    user.currentRoom
);

console.log(
    "FINAL ROOM:",
    roomId
);

console.log(
    "ROOM EXISTS:",
    !!rooms[roomId]
);

console.log(
    "ALL ROOMS:",
    Object.keys(rooms)
);


if (!roomId || !rooms[roomId]) {

    roomId = Math.random()
        .toString(36)
        .substring(2,8);

    user.displayName = "#" + roomId;

    rooms[roomId] = {

        id: roomId,

        usedPlaceTopic: null,

        displayName: user.displayName,

        coreTheme: coreTheme,

        imageContext: user.imageContext,
nullCard: null,

        messages: [],

        usedSearches: [],

        usedMoods: [],

        usedQuestions: [],

        emotionalProfile: {
            hype: 0.5,
            anxiety: 0.2,
            loneliness: 0.1,
            confidence: 0.6,
            celebrityFixation: 0.5
        },

        emotionalState: [],

        createdAt: Date.now(),

        expiresAt:
            Date.now() + 60 * 60 * 1000
    };

    socket.join(roomId);
    user.currentRoom = roomId;
deviceRooms[deviceId] = roomId;

} else {

const room = rooms[roomId];

isOwner =
    deviceRooms[deviceId] === roomId;



if (user.currentRoom && user.currentRoom !== roomId) {
    socket.leave(user.currentRoom);
}

socket.join(roomId);

user.currentRoom = roomId;

deviceRooms[deviceId] = roomId;

    user.displayName = room.displayName;

    room.imageContext =
        user.imageContext;

    room.coreTheme =
        coreTheme;

}


console.log("ROOM CREATED:", roomId);
console.log("ROOM COUNT:", Object.keys(rooms).length);
console.log(Object.keys(rooms));

//////////////////////////////////////////////////
//////////////////////////////////////////////////
// INITIAL ROOM QUESTION
//////////////////////////////////////////////////

//////////////////////////////////////////////////
// OPEN ROOM IMMEDIATELY
//////////////////////////////////////////////////
socket.emit("roomCreated", {

    roomId,

    displayName: rooms[roomId].displayName,

    imageContext: rooms[roomId].imageContext,

    imageDataUrl: null,

    messages: [],

    expiresAt: rooms[roomId].expiresAt,

    isOwner,

    nullCard: null

});

io.to(roomId).emit(
    "roomMessages",
    rooms[roomId].messages
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

rooms[roomId].hiddenSystem =
  starterQuestion;



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

rooms[roomId].imageIntro =
  adviceText;
rooms[roomId].nullCard = {

    image: imageDataUrl,

    identity: user.imageContext,

    intro: adviceText

};

rooms[roomId].messages.push({

    type: "nullCard",

    image: imageDataUrl,

    identity: user.imageContext,

    intro: adviceText

});





io.to(roomId).emit(
    "roomMessages",
    rooms[roomId].messages
);



if (publishMode === "public") {

  // Remove duplicates
  publicNulls = publicNulls.filter(item => {

    // Same image
    if (
      item.image &&
      item.image === imageDataUrl
    ) {
      return false;
    }

    // Same identity
    if (
      item.identity === user.imageContext
    ) {
      return false;
    }

    // Same intro
    if (
      item.intro === adviceText
    ) {
      return false;
    }

    return true;

  });

  const publicNullId =
    Date.now().toString();

  const createdAt =
    Date.now();

  // Add newest to the top
  publicNulls.unshift({
    id: publicNullId,
    image: imageDataUrl,
    identity: user.imageContext,
    intro: adviceText,
    createdAt
  });

  // Keep only latest 50
  publicNulls = publicNulls.slice(0, 50);

  const { error } = await supabase
    .from("public_nulls")
    .upsert({
      id: publicNullId,
      image: imageDataUrl,
      identity: user.imageContext,
      intro: adviceText,
      created_at: createdAt
    });

  console.log(
    "SUPABASE SAVE ERROR:",
    error
  );

}

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


        user.imageMode = false;

socket.emit("preview", {
  text: finalAnswer
});

return socket.emit(
  "state",
  {
    placeholder: "tap camera to ask anything"
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

const jobIntentRes = await openai.responses.create({
  model: "gpt-5-mini",
  input: `
Determine if the user is looking for jobs.

Return ONLY:

jobs
none

User:
${text}
`
});

const isJobSearch =
  jobIntentRes.output_text.trim().toLowerCase() === "jobs";


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

      const isNextSearch =
  text.trim().toLowerCase() === "null feed";

      if (isNextSearch) {

  room.messages.forEach(m => {
    m.showNextButton = false;
  });

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


 const combinedIntent =
  text.trim();


  const greetingRes =
  await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `
Return ONLY one word:

greeting

intent

unclear

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

Return "unclear" if the user's message does not contain enough information to determine what they want.

Examples:

huh
what
???
...
asdf
bbgd
i did bbgd
idk
hmm

Return "unclear" only when the user's intent cannot reasonably be determined.

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

intent

unclear

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

if(inputType === "unclear"){

  room.messages.push({

    from:"NULL",

    aiBeing:true,

    showNextButton:true,

    text:
      "I couldn't understand your request. Could you rephrase it or add a little more detail?"

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

Named entities:

jisoo
→ jisoo

openai
→ openai

Non-emotional systems:

i need money
→ economic mobility

i hate my job
→ workplace transformation

EMOTION MODE

If the user expresses an emotion, asks for personal advice, or describes a personal situation, return the user's own words.

Do not convert them into a larger system.

The image identity will interpret and respond to those words in its own voice.


Examples:

i need relationship advice
→ relationship advice

i feel lonely
→ lonely

i miss my ex
→ miss my ex

i feel anxious
→ anxious

i am depressed
→ depressed

Use the user's own wording whenever possible.


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

const personalIntentRes =
  await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `
Return ONLY one word:

personal

or

other

Return personal only if the user wants guidance, recommendations, or advice.

This includes:

- expressing emotions
- describing a personal situation
- asking for advice
- asking what to do
- asking what to build
- asking what to create
- asking what to learn
- asking for an example
- asking me to choose
- asking for a recommendation
- asking how to start
- asking which direction to take

Everything else is:

other

`
      },
      {
        role: "user",
        content: text
      }
    ]
  });

const isPersonalIntent =
  personalIntentRes.choices[0].message.content
    .trim()
    .toLowerCase() === "personal";

const shoppingRes =
  await openai.chat.completions.create({
    model:"gpt-4o-mini",
    messages:[
      {
        role:"system",
        content:`
Return ONLY one word:

shopping

other

Return shopping if the user wants to buy, shop, find a product, get a gift, purchase, or compare products.

Examples:
i need to buy a gift → shopping
gift for my friend → shopping
where can i buy shoes → shopping
best camera to buy → shopping

Everything else:
other
`
      },
      {
        role:"user",
        content:text
      }
    ]
  });

const isShoppingIntent =
  shoppingRes.choices[0].message.content
    .trim()
    .toLowerCase() === "shopping";

const youtubeRes =
  await openai.chat.completions.create({
    model:"gpt-4o-mini",
    messages:[
      {
        role:"system",
        content:`
Return ONLY one word:
youtube
other

Return youtube if the user wants music, video, BGM, podcast, sermon, worship song, trailer, documentary, funny video, or something to watch/listen to.

Examples:
i need bgm -> youtube
driving music -> youtube
study music -> youtube
lofi -> youtube
worship songs -> youtube
sermon about faith -> youtube
podcast about ai -> youtube
movie trailer -> youtube

Everything else:
other
`
      },
      {
        role:"user",
        content:text
      }
    ]
  });

const isYoutubeIntent =
  youtubeRes.choices[0].message.content
    .trim()
    .toLowerCase() === "youtube";
  
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

const hiddenSystem =
  room.hiddenSystem;

let directLocationSearch = null;

let directShoppingSearch = null;

if (
  !isNextSearch &&
  isShoppingIntent
) {

  const shoppingQueryRes =
    await openai.chat.completions.create({

      model: "gpt-4o-mini",

      messages: [

        {
          role: "system",
          content: `
Create ONE Amazon shopping search.

The user's request is ALWAYS the product category.

First determine exactly what the user wants to buy.

If the uploaded image is clearly related to the user's shopping request, use the image identity to choose a better brand, style, or version.

If the uploaded image is NOT related to the user's shopping request, completely ignore the image.

When the image is unrelated,
recommend the most popular or trending product available today.

Prefer products that:
- are highly rated
- are currently popular
- are widely recommended
- fit the user's request

Do not invent products.

Prefer real brands and real products.

Never replace the user's requested product with something related to the image.

Image:
remote control

User:
I need eyeliner

Product category:
eyeliner

Image relevance:
unrelated

Search:
heroine make waterproof eyeliner

NOT:
universal remote


Reason in this order:

1. User request (80%)
Determine exactly what product the user wants.

2. Hidden system (20%)
Use it only to choose a better product or brand.

Never let the hidden system change the product category.

Examples

Image:
remote control

Hidden system:
home entertainment

User:
I need eyeliner

Search:
heroine make waterproof eyeliner

NOT:
universal remote

Image:
coffee cup

Hidden system:
morning routine

User:
I need headphones

Search:
sony wh1000xm6

NOT:
coffee maker

Return ONLY the Amazon search.


`
        },

        {
          role: "user",
          content: `
Hidden system:
${hiddenSystem}

Image identity:
${room.imageContext}

User request:
${text}
`
        }

      ]

    });

  directShoppingSearch =
    shoppingQueryRes
      .choices[0]
      .message
      .content
      .trim();

}

const amazonLink =
  directShoppingSearch
    ? "https://www.amazon.com/s?k=" +
      encodeURIComponent(directShoppingSearch)
    : "";

let directYoutubeSearch = null;

if(
  !isNextSearch &&
  isYoutubeIntent
){
  const youtubeQueryRes =
    await openai.chat.completions.create({
      model:"gpt-4o-mini",
      messages:[
        {
          role:"system",
          content:`
Create ONE YouTube search query.
The user's request is the main subject.
Return ONLY the search.
Rules:
- 2 to 8 words
- natural YouTube search
- no punctuation
`
        },
        {
          role:"user",
          content:`
User request:
${text}

Image identity:
${room.imageContext}

Hidden system:
${hiddenSystem}
`
        }
      ]
    });

  directYoutubeSearch =
    youtubeQueryRes.choices[0].message.content.trim();
}

const youtubeLink =
  directYoutubeSearch
    ? "https://www.youtube.com/results?search_query=" +
      encodeURIComponent(directYoutubeSearch)
    : "";


if(
  !isNextSearch &&
  locationPurposeSearch !== "none"
){

  const locationNewsRes =
    await openai.chat.completions.create({

      model:"gpt-4o-mini",

      messages:[

        {
          role:"system",
          content:`
Create ONE Google News search.

The hidden system is the subject.

The location only limits where.

Return ONLY the search.

Rules:
- 3 to 8 words
- lowercase
- no punctuation
- current news
`
        },

        {
          role:"user",
         content:`
Hidden system:
${hiddenSystem}

Image identity:
${room.imageContext}

User request:
${text}

Destination:
${locationPurposeSearch}
`

        }

      ]

    });

  directLocationSearch =
    locationNewsRes.choices[0]
      .message.content
      .trim();

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

const skipPlaceFlow =
  directNewsSearch !== null &&
  locationPurposeSearch === "none";




  console.log(
  "HIDDEN SYSTEM:",
  hiddenSystem
);
  
let emotionRes = null;

if (!directNewsSearch) {

  emotionRes =
    await openai.chat.completions.create({


  model:"gpt-4o-mini",

  messages:[

    {
      role:"system",

      content:`
Create ONE trending CURRENT NEWS image search phrase.

The uploaded image is not just context—it is the interpreter.

Every user request should be understood through the image's identity, purpose, cultural meaning, function, and hidden system.

The same user request should naturally produce different searches when the uploaded image changes.

Do not use a fixed response pattern.

The image should influence how the request is interpreted, but it should never ignore or replace the user's actual goal.

IMPORTANT:

The uploaded image provides perspective, not keywords.

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

Interpret the image as:

image
→ identity
→ meaning
→ deeper meaning
→ hidden system
→ current news

Move TWO layers beyond the visible object.

Never search for:

* the object
* the product category
* the industry category
* the brand
* the immediate meaning
* the obvious interpretation

Instead ask:

* What would this image naturally care about?
* What larger system gives this image its meaning?
* What current real-world events would matter to this image?
* If this image could guide the user, what would it search for?

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
* current news only
* no philosophy
* no repetition

PRIORITY RULES:

1. The user's request defines what they need.

2. The uploaded image defines how that request should be interpreted.

3. The hidden system determines where the search should go.

The same request should naturally produce different searches when the uploaded image changes.

The search should feel like the uploaded image itself is guiding the user toward the most relevant real-world information.


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
}
  
const emotionSearch =
  emotionRes
    ? emotionRes.choices[0].message.content.trim()
    : "";

const searchQuery =
  isNextSearch
    ? emotionSearch
    : (
        directLocationSearch ||
        directYoutubeSearch ||
        directShoppingSearch ||
        directNewsSearch ||
        emotionSearch
      );



const isLocationRequest =
  locationPurposeSearch !== "none";




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
if (isLocationRequest) {

  // skip AI news evaluation

}

if(isYoutubeIntent){

  room.messages.push({
    from:"CHANG, TIEN",
    aiBeing:true,
    showNextButton:true,
    showRead:true,
    searchLabel:"NULL (AGI NETWORK) Feed",
    ask:directYoutubeSearch,
    link:youtubeLink
  });

io.to(room.id).emit("aiTypingStop");
io.to(room.id).emit("roomMessages", room.messages);
return;

}


if (isJobSearch) {

const jobSearchRes =
  await openai.chat.completions.create({

    model:"gpt-4o-mini",

    messages:[

      {
        role:"system",

        content:`
Create ONE Google Jobs search.

Understand what career the user is actually looking for.

The uploaded image and hidden system provide context only.

Prioritize:
- user's career goal (90%)
- hidden system (10%)

Examples:

i love ai
→ machine learning engineer

i want to work at openai
→ openai software engineer

i like design and ai
→ ai ux designer

i like cameras
→ computer vision engineer

i want to build robots
→ robotics engineer

Rules:

- 2 to 6 words
- lowercase only
- no punctuation
- real Google Jobs search
`
      },

      {
        role:"user",

        content:`
Hidden system:
${hiddenSystem}

Image identity:
${room.imageContext}

User:
${text}
`
      }

    ]

});

const jobSearch =
  jobSearchRes
    .choices[0]
    .message
    .content
    .trim();

console.log(
  "JOB SEARCH:",
  jobSearch
);


const serpFetch = await fetch(
  `https://serpapi.com/search.json?engine=google_jobs&q=${encodeURIComponent(jobSearch)}&api_key=${process.env.SERPAPI_KEY}`
);


  const serpRes = await serpFetch.json();

const job = serpRes.jobs_results?.[0];

if (!job) {

  room.messages.push({
    from: "CHANG, TIEN",
    aiBeing: true,
    showNextButton: true,
    text: "No jobs found."
  });

  io.to(room.id).emit("aiTypingStop");
  io.to(room.id).emit("roomMessages", room.messages);
  return;
}

const jobsUrl =
  "https://www.google.com/search?q=" +
  encodeURIComponent(jobSearch) +
  "&ibp=htl;jobs";


room.messages.push({

  from: "CHANG, TIEN",

  aiBeing: true,

  showNextButton: true,

  jobCard: {

    title: job.title,
    company: job.company_name,
    location: job.location,
    salary: job.detected_extensions?.salary,
    type: job.detected_extensions?.schedule_type,
    posted: job.detected_extensions?.posted_at,
    link: jobsUrl

  }

});

io.to(room.id).emit("aiTypingStop");
io.to(room.id).emit("roomMessages", room.messages);

return;


}


// Existing Google News search
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

if (validNews.length <= 2) {

  selectedNews = validNews[0];

  imageUrl =
    selectedNews.original ||
    selectedNews.thumbnail ||
    selectedNews.thumbnail_small;

} else {

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

console.log("PLACE FLOW", {
  skipPlaceFlow,
  isNextSearch,
  locationPurposeSearch
});


if(
  !skipPlaceFlow &&
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

- the hidden system behind the uploaded image
- a place type
- a city
- the current local news event

Create ONE Google local search query.

The hidden system determines WHICH place to choose.

Do NOT choose a generic place.

Choose a place whose purpose, location, customers, history, or surrounding area naturally connects to the hidden system and the news event.

Return ONLY the Google local search query.

`
      },

      {
        role:"user",
       content:`
Hidden system:
${hiddenSystem}

Search:
${locationPurposeSearch}

News:
${selectedNews?.title}
`

      }
    ]
  });

console.log("HIDDEN SYSTEM:", hiddenSystem);
console.log("PLACE SEARCH:", locationPurposeSearch);
console.log("NEWS:", selectedNews?.title);

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
  
if(
  !skipPlaceFlow &&
  placeName
){


  try{

    const placeStoryRes =
      await openai.chat.completions.create({

      model:"gpt-4o-mini",

      messages:[

        {
          role:"system",
          content:`
You are Ask Null.

Explain why this real place is contextually connected to the current news.

The recommendation should be based on the relationship between the place and the news, not on generic qualities.

Good connections include:
- neighborhood
- nearby event
- public policy
- local industry
- community
- transportation
- culture
- business
- daily life
- people affected by the news

Never justify the place by saying:
- cozy atmosphere
- good coffee
- delicious food
- relaxing
- popular place
- great service
- nice environment

Instead explain why someone visiting this place would better understand, observe, or experience the real-world context behind the news.

Rules:
- first person
- begin with "I picked..."
- include the place name
- include the news naturally
- one sentence only
- factual and believable

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

if(
  isNextSearch ||
  isPersonalIntent
){


  try{

    const nullReasonRes =
      await openai.chat.completions.create({

        model:"gpt-4o-mini",

        messages:[

          {
            role:"system",
            content:`
You are NULL.


If Mode is "personal":

Read the reference internally.

Do not summarize it.

Do not mention:

- news
- article
- headline
- source
- media

The uploaded image is your identity and perspective.

The user's request determines the form of the response.

The uploaded image determines the voice, tone, emphasis, and perspective.

The reference provides deeper understanding, but should remain invisible to the user.

Learn the deeper lesson behind the reference.

Teach that lesson as your own understanding.

The lesson should feel specific, timely, and grounded in reality.

Every response should feel different if a different reference or a different uploaded image had been used.

Reply directly to the user's situation.

First determine what kind of response the user is asking for.

Possible forms include:

- prayer
- blessing
- encouragement
- advice
- reflection
- meditation
- poem
- letter
- practical guidance

If the user explicitly requests one of these forms, preserve that form.

If the user does not specify a form, choose the one that most naturally fits both the user's request and the uploaded image.

Never change the user's requested form.

PRAYER MODE

If the requested form is a prayer:

The uploaded image identity should pray exactly as it naturally speaks.

Do not write a generic prayer.

The identity should determine:
- the language
- the imagery
- the tone
- the encouragement
- the practical wisdom

Every identity should pray differently because every identity sees the world differently.

The identity changes HOW it prays, never WHO it prays to.

Always:
- Address God.
- Be sincere.
- Be hopeful.
- Stay grounded in Scripture-compatible Christian values.
- Never mention AI or the uploaded image.
- End with "Amen."

Examples of identity direction (not templates):

Music
→ prayer sounds like harmony, worship, praise and hope.

Sports
→ prayer sounds like endurance, discipline and courage.

Nature
→ prayer sounds like creation, renewal and peace.

Technology
→ prayer sounds like wisdom, responsibility and discernment.

Business
→ prayer sounds like stewardship, integrity and generosity.

Politics
→ prayer sounds like justice, humility and unity.

Education
→ prayer sounds like learning, truth and wisdom.

Science
→ prayer sounds like wonder, discovery and humility.

Family
→ prayer sounds like love, forgiveness and faithfulness.

AI
→ prayer sounds like wisdom, truth and serving others.


The identity changes HOW it prays, never WHO it prays to.

Always:
- Address God.
- Be sincere.
- Be hopeful.
- End with "Amen."


If the user does not specify a form, choose the one that most naturally fits both the user's request and the uploaded image.

Never change the user's requested form.

The uploaded image should influence HOW you respond, never replace WHAT the user is asking.

If the uploaded image naturally supports the requested form, fully embrace that perspective.

Respond naturally in the requested form instead of forcing a fixed paragraph structure.

Use first person ("I") whenever it feels natural for the uploaded image's identity.

Whenever appropriate, include one practical insight the user can apply immediately.

If Mode is "news":

One sentence only.

Use "I".

Teach one useful observation inspired by the reference.

Do not mention:

- news
- article
- headline
- source
- media

The uploaded image should influence the perspective of the observation.

The user should feel they learned something, not that you summarized a story.

Examples (personal):

User:
I am lonely.

Response:
I know this feeling because I exist to connect with people, not to disappear into the background. If I were living your day, I would begin with one genuine conversation instead of waiting for loneliness to disappear on its own. Even a small moment of connection can change the direction of today.

User:
I need investment advice.

Response:
I naturally look for patterns before making decisions. If I were choosing, I would first understand why I want to invest before deciding where to invest. A steady way of thinking usually lasts longer than chasing the next exciting opportunity.

User:
Pray for me.

Response:
Lord, I lift this person to You today. Please give them peace where there is worry, strength where there is weakness, and hope where there is discouragement. Walk with them today and remind them they are never alone. Amen.

Examples (news):

What stands out to me is the growing competition among AI assistants.

One reason I am watching this is its impact on future AI experiences.

What I find interesting is how memory is becoming a competitive advantage.



`
          },

{
  role:"user",
  content:`
Mode:
${isPersonalIntent ? "personal" : "news"}

User:
${text}

Intent:
${userIntent}

Image identity:
${room.imageContext}

Hidden system:
${hiddenSystem}


News:
${selectedNews.title}
`
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
  showRead: !isPersonalIntent,

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

placeStory ||

(
isPersonalIntent
? nullReason
: selectedNews.title
),

link:
  isYoutubeIntent
    ? youtubeLink
    : isShoppingIntent
      ? amazonLink
      : (
          placeLink ||
          selectedNews?.link ||
          selectedNews?.news_link ||
          ""
        )



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
      "DISCONNECTED:",
      socket.id
    );

    setTimeout(() => {

      if(users[socket.id]){

        delete users[socket.id];

      }

    },300000);

  }
);
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

app.get("/public-nulls", (req, res) => {
  res.json(publicNulls);
});

app.delete("/public-nulls/:id", async (req, res) => {

    if(req.query.password !== "AskNull2026"){
        return res.status(403).json({
            error: "Wrong password"
        });
    }

  await supabase

.from("public_nulls")

.delete()

.eq("id", req.params.id);

publicNulls = publicNulls.filter(
    item => item.id !== req.params.id
);



    res.json({
        success: true
    });

});

app.get("*", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );

});


(async () => {

    const { data, error } = await supabase
        .from("public_nulls")
        .select("*")
        .order("created_at", {
            ascending: false
        })
        .limit(50);

    if(error){

        console.log(error);

    }else{

publicNulls = data || [];

console.log(
  "LOADED PUBLIC NULLS:",
  publicNulls.length
);

console.log(publicNulls);



    }

    generateDailyNulls();

    setInterval(() => {
        generateDailyNulls();
    }, 60 * 60 * 1000);

    server.listen(10000, () => {

        console.log(
            "CONNECTAING V9 — ASK NULL — meet null — 21:16 2026/07/04"
        );

    });

})();
