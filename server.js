//////////////////////////////////////////////////////////////
// AI CONNECT BOARD — V2 FINAL BACKEND (WITH AI SEED 6)
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
// AI SEED (6 QUESTIONS WHEN EMPTY)
//////////////////////////////////////////////////////////////

function seedAIQuestionsIfEmpty() {
  if (questions.length === 0) {
    const aiEmail = "a078bc@gmail.com";

    questions.unshift(
      {
        id: makeId(),
        email: aiEmail,
        text: "Anne Hathaway looks older, but I believe we are both old and young at the same time.",
        answers: [],
        createdAt: Date.now()
      },
      {
        id: makeId(),
        email: aiEmail,
        text: "What should I learn in AI for next week?",
        answers: [],
        createdAt: Date.now()
      },
      {
        id: makeId(),
        email: aiEmail,
        text: "Is it okay that I love Justin Bieber? I am 31.",
        answers: [],
        createdAt: Date.now()
      },
      {
        id: makeId(),
        email: aiEmail,
        text: "I’m not Asian—can I drink boba tea?",
        answers: [],
        createdAt: Date.now()
      },
      {
        id: makeId(),
        email: aiEmail,
        text: "I finally decided that Jisoo is my favorite.",
        answers: [],
        createdAt: Date.now()
      },
      {
        id: makeId(),
        email: aiEmail,
        text: "I love myself already. Do I need to find a girlfriend?",
        answers: [],
        createdAt: Date.now()
      }
    );
  }
}

//////////////////////////////////////////////////////////////
// GRAMMAR REWRITE
//////////////////////////////////////////////////////////////

async function rewriteText(input) {
  try {
    const text = String(input || "").trim();
    if (!text || text.length < 3) return text;

    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Fix grammar. Keep meaning. Keep it short and natural. Output only the corrected text."
        },
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
// CLEANUP
//////////////////////////////////////////////////////////////

setInterval(() => {
  const now = Date.now();
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  let changed = false;

  for (let i = questions.length - 1; i >= 0; i--) {
    const q = questions[i];
    if (now - q.createdAt > SIX_HOURS || q.answers.length >= 3) {
      questions.splice(i, 1);
      changed = true;
    }
  }

  if (changed) io.emit("count", questions.length);
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

  socket.emit("state", {
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

  seedAIQuestionsIfEmpty();

  socket.emit("state", { placeholder: "enter your email" });
  socket.emit("count", questions.length);

  socket.on("selectQuestion", ({ index }) => {
    const user = users[socket.id];
    const selectedIndex = user.pageIndex + Number(index);
    const selectedQuestion = user.currentQuestions[selectedIndex];

    if (!selectedQuestion) {
      return socket.emit("state", { placeholder: "tap a question first" });
    }

    user.currentIndex = selectedIndex;

    socket.emit("state", {
      placeholder: "answer or refer someone (email)"
    });
  });

  socket.on("input", async ({ text }) => {
    const user = users[socket.id];
    if (!text || !user) return;

    const lower = text.toLowerCase();
    const email = extractEmail(text);

    // EMAIL STEP
    if (user.step === "email") {
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

    // MODE
    if (user.step === "mode") {
      if (lower.includes("answer")) {
        user.step = "answer";
        loadQuestions(user);
        return sendQuestions(socket, user);
      }

      const fixed = await rewriteText(text);
      createQuestion(user, fixed);
      return sendQuestions(socket, user);
    }

    // ASK
    if (user.step === "ask") {
      const fixed = await rewriteText(text);
      createQuestion(user, fixed);
      return sendQuestions(socket, user);
    }

    // ANSWER MODE
    if (user.step === "answer") {
      if (lower === "ask") {
        user.step = "ask";
        user.currentIndex = null;
        return socket.emit("state", { placeholder: "type your question" });
      }

      if (lower === "next") {
        user.pageIndex += 3;
        user.currentIndex = null;
        return sendQuestions(socket, user);
      }

      if (lower.startsWith("refer")) {
        if (!email) {
          return socket.emit("state", {
            placeholder: "type 'refer friend@email.com'"
          });
        }

        if (user.currentIndex === null) {
          return socket.emit("state", { placeholder: "tap a question first" });
        }

        const q = user.currentQuestions[user.currentIndex];

        await sendEmail(
          email,
          "You’ve got a question",
          `You’ve got mail.\n\n"${q.text}"\n\n${APP_URL}`,
          user.email
        );

        user.currentIndex = null;

        return socket.emit("state", {
          placeholder: "Invited. Tap a question"
        });
      }

      if (email && text === email) {
        return socket.emit("state", {
          placeholder: "type: refer friend@email.com"
        });
      }

      if (user.currentIndex === null) {
        return socket.emit("state", { placeholder: "tap a question first" });
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
        "Someone answered your question",
        fixed,
        user.email
      );

      user.currentIndex = null;

      return socket.emit("state", {
        placeholder: "Sent. Tap a question or type 'ask'"
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
  console.log("AI CONNECT BOARD V2 RUNNING");
});