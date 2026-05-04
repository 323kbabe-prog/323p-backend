//////////////////////////////////////////////////////////////
// AI CONNECT BOARD — V2 FINAL BACKEND (CLEAN)
// Board = questions only
// Answers = email only (human + image AI)
// Image = persona → email answer
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
// EMAIL
//////////////////////////////////////////////////////////////

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: { rejectUnauthorized: false }
});

async function sendEmail(to, subject, message, replyToEmail) {
  try {
    await transporter.sendMail({
      from: `"AI Connect" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      replyTo: replyToEmail,
      text: message
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
  const aiEmail = "a078bc@gmail.com";
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
      email: aiEmail,
      text,
      answers: [],
      imagePersona: null,
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
    const text = input.trim();
    if (text.length < 3) return text;

    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Fix grammar. Keep meaning." },
        { role: "user", content: text }
      ],
      temperature: 0.2
    });

    return res.choices[0].message.content.trim();
  } catch {
    return input;
  }
}

//////////////////////////////////////////////////////////////
// IMAGE PERSONA
//////////////////////////////////////////////////////////////

async function createImagePersona(imageDataUrl) {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "Create a short personality based on this image."
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Describe personality only." },
          { type: "image_url", image_url: { url: imageDataUrl } }
        ]
      }
    ]
  });

  return res.choices[0].message.content.trim();
}

async function imageAnswer(persona, question) {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `
You are this voice:
${persona}
Short answer only. No explanation.
`
      },
      { role: "user", content: question }
    ]
  });

  return res.choices[0].message.content.trim();
}

//////////////////////////////////////////////////////////////
// CLEANUP (6h)
//////////////////////////////////////////////////////////////

setInterval(() => {
  const now = Date.now();
  const SIX_HOURS = 6 * 60 * 60 * 1000;

  let changed = false;

  for (let i = questions.length - 1; i >= 0; i--) {
    const q = questions[i];

    if (
      now - q.createdAt > SIX_HOURS ||
      q.answers.length >= 3
    ) {
      questions.splice(i, 1);
      changed = true;
    }
  }

  if (changed) {
    seedAIQuestionsIfEmpty();
    io.emit("count", questions.length);
  }
}, 60000);

//////////////////////////////////////////////////////////////
// HELPERS
//////////////////////////////////////////////////////////////

function loadQuestions(user) {
  seedAIQuestionsIfEmpty();

  user.currentQuestions = [...questions].sort((a, b) => {
    if (a.answers.length !== b.answers.length) {
      return a.answers.length - b.answers.length;
    }
    return b.createdAt - a.createdAt;
  });

  user.pageIndex = 0;
  user.currentIndex = null;
}

function sendQuestions(socket, user) {
  const batch = user.currentQuestions.slice(
    user.pageIndex,
    user.pageIndex + 3
  );

  socket.emit("questions", batch);

  socket.emit("state", {
    placeholder: 'tap a question or type "ask"'
  });
}

function createQuestion(user, text, imagePersona = null) {
  questions.unshift({
    id: makeId(),
    email: user.email,
    text,
    answers: [],
    imagePersona,
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
    currentQuestions: [],
    currentIndex: null,
    pageIndex: 0,
    imagePersona: null
  };

  socket.emit("state", {
    placeholder: 'ask, answer, or "image"'
  });

  socket.emit("count", questions.length);

  ////////////////////////////////////////////////////////////

  socket.on("imageUpload", async ({ imageDataUrl }) => {
    const user = users[socket.id];

    if (!user.email) {
      return socket.emit("state", {
        placeholder: "enter email first"
      });
    }

    user.imagePersona = await createImagePersona(imageDataUrl);

    socket.emit("state", {
      placeholder: "image loaded — ask something"
    });
  });

  ////////////////////////////////////////////////////////////

  socket.on("input", async ({ text }) => {
    const user = users[socket.id];
    if (!user) return;

    const lower = text.toLowerCase();
    const email = extractEmail(text);

    ////////////////////////////////////////////////////////////
    // EMAIL
    ////////////////////////////////////////////////////////////

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

    ////////////////////////////////////////////////////////////
    // MODE
    ////////////////////////////////////////////////////////////

    if (user.step === "mode") {
      if (lower.includes("answer")) {
        user.step = "answer";
        loadQuestions(user);
        return sendQuestions(socket, user);
      }

      const q = await rewriteText(text);

      createQuestion(user, q);

      user.step = "answer";
      loadQuestions(user);
      return sendQuestions(socket, user);
    }

    ////////////////////////////////////////////////////////////
    // IMAGE QUESTION FLOW (FIXED)
    ////////////////////////////////////////////////////////////

    if (user.imagePersona) {
      const question = await rewriteText(text);

      // create clean question
      createQuestion(user, question, user.imagePersona);

      // send answer via email ONLY
      const ans = await imageAnswer(user.imagePersona, question);

      await sendEmail(
        user.email,
        "You’ve got an answer",
        `
From Image AI:

${ans}

Continue:
${APP_URL}
`,
        user.email
      );

      user.imagePersona = null;

      return socket.emit("state", {
        placeholder: "sent — check your email"
      });
    }

    ////////////////////////////////////////////////////////////
    // ANSWER MODE
    ////////////////////////////////////////////////////////////

    if (user.step === "answer") {
      if (lower === "next") {
        user.pageIndex += 3;
        return sendQuestions(socket, user);
      }

      if (lower === "ask") {
        user.step = "ask";
        return socket.emit("state", {
          placeholder: "type your question"
        });
      }

      if (lower.startsWith("refer")) {
        if (!email || user.currentIndex === null) return;

        const q = user.currentQuestions[user.currentIndex];

        await sendEmail(
          email,
          "You’ve got a question",
          `
${q.text}

${APP_URL}
`,
          user.email
        );

        return socket.emit("state", {
          placeholder: "invited"
        });
      }

      if (user.currentIndex === null) return;

      const q = user.currentQuestions[user.currentIndex];
      const ans = await rewriteText(text);

      q.answers.push({ text: ans });

      await sendEmail(
        q.email,
        "Someone answered",
        `
${ans}

${APP_URL}
`,
        user.email
      );

      return socket.emit("state", {
        placeholder: "sent"
      });
    }

    ////////////////////////////////////////////////////////////
    // ASK
    ////////////////////////////////////////////////////////////

    if (user.step === "ask") {
      const q = await rewriteText(text);

      createQuestion(user, q);

      user.step = "answer";
      loadQuestions(user);
      return sendQuestions(socket, user);
    }
  });

  ////////////////////////////////////////////////////////////

  socket.on("selectQuestion", ({ index }) => {
    const user = users[socket.id];
    user.currentIndex = user.pageIndex + index;

    socket.emit("state", {
      placeholder: "answer or refer"
    });
  });

  socket.on("disconnect", () => {
    delete users[socket.id];
  });
});

//////////////////////////////////////////////////////////////

server.listen(process.env.PORT || 10000, () => {
  console.log("AI CONNECT FINAL RUNNING");
});