//////////////////////////////////////////////////////////////
// AI CONNECT — FINAL BACKEND
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
// EMAIL (CID IMAGE SUPPORT)
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
  return Date.now() + Math.random().toString(36).slice(2);
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

  ////////////////////////////////////////////////////////////
  // IMAGE AI
  ////////////////////////////////////////////////////////////

  socket.on("imageUpload", async ({ imageDataUrl }) => {
    const user = users[socket.id];
    user.lastImage = imageDataUrl;

    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Describe this image as an AI persona."
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

      socket.emit("state", { placeholder: "sent" });
      return;
    }

    // EMAIL STEP
    if (user.step === "email") {
      if (email) {
        user.email = email;
        user.step = "mode";
        socket.emit("state", { placeholder: "ask or answer" });
      }
      return;
    }

    // MODE
    if (user.step === "mode") {

      if (lower === "answer") {
        user.step = "answer";
        user.currentQuestions = [...questions];
        socket.emit("questions", questions.slice(0, 3));
        return;
      }

      if (lower === "image ai") {
        socket.emit("state", { placeholder: "take photo" });
        return;
      }

      questions.unshift({
        id: makeId(),
        email: user.email,
        text: raw,
        answers: [],
        createdAt: Date.now()
      });

      socket.emit("state", { placeholder: "question live" });
    }
  });

});
server.listen(10000);
