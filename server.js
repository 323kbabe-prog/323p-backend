//////////////////////////////////////////////////////////////
// 🔥 BASE AI SEARCH CHATROOM (FINAL WORKING)
//////////////////////////////////////////////////////////////

const express = require("express");
const cors = require("cors");
const http = require("http");
const OpenAI = require("openai");

// ✅ FIX: add fetch
const fetch = require("node-fetch");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

//////////////////////////////////////////////////////////////
// 🔥 OPENAI
//////////////////////////////////////////////////////////////

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

//////////////////////////////////////////////////////////////
// 🔥 BASIC ROUTE
//////////////////////////////////////////////////////////////

app.get("/", (_, res) => {
  res.send("BASE AI CHAT RUNNING");
});

//////////////////////////////////////////////////////////////
// 🔥 SERVER + SOCKET
//////////////////////////////////////////////////////////////

const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server, {
  cors: { origin: "*" }
});

const rooms = {};

//////////////////////////////////////////////////////////////
// 🔥 SAFE TEXT
//////////////////////////////////////////////////////////////

function safe(str = "") {
  return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

//////////////////////////////////////////////////////////////
// 🔥 SOCKET
//////////////////////////////////////////////////////////////

io.on("connection", (socket) => {

  socket.on("joinRoom", ({ roomId }) => {

    socket.join(roomId);

    socket.emit("message", {
      role: "ai",
      persona: "AI",
      text: "Welcome to AI Search Chat"
    });

  });

  socket.on("sendMessage", async ({ roomId, message }) => {

    if (!message) return;

    // show user
    io.to(roomId).emit({
      role: "user",
      text: safe(message)
    });

    ////////////////////////////////////////////////////////
    // 🔍 SEARCH
    ////////////////////////////////////////////////////////

    let ytResults = [];
    let webResults = [];

    // 🔴 YouTube
    try {
      const ytRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?key=${process.env.YOUTUBE_API_KEY}&q=${encodeURIComponent(message)}&type=video&part=snippet&maxResults=3`
      );

      const ytData = await ytRes.json();

      if (ytData.items) {
        ytResults = ytData.items.map(v => ({
          title: safe(v.snippet.title),
          link: `https://www.youtube.com/watch?v=${v.id.videoId}`
        }));
      }

    } catch (e) {
      console.log("YT error:", e);
    }

    // 🟢 Google SERP
    try {
      const serpRes = await fetch(
        `https://serpapi.com/search.json?q=${encodeURIComponent(message)}&api_key=${process.env.SERP_KEY}`
      );

      const serpData = await serpRes.json();

      if (serpData.organic_results) {
        webResults = serpData.organic_results.slice(0, 3).map(r => ({
          title: safe(r.title),
          link: r.link
        }));
      }

    } catch (e) {
      console.log("SERP error:", e);
    }

    ////////////////////////////////////////////////////////
    // SHOW WEB
    ////////////////////////////////////////////////////////
    io.to(roomId).emit({
      role: "ai",
      persona: "Web",
      text: webResults.length
        ? webResults.map(r =>
            `<b>${r.title}</b><br>
             <a href="${r.link}" target="_blank">${r.link}</a>`
          ).join("<br><br>")
        : "No web results"
    });

    ////////////////////////////////////////////////////////
    // SHOW YOUTUBE
    ////////////////////////////////////////////////////////
    io.to(roomId).emit({
      role: "ai",
      persona: "YouTube",
      text: ytResults.length
        ? ytResults.map(r =>
            `🎥 <b>${r.title}</b><br>
             <a href="${r.link}" target="_blank">${r.link}</a>`
          ).join("<br><br>")
        : "No videos"
    });

    ////////////////////////////////////////////////////////
    // 🤖 AI SUMMARY
    ////////////////////////////////////////////////////////

    try {

      const context = [...webResults, ...ytResults]
        .map(r => r.title)
        .join("\n");

      const aiRes = await openai.chat.completions.create({
        model:"gpt-4o-mini",
        messages:[
          { role:"system", content:"Summarize clearly." },
          { role:"user", content:`${message}\n${context}` }
        ]
      });

      io.to(roomId).emit({
        role:"ai",
        persona:"AI",
        text: aiRes.choices[0].message.content
      });

    } catch (err) {

      io.to(roomId).emit({
        role:"ai",
        persona:"AI",
        text:"AI summary unavailable"
      });

    }

  });

});

//////////////////////////////////////////////////////////////
// 🚀 START SERVER
//////////////////////////////////////////////////////////////

const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("🔥 BASE AI CHAT RUNNING");
});
