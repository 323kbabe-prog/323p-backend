//////////////////////////////////////////////////////////////
// AI CONNECT BOARD — FINAL CLEAN VERSION
//////////////////////////////////////////////////////////////

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const nodemailer = require("nodemailer");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

//////////////////////////////////////////////////////////////
// EMAIL
//////////////////////////////////////////////////////////////

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendEmail(to, message, replyToEmail) {
  try {
    await transporter.sendMail({
      from: `"AI Connect" <${process.env.EMAIL_USER}>`,
      to,
      subject: "New answer to your question",
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

function makeId() {
  return Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

function extractEmail(text) {
  const m = String(text || "").match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  return m ? m[0].toLowerCase() : null;
}

//////////////////////////////////////////////////////////////
// SEED (prevents empty board)
//////////////////////////////////////////////////////////////

function ensureSeed() {
  if (questions.length === 0) {
    questions.push({
      id: "seed",
      email: "system@aiconnect.com",
      text: "What is something you learned recently?",
      answers: [],
      createdAt: Date.now()
    });
  }
}

//////////////////////////////////////////////////////////////
// CLEANUP (6 HOURS OR 3 ANSWERS)
//////////////////////////////////////////////////////////////

setInterval(() => {

  const now = Date.now();
  const SIX_HOURS = 6 * 60 * 60 * 1000;

  for (let i = questions.length - 1; i >= 0; i--) {

    const q = questions[i];

    const expired = (now - q.createdAt) > SIX_HOURS;
    const enoughAnswers = q.answers.length >= 3;

    if (expired || enoughAnswers) {
      questions.splice(i, 1);
    }
  }

  ensureSeed();

}, 60000);

//////////////////////////////////////////////////////////////
// HELPERS
//////////////////////////////////////////////////////////////

function loadQuestions(user) {

  ensureSeed();

  const sorted = [...questions].sort((a, b) => {

    if (a.answers.length !== b.answers.length) {
      return a.answers.length - b.answers.length;
    }

    return b.createdAt - a.createdAt;
  });

  user.currentQuestions = sorted;
  user.currentIndex = 0;
}

function sendQuestions(socket, user) {

  const batch = user.currentQuestions.slice(
    user.currentIndex,
    user.currentIndex + 3
  );

  if (!batch.length) {
    return socket.emit("state", {
      placeholder: "no more. type next"
    });
  }

  socket.emit("questions", batch);

  socket.emit("state", {
    placeholder: "answer or next"
  });
}

//////////////////////////////////////////////////////////////
// SOCKET
//////////////////////////////////////////////////////////////

io.on("connection", (socket) => {

  users[socket.id] = {
    step: "email",
    email: null,
    currentQuestions: [],
    currentIndex: 0
  };

  socket.emit("state", {
    placeholder: "enter your email"
  });

  ////////////////////////////////////////////////////////////
  // INPUT
  ////////////////////////////////////////////////////////////

  socket.on("input", async (data) => {

    const text = (data.text || "").trim();
    const user = users[socket.id];
    if (!text || !user) return;

    ////////////////////////////////////////////////////////////
    // EMAIL
    ////////////////////////////////////////////////////////////

    if (user.step === "email") {

      const email = extractEmail(text);

      if (!email) {
        return socket.emit("state", {
          placeholder: "invalid email"
        });
      }

      user.email = email;
      user.step = "mode";

      return socket.emit("state", {
        placeholder: "ask or answer"
      });
    }

    ////////////////////////////////////////////////////////////
    // MODE
    ////////////////////////////////////////////////////////////

    if (user.step === "mode") {

      if (text.toLowerCase().includes("ask")) {
        user.step = "ask";
        return socket.emit("state", {
          placeholder: "your question"
        });
      }

      if (text.toLowerCase().includes("answer")) {
        user.step = "answer";
        loadQuestions(user);
        return sendQuestions(socket, user);
      }

      return socket.emit("state", {
        placeholder: "type ask or answer"
      });
    }

    ////////////////////////////////////////////////////////////
    // ASK → AUTO ANSWER MODE
    ////////////////////////////////////////////////////////////

    if (user.step === "ask") {

      questions.unshift({
        id: makeId(),
        email: user.email,
        text,
        answers: [],
        createdAt: Date.now()
      });

      user.step = "answer";

      loadQuestions(user);

      socket.emit("state", {
        placeholder: "answer or next"
      });

      return sendQuestions(socket, user);
    }

    ////////////////////////////////////////////////////////////
    // ANSWER MODE
    ////////////////////////////////////////////////////////////

    if (user.step === "answer") {

      if (text.toLowerCase() === "next") {
        user.currentIndex += 3;
        return sendQuestions(socket, user);
      }

      const q = user.currentQuestions[user.currentIndex];
      if (!q) return;

      q.answers.push({
        text,
        from: user.email
      });

      await sendEmail(
        q.email,
        `
New answer:

${text}

Responder:
${user.email}

Reply directly to continue.
`,
        user.email
      );

      return socket.emit("state", {
        placeholder: "sent. answer or next"
      });
    }

  });

  socket.on("disconnect", () => {
    delete users[socket.id];
  });

});

//////////////////////////////////////////////////////////////
// START
//////////////////////////////////////////////////////////////

const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("AI CONNECT BOARD RUNNING");
});