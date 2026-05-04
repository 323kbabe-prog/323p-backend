//////////////////////////////////////////////////////////////
// AI CONNECT — FINAL BACKEND V2.2
// image compression + preview + CID email
//////////////////////////////////////////////////////////////

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const nodemailer = require("nodemailer");
const OpenAI = require("openai");
const sharp = require("sharp");

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
// EMAIL (CID IMAGE)
//////////////////////////////////////////////////////////////

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendEmailWithImage(to, subject, html, imageDataUrl, replyToEmail) {
  try {
    const base64 = imageDataUrl.split(",")[1];

    await transporter.sendMail({
      from: `"AI Connect" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      replyTo: replyToEmail,
      html,
      attachments: [
        {
          filename: "image.jpg",
          content: base64,
          encoding: "base64",
          cid: "img1"
        }
      ]
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
  const m = text.match(/\S+@\S+\.\S+/);
  return m ? m[0].toLowerCase() : null;
}

//////////////////////////////////////////////////////////////
// IMAGE COMPRESSION (SERVER SAFETY)
//////////////////////////////////////////////////////////////

async function compressImage(base64) {
  const buffer = Buffer.from(base64.split(",")[1], "base64");

  const out = await sharp(buffer)
    .resize(1280, 1280, { fit: "inside" })
    .jpeg({ quality: 70 })
    .toBuffer();

  return "data:image/jpeg;base64," + out.toString("base64");
}

//////////////////////////////////////////////////////////////
// IMAGE AI
//////////////////////////////////////////////////////////////

async function createPersona(image) {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Create emotional voice from image." },
      {
        role: "user",
        content: [
          { type: "text", text: "Personality only." },
          { type: "image_url", image_url: { url: image } }
        ]
      }
    ]
  });

  return res.choices[0].message.content;
}

async function getAnswer(persona, question) {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: persona },
      { role: "user", content: question }
    ]
  });

  return res.choices[0].message.content;
}

//////////////////////////////////////////////////////////////
// SOCKET
//////////////////////////////////////////////////////////////

io.on("connection", (socket) => {
  users[socket.id] = {
    step: "email",
    email: null,
    persona: null,
    image: null
  };

  socket.emit("state", {
    placeholder: "enter your email to connect"
  });

  ////////////////////////////////////////////////////////////
  // IMAGE UPLOAD
  ////////////////////////////////////////////////////////////

  socket.on("imageUpload", async ({ imageDataUrl }) => {
    const user = users[socket.id];

    // compress image
    const compressed = await compressImage(imageDataUrl);

    user.image = compressed;
    user.persona = await createPersona(compressed);

    socket.emit("state", {
      placeholder: "image loaded — ask something"
    });
  });

  ////////////////////////////////////////////////////////////
  // INPUT
  ////////////////////////////////////////////////////////////

  socket.on("input", async ({ text }) => {
    const user = users[socket.id];
    const email = extractEmail(text);

    // EMAIL STEP
    if (user.step === "email") {
      if (email) {
        user.email = email;
        user.step = "ready";

        return socket.emit("state", {
          placeholder: 'ask, answer, or "image"'
        });
      }
      return;
    }

    // IMAGE QUESTION FLOW
    if (user.persona) {
      const question = text;

      // save question (clean board)
      questions.unshift({
        id: makeId(),
        text: question
      });

      // AI answer
      const ans = await getAnswer(user.persona, question);

      //////////////////////////////////////////////////////
      // 1. PREVIEW (NOT placeholder)
      //////////////////////////////////////////////////////
      const short = ans.split(".")[0];

      socket.emit("preview", {
        text: short
      });

      //////////////////////////////////////////////////////
      // 2. EMAIL WITH IMAGE
      //////////////////////////////////////////////////////
      await sendEmailWithImage(
        user.email,
        "You’ve got an answer",
        `
        <div style="font-family:system-ui">

          <p>You asked:</p>

          <img src="cid:img1" style="max-width:100%; border-radius:8px;" />

          <p>${question}</p>

          <hr/>

          <p><b>From Image AI:</b></p>

          <p>${ans}</p>

          <br/>

          <a href="${APP_URL}">Continue</a>

        </div>
        `,
        user.image,
        user.email
      );

      // reset image session
      user.persona = null;
      user.image = null;

      return;
    }
  });

  socket.on("disconnect", () => {
    delete users[socket.id];
  });
});

//////////////////////////////////////////////////////////////

server.listen(process.env.PORT || 10000, () => {
  console.log("AI CONNECT V2.2 RUNNING");
});