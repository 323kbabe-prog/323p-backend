//////////////////////////////////////////////////////////////
// AI CONNECT BOARD — V2.3 BACKEND (NO FAKE DATA)
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

async function sendEmail(to, subject, text) {
  try {
    await transporter.sendMail({
      from: `"AI Connect" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text
    });
  } catch (e) {
    console.log("EMAIL ERROR:", e);
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
// CLEANUP (6H OR 3 ANSWERS)
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
// SOCKET
//////////////////////////////////////////////////////////////

io.on("connection", (socket) => {

  users[socket.id] = {
    step: "email",
    email: null,
    currentQuestions: [],
    currentIndex: null,
    pageIndex: 0,

    imageMode: false,
    imageContext: null
  };

  socket.emit("state", { placeholder: "enter your email to connect" });
  socket.emit("count", questions.length);

  ////////////////////////////////////////////////////////////
  // IMAGE → AI PERSONA
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
            content: "Describe this image as an AI persona with tone and personality."
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
    // IMAGE MODE
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
          { role: "system", content: `You are:\n${user.imageContext}` },
          { role: "user", content: text }
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
        user.currentQuestions = [...questions];
        return socket.emit("questions", user.currentQuestions.slice(0,3));
      }

      if (lower === "image") {
        return socket.emit("state", {
          placeholder: "upload an image"
        });
      }

      questions.unshift({
        id: makeId(),
        email: user.email,
        text,
        answers: [],
        createdAt: Date.now()
      });

      user.step = "answer";
      user.currentQuestions = [...questions];

      io.emit("count", questions.length);

      return socket.emit("questions", user.currentQuestions.slice(0,3));
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
        return socket.emit("questions",
          user.currentQuestions.slice(user.pageIndex, user.pageIndex + 3)
        );
      }

      if (user.currentIndex === null) {
        return socket.emit("state", {
          placeholder: "tap a question first"
        });
      }

      const q = user.currentQuestions[user.currentIndex];

      q.answers.push({
        text,
        from: user.email,
        createdAt: Date.now()
      });

      await sendEmail(q.email, "New Answer", text);

      user.currentIndex = null;

      return socket.emit("state", {
        placeholder: "sent. tap a question or type 'ask'"
      });
    }
  });

  socket.on("selectQuestion", ({ index }) => {
    const user = users[socket.id];
    user.currentIndex = index;

    socket.emit("state", {
      placeholder: "answer or refer friend@email.com"
    });
  });

  socket.on("disconnect", () => {
    delete users[socket.id];
  });
});

server.listen(10000, () => {
  console.log("V2.3 running");
});
