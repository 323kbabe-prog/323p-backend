//////////////////////////////////////////////////////////////
// INPUT-ONLY AI CONNECTOR (FINAL FIXED VERSION)
//////////////////////////////////////////////////////////////

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const nodemailer = require("nodemailer");

const app = express();
app.use(cors({ origin: "*" }));

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

//////////////////////////////////////////////////////////////
// HEALTH CHECK
//////////////////////////////////////////////////////////////

app.get("/", (req, res) => {
  res.send("AI CONNECT BACKEND LIVE");
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

async function sendEmail(to, message, fromEmail) {
  try {
    await transporter.sendMail({
      from: `"AI Connect" <${process.env.EMAIL_USER}>`,
      to,
      subject: "New connection message",
      text: `Message:\n${message}\n\nReply: ${fromEmail}`
    });
  } catch (err) {
    console.log("EMAIL ERROR:", err);
  }
}

//////////////////////////////////////////////////////////////
// STATE
//////////////////////////////////////////////////////////////

const users = {};

function extractEmail(text) {
  const match = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  return match ? match[0] : null;
}

function random(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

//////////////////////////////////////////////////////////////
// SOCKET
//////////////////////////////////////////////////////////////

io.on("connection", (socket) => {

  console.log("CONNECTED:", socket.id);

  users[socket.id] = {
    step: "start",
    email: null
  };

  ////////////////////////////////////////////////////////////
  // INITIAL STATE
  ////////////////////////////////////////////////////////////

  socket.emit("state", {
    placeholder: "you want connect real person? type yes"
  });

  ////////////////////////////////////////////////////////////
  // INPUT HANDLER
  ////////////////////////////////////////////////////////////

  socket.on("input", async (data) => {

    const text = (data.text || "").trim();
    const user = users[socket.id];

    if (!text) return;

    ////////////////////////////////////////////////////////////
    // STEP 1 — WAIT YES
    ////////////////////////////////////////////////////////////

    if (user.step === "start") {

      if (text.toLowerCase().includes("yes")) {

        user.step = "email";

        socket.emit("state", {
          placeholder: "ok type your email"
        });

      } else {

        socket.emit("state", {
          placeholder: random([
            "type yes to continue",
            "just type yes",
            "need yes to start",
            "say yes to connect"
          ])
        });

      }

      return;
    }

    ////////////////////////////////////////////////////////////
    // STEP 2 — EMAIL INPUT
    ////////////////////////////////////////////////////////////

    if (user.step === "email") {

      const email = extractEmail(text);

      if (!email) {

        socket.emit("state", {
          placeholder: random([
            "need real email",
            "enter valid email",
            "that not email",
            "email format wrong"
          ])
        });

        return;
      }

      user.email = email;
      user.step = "ready";

      socket.emit("state", {
        placeholder: "type message + email to send"
      });

      return;
    }

    ////////////////////////////////////////////////////////////
    // STEP 3 — READY STATE
    ////////////////////////////////////////////////////////////

    if (user.step === "ready") {

      const targetEmail = extractEmail(text);

      ////////////////////////////////////////////////////////////
      // EMAIL FOUND
      ////////////////////////////////////////////////////////////

      if (targetEmail) {

        // remove email from message
        const messageOnly = text.replace(targetEmail, "").trim();

        ////////////////////////////////////////////////////////////
        // ❌ NO MESSAGE CONTENT
        ////////////////////////////////////////////////////////////

        if (!messageOnly) {
          socket.emit("state", {
            placeholder: random([
              "type message with email",
              "need message + email",
              "say something + email",
              "message missing"
            ])
          });
          return;
        }

        ////////////////////////////////////////////////////////////
        // ✅ SEND EMAIL
        ////////////////////////////////////////////////////////////

        await sendEmail(targetEmail, messageOnly, user.email);

        socket.emit("state", {
          placeholder: random([
            "sent ✓ type another",
            "message sent ✓",
            "done ✓ send more",
            "sent ✓ next"
          ])
        });

        return;
      }

      ////////////////////////////////////////////////////////////
      // NORMAL MESSAGE (NO EMAIL)
      ////////////////////////////////////////////////////////////

      socket.emit("state", {
        placeholder: random([
          "saved ✓ waiting match",
          "ok saved",
          "stored ✓",
          "waiting match"
        ])
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

const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("AI CONNECTOR RUNNING ON", PORT);
});
