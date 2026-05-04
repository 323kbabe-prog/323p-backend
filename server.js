//////////////////////////////////////////////////////////////
// AI CONNECT — FINAL BACKEND
// stable no sharp + scene/text-aware image AI
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

const APP_URL = process.env.APP_URL || "https://connectaing.com";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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

const users = {};
const questions = [];

function makeId() {
  return Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

function extractEmail(text) {
  const m = String(text || "").match(/\S+@\S+\.\S+/);
  return m ? m[0].toLowerCase() : null;
}

function seedAIQuestionsIfEmpty() {
  if (questions.length > 0) return;

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
      text,
      answers: [],
      createdAt: Date.now()
    });
  });

  io.emit("count", questions.length);
}

async function rewriteText(input) {
  try {
    const text = String(input || "").trim();
    if (text.length < 3) return text;

    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Fix grammar. Keep meaning. Output only the corrected text."
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

async function createPersona(image) {
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
          {
            type: "text",
            text: "Create the image persona from this picture."
          },
          {
            type: "image_url",
            image_url: { url: image }
          }
        ]
      }
    ],
    temperature: 0.4
  });

  return res.choices[0].message.content.trim();
}

async function getAnswer(persona, question) {
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

setInterval(() => {
  const now = Date.now();
  const SIX_HOURS = 6 * 60 * 60 * 1000;

  for (let i = questions.length - 1; i >= 0; i--) {
    const q = questions[i];

    if (now - q.createdAt > SIX_HOURS || q.answers.length >= 3) {
      questions.splice(i, 1);
    }
  }

  seedAIQuestionsIfEmpty();
  io.emit("count", questions.length);
}, 60000);

io.on("connection", (socket) => {
  users[socket.id] = {
    step: "email",
    email: null,
    persona: null,
    image: null
  };

  seedAIQuestionsIfEmpty();

  socket.emit("state", {
    placeholder: "enter your email to connect"
  });

  socket.emit("count", questions.length);

  socket.on("count", () => {
    socket.emit("count", questions.length);
  });

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
      user.image = imageDataUrl;
      user.persona = await createPersona(imageDataUrl);

      socket.emit("state", {
        placeholder: "image loaded — ask something"
      });
    } catch (err) {
      console.log("IMAGE ERROR:", err);

      socket.emit("state", {
        placeholder: "image failed"
      });
    }
  });

  socket.on("input", async ({ text }) => {
    const user = users[socket.id];
    if (!user) return;

    const raw = String(text || "").trim();
    const lower = raw.toLowerCase();
    const email = extractEmail(raw);

    if (!raw) return;

    if (user.step === "email") {
      if (email) {
        user.email = email;
        user.step = "ready";

        return socket.emit("state", {
          placeholder: 'ask, answer, or "image"'
        });
      }

      return socket.emit("state", {
        placeholder: "enter your email to connect"
      });
    }

    if (user.persona) {
      const question = await rewriteText(raw);

      questions.unshift({
        id: makeId(),
        text: question,
        answers: [],
        createdAt: Date.now()
      });

      io.emit("count", questions.length);

      const ans = await getAnswer(user.persona, question);
      const preview = ans.split(".")[0];

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

      user.persona = null;
      user.image = null;

      return socket.emit("state", {
        placeholder: 'ask, answer, or "image"'
      });
    }

    return socket.emit("state", {
      placeholder: 'ask, answer, or "image"'
    });
  });

  socket.on("disconnect", () => {
    delete users[socket.id];
  });
});

server.listen(process.env.PORT || 10000, () => {
  console.log("AI CONNECT RUNNING — SCENE + TEXT AWARE IMAGE AI");
});