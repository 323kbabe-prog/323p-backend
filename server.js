//////////////////////////////////////////////////////////////
// AI CONNECT — FINAL BACKEND (STABLE, NO SHARP)
//////////////////////////////////////////////////////////////

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
  cors: { origin: "*" },
  maxHttpBufferSize: 15 * 1024 * 1024
});

//////////////////////////////////////////////////////////////
// CONFIG
//////////////////////////////////////////////////////////////

const APP_URL = process.env.APP_URL || "https://connectaing.com";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

//////////////////////////////////////////////////////////////
// EMAIL (CID IMAGE)
//////////////////////////////////////////////////////////////

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendEmailWithImage(to, subject, html, imageDataUrl, replyToEmail) {
  try {
    const base64 = imageDataUrl.split(",")[1];

    await transporter.sendMail({
      from: `"AI Connect" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      replyTo: replyToEmail,
      html,
      attachments: [
        {
          filename: "image.jpg",
          content: base64,
          encoding: "base64",
          cid: "img1"
        }
      ]
    });
  } catch (err) {
    console.log("EMAIL ERROR:", err);
  }
}

//////////////////////////////////////////////////////////////
// DATA
//////////////////////////////////////////////////////////////

const users = {};
const questions = [];

function makeId() {
  return Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

function extractEmail(text) {
  const m = text.match(/\S+@\S+\.\S+/);
  return m ? m[0].toLowerCase() : null;
}

//////////////////////////////////////////////////////////////
// SEED
//////////////////////////////////////////////////////////////

function seedAIQuestionsIfEmpty() {
  if (questions.length > 0) return;

  const seeds = [
    "Anne Hathaway looks older, but I believe we are both old and young at the same time.",
    "What should I learn in AI for next week?",
    "Is it okay that I love Justin Bieber? I am 31.",
    "I’m not Asian—can I drink boba tea?",
    "I finally decided that Jisoo is my favorite.",
    "I love myself already. Do I need to find a girlfriend?"
  ];

  seeds.forEach(text => {
    questions.unshift({
      id: makeId(),
      text,
      answers: [],
      createdAt: Date.now()
    });
  });

  io.emit("count", questions.length);
}

//////////////////////////////////////////////////////////////
// IMAGE AI
//////////////////////////////////////////////////////////////

async function createPersona(image) {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Create emotional voice from image." },
      {
        role: "user",
        content: [
          { type: "text", text: "Personality only." },
          { type: "image_url", image_url: { url: image } }
        ]
      }
    ]
  });

  return res.choices[0].message.content;
}

async function getAnswer(persona, question) {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: persona },
      { role: "user", content: question }
    ]
  });

  return res.choices[0].message.content;
}

//////////////////////////////////////////////////////////////
// CLEANUP
//////////////////////////////////////////////////////////////

setInterval(() => {
  const now = Date.now();
  const SIX = 6 * 60 * 60 * 1000;

  for (let i = questions.length - 1; i >= 0; i--) {
    const q = questions[i];
    if (now - q.createdAt > SIX || q.answers.length >= 3) {
      questions.splice(i, 1);
    }
  }

  seedAIQuestionsIfEmpty();
  io.emit("count", questions.length);
}, 60000);

//////////////////////////////////////////////////////////////
// SOCKET
//////////////////////////////////////////////////////////////

io.on("connection", (socket) => {
  users[socket.id] = {
    step: "email",
    email: null,
    persona: null,
    image: null
  };

  seedAIQuestionsIfEmpty();

  socket.emit("state", {
    placeholder: "enter your email to connect"
  });

  socket.emit("count", questions.length);

  ////////////////////////////////////////////////////////////
  // IMAGE
  ////////////////////////////////////////////////////////////

  socket.on("imageUpload", async ({ imageDataUrl }) => {
    const user = users[socket.id];

    user.image = imageDataUrl;
    user.persona = await createPersona(imageDataUrl);

    socket.emit("state", {
      placeholder: "image loaded — ask something"
    });
  });

  ////////////////////////////////////////////////////////////
  // INPUT
  ////////////////////////////////////////////////////////////

  socket.on("input", async ({ text }) => {
    const user = users[socket.id];
    const email = extractEmail(text);

    // EMAIL STEP
    if (user.step === "email") {
      if (email) {
        user.email = email;
        user.step = "ready";

        return socket.emit("state", {
          placeholder: 'ask, answer, or "image"'
        });
      }
      return;
    }

    // IMAGE QUESTION FLOW
    if (user.persona) {
      const question = text;

      questions.unshift({
        id: makeId(),
        text: question,
        answers: [],
        createdAt: Date.now()
      });

      const ans = await getAnswer(user.persona, question);

      // 🔥 preview
      const short = ans.split(".")[0];

      socket.emit("preview", {
        text: short
      });

      // 🔥 email
      await sendEmailWithImage(
        user.email,
        "You’ve got an answer",
        `
        <div style="font-family:system-ui">

          <p>You asked:</p>

          <img src="cid:img1" style="max-width:100%; border-radius:8px;" />

          <p>${question}</p>

          <hr/>

          <p><b>From Image AI:</b></p>

          <p>${ans}</p>

          <br/>

          <a href="${APP_URL}">Continue</a>

        </div>
        `,
        user.image,
        user.email
      );

      user.persona = null;
      user.image = null;

      return;
    }
  });

  socket.on("disconnect", () => {
    delete users[socket.id];
  });
});

//////////////////////////////////////////////////////////////

server.listen(process.env.PORT || 10000, () => {
  console.log("AI CONNECT RUNNING (STABLE)");
});