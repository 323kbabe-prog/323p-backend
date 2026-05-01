//////////////////////////////////////////////////////////////
// AI CONNECT BOARD — V2 BACKEND FINAL
// CLICKABLE QUESTIONS REQUIRED BEFORE ANSWERING
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
  },
  tls: {
    rejectUnauthorized: false
  }
});

async function sendEmail(to, message, replyToEmail) {
  try {
    await transporter.sendMail({
      from: `"AI Connect - Connectaing.com" <${process.env.EMAIL_USER}>`,
      to,
      subject: "Someone answered your question",
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

  // important:
  // null means user has NOT clicked a question yet
  user.currentIndex = null;

  // pagination pointer
  user.pageIndex = 0;
}

function sendQuestions(socket, user) {
  const batch = user.currentQuestions.slice(
    user.pageIndex,
    user.pageIndex + 3
  );

  if (!batch.length) {
    return socket.emit("state", {
      placeholder: "no more. type next"
    });
  }

  socket.emit("questions", batch);

  socket.emit("state", {
    placeholder: "tap a question"
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
  // SELECT QUESTION — REQUIRED BEFORE ANSWERING
  ////////////////////////////////////////////////////////////

  socket.on("selectQuestion", ({ index }) => {
    const user = users[socket.id];
    if (!user) return;

    const selectedIndex = user.pageIndex + Number(index);
    const selectedQuestion = user.currentQuestions[selectedIndex];

    if (!selectedQuestion) {
      return socket.emit("state", {
        placeholder: "tap a question"
      });
    }

    user.currentIndex = selectedIndex;

    socket.emit("state", {
      placeholder: "answer this"
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

    //////////////////////////////////////////////////////////
    // MODE STEP
    //////////////////////////////////////////////////////////

    if (user.step === "mode") {
      const lower = text.toLowerCase();

      if (lower.includes("ask")) {
        user.step = "ask";

        return socket.emit("state", {
          placeholder: "your question"
        });
      }

      if (lower.includes("answer")) {
        user.step = "answer";
        loadQuestions(user);

        return sendQuestions(socket, user);
      }

      return socket.emit("state", {
        placeholder: "type ask or answer"
      });
    }

    //////////////////////////////////////////////////////////
    // ASK FLOW
    //////////////////////////////////////////////////////////

    if (user.step === "ask") {
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

      return sendQuestions(socket, user);
    }

    //////////////////////////////////////////////////////////
    // ANSWER FLOW
    //////////////////////////////////////////////////////////

    if (user.step === "answer") {
      const lower = text.toLowerCase();

      if (lower === "next") {
        user.pageIndex += 3;
        user.currentIndex = null;

        return sendQuestions(socket, user);
      }

      // hard rule:
      // user must click a question first
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

      q.answers.push({
        text,
        from: user.email,
        createdAt: Date.now()
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

      user.currentIndex = null;

      return socket.emit("state", {
        placeholder: "sent. tap another question"
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
  console.log("AI CONNECT BOARD V2 BACKEND RUNNING");
});