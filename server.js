//////////////////////////////////////////////////////////////
// AI CONNECT BOARD — V5.1 BACKEND (EMAIL IMAGE FIX)
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
const io = new Server(server, { cors: { origin: "*" } });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

//////////////////////////////////////////////////////////////
// EMAIL (FIXED — CID IMAGE)
//////////////////////////////////////////////////////////////

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendEmail(to, subject, text, imageDataUrl) {
  try {
    const attachments = [];
    let cid = null;

    if (imageDataUrl) {
      const base64Data = imageDataUrl.split("base64,")[1];
      cid = "image1@ai";

      attachments.push({
        filename: "image.jpg",
        content: base64Data,
        encoding: "base64",
        cid
      });
    }

    await transporter.sendMail({
      from: `"AI Connect" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html: `
        <div>
          <p>${text.replace(/\n/g, "<br>")}</p>
          ${cid ? `<img src="cid:${cid}" style="max-width:100%;margin-top:10px;" />` : ""}
        </div>
      `,
      attachments
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
// CLEANUP
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
    imageContext: null,
    lastImage: null
  };

  socket.emit("state", { placeholder: "enter your email to connect" });
  socket.emit("count", questions.length);

  ////////////////////////////////////////////////////////////
  // IMAGE AI PERSONA
  ////////////////////////////////////////////////////////////

  socket.on("imageUpload", async ({ imageDataUrl }) => {
    const user = users[socket.id];
    user.lastImage = imageDataUrl;

    try {
      const res = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Describe this image as an AI persona with personality and tone."
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze image" },
              { type: "image_url", image_url: { url: imageDataUrl } }
            ]
          }
        ]
      });

      user.imageMode = true;
      user.imageContext = res.choices[0].message.content;

      socket.emit("preview", { text: user.imageContext });
      socket.emit("state", { placeholder: "ask this image" });

    } catch {
      socket.emit("state", { placeholder: "image failed" });
    }
  });

  ////////////////////////////////////////////////////////////
  // INPUT
  ////////////////////////////////////////////////////////////

  socket.on("input", async ({ text }) => {
    const user = users[socket.id];
    if (!user || !text) return;

    const raw = text.trim();
    const lower = raw.toLowerCase();
    const email = extractEmail(raw);

    // IMAGE MODE
    if (user.imageMode) {

      if (lower === "ask" || lower === "answer") {
        user.imageMode = false;
        return socket.emit("state", { placeholder: "type your question" });
      }

      const res = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: user.imageContext },
          { role: "user", content: raw }
        ]
      });

      const answer = res.choices[0].message.content;

      await sendEmail(
        user.email,
        "AI Reply",
        `Q: ${raw}\n\nA: ${answer}`,
        user.lastImage
      );

      return socket.emit("state", { placeholder: "sent. ask more" });
    }

    // EMAIL STEP
    if (user.step === "email") {
      if (email) {
        user.email = email;
        user.step = "mode";
        return socket.emit("state", {
          placeholder: "type 'ask', 'answer', or 'image ai'"
        });
      }
      return socket.emit("state", { placeholder: "enter your email to start" });
    }

    // MODE
    if (user.step === "mode") {

      if (lower === "answer") {
        user.step = "answer";
        user.currentQuestions = [...questions];
        user.pageIndex = 0;
        return socket.emit("questions", user.currentQuestions.slice(0, 3));
      }

      if (lower === "image ai") {
        return socket.emit("state", { placeholder: "take a photo" });
      }

      questions.unshift({
        id: makeId(),
        email: user.email,
        text: raw,
        answers: [],
        createdAt: Date.now()
      });

      io.emit("count", questions.length);

      user.step = "answer";
      user.currentQuestions = [...questions];
      user.pageIndex = 0;

      return socket.emit("questions", user.currentQuestions.slice(0, 3));
    }

    // ANSWER MODE
    if (user.step === "answer") {

      if (lower === "ask") {
        user.step = "mode";
        return socket.emit("state", { placeholder: "type your question" });
      }

      if (lower === "next") {
        user.pageIndex += 3;
        return socket.emit("questions",
          user.currentQuestions.slice(user.pageIndex, user.pageIndex + 3)
        );
      }

      if (user.currentIndex === null) {
        return socket.emit("state", { placeholder: "tap a question first" });
      }

      const q = user.currentQuestions[user.currentIndex];

      q.answers.push({
        text: raw,
        from: user.email,
        createdAt: Date.now()
      });

      await sendEmail(q.email, "New Answer", raw);

      user.currentIndex = null;

      return socket.emit("state", {
        placeholder: "sent. tap a question"
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
  console.log("V5.1 running");
});
