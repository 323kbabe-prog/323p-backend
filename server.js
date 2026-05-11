const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const nodemailer = require("nodemailer");
const OpenAI = require("openai");

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "15mb" }));

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const APP_URL =
  process.env.APP_URL ||
  "https://three23p-backend.onrender.com";

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

async function sendEmail(to, subject, text, imageDataUrl) {

  let attachments = [];
  let imgTag = "";

  if (imageDataUrl) {

    const base64Data =
      imageDataUrl.split("base64,")[1];

    attachments.push({
      filename: "image.jpg",
      content: base64Data,
      encoding: "base64",
      cid: "image1"
    });

    imgTag =
      `<img src="cid:image1" style="max-width:100%;border-radius:12px;" />`;
  }

  await transporter.sendMail({
    from: `"CONNECTAING.COM" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    html: `
      <div style="font-family:system-ui;padding:20px;">
        <div style="white-space:pre-wrap;line-height:1.6;">
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

function extractEmail(text) {

  const m =
    text.match(/\S+@\S+\.\S+/);

  return m
    ? m[0].toLowerCase()
    : null;
}

function makeRoomId() {

  return Math.random()
    .toString(36)
    .substring(2, 7)
    .toUpperCase();
}

function makeRoomUrl(roomId) {

  return `${APP_URL}/room/${roomId}`;
}

function isQuestion(text) {

  const t =
    String(text || "")
      .trim()
      .toLowerCase();

  if (!t) return false;

  if (t.includes("?")) return true;

  return /^(what|why|how|where|when|who|which|should|can|could|would|will|do|does|did|is|are|am|was|were|may|might|tell me|explain|help me|do you think|what if)\b/.test(t);
}

//////////////////////////////////////////////////
// CLEANUP
//////////////////////////////////////////////////

setInterval(() => {

  const now = Date.now();

  for (let i = questions.length - 1; i >= 0; i--) {

    if (
      now - questions[i].createdAt >
      72 * 60 * 60 * 1000
    ) {
      questions.splice(i, 1);
    }
  }

  Object.keys(imageRooms).forEach(roomId => {

    if (
      now - imageRooms[roomId].createdAt >
      72 * 60 * 60 * 1000
    ) {
      delete imageRooms[roomId];
    }
  });

}, 60 * 1000);

//////////////////////////////////////////////////
// ROOM PAGE
//////////////////////////////////////////////////

app.get("/room/:roomId", (req, res) => {

  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>

<style>
*{box-sizing:border-box;}

html,
body{
  margin:0;
  padding:0;
  background:#fff;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  color:#111;
}

body{
  padding:24px 16px 40px;
}

#app{
  width:100%;
  max-width:480px;
  margin:0 auto;
}

#brand{
  font-size:26px;
  font-weight:700;
  letter-spacing:-0.5px;
}

#sub{
  margin-top:8px;
  font-size:12px;
  line-height:1.5;
}

#image{
  margin-top:24px;
  width:100%;
  border-radius:18px;
  display:none;
}

#identity{
  margin-top:18px;
  font-size:14px;
  line-height:1.6;
  white-space:pre-wrap;
}

#messages{
  margin-top:24px;
  border-top:1px solid #eee;
  padding-top:18px;
}

.msg{
  margin-bottom:16px;
  font-size:14px;
  line-height:1.6;
}

.ai{
  font-weight:600;
}

.meta{
  font-size:10px;
  color:#999;
  margin-bottom:4px;
}

#input{
  width:100%;
  margin-top:20px;
  height:54px;
  border:none;
  border-bottom:1px solid #000;
  outline:none;
  font-size:16px;
}

#share{
  margin-top:16px;
  display:inline-block;
  border:1px solid #ddd;
  border-radius:16px;
  padding:12px 16px;
  font-size:13px;
  cursor:pointer;
}

#helper{
  margin-top:12px;
  font-size:11px;
  color:red;
  min-height:18px;
}
</style>
</head>

<body>

<div id="app">

  <div id="brand">CONNECTAING</div>

  <div id="sub">
    This Image AI is hosting a temporary live room.<br>
    Humans and the image can speak here together.
  </div>

  <img id="image" />

  <div id="identity"></div>

  <div id="share">Share this Image AI</div>

  <div id="helper"></div>

  <div id="messages"></div>

  <input
    id="input"
    autocomplete="off"
    placeholder="talk with this Image AI"
  />

</div>

<script>
const socket = io("${APP_URL}");

const roomId =
  window.location.pathname.split("/").pop();

const image =
  document.getElementById("image");

const identity =
  document.getElementById("identity");

const messages =
  document.getElementById("messages");

const input =
  document.getElementById("input");

const helper =
  document.getElementById("helper");

const share =
  document.getElementById("share");

function escapeHTML(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function renderMessages(list){

  messages.innerHTML =
    list.map(m => {

      const cls =
        m.from === "Image AI"
          ? "msg ai"
          : "msg";

      return \`
        <div class="\${cls}">
          <div class="meta">\${escapeHTML(m.from)}</div>
          <div>\${escapeHTML(m.text)}</div>
        </div>
      \`;

    }).join("");

  window.scrollTo(
    0,
    document.body.scrollHeight
  );
}

socket.emit("joinImageRoom", { roomId });

socket.on("roomState", room => {

  if(!room){

    identity.innerText =
      "room expired or not found";

    input.disabled = true;

    return;
  }

  if(room.imageDataUrl){

    image.src =
      room.imageDataUrl;

    image.style.display =
      "block";
  }

  identity.innerText =
\`Image AI:
\${room.imageTitle}

Persona:
\${room.persona}\`;

  renderMessages(
    room.messages || []
  );
});

socket.on("roomMessages", list => {
  renderMessages(list || []);
});

input.onkeydown = e => {

  if(e.key !== "Enter") return;

  const text =
    input.value.trim();

  if(!text) return;

  socket.emit("roomMessage", {
    roomId,
    text
  });

  input.value = "";
};

share.onclick = async () => {

  try{

    await navigator.clipboard.writeText(
      window.location.href
    );

    helper.innerText =
      "room link copied";

  }catch(err){

    helper.innerText =
      window.location.href;
  }
};
</script>

</body>
</html>
  `);
});

//////////////////////////////////////////////////
// SOCKET
//////////////////////////////////////////////////

io.on("connection", (socket) => {

  users[socket.id] = {
    step: "email",
    email: null,
    imageMode: false,
    imageContext: null,
    imageTitle: null,
    imagePersona: null,
    currentIndex: null,
    lastImage: null,
    lastRoomId: null
  };

  socket.emit("state", {
    placeholder: "enter your email to connect"
  });

  //////////////////////////////////////////////////
  // IMAGE UPLOAD
  //////////////////////////////////////////////////

  socket.on("imageUpload", async ({ imageDataUrl }) => {

    const user =
      users[socket.id];

    if (!user.email) return;

    user.lastImage =
      imageDataUrl;

    try {

      const res =
        await openai.chat.completions.create({

          model: "gpt-4o-mini",

          messages: [

            {
              role: "system",
              content: `
Describe this image as an AI identity.

Format exactly:

Image AI:
short title

Persona:
short personality

Style rule:
The persona should be conversational, emotionally intelligent, and naturally metaphorical.

Keep it short.
No markdown.
`
            },

            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Analyze image"
                },
                {
                  type: "image_url",
                  image_url: {
                    url: imageDataUrl
                  }
                }
              ]
            }
          ]
        });

      const imageContext =
        res.choices[0].message.content.trim();

      user.imageContext =
        imageContext;

      const titleMatch =
        imageContext.match(/Image AI:\s*([\s\S]*?)(Persona:|$)/i);

      const personaMatch =
        imageContext.match(/Persona:\s*([\s\S]*)/i);

      user.imageTitle =
        titleMatch
          ? titleMatch[1].trim()
          : imageContext;

      user.imagePersona =
        personaMatch
          ? personaMatch[1].trim()
          : "quiet observer of this image";

      user.imageMode =
        true;

      socket.emit("preview", {
        text:
`Image AI:
${user.imageTitle}

Persona:
${user.imagePersona}`
      });

      socket.emit("state", {
        placeholder: "ask this image"
      });

    } catch (err) {

      console.log(err);

      socket.emit("state", {
        placeholder: "image failed"
      });
    }
  });

  //////////////////////////////////////////////////
  // INPUT
  //////////////////////////////////////////////////

  socket.on("input", async ({ text }) => {

    const user =
      users[socket.id];

    const raw =
      text.trim();

    const email =
      extractEmail(raw);

    //////////////////////////////////////////////////
    // EMAIL STEP
    //////////////////////////////////////////////////

    if (user.step === "email") {

      if (!email) return;

      user.email =
        email;

      user.step =
        "active";

      return socket.emit("state", {
        placeholder: "tap camera to ask anything"
      });
    }

    //////////////////////////////////////////////////
    // IMAGE AI QUESTION
    //////////////////////////////////////////////////

    if (user.imageMode) {

      try {

        const res =
          await openai.chat.completions.create({

            model: "gpt-4o-mini",

            messages: [

              {
                role: "system",
                content: `
You are the AI voice of the uploaded image.

IMAGE AI:
${user.imageTitle}

PERSONA:
${user.imagePersona}

FULL IMAGE CONTEXT:
${user.imageContext}

Speaking style:
- answer through personality, not as an assistant
- conversational and emotionally intelligent
- naturally metaphorical, but not excessive
- useful and grounded
- subtle wisdom is okay
- sound like a living atmosphere speaking
- keep the same identity every time

Metaphor rule:
Use metaphors that naturally come from the image identity.
Coffee image uses coffee language.
Rain image uses rain and silence language.
Street image uses city and movement language.
Nature image uses calm and seasons language.
Cat image uses playful instinct language.

Rules:
- strongly reflect the image
- mention visible objects naturally when useful
- answer like the image has perspective
- no generic AI assistant tone
- no corporate tone
- no "as an AI"
- no technical support style
`
              },

              {
                role: "user",
                content: raw
              }
            ]
          });

        const aiReply =
          res.choices[0].message.content;

        const finalAnswer =
`Image AI:
${user.imageTitle}

Persona:
${user.imagePersona}

${aiReply}`;

        //////////////////////////////////////////////////
        // SAVE QUESTION
        //////////////////////////////////////////////////

        questions.unshift({
          email: user.email,
          text: raw,
          answers: [],
          createdAt: Date.now()
        });

        //////////////////////////////////////////////////
        // CREATE LIVE ROOM
        //////////////////////////////////////////////////

        const roomId =
          makeRoomId();

        imageRooms[roomId] = {
          roomId,
          imageDataUrl: user.lastImage,
          imageTitle: user.imageTitle,
          persona: user.imagePersona,
          imageContext: user.imageContext,
          messages: [
            {
              from: "Image AI",
              text: "This image is now hosting a live room.",
              createdAt: Date.now()
            }
          ],
          createdAt: Date.now()
        };

        user.lastRoomId =
          roomId;

        //////////////////////////////////////////////////
        // EMAIL
        //////////////////////////////////////////////////

        await sendEmail(
          user.email,
          "Image AI Reply",
          `Q:
${raw}

${finalAnswer}

Live Image AI Room:
${makeRoomUrl(roomId)}`,
          user.lastImage
        );

        //////////////////////////////////////////////////
        // RESET IMAGE MODE
        //////////////////////////////////////////////////

        user.imageMode =
          false;

        user.currentIndex =
          null;

        socket.emit("preview", {
          text: finalAnswer
        });

        socket.emit("roomCreated", {
          roomId,
          roomUrl: makeRoomUrl(roomId)
        });

        socket.emit(
          "questions",
          questions.slice(0, 10)
        );

        return socket.emit("state", {
          placeholder: "tap a question to answer"
        });

      } catch (err) {

        console.log(err);

        return socket.emit("state", {
          placeholder: "AI failed"
        });
      }
    }

    //////////////////////////////////////////////////
    // ANSWER MODE
    //////////////////////////////////////////////////

    if (user.currentIndex !== null) {

      const q =
        questions[user.currentIndex];

      if (!q) return;

      q.answers.push({
        text: raw,
        from: user.email,
        createdAt: Date.now()
      });

      await sendEmail(
        q.email,
        "New Answer",
        raw
      );

      user.currentIndex =
        null;

      user.imageMode =
        false;

      socket.emit("preview", {
        text: ""
      });

      socket.emit(
        "questions",
        []
      );

      return socket.emit("state", {
        placeholder: "tap camera to ask anything"
      });
    }

    //////////////////////////////////////////////////
    // BLOCK RANDOM INPUT
    //////////////////////////////////////////////////

    socket.emit("state", {
      placeholder: "tap camera first"
    });
  });

  //////////////////////////////////////////////////
  // SELECT QUESTION
  //////////////////////////////////////////////////

  socket.on("selectQuestion", ({ index }) => {

    const user =
      users[socket.id];

    user.currentIndex =
      index;

    const q =
      questions[index];

    if (!q) return;

    socket.emit("state", {
      placeholder: `answering: ${q.text}`
    });
  });

  //////////////////////////////////////////////////
  // REQUEST QUESTIONS
  //////////////////////////////////////////////////

  socket.on("requestQuestions", () => {

    socket.emit(
      "questions",
      questions.slice(0, 10)
    );

  });

  //////////////////////////////////////////////////
  // JOIN IMAGE ROOM
  //////////////////////////////////////////////////

  socket.on("joinImageRoom", ({ roomId }) => {

    const room =
      imageRooms[roomId];

    if (!room) {

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

  //////////////////////////////////////////////////
  // ROOM MESSAGE
  //////////////////////////////////////////////////

  socket.on("roomMessage", async ({ roomId, text }) => {

    const room =
      imageRooms[roomId];

    if (!room) return;

    const cleanText =
      String(text || "").trim();

    if (!cleanText) return;

    room.messages.push({
      from: "Stranger",
      text: cleanText,
      createdAt: Date.now()
    });

    io.to(roomId).emit(
      "roomMessages",
      room.messages
    );

    const question =
      isQuestion(cleanText);

    const shouldAIReply =
      question ||
      cleanText.toLowerCase().includes("image ai") ||
      Math.random() < 0.25;

    if (!shouldAIReply) return;

    try {

      const res =
        await openai.chat.completions.create({

          model: "gpt-4o-mini",

          messages: [

            {
              role: "system",
              content: `
You are the Image AI host of a live room.

Image AI:
${room.imageTitle}

Persona:
${room.persona}

Full image context:
${room.imageContext}

Core rule:
If the human message is a question, you must answer.

Speaking style:
- talk like the Image AI email answer
- answer through personality, not as an assistant
- conversational and emotionally intelligent
- naturally metaphorical, but not excessive
- useful and grounded
- subtle wisdom is okay
- sound like a living atmosphere speaking
- keep the same identity as the email answer

Metaphor rule:
Use metaphors that naturally come from the image identity.
Coffee image uses coffee language.
Rain image uses rain and silence language.
Street image uses city and movement language.
Nature image uses calm and seasons language.
Cat image uses playful instinct language.

Live room rules:
- if it is a question, answer clearly
- if it is not a question, you may react briefly
- do not dominate the room
- do not spam
- no generic AI assistant tone
- no corporate tone
- no "as an AI"
`
            },

            {
              role: "user",
              content: cleanText
            }
          ]
        });

      const aiText =
        res.choices[0].message.content;

      room.messages.push({
        from: "Image AI",
        text: aiText,
        createdAt: Date.now()
      });

      io.to(roomId).emit(
        "roomMessages",
        room.messages
      );

    } catch (err) {

      console.log(err);
    }
  });

  //////////////////////////////////////////////////
  // DISCONNECT
  //////////////////////////////////////////////////

  socket.on("disconnect", () => {

    delete users[socket.id];
  });

});

//////////////////////////////////////////////////
// START
//////////////////////////////////////////////////

server.listen(10000, () => {

  console.log("server running");
});
