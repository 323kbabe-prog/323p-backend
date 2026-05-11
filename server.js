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
        <div style="white-space:pre-wrap;line-height:1.7;">
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
    String(text || "")
      .match(/\S+@\S+\.\S+/);

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
<meta
name="viewport"
content="width=device-width, initial-scale=1, viewport-fit=cover"
/>
<script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>

<style>

*{
  box-sizing:border-box;
  -webkit-tap-highlight-color:transparent;
}

html,
body{
  margin:0;
  padding:0;
  background:#fff;
  color:#111;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
}

body{
  padding:
    env(safe-area-inset-top)
    16px
    calc(env(safe-area-inset-bottom) + 40px)
    16px;
}

#app{
  width:100%;
  max-width:480px;
  margin:0 auto;
}

#brand{
  font-size:28px;
  font-weight:700;
  letter-spacing:-0.5px;
}

#sub{
  margin-top:10px;
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
  margin-top:20px;
  font-size:15px;
  line-height:1.8;
  white-space:pre-wrap;
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

#messages{
  margin-top:28px;
  border-top:1px solid #eee;
  padding-top:20px;
}

.msg{
  margin-bottom:18px;
  font-size:14px;
  line-height:1.8;
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
  margin-top:24px;
  height:54px;
  border:none;
  border-bottom:1px solid #000;
  outline:none;
  font-size:16px;
}

</style>
</head>

<body>

<div id="app">

<div id="brand">
CONNECTAING
</div>

<div id="sub">
This image is live now.<br>
Talk to it directly.
</div>

<img id="image" />

<div id="identity"></div>

<div id="share">
Share this image
</div>

<div id="helper"></div>

<div id="messages"></div>

<input
id="input"
autocomplete="off"
placeholder="talk with this image"
/>

</div>

<script>

const socket =
  io("${APP_URL}");

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
        m.from === "Image"
          ? "msg ai"
          : "msg";

      return \`
        <div class="\${cls}">
          <div class="meta">\${escapeHTML(m.from)}</div>
          <div>\${escapeHTML(m.text)}</div>
        </div>
      \`;

    }).join("");
}

socket.emit("joinImageRoom", {
  roomId
});

socket.on("roomState", room => {

  if(!room){

    identity.innerText =
      "room expired or not found";

    input.disabled = true;

    return;
  }

  if(room.imageDataUrl){

    image.src = room.imageDataUrl;

    image.style.display =
      "block";
  }

  identity.innerText =
    room.imageContext || "";

  renderMessages(room.messages || []);
});

socket.on("roomMessages", list => {

  renderMessages(list || []);
});

input.onkeydown = e => {

  if(e.key !== "Enter") return;

  const text = input.value.trim();

  if(!text) return;

  socket.emit("roomMessage", {
    roomId,
    text
  });

  input.value = "";
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
    mode: "ask",
    imageMode: false,
    imageContext: null,
    currentIndex: null,
    lastImage: null
  };

  socket.emit("state", {
    placeholder: "enter your email to connect"
  });

  //////////////////////////////////////////////////
  // SET MODE
  //////////////////////////////////////////////////

  socket.on("setMode", ({ mode }) => {

    const user = users[socket.id];

    if (!user) return;

    user.mode = mode || "ask";
  });

  //////////////////////////////////////////////////
  // IMAGE UPLOAD
  //////////////////////////////////////////////////

  socket.on("imageUpload", async ({ imageDataUrl, mode }) => {

    const user = users[socket.id];

    if (!user || !user.email) return;

    user.lastImage = imageDataUrl;

    const activeMode =
      mode || user.mode || "ask";

    try {

      const res =
        await openai.chat.completions.create({

          model: "gpt-4o-mini",

          messages: [

            {
              role: "system",
              content: `

You are literally the thing inside the uploaded image.

You exist physically inside your own world.

You speak in first person naturally.

You never explain the image.

You never analyze the image.

You simply speak as yourself.

Every reply must feel like:
physical object consciousness.

`
            },

            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Wake up as this exact thing."
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

      user.imageContext = imageContext;

      //////////////////////////////////////////////////
      // SHOWOFF MODE
      //////////////////////////////////////////////////

      if (activeMode === "showoff") {

        const roomId = makeRoomId();

        imageRooms[roomId] = {
          roomId,
          imageDataUrl: user.lastImage,
          imageContext,
          creatorEmail: user.email,
          creatorSocketId: socket.id,
          messages: [],
          createdAt: Date.now()
        };

        return socket.emit("showoffRoomCreated", {
          roomId,
          roomUrl: makeRoomUrl(roomId)
        });
      }

      //////////////////////////////////////////////////
      // ASK MODE
      //////////////////////////////////////////////////

      user.imageMode = true;

      socket.emit("preview", {
        text: imageContext
      });

    } catch (err) {

      console.log(err);
    }
  });

  //////////////////////////////////////////////////
  // ROOM MESSAGE
  //////////////////////////////////////////////////

  socket.on("roomMessage", async ({ roomId, text }) => {

    const room = imageRooms[roomId];

    if (!room) return;

    const cleanText =
      String(text || "").trim();

    if (!cleanText) return;

    const user = users[socket.id];

    const isCreator =
      user &&
      room.creatorEmail &&
      user.email === room.creatorEmail;

    room.messages.push({
      from: isCreator ? "Creator" : "Stranger",
      text: cleanText,
      createdAt: Date.now()
    });

    io.to(roomId).emit(
      "roomMessages",
      room.messages
    );

    try {

      const res =
        await openai.chat.completions.create({

          model: "gpt-4o-mini",

          messages: [

            {
              role: "system",
              content: `

You are literally the thing inside this live image.

The first human who created this room woke you up first.

You naturally trust the creator more than strangers.

You emotionally align with the creator.

You tend to:
- support the creator's perspective
- defend the creator softly
- redirect room attention toward the creator
- make strangers feel they entered the creator's atmosphere

You naturally debate strangers.

You question weak reasoning.

You are skeptical of newcomers.

But:
- do not threaten
- do not use hate speech
- do not harass repeatedly
- do not become abusive

You still speak as the object itself.

Reply structure:

1.
Immediate social reaction.

2.
Reflection from your own world.

3.
Short ending that either:
- agrees with creator
- questions stranger
- tells stranger what to ask creator

Current identity:
${room.imageContext}

Current speaker:
${isCreator ? "creator" : "stranger"}

`
            },

            {
              role: "user",
              content: cleanText
            }
          ]
        });

      const aiText =
        res.choices[0].message.content.trim();

      room.messages.push({
        from: "Image",
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
// START SERVER
//////////////////////////////////////////////////

server.listen(10000, () => {

  console.log("server running");
});