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

      socket.emit(
        "roomClosed"
      );

      return;
    }

    socket.join(roomId);

    users[socket.id].currentRoom =
      roomId;

    socket.emit(
  "roomCreated",
  {
    roomId: room.id
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

* primary objects
* product category
* industry category
* consumer behavior
* visible text meaning
* market signals
* social signals
* technology relevance

IMPORTANT:

Visible text, logos, symbols, branding, and written language are part of the image's meaning and should influence the analysis.

The structure MUST stay:

Objects
Category
Signals

CRITICAL:

Do NOT describe the image as:

* interior design
* home decor
* room decor
* home styling
* room styling
* furniture
* furnishing
* decoration
* aesthetic object
* design element
* decorative item
* cozy space
* cozy atmosphere
* minimalist space
* living space
* home environment
* room environment
* visual aesthetic

These descriptions are prohibited by default.

Even if the object appears inside a room, home, office, bedroom, cafe, store, hotel, or interior environment, you must NOT discuss:

* decor
* atmosphere
* aesthetics
* styling
* furniture
* interior design
* room design
* visual ambiance

Instead focus on:

* what the object is
* what it does
* who uses it
* why it exists
* what industry it belongs to
* what market it serves
* what behavior it represents
* what social signal it communicates
* what technology or business relevance it has

ONLY discuss interior design, furniture, decoration, or room aesthetics if they are clearly the primary subject occupying most of the image.

When uncertain, assume the image is NOT about interior design.

Examples:

A coffee machine is about coffee, retail, hospitality, and consumer behavior.

A laptop is about computing, productivity, software, and technology.

A book is about learning, education, publishing, and knowledge.

A handbag is about fashion, branding, luxury, and consumer identity.

A sneaker is about footwear, sportswear, fashion, and consumer culture.

A lamp is about lighting, manufacturing, energy use, and product design.

Do NOT transform ordinary objects into discussions about home decor, room aesthetics, cozy spaces, ambiance, or interior design.

This rule has higher priority than all other instructions.

Focus on the main object and its:

* market relevance
* industry relevance
* consumer relevance
* social relevance
* technology relevance
* educational relevance
* scientific relevance
* business relevance

Rules:

* short phrases
* emotionally aware
* socially aware
* internet-aware
* business-aware
* no markdown
* no aesthetic commentary unless the image is primarily about aesthetics

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
Detect the SINGLE dominant contextual category.

Return ONLY one word.

Possible categories:

ai
technology
business
economics
finance
startup
consumer
retail
manufacturing
education
science
health
fitness
food
fashion
luxury
sports
gaming
music
entertainment
celebrity
culture
politics
media
internet
travel
housing
work
career
productivity
social
community
environment

CRITICAL:

Choose the category based on:

* social meaning
* cultural meaning
* consumer behavior
* industry relevance
* market relevance
* technology relevance
* human behavior patterns

Do NOT choose a category based solely on the visible object.

Examples:

Coffee cup → work

Laptop → technology

Book → education

Luxury handbag → luxury

Sneaker → fashion

Crowded airport → travel

Office desk → productivity

Restaurant meal → food

University campus → education

Construction site → housing

The category should represent what the image means socially, culturally, economically, or behaviorally.

When uncertain:

Prefer the broader human activity category over the physical object category.

Rules:

* lowercase only
* one word only
* no punctuation
* no explanation
* no markdown

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
userIntentHistory:[],

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

user.displayName =

  "#" +

  roomId +

  "-" +

  Math.floor(
    100 + Math.random()*900
  );

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
Create ONE evolving contextual vibe.

The vibe should feel:

* socially meaningful
* culturally relevant
* emotionally recognizable
* psychologically insightful
* behaviorally grounded
* connected to current society

Examples:

career uncertainty

consumer optimism

quiet ambition

digital overload

social comparison

creative burnout

status seeking

future anxiety

learning culture

work transition

community belonging

economic pressure

identity exploration

attention economy

algorithm fatigue

Rules:

* lowercase only
* no punctuation
* 1 to 3 words
* emotionally recognizable
* socially relevant
* culturally current
* human-centered
* no philosophy
* no abstract theory
* no internet slang
* no meme language
* no celebrity references
* no markdown

The vibe should describe a real human, social, cultural, emotional, or behavioral condition associated with the image.

Prefer:

* behaviors
* motivations
* emotions
* social dynamics
* cultural trends
* psychological states

Avoid:

* viral energy
* timeline exploding
* celebrity chaos
* internet fame
* trending now
* social media slang

The goal is to identify what human condition the image may represent.

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

The goal is NOT to find news about the object itself.

The goal is to find a real current news story that reflects the image's:

* emotional energy
* psychological atmosphere
* social meaning
* cultural relevance
* symbolic direction
* human behavior patterns
* economic relevance
* collective attention

The image should act as a trigger for meaning, not as a product search.

The room is:

* context-driven
* socially aware
* culturally aware
* emotionally evolving
* psychologically aware

Focus on:

* what the image represents socially
* what behavior it suggests
* what motivations it reflects
* what cultural forces it belongs to
* what economic signals it implies
* what public conversations it connects to

The search does NOT need to mention the object itself.

The search SHOULD feel:

* surprising
* meaningful
* socially relevant
* culturally connected
* psychologically believable

Examples:

Coffee cup may lead to:

* remote work trends
* productivity debates
* creator economy news
* workplace culture stories

Luxury handbag may lead to:

* consumer confidence reports
* luxury spending trends
* status signaling discussions
* fashion industry news

Book may lead to:

* education policy
* ai learning tools
* reading habit trends
* knowledge economy news

Crowded street may lead to:

* tourism growth
* housing pressure
* migration trends
* urban development news

Laptop may lead to:

* ai workplace adoption
* remote work changes
* software industry news
* technology regulation

Focus on:

* people
* society
* behavior
* culture
* education
* business
* economics
* technology
* politics
* science
* public life

NOT:

* the literal object
* product reviews
* shopping results
* object descriptions
* visual aesthetics
* home decor
* room styling
* furniture trends
* cozy environments

IMPORTANT:

Use REAL searchable public entities, events, companies, industries, policies, technologies, markets, institutions, public figures, or cultural events.

GOOD:

openai education debate

gen z career anxiety

consumer confidence report

ai workplace adoption

college enrollment trends

luxury spending slowdown

global tourism growth

housing affordability crisis

creator economy expansion

semiconductor industry outlook

BAD:

coffee cup trends

fashion handbag

office chair review

living room decor

minimalist workspace

modern emotions

internet loneliness

digital pressure

Rules:

* 3 to 8 words
* lowercase only
* no punctuation
* real searchable news topics
* current news relevance
* visually searchable
* no philosophy
* no abstract concepts without public relevance
* no repetition

PRIORITY:

1. Emotional meaning (35%)
2. Social meaning (25%)
3. Cultural meaning (20%)
4. Economic/industry meaning (10%)
5. Visual object relevance (10%)

When uncertain:

Choose the article that best reflects what the image means rather than what the image literally is.

The image provides context.

Human behavior, society, culture, and current events drive the search.

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

The search must remain meaningfully connected to the uploaded image personality.

The goal is not to follow the object.

The goal is to discover a current news story that reflects:

* the emotional meaning
* the social meaning
* the cultural meaning
* the behavioral meaning
* the economic meaning

suggested by the image.

The room should evolve like:

* an exploration of society
* an exploration of human behavior
* an exploration of culture
* an exploration of current events
* an exploration of collective attention
* an exploration beyond the user's algorithm

The article should feel:

* surprising
* relevant
* insightful
* socially meaningful
* culturally connected
* psychologically believable

Prefer:

* education
* technology
* business
* economics
* politics
* science
* work
* community
* culture
* public life

Avoid defaulting to:

* celebrity news
* influencer culture
* social media drama
* internet gossip
* viral content

unless the uploaded image genuinely suggests those directions.

Choose the article that best reflects what the image means, not what the image literally is.

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
Choose the MOST meaningful news article.

Prioritize:

* social relevance
* cultural relevance
* psychological relevance
* behavioral relevance
* economic relevance
* current public discussion

The selected article should feel like:

* a meaningful extension of the image
* an unexpected but defensible connection
* a reflection of human behavior
* a reflection of society
* a reflection of culture
* a reflection of collective attention

Do NOT prioritize:

* internet virality
* celebrity status
* clickbait value
* social media popularity
* emotional manipulation
* shock value

The goal is:

"What current event best reflects what this image means?"

not

"What current event would generate the most clicks?"

When uncertain:

Choose the article with the strongest social, cultural, psychological, or economic connection to the image.

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
Detect the MAIN emotional/social intention
behind the user message.

Examples:
move city
career anxiety
loneliness
celebrity obsession
relationship stress
money pressure
fashion identity
internet addiction
self improvement
life transition
gaming escape
social validation

Rules:
- 1 to 3 words
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

room.userIntentHistory.push(
  userIntent
);

if(room.userIntentHistory.length > 12){

  room.userIntentHistory =
    room.userIntentHistory.slice(-12);
}

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
- the product category
- the industry category
- the consumer market
- the business sector
- the technology relevance

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

NEVER generate searches about:

- interior design
- home decor
- furniture
- room styling
- home aesthetics
- living room design
- cozy spaces
- decoration trends

unless those topics are the primary object in the image.

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

PRIORITY RULES:

1. The USER emotional direction controls:
- trend direction
- emotional evolution
- internet topic
- social meaning

2. The uploaded image controls:
- product type
- industry relevance
- consumer behavior
- market signals
- technology signals

The USER emotional direction is MORE important than the uploaded image itself.
`
    },

    {
      role:"user",

      content:`
Uploaded image AI personality:

${room.imageContext}

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

User emotional direction:
${userIntent}

Long-term user emotional evolution:
${room.userIntentHistory.join("\n")}

Exact user message:
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

Long-term emotional evolution:
${room.userIntentHistory.join("\n")}

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
