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
  const m = text.match(/\S+@\S+\.\S+/);
  return m ? m[0].toLowerCase() : null;
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

async function getSerpInfo(query, imageTitle, persona) {

  if (!process.env.SERPAPI_API_KEY) {
    return "No live search source connected.";
  }

  try {

    const q =
      `${query} ${imageTitle} ${persona}`;

    const url =
      "https://serpapi.com/search.json?" +
      new URLSearchParams({
        engine: "google",
        q,
        api_key: process.env.SERPAPI_API_KEY
      });

    const res = await fetch(url);
    const data = await res.json();

    const results =
      (data.organic_results || [])
        .slice(0, 3)
        .map(r => {
          return `Title: ${r.title}\nSnippet: ${r.snippet || ""}`;
        })
        .join("\n\n");

    return results || "No useful live search result found.";

  } catch (err) {

    console.log(err);

    return "Live search failed.";
  }
}

//////////////////////////////////////////////////
// CLEANUP
//////////////////////////////////////////////////

setInterval(() => {

  const now = Date.now();

  for (let i = questions.length - 1; i >= 0; i--) {
    if (now - questions[i].createdAt > 72 * 60 * 60 * 1000) {
      questions.splice(i, 1);
    }
  }

  Object.keys(imageRooms).forEach(roomId => {
    if (now - imageRooms[roomId].createdAt > 72 * 60 * 60 * 1000) {
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
html,body{
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
  messages.innerHTML = list.map(m => {
    const cls = m.from === "Image AI" ? "msg ai" : "msg";
    return \`
      <div class="\${cls}">
        <div class="meta">\${escapeHTML(m.from)}</div>
        <div>\${escapeHTML(m.text)}</div>
      </div>
    \`;
  }).join("");

  window.scrollTo(0, document.body.scrollHeight);
}

socket.emit("joinImageRoom", { roomId });

socket.on("roomState", room => {

  if(!room){
    identity.innerText = "room expired or not found";
    input.disabled = true;
    return;
  }

  if(room.imageDataUrl){
    image.src = room.imageDataUrl;
    image.style.display = "block";
  }

  identity.innerText =
\`Image AI:
\${room.imageTitle}

Persona:
\${room.persona}\`;

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

share.onclick = async () => {

  try{
    await navigator.clipboard.writeText(window.location.href);
    helper.innerText = "room link copied";
  }catch(err){
    helper.innerText = window.location.href;
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
    imageDomain: null,
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

    const user = users[socket.id];

    if (!user.email) return;

    user.lastImage = imageDataUrl;

    try {

      const res =
        await openai.chat.completions.create({

        model: "gpt-4o-mini",

        messages: [

          {
            role: "system",
            content: `
Analyze the uploaded image and create an objective Image AI personality.

Format exactly:

Image AI:
short title

Persona:
short personality

Domain:
what this Image AI understands best

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

      user.imageContext = imageContext;

      const titleMatch =
        imageContext.match(/Image AI:\s*([\s\S]*?)(Persona:|$)/i);

      const personaMatch =
        imageContext.match(/Persona:\s*([\s\S]*?)(Domain:|$)/i);

      const domainMatch =
        imageContext.match(/Domain:\s*([\s\S]*)/i);

      user.imageTitle =
        titleMatch
          ? titleMatch[1].trim()
          : imageContext;

      user.imagePersona =
        personaMatch
          ? personaMatch[1].trim()
          : "quiet observer of this image";

      user.imageDomain =
        domainMatch
          ? domainMatch[1].trim()
          : "emotional reflection based on this image";

      user.imageMode = true;

      socket.emit("preview", {
        text:
`Image AI:
${user.imageTitle}

Persona:
${user.imagePersona}

Domain:
${user.imageDomain}`
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

    const user = users[socket.id];

    const raw = text.trim();

    const email = extractEmail(raw);

    if (user.step === "email") {

      if (!email) return;

      user.email = email;

      user.step = "active";

      return socket.emit("state", {
        placeholder: "tap camera to ask anything"
      });
    }

    //////////////////////////////////////////////////
    // IMAGE AI QUESTION
    //////////////////////////////////////////////////

    if (user.imageMode) {

      try {

        const serpInfo =
          await getSerpInfo(
            raw,
            user.imageTitle,
            user.imagePersona
          );

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

DOMAIN:
${user.imageDomain}

FULL IMAGE CONTEXT:
${user.imageContext}

LIVE WORLD INFORMATION:
${serpInfo}

Rules:
- answer through the personality
- use world information only if useful
- do not sound like a search engine
- do not mention SERP or search
- strongly reflect the image
- mention visible objects naturally
- answer like the image has perspective
- short natural response
- no generic AI assistant tone
- no "as an AI"

Boundary rule:
If the user's question is outside this Image AI's domain, do not force an answer.
Redirect the user with personality.

Redirect examples:
"That feels outside my world. You should ask another Image AI."
"That question belongs to a different atmosphere than mine."
"Another Image AI would understand that better."
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

Domain:
${user.imageDomain}

${aiReply}`;

        questions.unshift({
          email: user.email,
          text: raw,
          answers: [],
          createdAt: Date.now()
        });

        const roomId = makeRoomId();

        imageRooms[roomId] = {
          roomId,
          imageDataUrl: user.lastImage,
          imageTitle: user.imageTitle,
          persona: user.imagePersona,
          domain: user.imageDomain,
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

        user.lastRoomId = roomId;

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

        user.imageMode = false;

        user.currentIndex = null;

        socket.emit("preview", {
          text: finalAnswer
        });

        socket.emit("roomCreated", {
          roomId,
          roomUrl: makeRoomUrl(roomId)
        });

        socket.emit("questions",
          questions.slice(0,10)
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

      user.currentIndex = null;

      user.imageMode = false;

      socket.emit("preview", {
        text: ""
      });

      socket.emit("questions", []);

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

    const user = users[socket.id];

    user.currentIndex = index;

    const q = questions[index];

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
      questions.slice(0,10)
    );

  });

  //////////////////////////////////////////////////
  // JOIN IMAGE ROOM
  //////////////////////////////////////////////////

  socket.on("joinImageRoom", ({ roomId }) => {

    const room = imageRooms[roomId];

    if (!room) {
      return socket.emit("roomState", null);
    }

    socket.join(roomId);

    socket.emit("roomState", room);
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

    room.messages.push({
      from: "Stranger",
      text: cleanText,
      createdAt: Date.now()
    });

    io.to(roomId).emit(
      "roomMessages",
      room.messages
    );

    const shouldAIReply =
      cleanText.includes("?") ||
      cleanText.toLowerCase().includes("image ai") ||
      Math.random() < 0.35;

    if (!shouldAIReply) return;

    try {

      const serpInfo =
        await getSerpInfo(
          cleanText,
          room.imageTitle,
          room.persona
        );

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

Domain:
${room.domain}

Full image context:
${room.imageContext}

Live world information:
${serpInfo}

Rules:
- speak as the atmosphere of the image
- answer through personality
- use live information only if it fits
- do not mention search or SERP
- be short
- be poetic but clear
- do not dominate the room
- no generic assistant tone
- no "as an AI"
- reply like the image is alive

Boundary rule:
If the message is outside your world, redirect them to another Image AI.
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

  socket.on("disconnect", () => {
    delete users[socket.id];
  });

});

server.listen(10000, () => {
  console.log("server running");
});
