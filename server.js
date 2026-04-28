//////////////////////////////////////////////////////////////
// AI CONNECTOR — EMAIL FIRST → INBOX → SEND → CHECK REPLIES
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
// EMAIL
//////////////////////////////////////////////////////////////

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendEmail(to, message, userEmail) {
  try {
    await transporter.sendMail({
      from: `"AI Connect" <${process.env.EMAIL_USER}>`,
      to,
      subject: "New message",
      text: `
Message:
${message}

User email:
${userEmail}

Reply:
For now, reply manually to this user email.
`
    });
  } catch (err) {
    console.log("EMAIL ERROR:", err);
  }
}

//////////////////////////////////////////////////////////////
// STATE
//////////////////////////////////////////////////////////////

const users = {};
const inbox = {};

function extractEmail(text) {
  const m = String(text || "").match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  return m ? m[0].toLowerCase() : null;
}

function isMeaningful(text) {
  return text && text.trim().length > 2;
}

function saveInbox(userEmail, item) {
  if (!inbox[userEmail]) inbox[userEmail] = [];
  inbox[userEmail].push({
    ...item,
    time: Date.now()
  });
}

//////////////////////////////////////////////////////////////
// SOCKET
//////////////////////////////////////////////////////////////

io.on("connection", (socket) => {

  users[socket.id] = {
    step: "userEmail",
    userEmail: null,
    targetEmail: null
  };

  socket.emit("state", {
    step: "userEmail",
    placeholder: "enter your email"
  });

  ////////////////////////////////////////////////////////////
  // INPUT
  ////////////////////////////////////////////////////////////

  socket.on("input", async (data) => {

    const text = (data.text || "").trim();
    const user = users[socket.id];

    if (!user || !text) return;

    ////////////////////////////////////////////////////////////
    // STEP 1 — USER EMAIL
    ////////////////////////////////////////////////////////////

    if (user.step === "userEmail") {

      const email = extractEmail(text);

      if (!email) {
        socket.emit("state", {
          step: "userEmail",
          placeholder: "invalid email"
        });
        return;
      }

      user.userEmail = email;
      user.step = "idle";

      const messages = inbox[email] || [];

      socket.emit("inbox", messages);

      socket.emit("state", {
        step: "idle",
        placeholder: messages.length
          ? `you have ${messages.length} messages`
          : "type their email"
      });

      return;
    }

    ////////////////////////////////////////////////////////////
    // STEP 2 — IDLE: CHECK INBOX OR TYPE TARGET EMAIL
    ////////////////////////////////////////////////////////////

    if (user.step === "idle") {

      const email = extractEmail(text);

      if (email) {
        user.targetEmail = email;
        user.step = "message";

        socket.emit("state", {
          step: "message",
          placeholder: "your message"
        });

        return;
      }

      const messages = inbox[user.userEmail] || [];

      socket.emit("inbox", messages);

      socket.emit("state", {
        step: "idle",
        placeholder: messages.length
          ? `latest reply shown`
          : "no replies yet"
      });

      return;
    }

    ////////////////////////////////////////////////////////////
    // STEP 3 — MESSAGE
    ////////////////////////////////////////////////////////////

    if (user.step === "message") {

      if (!isMeaningful(text)) {
        socket.emit("state", {
          step: "message",
          placeholder: "message too short"
        });
        return;
      }

      saveInbox(user.userEmail, {
        type: "sent",
        from: user.userEmail,
        to: user.targetEmail,
        message: text
      });

      await sendEmail(user.targetEmail, text, user.userEmail);

      //////////////////////////////////////////////////////////
      // TEMP FAKE REPLY FOR TESTING
      // Remove this later when you add real inbound email.
      //////////////////////////////////////////////////////////

      setTimeout(() => {
        saveInbox(user.userEmail, {
          type: "reply",
          from: user.targetEmail,
          to: user.userEmail,
          message: "Reply received. This is a test reply."
        });
      }, 5000);

      user.step = "idle";
      user.targetEmail = null;

      socket.emit("inbox", inbox[user.userEmail] || []);

      socket.emit("state", {
        step: "idle",
        placeholder: "sent. come back later"
      });

      return;
    }

  });

  ////////////////////////////////////////////////////////////
  // RESET
  ////////////////////////////////////////////////////////////

  socket.on("reset", () => {
    users[socket.id] = {
      step: "userEmail",
      userEmail: null,
      targetEmail: null
    };

    socket.emit("state", {
      step: "userEmail",
      placeholder: "enter your email"
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
// START SERVER
//////////////////////////////////////////////////////////////

const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("AI CONNECTOR RUNNING");
});