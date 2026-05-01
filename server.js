//////////////////////////////////////////////////////////////
// AI CONNECT BOARD — V2 FINAL BACKEND
// Natural ask + strict click-to-answer + ask return
// refer invite system + teach-on-mistake email detection
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
// CONFIG
//////////////////////////////////////////////////////////////

const APP_URL = process.env.APP_URL || "https://connectaing.com";

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
      from: `"AI Connect - Connectaing.com" <${process.env.EMAIL_USER}>`,
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
// CLEANUP — 6 HOURS OR 3 ANSWERS
//////////////////////////////////////////////////////////////

setInterval(() => {
  const now = Date.now();
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  let changed = false;

  for (let i = questions.length - 1; i >= 0; i--) {
    const q = questions[i];

    const expired = now - q.createdAt > SIX_HOURS;
    const enoughAnswers = q.answers.length >= 3;

    if (expired || enoughAnswers) {
      questions.splice(i, 1);
      changed = true;
    }
  }

  if (changed) {
    io.emit("count", questions.length);
  }
}, 60000);

//////////////////////////////////////////////////////////////
// HELPERS
//////////////////////////////////////////////////////////////

function loadQuestions(user) {
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
  const batch = user.currentQuestions.slice(
    user.pageIndex,
    user.pageIndex + 3
  );

  if (!batch.length) {
    socket.emit("questions", []);

    return socket.emit("state", {
      placeholder: "no more. type ask"
    });
  }

  socket.emit("questions", batch);

  return socket.emit("state", {
    placeholder: "tap a question or type 'ask'"
  });
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

  user.step = "answer";
  loadQuestions(user);
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
    pageIndex: 0
  };

  socket.emit("state", {
    placeholder: "enter your email"
  });

  socket.emit("count", questions.length);

  ////////////////////////////////////////////////////////////
  // COUNT
  ////////////////////////////////////////////////////////////

  socket.on("count", () => {
    socket.emit("count", questions.length);
  });

  ////////////////////////////////////////////////////////////
  // SELECT QUESTION — REQUIRED BEFORE ANSWER / REFER
  ////////////////////////////////////////////////////////////

  socket.on("selectQuestion", ({ index }) => {
    const user = users[socket.id];
    if (!user) return;

    const selectedIndex = user.pageIndex + Number(index);
    const selectedQuestion = user.currentQuestions[selectedIndex];

    if (!selectedQuestion) {
      return socket.emit("state", {
        placeholder: "tap a question first"
      });
    }

    user.currentIndex = selectedIndex;

    return socket.emit("state", {
      placeholder: "answer or refer someone (email)"
    });
  });

  ////////////////////////////////////////////////////////////
  // INPUT
  ////////////////////////////////////////////////////////////

  socket.on("input", async (data) => {
    const text = (data.text || "").trim();
    const user = users[socket.id];

    if (!text || !user) return;

    //////////////////////////////////////////////////////////
    // EMAIL STEP
    //////////////////////////////////////////////////////////

    if (user.step === "email") {
      const email = extractEmail(text);

      if (email) {
        user.email = email;
        user.step = "mode";

        return socket.emit("state", {
          placeholder: "ask a question or type 'answer'"
        });
      }

      return socket.emit("state", {
        placeholder: "enter your email to start"
      });
    }

    //////////////////////////////////////////////////////////
    // MODE STEP — NATURAL ASK
    //////////////////////////////////////////////////////////

    if (user.step === "mode") {
      const lower = text.toLowerCase();

      if (lower.includes("answer")) {
        user.step = "answer";
        loadQuestions(user);
        return sendQuestions(socket, user);
      }

      createQuestion(user, text);
      return sendQuestions(socket, user);
    }

    //////////////////////////////////////////////////////////
    // ASK STEP
    //////////////////////////////////////////////////////////

    if (user.step === "ask") {
      createQuestion(user, text);
      return sendQuestions(socket, user);
    }

    //////////////////////////////////////////////////////////
    // ANSWER STEP
    //////////////////////////////////////////////////////////

    if (user.step === "answer") {
      const lower = text.toLowerCase();
      const detectedEmail = extractEmail(text);

      // ASK RETURN
      if (lower === "ask") {
        user.step = "ask";
        user.currentIndex = null;

        return socket.emit("state", {
          placeholder: "type your question"
        });
      }

      // NEXT PAGE
      if (lower === "next") {
        user.pageIndex += 3;
        user.currentIndex = null;
        return sendQuestions(socket, user);
      }

      // REFER / INVITE FRIEND
      if (lower.startsWith("refer")) {
        const friendEmail = detectedEmail;

        if (!friendEmail) {
          return socket.emit("state", {
            placeholder: "type 'refer friend@email.com'"
          });
        }

        if (user.currentIndex === null) {
          return socket.emit("state", {
            placeholder: "tap a question first"
          });
        }

        const q = user.currentQuestions[user.currentIndex];

        if (!q) {
          user.currentIndex = null;

          return socket.emit("state", {
            placeholder: "tap a question first"
          });
        }

        await sendEmail(
          friendEmail,
          "You’ve got a question",
          `
You’ve got mail.

${user.email} invited you to answer:

"${q.text}"

Reply to answer
or join the board:
${APP_URL}

We are the world. We are connected strangers.<br>
`,
          user.email
        );

        return socket.emit("state", {
          placeholder: "Invited. Tap a question"
        });
      }

      // TEACH ON MISTAKE:
      // If user types only an email, teach the refer format.
      if (detectedEmail && text === detectedEmail) {
        return socket.emit("state", {
          placeholder: "type: refer friend@email.com"
        });
      }

      // MUST SELECT QUESTION FIRST
      if (user.currentIndex === null) {
        return socket.emit("state", {
          placeholder: "tap a question first"
        });
      }

      const q = user.currentQuestions[user.currentIndex];

      if (!q) {
        user.currentIndex = null;

        return socket.emit("state", {
          placeholder: "tap a question first"
        });
      }

      // DEFAULT = ANSWER
      q.answers.push({
        text,
        from: user.email,
        createdAt: Date.now()
      });

      await sendEmail(
        q.email,
        "Someone answered your question",
        `
New answer:

${text}

Responder:
${user.email}

Reply directly to continue.
`,
        user.email
      );

      user.currentIndex = null;

      return socket.emit("state", {
        placeholder: "Sent. Tap a question or type 'ask'"
      });
    }
  });

  ////////////////////////////////////////////////////////////
  // DISCONNECT
  ////////////////////////////////////////////////////////////

  socket.on("disconnect", () => {
    delete users[socket.id];
  });
});

//////////////////////////////////////////////////////////////
// START
//////////////////////////////////////////////////////////////

const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("AI CONNECT BOARD V2 FINAL WITH TEACH-ON-MISTAKE RUNNING");
});
