//////////////////////////////////////////////////////////////
// AI CONNECT BOARD — V2.2 BACKEND
// Human system + Image AI Persona (add-on) + Email responses
//////////////////////////////////////////////////////////////

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
  tls: {
    rejectUnauthorized: false
  }
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
// AI SEED
//////////////////////////////////////////////////////////////

function seedAIQuestionsIfEmpty() {
  if (questions.length > 0 || isSeeding) return;

  isSeeding = true;

  const aiEmail = "seed@ai.com";
  const now = Date.now();

  questions.unshift(
    { id: makeId(), email: aiEmail, text: "Should I trust this decision?", answers: [], createdAt: now },
    { id: makeId(), email: aiEmail, text: "What should I learn in AI next week?", answers: [], createdAt: now },
    { id: makeId(), email: aiEmail, text: "Is this idea worth building?", answers: [], createdAt: now }
  );

  io.emit("count", questions.length);
  isSeeding = false;
}

//////////////////////////////////////////////////////////////
// GRAMMAR REWRITE
//////////////////////////////////////////////////////////////

async function rewriteText(input) {
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Fix grammar only. Keep meaning." },
        { role: "user", content: input }
      ]
    });

    return res.choices[0].message.content.trim();
  } catch {
    return input;
  }
}

//////////////////////////////////////////////////////////////
// CLEANUP — 6 HOURS
//////////////////////////////////////////////////////////////

setInterval(() => {
  const now = Date.now();
  const SIX_HOURS = 6 * 60 * 60 * 1000;

  for (let i = questions.length - 1; i >= 0; i--) {
    const q = questions[i];
    if (now - q.createdAt > SIX_HOURS || q.answers.length >= 3) {
      questions.splice(i, 1);
    }
  }

  io.emit("count", questions.length);
}, 60000);

//////////////////////////////////////////////////////////////
// HELPERS
//////////////////////////////////////////////////////////////

function loadQuestions(user) {
  seedAIQuestionsIfEmpty();

  const sorted = [...questions].sort((a, b) => {
    if (a.answers.length !== b.answers.length) {
      return a.answers.length - b.answers.length;
    }
    return b.createdAt - a.createdAt;
  });

  user.currentQuestions = sorted;
  user.currentIndex = null;
  user.pageIndex = 0;
}

function sendQuestions(socket, user) {
  const batch = user.currentQuestions.slice(user.pageIndex, user.pageIndex + 3);

  if (!batch.length) {
    socket.emit("questions", []);
    return socket.emit("state", { placeholder: "no more. type ask" });
  }

  socket.emit("questions", batch);
  socket.emit("state", { placeholder: "tap a question or type 'ask'" });
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

    // NEW
    imageMode: false,
    imageContext: null
  };

  socket.emit("state", { placeholder: "enter your email to connect" });
  socket.emit("count", questions.length);

  ////////////////////////////////////////////////////////////
  // IMAGE UPLOAD → PERSONA
  ////////////////////////////////////////////////////////////

  socket.on("imageUpload", async ({ imageDataUrl }) => {
    const user = users[socket.id];
    if (!user) return;

    try {
      const res = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Describe this image as a persona with tone and personality."
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this image" },
              { type: "image_url", image_url: { url: imageDataUrl } }
            ]
          }
        ]
      });

      const persona = res.choices[0].message.content;

      user.imageMode = true;
      user.imageContext = persona;

      socket.emit("preview", { text: persona });

      socket.emit("state", {
        placeholder: "ask this image. answer comes by email"
      });

    } catch {
      socket.emit("state", { placeholder: "image failed. try again" });
    }
  });

  ////////////////////////////////////////////////////////////
  // INPUT
  ////////////////////////////////////////////////////////////

  socket.on("input", async ({ text }) => {
    const user = users[socket.id];
    if (!user || !text) return;

    const lower = text.toLowerCase();
    const email = extractEmail(text);

    //////////////////////////////////////////////////////////
    // IMAGE MODE (NEW)
    //////////////////////////////////////////////////////////

    if (user.imageMode) {
      if (lower === "ask" || lower === "answer") {
        user.imageMode = false;
        return socket.emit("state", {
          placeholder: "type 'ask', 'answer', or 'image'"
        });
      }

      const res = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are this persona:\n${user.imageContext}`
          },
          {
            role: "user",
            content: text
          }
        ]
      });

      const answer = res.choices[0].message.content;

      await sendEmail(
        user.email,
        "Image AI Reply",
        `Q: ${text}\n\nA: ${answer}`
      );

      return socket.emit("state", {
        placeholder: "sent. check your email or ask more"
      });
    }

    //////////////////////////////////////////////////////////
    // EMAIL STEP
    //////////////////////////////////////////////////////////

    if (user.step === "email") {
      if (email) {
        user.email = email;
        user.step = "mode";
        return socket.emit("state", {
          placeholder: "type 'ask', 'answer', or 'image'"
        });
      }
      return socket.emit("state", {
        placeholder: "enter your email to start"
      });
    }

    //////////////////////////////////////////////////////////
    // MODE
    //////////////////////////////////////////////////////////

    if (user.step === "mode") {
      if (lower === "answer") {
        user.step = "answer";
        loadQuestions(user);
        return sendQuestions(socket, user);
      }

      if (lower === "image") {
        return socket.emit("state", {
          placeholder: "upload an image"
        });
      }

      const fixed = await rewriteText(text);

      questions.unshift({
        id: makeId(),
        email: user.email,
        text: fixed,
        answers: [],
        createdAt: Date.now()
      });

      loadQuestions(user);
      return sendQuestions(socket, user);
    }

    //////////////////////////////////////////////////////////
    // ANSWER MODE
    //////////////////////////////////////////////////////////

    if (user.step === "answer") {
      if (lower === "ask") {
        user.step = "mode";
        return socket.emit("state", {
          placeholder: "type your question"
        });
      }

      if (lower === "next") {
        user.pageIndex += 3;
        return sendQuestions(socket, user);
      }

      if (user.currentIndex === null) {
        return socket.emit("state", {
          placeholder: "tap a question first"
        });
      }

      const q = user.currentQuestions[user.currentIndex];
      const fixed = await rewriteText(text);

      q.answers.push({
        text: fixed,
        from: user.email,
        createdAt: Date.now()
      });

      await sendEmail(
        q.email,
        "New Answer",
        `${fixed}\n\nfrom: ${user.email}`
      );

      user.currentIndex = null;

      return socket.emit("state", {
        placeholder: "sent. tap a question or type 'ask'"
      });
    }
  });

  socket.on("selectQuestion", ({ index }) => {
    const user = users[socket.id];
    user.currentIndex = user.pageIndex + index;

    socket.emit("state", {
      placeholder: "answer or refer friend@email.com"
    });
  });

  socket.on("disconnect", () => {
    delete users[socket.id];
  });
});

//////////////////////////////////////////////////////////////
// START
//////////////////////////////////////////////////////////////

server.listen(10000, () => {
  console.log("V2.2 running");
});
