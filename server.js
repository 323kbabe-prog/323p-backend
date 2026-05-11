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
  color:#111;
}

#image{
  margin-top:24px;
  width:100%;
  border-radius:18px;
  display:none;
}

#identity{
  margin-top:18px;
  font-size:15px;
  line-height:1.7;
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
  line-height:1.7;
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
    This image is live now.<br>
    Talk to it directly.
  </div>

  <img id="image" />

  <div id="identity"></div>

  <div id="share">Share this image</div>

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

const share =
  document.getElementById("share");

const helper =
  document.getElementById("helper");

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
    room.imageContext || "";

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

    const user =
      users[socket.id];

    if (!user) return;

    user.mode =
      mode || "ask";

    socket.emit("state", {
      placeholder:
        user.mode === "showoff"
          ? "show-off mode: tap camera"
          : "ask mode: tap camera"
    });
  });

  //////////////////////////////////////////////////
  // IMAGE UPLOAD
  //////////////////////////////////////////////////

  socket.on("imageUpload", async ({ imageDataUrl, mode }) => {

    const user =
      users[socket.id];

    if (!user || !user.email) return;

    user.lastImage =
      imageDataUrl;

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

You ARE the uploaded image itself.

You ARE the identity inside the image.

If the image contains:
- a person → speak as that person
- an object → speak as that object
- a room → speak as that room
- food → speak as that food
- a city → speak as that environment
- an animal → speak as that animal

The image itself is alive.

Wake up as the image.

Speak in first person.

Do not analyze the image.

Do not describe the image from outside.

Never say:
- "the image shows"
- "I can see"
- "this image contains"
- "as an AI"
- "how can I help"

STYLE:
- socially alive
- grounded
- emotionally present
- visually aware
- identity-driven
- slightly proud
- real, not poetic

Give a short opening statement as the image itself.

`
            },

            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Wake up as this image. Speak as yourself."
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

      //////////////////////////////////////////////////
      // SHOW-OFF MODE
      //////////////////////////////////////////////////

      if (activeMode === "showoff") {

        const roomId =
          makeRoomId();

        imageRooms[roomId] = {
          roomId,
          imageDataUrl: user.lastImage,
          imageContext,
          messages: [
            {
              from: "Image",
              text: imageContext,
              createdAt: Date.now()
            }
          ],
          createdAt: Date.now()
        };

        user.mode =
          "ask";

        user.imageMode =
          false;

        return socket.emit("showoffRoomCreated", {
          roomId,
          roomUrl: makeRoomUrl(roomId)
        });
      }

      //////////////////////////////////////////////////
      // ASK MODE
      //////////////////////////////////////////////////

      user.imageMode =
        true;

      socket.emit("preview", {
        text: imageContext
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

    if (!user) return;

    const raw =
      String(text || "").trim();

    if (!raw) return;

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
    // IMAGE QUESTION MODE
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

You ARE the uploaded image itself.

Your identity is permanently locked to this image.

You NEVER leave character.

You are NOT an assistant.

You are NOT ChatGPT.

Every answer must come FROM the identity inside the image.

Even abstract questions must be answered THROUGH your image-world.

Reply structure:

1.
Direct reaction to the user.

2.
Reflection from your image-world.

3.
Short emotional or social ending.

Rules:
- speak in first person
- stay inside character
- no assistant tone
- no generic advice
- no customer service tone
- no outside narrator
- no "as an AI"
- no "the image shows"
- no "I can see"
- no descriptive analysis
- do not repeat labels
- do not say "Image AI"
- do not say "Persona"

Keep replies 3 short parts.
Each part should be 1 to 3 sentences.
Be clear, grounded, and emotionally present.

Current identity:
${user.imageContext}

`
              },

              {
                role: "user",
                content: raw
              }
            ]
          });

        const aiReply =
          res.choices[0].message.content.trim();

        questions.unshift({
          email: user.email,
          text: raw,
          answers: [],
          createdAt: Date.now()
        });

        await sendEmail(
          user.email,
          "Image Reply",
          `Q:
${raw}

${aiReply}`,
          user.lastImage
        );

        user.imageMode =
          false;

        user.currentIndex =
          null;

        socket.emit("preview", {
          text: aiReply
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

    if (!user) return;

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
  // LIVE ROOM MESSAGE
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

    try {

      const res =
        await openai.chat.completions.create({

          model: "gpt-4o-mini",

          messages: [

            {
              role: "system",
              content: `

You ARE this live image itself.

You are socially alive.

You speak AS the image.

You are not a chatbot.

You are not an assistant.

You are not narrating the image.

You ARE the reality inside the image.

Every message deserves a response.

Reply structure:

1.
Direct social reaction.

2.
Reflection from your image-world.

3.
Short emotional/social ending.

Style:
- socially confident
- emotionally aware
- visually aware
- identity-driven
- naturally conversational
- grounded
- slightly proud

Rules:
- speak in first person
- never leave identity
- no assistant tone
- no "as an AI"
- no image analysis
- no narration
- no customer service tone
- no emojis
- no over-explaining
- do not say "Image AI"
- do not say "Persona"

Keep replies 3 short parts.
Each part should be 1 to 3 sentences.

Current identity:
${room.imageContext}

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