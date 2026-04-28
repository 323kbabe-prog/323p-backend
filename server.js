//////////////////////////////////////////////////////////////
// ASIAN AI MATCH SYSTEM — AI ONLY (NO STRANGER)
//////////////////////////////////////////////////////////////

const express = require("express");
const http = require("http");
const cors = require("cors");
const OpenAI = require("openai");
const { Server } = require("socket.io");
const nodemailer = require("nodemailer");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

//////////////////////////////////////////////////////////////
// OPENAI (OPTIONAL)
//////////////////////////////////////////////////////////////

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

//////////////////////////////////////////////////////////////
// EMAIL SETUP
//////////////////////////////////////////////////////////////

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendMatchEmail(to, message, fromEmail) {
  try {
    await transporter.sendMail({
      from: `"AI Connect" <${process.env.EMAIL_USER}>`,
      to,
      subject: "New message from AI connect",
      text: `
Someone send you message:

"${message}"

Reply to: ${fromEmail}
      `
    });
  } catch (err) {
    console.error("Email error:", err);
  }
}

//////////////////////////////////////////////////////////////
// MEMORY
//////////////////////////////////////////////////////////////

const users = {}; // socket.id -> user state

const topicQueues = {
  general: []
};

//////////////////////////////////////////////////////////////
// HELPERS
//////////////////////////////////////////////////////////////

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function cleanText(text) {
  return String(text || "").trim();
}

function extractEmail(text) {
  const match = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  return match ? match[0] : null;
}

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

//////////////////////////////////////////////////////////////
// CONNECTION
//////////////////////////////////////////////////////////////

io.on("connection", (socket) => {

  ////////////////////////////////////////////////////////////
  // INIT USER
  ////////////////////////////////////////////////////////////

  users[socket.id] = {
    email: null,
    awaitingEmail: false,
    targetEmail: null,
    step: "start"
  };

  ////////////////////////////////////////////////////////////
  // FIRST MESSAGE
  ////////////////////////////////////////////////////////////

  setTimeout(() => {
    io.to(socket.id).emit("message", {
      id: makeId(),
      sender: "AI",
      text: "you want connect real person? say yes"
    });
  }, 500);

  ////////////////////////////////////////////////////////////
  // MESSAGE HANDLER
  ////////////////////////////////////////////////////////////

  socket.on("message", async (msg) => {

    const text = cleanText(msg.text);
    const user = users[socket.id];

    ////////////////////////////////////////////////////////////
    // STEP 1 — WAIT YES
    ////////////////////////////////////////////////////////////

    if (user.step === "start") {

      if (text.toLowerCase().includes("yes")) {
        user.step = "email";

        await delay(800);

        io.to(socket.id).emit("message", {
          id: makeId(),
          sender: "AI",
          text: "ok type your email"
        });
      }

      return;
    }

    ////////////////////////////////////////////////////////////
    // STEP 2 — CAPTURE EMAIL
    ////////////////////////////////////////////////////////////

    if (user.step === "email") {

      const email = extractEmail(text);

      if (!email) {
        io.to(socket.id).emit("message", {
          id: makeId(),
          sender: "AI",
          text: "need real email"
        });
        return;
      }

      user.email = email;
      user.step = "ready";

      await delay(800);

      io.to(socket.id).emit("message", {
        id: makeId(),
        sender: "AI",
        text: "ok saved. you can send message or type other email"
      });

      return;
    }

    ////////////////////////////////////////////////////////////
    // STEP 3 — READY STATE
    ////////////////////////////////////////////////////////////

    if (user.step === "ready") {

      const targetEmail = extractEmail(text);

      ////////////////////////////////////////////////////////////
      // DIRECT EMAIL SEND
      ////////////////////////////////////////////////////////////

      if (targetEmail) {

        await sendMatchEmail(
          targetEmail,
          text,
          user.email
        );

        await delay(800);

        io.to(socket.id).emit("message", {
          id: makeId(),
          sender: "AI",
          text: "sent. they will see your message"
        });

        return;
      }

      ////////////////////////////////////////////////////////////
      // ADD TO MATCH POOL
      ////////////////////////////////////////////////////////////

      topicQueues.general.push({
        from: user.email,
        text
      });

      await delay(800);

      io.to(socket.id).emit("message", {
        id: makeId(),
        sender: "AI",
        text: "ok waiting match or send email direct"
      });

      return;
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
// START SERVER
//////////////////////////////////////////////////////////////

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
