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

//////////////////////////////////////////////////
// EMAIL
//////////////////////////////////////////////////

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendEmail(to, subject, text, imageDataUrl) {
  await transporter.sendMail({
    from: `"AI Connect" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    html: `
      <p>${text.replace(/\n/g, "<br>")}</p>
      ${imageDataUrl ? `<img src="${imageDataUrl}" style="max-width:100%" />` : ""}
    `
  });
}

//////////////////////////////////////////////////
// DATA
//////////////////////////////////////////////////

const users = {};
const questions = [];

function extractEmail(text) {
  const m = text.match(/\S+@\S+\.\S+/);
  return m ? m[0].toLowerCase() : null;
}

//////////////////////////////////////////////////
// CLEANUP
//////////////////////////////////////////////////

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

//////////////////////////////////////////////////
// SOCKET
//////////////////////////////////////////////////

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

  //////////////////////////////////////////////////
  // IMAGE UPLOAD
  //////////////////////////////////////////////////

  socket.on("imageUpload", async ({ imageDataUrl }) => {

    const user = users[socket.id];
    if (!user.email) return;

    user.lastImage = imageDataUrl;

    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Describe this image as an AI persona." },
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

  //////////////////////////////////////////////////
  // INPUT
  //////////////////////////////////////////////////

  socket.on("input", async ({ text }) => {

    const user = users[socket.id];
    const raw = text.trim();
    const lower = raw.toLowerCase();
    const email = extractEmail(raw);

    //////////////////////////////////////////////////
    // AUTO TEACH
    //////////////////////////////////////////////////

    if (email && user.step !== "email" && !lower.startsWith("refer")) {
      return socket.emit("state", {
        placeholder: `type: refer ${email}`
      });
    }

    //////////////////////////////////////////////////
    // IMAGE MODE
    //////////////////////////////////////////////////

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

      await sendEmail(user.email, "AI Reply",
        `Q: ${raw}\n\nA: ${answer}`,
        user.lastImage
      );

      return socket.emit("state", { placeholder: "sent. ask more" });
    }

    //////////////////////////////////////////////////
    // EMAIL STEP
    //////////////////////////////////////////////////

    if (user.step === "email") {
      if (email) {
        user.email = email;
        user.step = "mode";
        return socket.emit("state", {
          placeholder: "type 'ask', 'answer', or 'image ai'"
        });
      }
      return socket.emit("state", {
        placeholder: "enter your email to connect"
      });
    }

    //////////////////////////////////////////////////
    // MODE
    //////////////////////////////////////////////////

    if (user.step === "mode") {

      if (lower === "answer") {
        user.step = "answer";
      }

      if (!["ask","answer","next","image ai"].includes(lower)) {
        questions.unshift({
          email: user.email,
          text: raw,
          answers: [],
          createdAt: Date.now()
        });
        user.step = "answer";
      }

      user.currentQuestions = [...questions].sort((a,b) =>
        a.answers.length - b.answers.length ||
        b.createdAt - a.createdAt
      );

      user.pageIndex = 0;

      return socket.emit("questions",
        user.currentQuestions.slice(0,3)
      );
    }

    //////////////////////////////////////////////////
    // ANSWER MODE
    //////////////////////////////////////////////////

    if (user.step === "answer") {

      if (lower === "next") {
        user.pageIndex += 3;
        return socket.emit("questions",
          user.currentQuestions.slice(user.pageIndex, user.pageIndex + 3)
        );
      }

      if (lower.startsWith("refer ")) {
        const refEmail = extractEmail(raw);
        const q = user.currentQuestions[user.currentIndex];

        await sendEmail(refEmail, "Answer this question",
          `${q.text}\n\n${process.env.APP_URL}`
        );

        return socket.emit("state", {
          placeholder: "invited. tap a question"
        });
      }

      if (user.currentIndex === null) {
        return socket.emit("state", {
          placeholder: "tap a question first"
        });
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

server.listen(10000);
