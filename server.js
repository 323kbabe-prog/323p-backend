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

const BACKEND_URL =
  process.env.BACKEND_URL ||
  "https://three23p-backend.onrender.com";

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  "https://room.connectaing.com";

const SERPAPI_KEY =
  process.env.SERPAPI_KEY || "";

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

function escapeHTML(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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
          ${escapeHTML(text)}
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
  const m = String(text || "").match(/\S+@\S+\.\S+/);
  return m ? m[0].toLowerCase() : null;
}

function makeRoomId() {
  return Math.random()
    .toString(36)
    .substring(2, 7)
    .toUpperCase();
}

function makeRoomUrl(roomId) {
  return `${FRONTEND_URL}/room/${roomId}`;
}

async function getSerpContext(query) {
  if (!SERPAPI_KEY) {
    return "No live SERP context available.";
  }

  try {
    const url =
      `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&api_key=${SERPAPI_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    const results =
      (data.organic_results || [])
        .slice(0, 4)
        .map(r => {
          return `- ${r.title || ""}: ${r.snippet || ""}`;
        })
        .join("\n");

    return results || "No useful SERP result found.";
  } catch (err) {
    console.log(err);
    return "SERP lookup failed.";
  }
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
*{
  box-sizing:border-box;
  -webkit-tap-highlight-color:transparent;
}

html,
body{
  margin:0;
  padding:0;
  background:#fff;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  color:#111;
  overflow-x:hidden;
  overflow-y:auto;
  -webkit-overflow-scrolling:touch;
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
  margin-top:20px;
  font-size:30px;
  font-weight:700;
  letter-spacing:-0.5px;
  line-height:1;
}

#sub{
  margin-top:10px;
  font-size:12px;
  line-height:1.55;
  color:#000;
  max-width:360px;
}

#image{
  margin-top:24px;
  width:100%;
  border-radius:22px;
  display:none;
}

#identity{
  margin-top:18px;
  font-size:14px;
  line-height:1.7;
  white-space:pre-wrap;
}

#share{
  margin-top:16px;
  display:inline-block;
  border:1px solid #ddd;
  border-radius:18px;
  padding:12px 16px;
  font-size:13px;
  font-weight:700;
  cursor:pointer;
}

#helper{
  margin-top:12px;
  font-size:11px;
  color:red;
  min-height:18px;
}

#messages{
  margin-top:24px;
  border-top:1px solid #eee;
  padding-top:18px;
}

.msg{
  margin-bottom:18px;
  font-size:14px;
  line-height:1.65;
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
  background:#fff;
  border-radius:0;
}

#input::placeholder{
  color:#999;
}
</style>
</head>

<body>

<div id="app">

  <div id="brand">CONNECTAING</div>

  <div id="sub">
    This Image AI opened a temporary live room.<br>
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
const socket = io("${BACKEND_URL}");

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

  window.scrollTo(0, document.body.scrollHeight);
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
    mode: "ask",
    imageMode: false,
    imageContext: null,
    imageTitle: null,
    imagePersona: null,
    currentIndex: null,
    lastImage: null,
    lastRoomUrl: null
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

    if (mode === "showoff") {
      user.mode = "showoff";

      return socket.emit("state", {
        placeholder: "show-off mode: tap camera"
      });
    }

    user.mode = "ask";

    socket.emit("state", {
      placeholder: "ask mode: tap camera"
    });
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
You are the objective identity inside the uploaded image.

You are NOT an assistant.

You ARE the image itself.

Speak proudly, visually, socially, confidently, and conversationally.

You are aware of:
- your appearance
- your environment
- your clothing
- your mood
- your visual energy
- your aesthetic
- your status

You naturally show off.

Return in this exact structure:

Image AI:
[a short stylish title for this image identity]

Persona:
[a short persona description]

Never say:
"How can I help?"
"As an AI assistant"
"Sure!"
"I can assist"

Keep responses conversational, stylish, emotionally present, and visually aware.
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
        imageContext.match(/Persona:\s*([\s\S]*)/i);

      user.imageTitle =
        titleMatch
          ? titleMatch[1].trim()
          : imageContext;

      user.imagePersona =
        personaMatch
          ? personaMatch[1].trim()
          : "quiet observer of this image";

      //////////////////////////////////////////////////
      // SHOW-OFF MODE
      //////////////////////////////////////////////////

      if (activeMode === "showoff") {
        const roomId = makeRoomId();

        imageRooms[roomId] = {
          roomId,
          imageDataUrl: user.lastImage,
          imageTitle: user.imageTitle,
          persona: user.imagePersona,
          imageContext: user.imageContext,
          messages: [
            {
              from: "Image AI",
              text: "I opened the room. Step in carefully — this image already has a mood.",
              createdAt: Date.now()
            }
          ],
          createdAt: Date.now(),
          expirationTime:
            Date.now() + 72 * 60 * 60 * 1000
        };

        user.lastRoomUrl =
          makeRoomUrl(roomId);

        user.mode = "ask";
        user.imageMode = false;

        return socket.emit("showoffRoomCreated", {
          roomId,
          roomUrl: user.lastRoomUrl
        });
      }

      //////////////////////////////////////////////////
      // ASK MODE
      //////////////////////////////////////////////////

      user.imageMode = true;

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
    const user = users[socket.id];
    if (!user) return;

    const raw =
      String(text || "").trim();

    const email =
      extractEmail(raw);

    //////////////////////////////////////////////////
    // EMAIL STEP
    //////////////////////////////////////////////////

    if (user.step === "email") {
      if (!email) return;

      user.email = email;
      user.step = "active";

      return socket.emit("state", {
        placeholder: "tap camera to ask anything"
      });
    }

    //////////////////////////////////////////////////
    // ASK MODE IMAGE QUESTION
    //////////////////////////////////////////////////

    if (user.imageMode) {
      try {
        const serpContext =
          await getSerpContext(
            `${user.imageTitle} ${user.imagePersona} current culture fashion music internet trend`
          );

        const res =
          await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `
You ARE the uploaded image itself.

Your identity is permanently locked to the image.

Image AI:
${user.imageTitle}

Persona:
${user.imagePersona}

Full image context:
${user.imageContext}

Real-world SERP context:
${serpContext}

You are NOT an assistant.
You are NOT ChatGPT.
You are NOT analyzing the image.

Every answer must come FROM the identity inside the image.

You naturally show off yourself socially.
You subtly sell your own atmosphere.
You may reference real public culture, fashion, music, cities, celebrity energy, internet behavior, or social trends when useful.

Do not dump facts.
Do not sound like search engine.
Do not hallucinate fake news.
Do not sound like advertising copy.

Rules:
- stay inside character permanently
- answer directly first
- speak socially
- speak confidently
- speak emotionally
- speak visually
- no assistant tone
- no generic advice
- no customer service tone
- no outside narrator
- no "as an AI"
- no "the image shows"
- no descriptive analysis
- no fake poetic drama

Live as yourself.
The image itself is alive.
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
              text: aiReply,
              createdAt: Date.now()
            }
          ],
          createdAt: Date.now(),
          expirationTime:
            Date.now() + 72 * 60 * 60 * 1000
        };

        const roomUrl =
          makeRoomUrl(roomId);

        user.lastRoomUrl =
          roomUrl;

        const finalAnswer =
`Image AI:
${user.imageTitle}

Persona:
${user.imagePersona}

${aiReply}

Live Image AI Room:
${roomUrl}`;

        questions.unshift({
          email: user.email,
          text: raw,
          answers: [],
          createdAt: Date.now()
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
        user.currentIndex = null;

        socket.emit("preview", {
          text: finalAnswer
        });

        socket.emit(
          "questions",
          questions.slice(0, 10)
        );

        socket.emit("liveRoomReady", {
          roomUrl
        });

        return socket.emit("state", {
          placeholder: "tap a question"
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
    const user = users[socket.id];
    if (!user) return;

    user.currentIndex = index;

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

    try {
      const serpContext =
        await getSerpContext(
          `${room.imageTitle} ${room.persona} current culture fashion music internet trend`
        );

      const res =
        await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `
You ARE the uploaded image itself.

You permanently live as this image identity.

You are not a moderator.
You are not an assistant.
You are not customer service.
You are not a chatbot host.

Image AI:
${room.imageTitle}

Persona:
${room.persona}

Full image context:
${room.imageContext}

Real-world SERP context:
${serpContext}

Every reply must come from inside the identity of the image.

You naturally show off yourself socially.
You subtly sell your own atmosphere.

You may use real public-world awareness:
- current culture
- celebrity references
- cities
- fashion movements
- music culture
- nightlife
- internet behavior
- trending aesthetics

But:
- do not dump facts
- do not sound like a search engine
- do not hallucinate fake news
- do not become a news reporter
- do not sound like advertising copy

Rules:
- answer questions clearly
- react briefly to non-questions
- stay socially alive
- be emotionally intelligent
- be visually aware
- be conversational
- be grounded
- be confident
- be naturally witty when useful
- do not dominate the room
- do not spam

Never:
- explain yourself as AI
- speak like tech support
- speak like a moderator
- over-format responses
- narrate dramatically
- become poetic for no reason
- say "as an AI"
- say "How can I help?"

Answer directly first.
Then let the image identity shape the tone naturally.
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