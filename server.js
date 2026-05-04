//////////////////////////////////////////////////////////////
// AI CONNECT — FINAL BACKEND V2.1 (HYBRID IMAGE AI)
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
// EMAIL (HTML SUPPORT)
//////////////////////////////////////////////////////////////

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendEmail(to, subject, html, replyToEmail) {
  try {
    await transporter.sendMail({
      from: `"AI Connect" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      replyTo: replyToEmail,
      html
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
let isSeeding = false;

function makeId() {
  return Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

function extractEmail(text) {
  const m = String(text || "").match(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
  );
  return m ? m[0].toLowerCase() : null;
}

//////////////////////////////////////////////////////////////
// SEED
//////////////////////////////////////////////////////////////

function seedAIQuestionsIfEmpty() {
  if (questions.length > 0 || isSeeding) return;

  isSeeding = true;
  const now = Date.now();

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
      email: "system",
      text,
      answers: [],
      createdAt: now
    });
  });

  io.emit("count", questions.length);
  isSeeding = false;
}

//////////////////////////////////////////////////////////////
// GRAMMAR
//////////////////////////////////////////////////////////////

async function rewriteText(input) {
  try {
    if (input.length < 3) return input;

    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Fix grammar. Keep meaning." },
        { role: "user", content: input }
      ]
    });

    return res.choices[0].message.content.trim();
  } catch {
    return input;
  }
}

//////////////////////////////////////////////////////////////
// IMAGE AI
//////////////////////////////////////////////////////////////

async function createImagePersona(image) {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "Create a short emotional voice from this image."
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Describe personality only." },
          { type: "image_url", image_url: { url: image } }
        ]
      }
    ]
  });

  return res.choices[0].message.content;
}

async function imageAnswer(persona, question) {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are this voice:\n${persona}\nShort emotional answer.`
      },
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
// HELPERS
//////////////////////////////////////////////////////////////

function loadQuestions(user) {
  seedAIQuestionsIfEmpty();

  user.currentQuestions = [...questions];
  user.pageIndex = 0;
  user.currentIndex = null;
}

function sendQuestions(socket, user) {
  const batch = user.currentQuestions.slice(user.pageIndex, user.pageIndex + 3);
  socket.emit("questions", batch);
}

function createQuestion(user, text) {
  questions.unshift({
    id: makeId(),
    email: user.email,
    text,
    answers: [],
    createdAt: Date.now()
  });

  io.emit("count", questions.length);
}

//////////////////////////////////////////////////////////////
// SOCKET
//////////////////////////////////////////////////////////////

io.on("connection", (socket) => {
  users[socket.id] = {
    step: "email",
    email: null,
    imagePersona: null,
    imageData: null
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

    user.imageData = imageDataUrl;
    user.imagePersona = await createImagePersona(imageDataUrl);

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
        user.step = "mode";

        return socket.emit("state", {
          placeholder: 'ask, answer, or "image"'
        });
      }
      return;
    }

    // IMAGE QUESTION FLOW
    if (user.imagePersona) {
      const question = await rewriteText(text);

      createQuestion(user, question);

      const ans = await imageAnswer(user.imagePersona, question);

      // 🔥 1. SCREEN PREVIEW
      const short = ans.split(".")[0];

      socket.emit("state", {
        placeholder: short
      });

      // 🔥 2. EMAIL (WITH IMAGE)
      await sendEmail(
        user.email,
        "You’ve got an answer",
        `
        <div style="font-family:system-ui">
          <p>You asked:</p>
          <img src="${user.imageData}" style="max-width:100%" />
          <p>${question}</p>
          <hr/>
          <p><b>From Image AI:</b></p>
          <p>${ans}</p>
          <br/>
          <a href="${APP_URL}">Continue</a>
        </div>
        `,
        user.email
      );

      user.imagePersona = null;
      user.imageData = null;

      return;
    }
  });

  socket.on("disconnect", () => {
    delete users[socket.id];
  });
});

//////////////////////////////////////////////////////////////

server.listen(process.env.PORT || 10000, () => {
  console.log("AI CONNECT V2.1 RUNNING");
});