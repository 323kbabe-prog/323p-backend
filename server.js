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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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
// SOCKET SYSTEM
//////////////////////////////////////////////////////////////

io.on("connection", (socket) => {

  users[socket.id] = {
    step: "email",
    email: null,
    imageMode: false,
    imageContext: null,
    lastImage: null,
    currentQuestions: [],
    currentIndex: null,
    pageIndex: 0
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
            content: "Describe this image clearly and naturally."
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

      socket.emit("preview", {
        text: user.imageContext
      });

      socket.emit("state", {
        placeholder: "ask this image"
      });

    } catch (e) {
      console.log("AI PREVIEW ERROR:", e);
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
    // AUTO-TEACH
    //////////////////////////////////////////////////////////

    if (email && user.step !== "email" && !lower.startsWith("refer")) {
      return socket.emit("state", {
        placeholder: `type: refer ${email}`
      });
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
    // IMAGE MODE (AI ASK → EMAIL → SAVE QUESTION)
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

        //////////////////////////////////////////////////////
        // 🔥 SAVE QUESTION INTO SYSTEM
        //////////////////////////////////////////////////////

        questions.unshift({
          email: user.email,
          text: raw,
          answers: [],
          createdAt: Date.now()
        });

        //////////////////////////////////////////////////////
        // SEND EMAIL
        //////////////////////////////////////////////////////

        await sendEmail(
          user.email,
          "AI Reply",
          `Q: ${raw}\n\nA: ${answer}`,
          user.lastImage
        );

      } catch (e) {
        console.log("AI ANSWER ERROR:", e);
      }

      user.imageMode = false;

      //////////////////////////////////////////////////////
      // CLEAR PREVIEW
      //////////////////////////////////////////////////////

      socket.emit("preview", { text: "" });

      //////////////////////////////////////////////////////
      // SEND STATE
      //////////////////////////////////////////////////////

      socket.emit("state", {
        placeholder: "sent. check your email"
      });

      //////////////////////////////////////////////////////
      // LOAD QUESTIONS (UNDER CAMERA)
      //////////////////////////////////////////////////////

      if (questions.length === 0) {
        return;
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

    //////////////////////////////////////////////////////////
    // NEXT
    //////////////////////////////////////////////////////////

    if (lower === "next") {

      user.pageIndex += 3;

      return socket.emit("questions",
        user.currentQuestions.slice(user.pageIndex, user.pageIndex + 3)
      );
    }

    //////////////////////////////////////////////////////////
    // REFER
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
        placeholder: "tap another or type 'next'"
      });
    }

    //////////////////////////////////////////////////////////
    // CREATE QUESTION (MANUAL)
    //////////////////////////////////////////////////////////

    questions.unshift({
      email: user.email,
      text: raw,
      answers: [],
      createdAt: Date.now()
    });

    user.currentQuestions = [...questions];

    user.pageIndex = 0;

    return socket.emit("questions",
      user.currentQuestions.slice(0,3)
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
// SERVER
//////////////////////////////////////////////////////////////

server.listen(10000, () => {
  console.log("AI CONNECT running on port 10000");
});
