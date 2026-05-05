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

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

//////////////////////////////////////////////////
// EMAIL (CID + IMAGE)
//////////////////////////////////////////////////

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
    html: `<p>${text.replace(/\n/g,"<br>")}</p>${imgTag}`,
    attachments
  });
}

//////////////////////////////////////////////////
// DATA
//////////////////////////////////////////////////

const users = {};
const questions = [];

function extractEmail(text) {
  const m = text.match(/\S+@\S+\.\S+/);
  return m ? m[0].toLowerCase() : null;
}

//////////////////////////////////////////////////
// SOCKET
//////////////////////////////////////////////////

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

  socket.emit("state", { placeholder: "enter your email to connect" });

  //////////////////////////////////////////////////
  // IMAGE UPLOAD
  //////////////////////////////////////////////////

  socket.on("imageUpload", async ({ imageDataUrl }) => {

    const user = users[socket.id];
    if (!user.email) return;

    user.lastImage = imageDataUrl;

    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Describe this image." },
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

    socket.emit("preview", { text: user.imageContext });
    socket.emit("state", { placeholder: "ask this image" });
  });

  //////////////////////////////////////////////////
  // INPUT
  //////////////////////////////////////////////////

  socket.on("input", async ({ text }) => {

    const user = users[socket.id];
    const raw = text.trim();
    const email = extractEmail(raw);

    // EMAIL STEP
    if (user.step === "email") {
      if (email) {
        user.email = email;
        user.step = "active";
        return socket.emit("state", { placeholder: "ready" });
      }
      return;
    }

    //////////////////////////////////////////////////
    // IMAGE MODE (AI)
    //////////////////////////////////////////////////

    if (user.imageMode) {

      const res = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: user.imageContext },
          { role: "user", content: raw }
        ]
      });

      const answer = res.choices[0].message.content;

      await sendEmail(
        user.email,
        "AI Reply",
        `Q: ${raw}\n\nA: ${answer}`,
        user.lastImage
      );

      user.imageMode = false;

      // CLEAR PREVIEW
      socket.emit("preview", { text: "" });

      // AFTER SEND
      socket.emit("state", {
        placeholder: "sent. check your email"
      });

      // AUTO ANSWER SECTION
      user.currentQuestions = [...questions];
      user.pageIndex = 0;

      return socket.emit("questions",
        user.currentQuestions.slice(0,3)
      );
    }

    //////////////////////////////////////////////////
    // CREATE QUESTION
    //////////////////////////////////////////////////

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

  //////////////////////////////////////////////////
  // SELECT QUESTION
  //////////////////////////////////////////////////

  socket.on("selectQuestion", ({ index }) => {
    const user = users[socket.id];
    user.currentIndex = index;

    socket.emit("state", {
      placeholder: "answer or refer friend@email.com"
    });
  });

});

server.listen(10000);
