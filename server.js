//////////////////////////////////////////////////////////////
// AI CONNECT BOARD — V2 FINAL BACKEND
// Fixed 6 AI seed questions + seed lock + grammar rewrite
// ask + answer + refer email + pagination + 6h cleanup
// image upload → image persona → AI answer + refer image context
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
// AI SEED — 6 FIXED QUESTIONS WHEN EMPTY
//////////////////////////////////////////////////////////////

function seedAIQuestionsIfEmpty() {
  if (questions.length > 0 || isSeeding) return;

  isSeeding = true;

  const aiEmail = "a078bc@gmail.com";
  const now = Date.now();

  questions.unshift(
    {
      id: makeId(),
      email: aiEmail,
      text: "Anne Hathaway looks older, but I believe we are both old and young at the same time.",
      answers: [],
      imagePersona: null,
      createdAt: now
    },
    {
      id: makeId(),
      email: aiEmail,
      text: "What should I learn in AI for next week?",
      answers: [],
      imagePersona: null,
      createdAt: now
    },
    {
      id: makeId(),
      email: aiEmail,
      text: "Is it okay that I love Justin Bieber? I am 31.",
      answers: [],
      imagePersona: null,
      createdAt: now
    },
    {
      id: makeId(),
      email: aiEmail,
      text: "I’m not Asian—can I drink boba tea?",
      answers: [],
      imagePersona: null,
      createdAt: now
    },
    {
      id: makeId(),
      email: aiEmail,
      text: "I finally decided that Jisoo is my favorite.",
      answers: [],
      imagePersona: null,
      createdAt: now
    },
    {
      id: makeId(),
      email: aiEmail,
      text: "I love myself already. Do I need to find a girlfriend?",
      answers: [],
      imagePersona: null,
      createdAt: now
    }
  );

  io.emit("count", questions.length);
  isSeeding = false;
}

//////////////////////////////////////////////////////////////
// GRAMMAR REWRITE
//////////////////////////////////////////////////////////////

async function rewriteText(input) {
  try {
    const text = String(input || "").trim();

    if (!text) return input;
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
// IMAGE AI — IMAGE TO PERSONA
//////////////////////////////////////////////////////////////

async function createImagePersona(imageDataUrl) {
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Analyze the uploaded image and create a short AI persona voice from it. Do not identify real people. Focus on mood, environment, energy, visual feeling, and speaking style. Output only a compact persona description."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Create an image-based persona from this picture. Keep it short. This persona will answer user questions."
            },
            {
              type: "image_url",
              image_url: {
                url: imageDataUrl
              }
            }
          ]
        }
      ],
      temperature: 0.5
    });

    return res.choices[0].message.content.trim();
  } catch (err) {
    console.log("IMAGE PERSONA ERROR:", err);
    return null;
  }
}

async function answerWithImagePersona(imagePersona, question) {
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are an image-born voice.

Persona:
${imagePersona}

Rules:
Do not explain the image.
Do not say "this image shows."
Do not say "as an AI."
Answer as the image voice.
Keep it short, direct, and natural.
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
  } catch (err) {
    console.log("IMAGE ANSWER ERROR:", err);
    return "I’m here. Ask me again.";
  }
}

//////////////////////////////////////////////////////////////
// CLEANUP — 6 HOURS OR 3 ANSWERS
//////////////////////////////////////////////////////////////

setInterval(() => {
  const now = Date.now();
  const SIX_HOURS = 6 * 60 * 60 * 1000;

  let changed = false;

  for (let i = questions.length - 1; i >= 0; i--) {
    const q = questions[i];

    const expired = now - q.createdAt > SIX_HOURS;
    const enoughAnswers = q.answers.length >= 3;

    if (expired || enoughAnswers) {
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
  const batch = user.currentQuestions.slice(
    user.pageIndex,
    user.pageIndex + 3
  );

  if (!batch.length) {
    socket.emit("questions", []);

    return socket.emit("state", {
      placeholder: "no more. type ask"
    });
  }

  socket.emit("questions", batch);

  return socket.emit("state", {
    placeholder: "tap a question or type 'ask'"
  });
}

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

  user.step = "answer";
  user.imagePersona = null;
  user.imageLoaded = false;

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
    pageIndex: 0,
    imagePersona: null,
    imageLoaded: false
  };

  seedAIQuestionsIfEmpty();

  socket.emit("state", {
    placeholder: "enter your email"
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
  // Frontend sends:
  // socket.emit("imageUpload", { imageDataUrl });
  ////////////////////////////////////////////////////////////

  socket.on("imageUpload", async (data) => {
    const user = users[socket.id];
    if (!user) return;

    if (!user.email) {
      return socket.emit("state", {
        placeholder: "enter your email first"
      });
    }

    const imageDataUrl = data && data.imageDataUrl;

    if (!imageDataUrl) {
      return socket.emit("state", {
        placeholder: "upload an image"
      });
    }

    socket.emit("state", {
      placeholder: "reading image..."
    });

    const persona = await createImagePersona(imageDataUrl);

    if (!persona) {
      return socket.emit("state", {
        placeholder: "image failed. try again"
      });
    }

    user.imagePersona = persona;
    user.imageLoaded = true;
    user.step = "image";

    return socket.emit("state", {
      placeholder: "image loaded — ask something"
    });
  });

  ////////////////////////////////////////////////////////////
  // SELECT QUESTION
  ////////////////////////////////////////////////////////////

  socket.on("selectQuestion", ({ index }) => {
    const user = users[socket.id];
    if (!user) return;

    const selectedIndex = user.pageIndex + Number(index);
    const selectedQuestion = user.currentQuestions[selectedIndex];

    if (!selectedQuestion) {
      return socket.emit("state", {
        placeholder: "tap a question first"
      });
    }

    user.currentIndex = selectedIndex;

    return socket.emit("state", {
      placeholder: "answer or refer someone (email)"
    });
  });

  ////////////////////////////////////////////////////////////
  // INPUT
  ////////////////////////////////////////////////////////////

  socket.on("input", async (data) => {
    const text = (data.text || "").trim();
    const user = users[socket.id];

    if (!text || !user) return;

    //////////////////////////////////////////////////////////
    // EMAIL STEP
    //////////////////////////////////////////////////////////

    if (user.step === "email") {
      const email = extractEmail(text);

      if (email) {
        user.email = email;
        user.step = "mode";

        return socket.emit("state", {
          placeholder: "ask a question, upload image, or type 'answer'"
        });
      }

      return socket.emit("state", {
        placeholder: "enter your email to start"
      });
    }

    //////////////////////////////////////////////////////////
    // MODE STEP
    //////////////////////////////////////////////////////////

    if (user.step === "mode") {
      const lower = text.toLowerCase();

      if (lower.includes("answer")) {
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

      const fixedQuestion = await rewriteText(text);

      createQuestion(user, fixedQuestion);

      return sendQuestions(socket, user);
    }

    //////////////////////////////////////////////////////////
    // IMAGE STEP
    //////////////////////////////////////////////////////////

    if (user.step === "image") {
      const lower = text.toLowerCase();

      if (lower === "ask") {
        user.step = "ask";
        user.imagePersona = null;
        user.imageLoaded = false;

        return socket.emit("state", {
          placeholder: "type your question"
        });
      }

      if (lower.includes("answer")) {
        user.step = "answer";
        user.imagePersona = null;
        user.imageLoaded = false;

        loadQuestions(user);
        return sendQuestions(socket, user);
      }

      if (!user.imagePersona) {
        return socket.emit("state", {
          placeholder: "upload an image first"
        });
      }

      const fixedQuestion = await rewriteText(text);

      const imageAnswer = await answerWithImagePersona(
        user.imagePersona,
        fixedQuestion
      );

      const fullQuestion = `${fixedQuestion}\n\nImage AI answered:\n${imageAnswer}`;

      createQuestion(user, fullQuestion, user.imagePersona);

      return sendQuestions(socket, user);
    }

    //////////////////////////////////////////////////////////
    // ASK STEP
    //////////////////////////////////////////////////////////

    if (user.step === "ask") {
      const fixedQuestion = await rewriteText(text);

      createQuestion(user, fixedQuestion);

      return sendQuestions(socket, user);
    }

    //////////////////////////////////////////////////////////
    // ANSWER STEP
    //////////////////////////////////////////////////////////

    if (user.step === "answer") {
      const lower = text.toLowerCase();
      const detectedEmail = extractEmail(text);

      // ASK RETURN
      if (lower === "ask") {
        user.step = "ask";
        user.currentIndex = null;

        return socket.emit("state", {
          placeholder: "type your question"
        });
      }

      // NEXT PAGE
      if (lower === "next") {
        user.pageIndex += 3;
        user.currentIndex = null;

        return sendQuestions(socket, user);
      }

      // REFER / INVITE FRIEND
      if (lower.startsWith("refer")) {
        const friendEmail = detectedEmail;

        if (!friendEmail) {
          return socket.emit("state", {
            placeholder: "type 'refer friend@email.com'"
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
          ? `

Image AI context:
${q.imagePersona}
`
          : "";

        await sendEmail(
          friendEmail,
          "You’ve got a question",
          `
You’ve got mail.

${user.email} invited you to answer:

"${q.text}"
${imageContext}

Reply to answer
or join the board:
${APP_URL}

We are the world. We are connected strangers.
`,
          user.email
        );

        user.currentIndex = null;

        return socket.emit("state", {
          placeholder: "Invited. Tap a question"
        });
      }

      // AUTO-TEACH EMAIL FORMAT
      if (detectedEmail && text === detectedEmail) {
        return socket.emit("state", {
          placeholder: "type: refer friend@email.com"
        });
      }

      // MUST SELECT QUESTION FIRST
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

      // DEFAULT = ANSWER WITH GRAMMAR REWRITE
      const fixedAnswer = await rewriteText(text);

      q.answers.push({
        text: fixedAnswer,
        from: user.email,
        createdAt: Date.now()
      });

      const imageContext = q.imagePersona
        ? `

Image AI context:
${q.imagePersona}
`
        : "";

      await sendEmail(
        q.email,
        "Someone answered your question",
        `
New answer:
${fixedAnswer}

Responder:
${user.email}
${imageContext}

Reply directly to continue:
${APP_URL}
`,
        user.email
      );

      user.currentIndex = null;

      return socket.emit("state", {
        placeholder: "Sent. Tap a question or type 'ask'"
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
  console.log("AI CONNECT BOARD V2 FINAL + IMAGE AI RUNNING");
});