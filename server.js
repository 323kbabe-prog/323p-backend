//////////////////////////////////////////////////////////////
// AI CONNECT — V5.8 FINAL BACKEND
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
// EMAIL (CID FIX + SAFE)
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
    let attachments = [];
    let imgTag = "";

    if (imageDataUrl) {
      const base64Data = imageDataUrl.split("base64,")[1];

      attachments.push({
        filename: "image.jpg",
        content: base64Data,
        encoding: "base64",
        cid: "image1"
      });

      imgTag = `<img src="cid:image1" style="max-width:100%;margin-top:10px;" />`;
    }

    await transporter.sendMail({
      from: `"AI Connect" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html: `
        <div>
          <p>${text.replace(/\n/g, "<br>")}</p>
          ${imgTag}
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

function extractEmail(text) {
  const m = text.match(/\S+@\S+\.\S+/);
  return m ? m[0].toLowerCase() : null;
}

//////////////////////////////////////////////////////////////
// CLEANUP SYSTEM
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
// SOCKET SYSTEM
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

  socket.emit("state", {
    placeholder: "enter your email to connect"
  });

  ////////////////////////////////////////////////////////////
  // IMAGE UPLOAD (AI ENTRY)
  ////////////////////////////////////////////////////////////

  socket.on("imageUpload", async ({ imageDataUrl }) => {

    const user = users[socket.id];
    if (!user.email) return;

    user.lastImage = imageDataUrl;

    try {
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

      socket.emit("state", {
        placeholder: "ask this image"
      });

    } catch (e) {
      console.log("AI ERROR:", e);
      socket.emit("state", {
        placeholder: "tap camera to ask anything"
      });
    }
  });

  ////////////////////////////////////////////////////////////
  // INPUT HANDLER
  ////////////////////////////////////////////////////////////

  socket.on("input", async ({ text }) => {

    const user = users[socket.id];
    if (!user || !text) return;

    const raw = text.trim();
    const lower = raw.toLowerCase();
    const email = extractEmail(raw);

    //////////////////////////////////////////////////////////
    // AUTO TEACH (refer)
    //////////////////////////////////////////////////////////

    if (email && user.step !== "email" && !lower.startsWith("refer")) {
      return socket.emit("state", {
        placeholder: `type: refer ${email}`
      });
    }

    //////////////////////////////////////////////////////////
    // IMAGE MODE (AI RESPONSE → FORCE EXIT)
    //////////////////////////////////////////////////////////

    if (user.imageMode) {

      try {
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

      } catch (e) {
        console.log("AI ANSWER ERROR:", e);
      }

      // 🔥 HARD EXIT AI MODE
      user.imageMode = false;

      ////////////////////////////////////////////////////////
      // NO QUESTIONS → fallback to AI
      ////////////////////////////////////////////////////////

      if (questions.length === 0) {
        return socket.emit("state", {
          placeholder: "tap camera to ask anything"
        });
      }

      ////////////////////////////////////////////////////////
      // SHOW QUESTION BOARD ONLY
      ////////////////////////////////////////////////////////

      user.currentQuestions = [...questions].sort((a, b) =>
        a.answers.length - b.answers.length ||
        b.createdAt - a.createdAt
      );

      user.pageIndex = 0;

      socket.emit("state", {
        placeholder: "sent. now tap a question to answer"
      });

      return socket.emit("questions",
        user.currentQuestions.slice(0, 3)
      );
    }

    //////////////////////////////////////////////////////////
    // EMAIL STEP
    //////////////////////////////////////////////////////////

    if (user.step === "email") {

      if (email) {
        user.email = email;
        user.step = "active";

        return socket.emit("state", {
          placeholder: "ready"
        });
      }

      return socket.emit("state", {
        placeholder: "enter your email to connect"
      });
    }

    //////////////////////////////////////////////////////////
    // NEXT COMMAND
    //////////////////////////////////////////////////////////

    if (lower === "next") {

      user.pageIndex += 3;

      return socket.emit("questions",
        user.currentQuestions.slice(user.pageIndex, user.pageIndex + 3)
      );
    }

    //////////////////////////////////////////////////////////
    // REFER COMMAND
    //////////////////////////////////////////////////////////

    if (lower.startsWith("refer ")) {

      const refEmail = extractEmail(raw);

      if (!refEmail || user.currentIndex === null) {
        return socket.emit("state", {
          placeholder: "tap a question first"
        });
      }

      const q = user.currentQuestions[user.currentIndex];

      await sendEmail(
        refEmail,
        "Answer this question",
        `${q.text}\n\n${process.env.APP_URL}`
      );

      return socket.emit("state", {
        placeholder: "invited. tap another"
      });
    }

    //////////////////////////////////////////////////////////
    // ANSWER MODE
    //////////////////////////////////////////////////////////

    if (user.currentIndex !== null) {

      const q = user.currentQuestions[user.currentIndex];

      q.answers.push({
        text: raw,
        from: user.email,
        createdAt: Date.now()
      });

      await sendEmail(q.email, "New Answer", raw);

      user.currentIndex = null;

      return socket.emit("state", {
        placeholder: "sent. tap another"
      });
    }

    //////////////////////////////////////////////////////////
    // CREATE QUESTION (DEFAULT)
    //////////////////////////////////////////////////////////

    questions.unshift({
      email: user.email,
      text: raw,
      answers: [],
      createdAt: Date.now()
    });

    user.currentQuestions = [...questions].sort((a, b) =>
      a.answers.length - b.answers.length ||
      b.createdAt - a.createdAt
    );

    user.pageIndex = 0;

    return socket.emit("questions",
      user.currentQuestions.slice(0, 3)
    );
  });

  ////////////////////////////////////////////////////////////
  // SELECT QUESTION
  ////////////////////////////////////////////////////////////

  socket.on("selectQuestion", ({ index }) => {
    const user = users[socket.id];
    user.currentIndex = index;

    socket.emit("state", {
      placeholder: "answer or refer friend@email.com"
    });
  });

  ////////////////////////////////////////////////////////////
  // DISCONNECT
  ////////////////////////////////////////////////////////////

  socket.on("disconnect", () => {
    delete users[socket.id];
  });

});

//////////////////////////////////////////////////////////////
// SERVER START
//////////////////////////////////////////////////////////////

server.listen(10000, () => {
  console.log("AI CONNECT V5.8 running on port 10000");
});
