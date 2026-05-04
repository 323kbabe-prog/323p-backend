//////////////////////////////////////////////////////////////
// AI CONNECT — V2 FINAL BACKEND
// Ask + Answer + Refer + Seed + Image AI + Preview + CID Email
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
      from: `"AI Connect" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      replyTo: replyToEmail,
      html
    });
  } catch (err) {
    console.log("EMAIL ERROR:", err);
  }
}

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
    console.log("EMAIL IMAGE ERROR:", err);
  }
}

//////////////////////////////////////////////////////////////
// DATA
//////////////////////////////////////////////////////////////

const users = {};
const questions = [];
let isSeeding = false;

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
  if (questions.length > 0 || isSeeding) return;

  isSeeding = true;

  const aiEmail = "a078bc@gmail.com";
  const now = Date.now();

  const seeds = [
    "Anne Hathaway looks older, but I believe we are both old and young at the same time.",
    "What should I learn in AI for next week?",
    "Is it okay that I love Justin Bieber? I am 31.",
    "I’m not Asian—can I drink boba tea?",
    "I finally decided that Jisoo is my favorite.",
    "I love myself already. Do I need to find a girlfriend?"
  ];

  seeds.forEach(text => {
    questions.unshift({
      id: makeId(),
      email: aiEmail,
      text,
      answers: [],
      imagePersona: null,
      createdAt: now
    });
  });

  io.emit("count", questions.length);
  isSeeding = false;
}

//////////////////////////////////////////////////////////////
// GRAMMAR
//////////////////////////////////////////////////////////////

async function rewriteText(input) {
  try {
    const text = String(input || "").trim();
    if (text.length < 3) return text;

    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Fix grammar. Keep meaning. Keep it short and natural. Output only the corrected text."
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.2
    });

    return res.choices[0].message.content.trim();
  } catch (err) {
    console.log("REWRITE ERROR:", err);
    return input;
  }
}

//////////////////////////////////////////////////////////////
// IMAGE AI — SCENE + TEXT AWARE
//////////////////////////////////////////////////////////////

async function createImagePersona(imageDataUrl) {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `
Analyze the image and create a compact image persona.

Include:
1. Emotional tone
2. Visible objects
3. Readable text, brands, labels, or signs if present

Do not identify real people.
Do not explain.
Return only a short scene/persona description.
`
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Create the image persona from this picture." },
          { type: "image_url", image_url: { url: imageDataUrl } }
        ]
      }
    ],
    temperature: 0.4
  });

  return res.choices[0].message.content.trim();
}

async function getImageAnswer(persona, question) {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `
You are the emotional voice of the uploaded image.

Image persona:
${persona}

Rules:
- Answer from the image mood.
- Use visible objects naturally.
- Use readable text, brands, labels, or signs only if they fit naturally.
- Do not give generic advice.
- Do not sound like a therapist.
- Do not say "this image shows."
- Do not say "as an AI."
- Speak as if the image itself is responding.
- Keep it short, grounded, and specific.
`
      },
      {
        role: "user",
        content: question
      }
    ],
    temperature: 0.7
  });

  return res.choices[0].message.content.trim();
}

//////////////////////////////////////////////////////////////
// CLEANUP — 6H OR 3 ANSWERS
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

  if (changed) {
    seedAIQuestionsIfEmpty();
    io.emit("count", questions.length);
  }
}, 60000);

//////////////////////////////////////////////////////////////
// HELPERS
//////////////////////////////////////////////////////////////

function createQuestion(user, text, imagePersona = null) {
  questions.unshift({
    id: makeId(),
    email: user.email,
    text,
    answers: [],
    imagePersona,
    createdAt: Date.now()
  });

  io.emit("count", questions.length);
}

function loadQuestions(user) {
  seedAIQuestionsIfEmpty();

  user.currentQuestions = [...questions].sort((a, b) => {
    if (a.answers.length !== b.answers.length) {
      return a.answers.length - b.answers.length;
    }

    return b.createdAt - a.createdAt;
  });

  user.pageIndex = 0;
  user.currentIndex = null;
}

function sendQuestions(socket, user) {
  const batch = user.currentQuestions.slice(
    user.pageIndex,
    user.pageIndex + 3
  );

  socket.emit("questions", batch);

  socket.emit("state", {
    placeholder: 'tap a question or type "ask" "next"'
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
    pageIndex: 0,
    imagePersona: null,
    imageData: null
  };

  seedAIQuestionsIfEmpty();

  socket.emit("state", {
    placeholder: "enter your email to connect"
  });

  socket.emit("count", questions.length);

  ////////////////////////////////////////////////////////////
  // COUNT
  ////////////////////////////////////////////////////////////

  socket.on("count", () => {
    socket.emit("count", questions.length);
  });

  ////////////////////////////////////////////////////////////
  // IMAGE UPLOAD
  ////////////////////////////////////////////////////////////

  socket.on("imageUpload", async ({ imageDataUrl }) => {
    const user = users[socket.id];
    if (!user) return;

    if (!user.email) {
      return socket.emit("state", {
        placeholder: "enter your email first"
      });
    }

    socket.emit("state", {
      placeholder: "reading image..."
    });

    try {
      user.imageData = imageDataUrl;
      user.imagePersona = await createImagePersona(imageDataUrl);

      return socket.emit("state", {
        placeholder: "image loaded — ask something"
      });
    } catch (err) {
      console.log("IMAGE ERROR:", err);

      return socket.emit("state", {
        placeholder: "image failed"
      });
    }
  });

  ////////////////////////////////////////////////////////////
  // SELECT QUESTION
  ////////////////////////////////////////////////////////////

  socket.on("selectQuestion", ({ index }) => {
    const user = users[socket.id];
    if (!user) return;

    user.currentIndex = user.pageIndex + Number(index);

    socket.emit("state", {
      placeholder: "answer or refer"
    });
  });

  ////////////////////////////////////////////////////////////
  // INPUT
  ////////////////////////////////////////////////////////////

  socket.on("input", async ({ text }) => {
    const user = users[socket.id];
    if (!user) return;

    const raw = String(text || "").trim();
    const lower = raw.toLowerCase();
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
    // IMAGE QUESTION FLOW
    //////////////////////////////////////////////////////////

    if (user.imagePersona) {
      const question = await rewriteText(raw);

      createQuestion(user, question, user.imagePersona);

      const answer = await getImageAnswer(user.imagePersona, question);
      const preview = answer.split(".")[0];

      socket.emit("preview", {
        text: preview
      });

      await sendEmailWithImage(
        user.email,
        "You’ve got an answer",
        `
        <div style="font-family:system-ui; line-height:1.5;">
          <p>You asked:</p>

          <img src="cid:img1" style="max-width:100%; border-radius:8px;" />

          <p>${escapeHtml(question)}</p>

          <hr/>

          <p><b>From Image AI:</b></p>
          <p>${escapeHtml(answer)}</p>

          <br/>

          <a href="${APP_URL}">Continue</a>
        </div>
        `,
        user.imageData,
        user.email
      );

      user.imagePersona = null;
      user.imageData = null;
      user.step = "mode";

      return socket.emit("state", {
        placeholder: 'ask, answer, or "image"'
      });
    }

    //////////////////////////////////////////////////////////
    // MODE STEP
    //////////////////////////////////////////////////////////

    if (user.step === "mode") {
      if (lower === "answer") {
        user.step = "answer";
        loadQuestions(user);
        return sendQuestions(socket, user);
      }

      if (lower === "ask") {
        user.step = "ask";

        return socket.emit("state", {
          placeholder: "type your question"
        });
      }

      const fixedQuestion = await rewriteText(raw);
      createQuestion(user, fixedQuestion);

      user.step = "mode";

      return socket.emit("state", {
        placeholder: 'ask, answer, or "image"'
      });
    }

    //////////////////////////////////////////////////////////
    // ASK STEP
    //////////////////////////////////////////////////////////

    if (user.step === "ask") {
      const fixedQuestion = await rewriteText(raw);

      createQuestion(user, fixedQuestion);

      user.step = "mode";

      return socket.emit("state", {
        placeholder: 'ask, answer, or "image"'
      });
    }

    //////////////////////////////////////////////////////////
    // ANSWER STEP
    //////////////////////////////////////////////////////////

    if (user.step === "answer") {
      if (lower === "next") {
        user.pageIndex += 3;
        user.currentIndex = null;
        return sendQuestions(socket, user);
      }

      if (lower === "ask") {
        user.step = "ask";
        user.currentIndex = null;

        return socket.emit("state", {
          placeholder: "type your question"
        });
      }

      if (lower.startsWith("refer")) {
        if (!email) {
          return socket.emit("state", {
            placeholder: 'type "refer friend@email.com"'
          });
        }

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

        const imageContext = q.imagePersona
          ? `<p><b>Image context:</b><br>${escapeHtml(q.imagePersona)}</p>`
          : "";

        await sendEmail(
          email,
          "You’ve got a question",
          `
          <div style="font-family:system-ui; line-height:1.5;">
            <p>You’ve got a question:</p>
            <p>${escapeHtml(q.text)}</p>
            ${imageContext}
            <br/>
            <a href="${APP_URL}">Answer here</a>
          </div>
          `,
          user.email
        );

        user.currentIndex = null;

        return socket.emit("state", {
          placeholder: "invited"
        });
      }

      if (email && raw === email) {
        return socket.emit("state", {
          placeholder: 'type "refer friend@email.com"'
        });
      }

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

      const fixedAnswer = await rewriteText(raw);

      q.answers.push({
        text: fixedAnswer,
        from: user.email,
        createdAt: Date.now()
      });

      await sendEmail(
        q.email,
        "Someone answered your question",
        `
        <div style="font-family:system-ui; line-height:1.5;">
          <p>New answer:</p>
          <p>${escapeHtml(fixedAnswer)}</p>

          <p>Responder:<br>${escapeHtml(user.email)}</p>

          <br/>
          <a href="${APP_URL}">Continue</a>
        </div>
        `,
        user.email
      );

      user.currentIndex = null;

      return socket.emit("state", {
        placeholder: "sent"
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
  console.log("AI CONNECT V2 FINAL RUNNING");
});
