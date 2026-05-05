//////////////////////////////////////////////////////////////
// AI CONNECT — V2 FINAL BACKEND (LIVE UPDATE FIXED)
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
  }
});

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendEmail(to, subject, html, replyToEmail) {
  try {
    await transporter.sendMail({
      from: `"CONNECTAING.COM — AI Connect" <${process.env.EMAIL_USER}>`,
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
  if (questions.length > 0) return;

  const seeds = [
    "Should I trust this decision?",
    "What do you really think about this?",
    "Is this idea worth building?"
  ];

  seeds.forEach(text => {
    questions.unshift({
      id: makeId(),
      email: "system@ai",
      text,
      answers: [],
      createdAt: Date.now()
    });
  });

  io.emit("count", questions.length);
  io.emit("questions", questions.slice(0, 3)); // 🔥 important
}

//////////////////////////////////////////////////////////////
// CREATE QUESTION (🔥 FIX HERE)
//////////////////////////////////////////////////////////////

function createQuestion(user, text) {
  questions.unshift({
    id: makeId(),
    email: user.email,
    text,
    answers: [],
    createdAt: Date.now()
  });

  io.emit("count", questions.length);

  // 🔥 LIVE UPDATE FIX
  io.emit("questions", questions.slice(0, 3));
}

//////////////////////////////////////////////////////////////
// SOCKET
//////////////////////////////////////////////////////////////

io.on("connection", (socket) => {
  users[socket.id] = {
    step: "email",
    email: null
  };

  seedAIQuestionsIfEmpty();

  socket.emit("state", {
    placeholder: "enter your email to connect"
  });

  socket.emit("count", questions.length);
  socket.emit("questions", questions.slice(0, 3)); // initial load

  ////////////////////////////////////////////////////////////
  // INPUT
  ////////////////////////////////////////////////////////////

  socket.on("input", async ({ text }) => {
    const user = users[socket.id];
    if (!user) return;

    const raw = String(text || "").trim();
    const email = extractEmail(raw);

    if (!raw) return;

    //////////////////////////////////////////////////////////
    // EMAIL STEP
    //////////////////////////////////////////////////////////

    if (user.step === "email") {
      if (email) {
        user.email = email;
        user.step = "mode";

        return socket.emit("state", {
          placeholder: 'ask, answer, or "image"'
        });
      }

      return socket.emit("state", {
        placeholder: "enter your email to connect"
      });
    }

    //////////////////////////////////////////////////////////
    // ASK DIRECTLY (CORE FLOW)
    //////////////////////////////////////////////////////////

    createQuestion(user, raw);

    return socket.emit("state", {
      placeholder: 'ask, answer, or "image"'
    });
  });

  ////////////////////////////////////////////////////////////
  // COUNT
  ////////////////////////////////////////////////////////////

  socket.on("count", () => {
    socket.emit("count", questions.length);
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
  console.log("AI CONNECT V2 RUNNING (LIVE FIX)");
});
