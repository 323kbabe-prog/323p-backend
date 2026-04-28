//////////////////////////////////////////////////////////////
// AI CONNECTOR — TARGET EMAIL → MESSAGE → SEND → RESET
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
// EMAIL
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
      subject: "New message",
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
  const m = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  return m ? m[0] : null;
}

function isMeaningful(text) {
  return text && text.length > 2;
}

//////////////////////////////////////////////////////////////
// SOCKET
//////////////////////////////////////////////////////////////

io.on("connection", (socket) => {

  users[socket.id] = {
    step: "target",
    targetEmail: null
  };

  ////////////////////////////////////////////////////////////
  // INITIAL
  ////////////////////////////////////////////////////////////

  socket.emit("state", {
    placeholder: "choose your AI. type their email"
  });

  ////////////////////////////////////////////////////////////
  // INPUT
  ////////////////////////////////////////////////////////////

  socket.on("input", async (data) => {

    const text = (data.text || "").trim();
    const user = users[socket.id];

    if (!text) return;

    ////////////////////////////////////////////////////////////
    // STEP 1 — TARGET EMAIL
    ////////////////////////////////////////////////////////////

    if (user.step === "target") {

      const email = extractEmail(text);

      if (!email) {
        socket.emit("state", {
          placeholder: "need valid email"
        });
        return;
      }

      user.targetEmail = email;
      user.step = "message";

      socket.emit("state", {
        placeholder: "type your message"
      });

      return;
    }

    ////////////////////////////////////////////////////////////
    // STEP 2 — MESSAGE
    ////////////////////////////////////////////////////////////

    if (user.step === "message") {

      if (!isMeaningful(text)) {
        socket.emit("state", {
          placeholder: "type a real message"
        });
        return;
      }

      ////////////////////////////////////////////////////////////
      // SEND EMAIL (silent)
      ////////////////////////////////////////////////////////////

      await sendEmail(user.targetEmail, text, "anonymous@aiconnect.com");

      ////////////////////////////////////////////////////////////
      // RESET (no "sent" state)
      ////////////////////////////////////////////////////////////

      user.step = "target";
      user.targetEmail = null;

      socket.emit("state", {
        placeholder: "choose your AI. type their email"
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
// START SERVER (ONLY ONCE, OUTSIDE EVERYTHING)
//////////////////////////////////////////////////////////////

const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("AI CONNECTOR RUNNING");
});
