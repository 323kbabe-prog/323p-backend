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

```
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
  style="
  max-width:100%;
  border-radius:12px;
  " />`;
```

}

await transporter.sendMail({

```
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
```

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

```
if(
  now - questions[i].createdAt >
  72 * 60 * 60 * 1000
){

  questions.splice(i,1);
}
```

}

//////////////////////////////////////////////////
// ROOM CLEANUP
//////////////////////////////////////////////////

for(const roomId in rooms){

```
if(
  now >
  rooms[roomId].expiresAt
){

  io.to(roomId).emit(
    "roomClosed"
  );

  delete rooms[roomId];
}
```

}

}, 60 * 1000);

//////////////////////////////////////////////////
// HELPERS
//////////////////////////////////////////////////

function extractEmail(text){

const m =
text.match(/\S+@\S+.\S+/);

return m
? m[0].toLowerCase()
: null;
}

function sanitizeText(t){

return t
.replace(/**/g,"")
.replace(
/Atmosphere:/gi,
"Environment:"
)
.replace(
/Emotional Tone:/gi,
"Presence:"
);
}

//////////////////////////////////////////////////
// ROOM LINK
//////////////////////////////////////////////////

app.get(
"/room/:roomId",
(req,res) => {

const room =
rooms[req.params.roomId];

if(!room){

```
return res.json({
  error:"room not found"
});
```

}

res.json({
roomId:room.id,
imageContext:
room.imageContext,
imageDataUrl:
room.imageDataUrl,
messages:
room.messages
});

});

//////////////////////////////////////////////////
// SOCKET
//////////////////////////////////////////////////

io.on("connection", socket => {

users[socket.id] = {

```
step:"email",

email:null,

imageMode:false,

imageContext:null,

currentIndex:null,

lastImage:null,

currentRoom:null
```

};

socket.emit("state", {

```
placeholder:
  "enter your email to connect"
```

});

//////////////////////////////////////////////////
// IMAGE UPLOAD
//////////////////////////////////////////////////

socket.on(
"imageUpload",

```
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
```

Describe this image as an AI identity.

Format:
Objects
Environment
Presence

Rules:

* short phrases
* no markdown
* no symbols
  `
  },

  ```
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
    sanitizeText(
      res.choices[0]
        .message
        .content
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

      creatorEmail:
        user.email,

      imageContext:
        user.imageContext,

      imageDataUrl,

      messages:[],

      createdAt:
        Date.now(),

      expiresAt:
        Date.now() +
        60 * 60 * 1000
    };

    socket.join(roomId);

    user.currentRoom =
      roomId;

    socket.emit(
      "roomCreated",
      {
        roomId,

        shareUrl:
  ```

`https://connectaing.com/room/${roomId}`,

```
        imageContext:
          user.imageContext,

        imageDataUrl
      }
    );

    return;
  }

  //////////////////////////////////////////////////
  // NORMAL IMAGE AI MODE
  //////////////////////////////////////////////////

  user.imageMode = true;

  socket.emit("preview", {

    text:
```

`Image AI:
${user.imageContext}`
});

```
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
```

});

//////////////////////////////////////////////////
// JOIN ROOM
//////////////////////////////////////////////////

socket.on(
"joinRoom",

```
({ roomId }) => {

const room =
  rooms[roomId];

if(!room) return;

socket.join(roomId);

users[socket.id]
  .currentRoom =
  roomId;

socket.emit(
  "roomJoined",
  {
    roomId:
      room.id,

    imageContext:
      room.imageContext,

    imageDataUrl:
      room.imageDataUrl,

    messages:
      room.messages,

    shareUrl:
```

`https://connectaing.com/room/${roomId}`
}
);
});

//////////////////////////////////////////////////
// INPUT
//////////////////////////////////////////////////

socket.on(
"input",

```
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
        "tap camera to ask image AI"
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
```

You are the image identity itself.

Current year:
${new Date().getFullYear()}

Rules:

* short replies
* emotionally aware
* no markdown
  `
  },

  ```
        {
          role:"user",
          content:raw
        }
      ]
    });

    const aiReply =
      sanitizeText(
        res.choices[0]
          .message
          .content
      );

    const finalAnswer =
  ```

`Image AI:
${user.imageContext}

${aiReply}`;

```
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
```

${raw}

${finalAnswer}`,

```
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
          "tap a question"
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
        "tap camera to ask image AI"
    }
  );
}
```

});

//////////////////////////////////////////////////
// SELECT QUESTION
//////////////////////////////////////////////////

socket.on(
"selectQuestion",

```
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
```

});

//////////////////////////////////////////////////
// REQUEST QUESTIONS
//////////////////////////////////////////////////

socket.on(
"requestQuestions",

```
() => {

socket.emit(
  "questions",
  questions.slice(0,10)
);
```

});

//////////////////////////////////////////////////
// ROOM MESSAGE
//////////////////////////////////////////////////

socket.on(
"roomMessage",

```
async ({ text }) => {

const user =
  users[socket.id];

const room =
  rooms[user.currentRoom];

if(!room) return;

const pair = {

  from:user.email,

  userText:text,

  aiText:"",

  createdAt:Date.now()
};

room.messages.push(pair);

io.to(room.id).emit(
  "roomMessages",
  room.messages
);

//////////////////////////////////////////////////
// AI REPLY
//////////////////////////////////////////////////

try{

  const res =
    await openai.chat.completions.create({

    model:"gpt-4o-mini",

    messages:[

      {
        role:"system",

        content:`
```

You are the room itself.

Image identity:
${room.imageContext}

Room creator:
${room.creatorEmail}

Rules:

* short replies
* emotional awareness
* socially reactive
* no markdown
* naturally conversational
  `
  },

  ```
      {
        role:"user",
        content:text
      }
    ]
  });

  pair.aiText =
    sanitizeText(
      res.choices[0]
        .message
        .content
    );

  io.to(room.id).emit(
    "roomMessages",
    room.messages
  );
  ```

  }catch(err){

  ```
  console.log(err);
  ```

  }

  });

  //////////////////////////////////////////////////
  // LEAVE ROOM
  //////////////////////////////////////////////////

  socket.on(
  "leaveRoom",

  () => {

  const user =
  users[socket.id];

  if(user.currentRoom){

  ```
  socket.leave(
    user.currentRoom
  );
  ```

  }

  user.currentRoom = null;
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
