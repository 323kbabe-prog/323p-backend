//////////////////////////////////////////////////////////////
// AI EMAIL CONNECTOR — CLEAN VERSION
//////////////////////////////////////////////////////////////

const express = require("express");
const http = require("http");
const cors = require("cors");
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
// EMAIL SETUP (GMAIL APP PASSWORD)
//////////////////////////////////////////////////////////////

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendEmail(to, message, fromEmail) {
  try {
    await transporter.sendMail({
      from: `"AI Connect" <${process.env.EMAIL_USER}>`,
      to,
      subject: "New connection message",
      text: `Message:\n\n${message}\n\nReply: ${fromEmail}`
    });
  } catch (err) {
    console.error("Email error:", err);
  }
}

//////////////////////////////////////////////////////////////
// MEMORY
//////////////////////////////////////////////////////////////

const users = {}; // socket.id -> state
const pool = [];  // waiting messages

//////////////////////////////////////////////////////////////
// HELPERS
//////////////////////////////////////////////////////////////

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function extractEmail(text) {
  const match = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  return match ? match[0] : null;
}

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

//////////////////////////////////////////////////////////////
// SOCKET
//////////////////////////////////////////////////////////////

io.on("connection", (socket) => {

  users[socket.id] = {
    email: null,
    step: "start"
  };

  ////////////////////////////////////////////////////////////
  // FIRST MESSAGE
  ////////////////////////////////////////////////////////////

  setTimeout(() => {
    socket.emit("message", {
      id: makeId(),
      sender: "AI",
      text: "you want connect real person? say yes"
    });
  }, 400);

  ////////////////////////////////////////////////////////////
  // MESSAGE
  ////////////////////////////////////////////////////////////

  socket.on("message", async (msg) => {

    const text = (msg.text || "").trim();
    const user = users[socket.id];

    ////////////////////////////////////////////////////////////
    // STEP 1 — WAIT YES
    ////////////////////////////////////////////////////////////

    if (user.step === "start") {

      if (text.toLowerCase().includes("yes")) {
        user.step = "email";

        await delay(600);

        socket.emit("message", {
          id: makeId(),
          sender: "AI",
          text: "ok type your email"
        });
      }

      return;
    }

    ////////////////////////////////////////////////////////////
    // STEP 2 — GET EMAIL
    ////////////////////////////////////////////////////////////

    if (user.step === "email") {

      const email = extractEmail(text);

      if (!email) {
        socket.emit("message", {
          id: makeId(),
          sender: "AI",
          text: "need real email"
        });
        return;
      }

      user.email = email;
      user.step = "ready";

      await delay(600);

      socket.emit("message", {
        id: makeId(),
        sender: "AI",
        text: "ok saved. send message or type email to send"
      });

      return;
    }

    ////////////////////////////////////////////////////////////
    // STEP 3 — READY
    ////////////////////////////////////////////////////////////

    if (user.step === "ready") {

      const targetEmail = extractEmail(text);

      ////////////////////////////////////////////////////////////
      // DIRECT SEND
      ////////////////////////////////////////////////////////////

      if (targetEmail) {

        await sendEmail(targetEmail, text, user.email);

        socket.emit("message", {
          id: makeId(),
          sender: "AI",
          text: "sent ✓"
        });

        return;
      }

      ////////////////////////////////////////////////////////////
      // ADD TO POOL
      ////////////////////////////////////////////////////////////

      pool.push({
        from: user.email,
        text
      });

      socket.emit("message", {
        id: makeId(),
        sender: "AI",
        text: "saved. waiting match"
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
// START
//////////////////////////////////////////////////////////////

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("AI EMAIL CONNECTOR RUNNING");
});
