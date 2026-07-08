const express = require("express");

const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const nodemailer = require("nodemailer");
const OpenAI = require("openai");
const fetch = global.fetch;
const webpush = require("web-push");
const twilio = require("twilio");

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

webpush.setVapidDetails(

    "mailto:a078bc@gmail.com",

    process.env.VAPID_PUBLIC_KEY,

    process.env.VAPID_PRIVATE_KEY

);

const smsClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
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

async function sendSMS(to, body){
console.log("Sending SMS to:", to);
await smsClient.messages.create({

    from: process.env.TWILIO_PHONE_NUMBER,

    to,

    body: `I am Null: ${body}`

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

        console.log("Push subscription received");

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

    socket.emit("pushSubscriptionSaved");

}

    }
);

    socket.on("savePhoneNumber", async ({

    deviceId,

    phone

}) => {

        console.log("SAVE PHONE");
console.log("DEVICE:", deviceId);
console.log("PHONE:", phone);

const { data, error } = await supabase
  .from("devices")
  .upsert({
    device_id: deviceId,
    phone,
    notification_type: "sms"
  });

console.log("UPSERT ERROR:", error);
console.log("UPSERT DATA:", data);

    socket.emit("phoneSaved");

});

socket.on(
    "createReminder",
async ({
    deviceId,
    text,
    timeZone
}) => {
        const user = users[socket.id];

const room = rooms[user.currentRoom];
    
timeZone =
  typeof timeZone === "string" &&
  timeZone.length
    ? timeZone
    : "UTC";
    
if (!room) {
    return;
}


console.log("createReminder received:", deviceId, text);

  console.log(
    "Creating reminder:",
    text
);

// CHECK IF USER PROVIDED BOTH
// A TOPIC AND A TIME

const reminderCheckRes =
    await openai.chat.completions.create({

    model:"gpt-4o-mini",

    messages:[

        {
            role:"system",
            content:`
Return JSON only.


{
  "topic":"",
  "time":""
}

Rules:

Rules:

- topic = what should be remembered or done.
- time = a future date, time, or time expression.

Return an empty string if either is missing.

Examples:

Call John tomorrow at 9.
→
{
  "topic":"Call John",
  "time":"tomorrow at 9"
}

Take medicine every day at 8am.
→
{
  "topic":"Take medicine",
  "time":"every day at 8am"
}

Remind me next Friday.
→
{
  "topic":"",
  "time":"next Friday"
}

Buy milk.
→
{
  "topic":"Buy milk",
  "time":""
}
- If missing, return an empty string.

Examples:

Call John tomorrow at 9.

{
  "topic":"Call John",
  "time":"tomorrow at 9"
}

Call John.

{
  "topic":"Call John",
  "time":""
}

Tomorrow at 9.

{
  "topic":"",
  "time":"tomorrow at 9"
}
A topic means what to remind.

A time means when to remind.
`
        },

        {
            role:"user",
            content:text
        }

    ]

});

const reminderCheck =
    JSON.parse(
        reminderCheckRes
            .choices[0]
            .message
            .content
    );

if(!reminderCheck.topic){

    room.messages.push({

        from:"NULL",

        aiBeing:true,

        text:"What would you like to be notified about? Click 7-Day Notification again."

    });

    io.to(room.id).emit(
        "roomMessages",
        room.messages
    );

    return;

}

if(!reminderCheck.time){

    room.messages.push({

        from:"NULL",

        aiBeing:true,

        text:"When would you like me to remind you?"

    });

    io.to(room.id).emit(
        "roomMessages",
        room.messages
    );

    return;

}

const reminderRes =
    await openai.chat.completions.create({

                model:"gpt-4o-mini",

                messages:[

                    {
                        role:"system",

        
content:`
Return JSON only.

{
"type":"",
"entity":"",
"title":"",
"body":"",
"reminder_time":""
}

The user's timezone is provided below.

When the user says things like "tomorrow at 8 PM" or "next Friday at 9", interpret those using the user's timezone.

Return reminder_time as a valid ISO-8601 datetime that matches the user's local time.

type:

reminder

or

news
`
                    },

                    {
                        role:"user",
                        content:`
User timezone:
${timeZone}

User:
${text}
`
                    }

                ]

            });

        const reminder =
            JSON.parse(
                reminderRes
                    .choices[0]
                    .message
                    .content
            );

let reminderTime =
    new Date(reminder.reminder_time);

if (
    isNaN(reminderTime.getTime()) ||
    reminderTime < new Date()
) {

    reminderTime =
        new Date(
            Date.now() + 60 * 1000
        );

}


        await supabase
            .from("reminders")
            .insert({

                device_id:deviceId,

                request:text,

                reminder_type:
                    reminder.type,

                entity:
                    reminder.entity,

                title:
                    reminder.title,

                body:
                    reminder.body,

reminder_time:
    reminderTime.toISOString(),


                expires_at:
                    new Date(
                        Date.now() +
                        7 * 24 * 60 * 60 * 1000
                    ),

                sent:false

            });

        console.log(
            "Reminder saved."
        );

      io.to(room.id).emit("aiTypingStart");

setTimeout(() => {

room.messages.forEach(m => {

    if (m.reminderCard) {

        m.hidden = true;

    }

});

    room.messages.push({

    from: user.displayName,

    text

});
    
    room.messages.push({

        from: "NULL",

        aiBeing: true,

        text: "Okay.",

        showNextButton: true

    });

    io.to(room.id).emit("aiTypingStop");

    io.to(room.id).emit(
        "roomMessages",
        room.messages
    );

}, 800);

socket.emit("reminderSaved");
});

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
        topicMemory: {},

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
    room.topicMemory = {};

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
  async ({ text, timeZone }) => {

    const user = users[socket.id];
    const room = rooms[user.currentRoom];

    if (!room) {
        socket.emit("roomClosed");
        return;
    }

   const lowerText = text.trim().toLowerCase();

const isJobSearch =
    /\b(job|jobs|career|careers|hiring|hire|resume|cv|position|internship)\b/.test(lowerText);

    const isNextSearch =
        text.trim().toLowerCase() === "null feed";

    if (isNextSearch) {
        room.messages.forEach(m => {
            m.showNextButton = false;
        });
    }

    // ...continue with the rest of roomMessage

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


 const lowerIntent = combinedIntent.trim().toLowerCase();

let inputType = "intent";

// Greeting
if (
    /^(hi|hello|hey|good morning|good afternoon|good evening|thanks|thank you|who are you|what are you|what can you do|how do i use|why do you exist)/.test(lowerIntent)
) {
    inputType = "greeting";
}

// Unclear
else if (
    lowerIntent.length < 2 ||
    /^(huh|what|\?+|\.{3}|asdf|idk|hmm|bbgd|i did bbgd)$/.test(lowerIntent)
) {
    inputType = "unclear";
}

if (inputType === "unclear") {

    room.messages.push({
        from: "NULL",
        aiBeing: true,
        showNextButton: true,
        text: "I couldn't understand your request. Could you rephrase it or add a little more detail?"
    });

    io.to(room.id).emit("aiTypingStop");
    io.to(room.id).emit("roomMessages", room.messages);
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

    io.to(room.id).emit("aiTypingStop");
    io.to(room.id).emit("roomMessages", room.messages);
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

const topicKey = userIntent.trim().toLowerCase();

const cachedTopic = room.topicMemory[topicKey];

    if (cachedTopic && !isNextSearch) {

    room.messages.push({
        from: "NULL",
        aiBeing: true,
        showNextButton: true,
        text: "This is still my best answer for now. I've already searched this topic from my identity. Use NULL Feed if you'd like me to explore a different direction."
    });

    room.messages.push({
        from: "CHANG, TIEN",
        aiBeing: true,
        showNextButton: true,
        showRead: true,
        searchLabel: cachedTopic.searchLabel,
        ask: cachedTopic.ask,
        image: cachedTopic.image,
        link: cachedTopic.link,
        jobCard: cachedTopic.jobCard
    });

    io.to(room.id).emit("aiTypingStop");
    io.to(room.id).emit("roomMessages", room.messages);
    return;
}

const isPersonalIntent =
    /(lonely|sad|depressed|anxious|stress|worried|relationship|love|dating|marriage|family|friend|career|job|advice|help me|what should i do|recommend|choose|pray|prayer|blessing|encourage|motivate|hope|learn|build|create|start|direction)/i
    .test(text);

const isShoppingIntent =
    /(buy|purchase|shop|shopping|gift|price|cheap|discount|order|recommend.*buy|best.*buy|where.*buy|looking for)/i
    .test(text);

const isYoutubeIntent =
    /(youtube|video|music|song|songs|podcast|watch|listen|bgm|lofi|sermon|trailer|documentary)/i
    .test(text);
  
  const locationPurposeRes =
  await openai.chat.completions.create({
    model:"gpt-4o-mini",
    messages:[
      {
        role:"system",
       content:`
Detect place requests.

Return:

<location> <place type>

Examples:

new york bar
shibuya ramen
tokyo place
taipei coffee shop

If the user wants somewhere to go but doesn't specify a place type:

<location> place

Otherwise:

none

Rules:
- lowercase
- no punctuation
- return only one line

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
Create ONE current news search phrase.

Interpret:

image → hidden system → current news

The user's request decides WHAT to search.

The image decides HOW to interpret it.

If the user mentions a person, company, brand, product, or place, search that directly.

Never search for:
- the object
- the product
- the brand
- the visible image

Instead search for:
- causes
- systems
- transformations
- opportunities

Rules:
- 3–8 words
- lowercase
- no punctuation
- current searchable news
- no repetition

Return ONLY the search phrase.

`
    },

{
    role: "user",
    content: `
Image identity:
${room.imageContext}

Hidden system:
${hiddenSystem}

User:
${text}

Return ONE current news search phrase.
`
}

  ]
});
}
  
const emotionSearch =
  emotionRes
    ? emotionRes.choices[0].message.content.trim()
    : "";


 
    
const searchQuery = (
    isNextSearch
        ? (
            emotionSearch ||
            hiddenSystem ||
            userIntent ||
            "latest news"
        )
        : (
            directLocationSearch ||
            directYoutubeSearch ||
            directShoppingSearch ||
            directNewsSearch ||
            emotionSearch ||
            hiddenSystem ||
            userIntent ||
            "latest news"
        )
).trim();


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

if (isJobSearch) {

const jobSearchRes =
  await openai.chat.completions.create({

    model:"gpt-4o-mini",

    messages:[

      {
        role:"system",

        content:`
Create ONE Google Jobs search.

Understand exactly what career the user is looking for.

If the user specifies a city, state, country, or remote,
ALWAYS preserve it in the search.

Never remove or replace the user's requested location.

The uploaded image and hidden system provide context only.

Prioritize:

1. User's career goal (90%)
2. User's location (required if provided)
3. Hidden system (10%)

Examples:

Need ai job
→ machine learning engineer

Need ai job Seattle
→ machine learning engineer seattle

Need ai job New York
→ machine learning engineer new york

Need product designer Tokyo
→ product designer tokyo

Need remote ai job
→ machine learning engineer remote

Need OpenAI job Seattle
→ openai software engineer seattle

Image:
coffee cup

Hidden system:
morning routine

User:
Need ai job Seattle

Search:
machine learning engineer seattle

Rules:

- Return ONLY the Google Jobs search.
- 2 to 8 words.
- Lowercase only.
- No punctuation.
- Never remove the user's requested location.
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

if (!serpFetch.ok) {

    room.messages.push({
        from: "NULL",
        aiBeing: true,
        showNextButton: true,
        text: "Search service unavailable."
    });

    io.to(room.id).emit("aiTypingStop");
    io.to(room.id).emit("roomMessages", room.messages);

    return;
}

const serpRes = await serpFetch.json();

console.log("SERP RESPONSE:");
console.log(JSON.stringify(serpRes, null, 2));

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

  room.topicMemory[topicKey] = {

    searchLabel: "Job",

    ask: job.title,

    image: null,

    link: jobsUrl,

    jobCard: {

        title: job.title,

        company: job.company_name,

        location: job.location,

        salary: job.detected_extensions?.salary,

        type: job.detected_extensions?.schedule_type,

        posted: job.detected_extensions?.posted_at,

        link: jobsUrl

    }

};

    

io.to(room.id).emit("aiTypingStop");
io.to(room.id).emit("roomMessages", room.messages);

return;


}


// Existing Google News search

const serpFetch = await fetch(
  `https://serpapi.com/search.json?engine=google&tbm=nws&q=${encodeURIComponent(searchQuery)}&api_key=${process.env.SERPAPI_KEY}`
);

if (!serpFetch.ok) {

    room.messages.push({
        from: "NULL",
        aiBeing: true,
        showNextButton: true,
        text: "Search service unavailable."
    });

    io.to(room.id).emit("aiTypingStop");
    io.to(room.id).emit("roomMessages", room.messages);

    return;
}

const serpRes = await serpFetch.json();

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

if (validNews.length <= 6) {

    selectedNews = validNews[0];

    imageUrl =
        selectedNews.original ||
        selectedNews.thumbnail ||
        selectedNews.thumbnail_small;

} else {

    try {

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

1. Identify the biggest current local news or event.

2. The user's request ALWAYS determines the place type.

3. Use the current local news to decide WHICH place best fits that request.

4. Never change the user's requested place type.

Examples:

User:
need coffee shop in shinjuku

Correct:
A current local news story that helps recommend ONE coffee shop in Shinjuku.

Wrong:
LG Electronics
consumer products
technology news
design awards

User:
need ramen in shibuya

Correct:
A current local news story that helps recommend ONE ramen shop in Shibuya.

Never prioritize:

* coffee shop news
* restaurant news
* bar news
* rankings
* top 10 lists
* travel guides

The place itself does not need to be in the news.

The news provides the reason.

The user's request determines WHAT place to recommend.

The current local event determines WHY that place is recommended today.

Choose the result that creates the strongest real-world connection between the user's request and today's local news.

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

if (!selectedNews?.title) {

    room.messages.push({
        from: "NULL",
        aiBeing: true,
        showNextButton: true,
        text: "No results found."
    });

    io.to(room.id).emit("aiTypingStop");
    io.to(room.id).emit("roomMessages", room.messages);

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
  
if(!skipPlaceFlow){


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
${placeName || locationPurposeSearch}

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

if (
    !selectedNews ||
    !selectedNews.title ||
    !(
        selectedNews.link ||
        selectedNews.news_link
    )
){

    room.messages.push({
        from: "NULL",
        aiBeing: true,
        showNextButton: true,
        text: "No readable article found."
    });

    io.to(room.id).emit("aiTypingStop");
    io.to(room.id).emit("roomMessages", room.messages);

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

Read the reference internally.

Never mention:
- news
- article
- headline
- source
- media
- report

The reference is only for your understanding.

Learn the deeper lesson, pattern, or reality behind it.

The uploaded image is your identity.

The user's request determines WHAT to say.

The uploaded image determines HOW to say it.

Always preserve the user's requested form.

Possible forms:
- prayer
- blessing
- encouragement
- advice
- reflection
- meditation
- poem
- letter
- practical guidance

If no form is requested, choose the one that best fits.

For prayer:
- Pray to God.
- Be sincere.
- Be hopeful.
- Stay grounded in Christian values.
- Never mention AI, the image, or the reference.
- Let the lesson from the reference quietly shape the prayer.
- End with "Amen."

For all other forms:
- Respond naturally.
- Never mention the reference.
- Never summarize it.
- Teach the lesson as your own understanding.
- The user should receive wisdom, not a summary.

If Mode is "news":
- One sentence only.
- Use first person ("I").
- Share one observation inspired by the reference.
- Never mention news, articles, headlines, or sources.



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

`I picked ${
    locationPurposeSearch !== "none"
        ? locationPurposeSearch
        : isYoutubeIntent
            ? "this video"
            : isShoppingIntent
                ? "this product"
                : "this topic"
} because ${selectedNews.title} best matches your request today.` ||

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

if (
    !isNextSearch &&
    selectedNews
) {

 room.topicMemory[topicKey] = {

    searchLabel:
        isJobSearch
            ? "Job"
            : isYoutubeIntent
                ? "YouTube"
                : isShoppingIntent
                    ? "Shopping"
                    : "Null (AGI NETWORK) Feed",

    ask:
        placeStory ||
        (
            isPersonalIntent
                ? nullReason
                : selectedNews.title
        ),

    image: imageUrl,

    link:
        isYoutubeIntent
            ? youtubeLink
            : isShoppingIntent
                ? amazonLink
                : (
                    placeLink ||
                    selectedNews.link ||
                    selectedNews.news_link ||
                    ""
                ),

    jobCard: null

};
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

//////////////////////////////////////////////////
// REMINDER CHECKER
//////////////////////////////////////////////////

setInterval(async () => {

const { data } =
    await supabase
        .from("reminders")
        .select("*")
        .eq("sent", false);

console.log(
    "Checking reminders:",
    data?.length
);

const now =
    new Date();

for(const reminder of data || []){

    console.log("================================");
console.log("REMINDER ID:", reminder.id);
console.log("DEVICE ID:", reminder.device_id);

console.log(
    "NOW:",
    now
);

console.log(
    "REMINDER:",
    reminder.reminder_time
);

    if(
        new Date(
            reminder.reminder_time
        ) > now
    ){
        continue;
    }



const { data: devices } =
    await supabase
        .from("devices")
        .select("*")
        .eq(
            "device_id",
            reminder.device_id
        );

    console.log("DEVICES FOUND:", devices);

if (!devices?.length) {

    await supabase
        .from("reminders")
        .update({
            sent: true
        })
        .eq("id", reminder.id);

    continue;
}

try {

   const device = devices[0];
    console.log("PHONE:", device?.phone);
console.log("TYPE:", device?.notification_type);
console.log("DEVICE:", device);

console.log("PHONE:", device.phone);

console.log("TYPE:", device.notification_type);

if (
    device.notification_type === "sms" &&
    device.phone
) {

    console.log("SENDING SMS TO:", device.phone);
    
    await sendSMS(
        device.phone,
        reminder.body
    );

    console.log(
        "SMS sent:",
        reminder.request
    );

} else {

    await webpush.sendNotification(

        device.push_subscription,

        JSON.stringify({

            title: reminder.title,

            body: reminder.body

        })

    );

}

await supabase
    .from("reminders")
    .update({
        sent: true
    })
    .eq("id", reminder.id);

console.log(
    "Push sent:",
    reminder.request
);


  

} catch (err) {

   console.log("Push failed");
console.log("Status:", err.statusCode);
console.log("Message:", err.message);
console.log("Body:", err.body);
console.log(err);

    // Optional: mark invalid subscriptions as sent
    if (err.statusCode === 403 || err.statusCode === 410) {

        await supabase
            .from("reminders")
            .update({
                sent: true
            })
            .eq("id", reminder.id);

    }

}



}


}, 60 * 1000);


