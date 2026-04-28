//////////////////////////////////////////////////////////////
// INPUT-ONLY AI CONNECTOR
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
  const m = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  return m ? m[0] : null;
}

//////////////////////////////////////////////////////////////
// SOCKET
//////////////////////////////////////////////////////////////

io.on("connection", (socket) => {

  users[socket.id] = {
    step: "start",
    email: null
  };

  // send initial state
  socket.emit("state", {
    placeholder: "you want connect real person? type yes"
  });

  socket.on("input", async (data) => {

    const text = (data.text || "").trim();
    const user = users[socket.id];

    if (!text) return;

    ////////////////////////////////////////////////////////////
    // STEP 1
    ////////////////////////////////////////////////////////////

    if (user.step === "start") {
      if (text.toLowerCase().includes("yes")) {
        user.step = "email";

        socket.emit("state", {
          placeholder: "type your email"
        });
      }
      return;
    }

    ////////////////////////////////////////////////////////////
    // STEP 2
    ////////////////////////////////////////////////////////////

    if (user.step === "email") {
      const email = extractEmail(text);

      if (!email) {
        socket.emit("state", {
          placeholder: "need real email"
        });
        return;
      }

      user.email = email;
      user.step = "ready";

      socket.emit("state", {
        placeholder: "type message or paste email to send"
      });

      return;
    }

    ////////////////////////////////////////////////////////////
    // STEP 3
    ////////////////////////////////////////////////////////////

    if (user.step === "ready") {

      const target = extractEmail(text);

      if (target) {
        await sendEmail(target, text, user.email);

        socket.emit("state", {
          placeholder: "sent ✓ type another"
        });

        return;
      }

      socket.emit("state", {
        placeholder: "saved ✓ waiting match"
      });

      return;
    }

  });

  socket.on("disconnect", () => {
    delete users[socket.id];
  });

});

//////////////////////////////////////////////////////////////
// START
//////////////////////////////////////////////////////////////

const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("INPUT AI CONNECTOR RUNNING");
});
