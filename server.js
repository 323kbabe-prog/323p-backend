//////////////////////////////////////////////////////////////
// 🔥 REAL-TIME CHATROOM (AI QUERY + MEMORY + ALWAYS 3 YT)
//////////////////////////////////////////////////////////////

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const OpenAI = require("openai");
const fetch = require("node-fetch");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

app.get("/", (_, res) => res.send("OK"));

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const rooms = {};

io.on("connection", (socket) => {

  ////////////////////////////////////////////////////////////
  // JOIN ROOM
  ////////////////////////////////////////////////////////////
  socket.on("joinRoom", (roomId) => {

    socket.join(roomId);

    if(!rooms[roomId]) rooms[roomId] = [];

    const intro = "Welcome to XXX.live";

    socket.emit("message", {
      role: "ai",
      persona: "AI",
      text: intro
    });

    if(rooms[roomId].length === 0){
      rooms[roomId].push({
        role: "assistant",
        content: intro
      });
    }

  });

  ////////////////////////////////////////////////////////////
  // SEND MESSAGE
  ////////////////////////////////////////////////////////////
  socket.on("sendMessage", async ({ roomId, message }) => {

    if(!message) return;

    if(!rooms[roomId]) rooms[roomId] = [];

    ////////////////////////////////////////////////////////
    // SAVE USER
    ////////////////////////////////////////////////////////
    rooms[roomId].push({
      role: "user",
      content: message
    });

    rooms[roomId] = rooms[roomId].slice(-20);

    ////////////////////////////////////////////////////////
    // SEND USER
    ////////////////////////////////////////////////////////
    io.to(roomId).emit("message", {
      role: "user",
      text: message
    });

    ////////////////////////////////////////////////////////
    // 🌍 GET USER REGION (IP)
    ////////////////////////////////////////////////////////
    let regionCode = "US";

    try {
      const rawIP = socket.handshake.headers["x-forwarded-for"];
      const ip = rawIP ? rawIP.split(",")[0] : socket.handshake.address;

      const geoRes = await fetch(`http://ip-api.com/json/${ip}`);
      const geoData = await geoRes.json();

      if(geoData?.countryCode){
        regionCode = geoData.countryCode;
      }

    } catch (err) {
      console.log("Geo error:", err);
    }

    ////////////////////////////////////////////////////////
    // 🤖 AI GENERATE SEARCH QUERY
    ////////////////////////////////////////////////////////
    let smartQuery = message;

    try {
      const qGen = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: `
Generate a YouTube search query.

- understand intent
- use location if useful
- 5–8 words
- output only query
`
          },
          {
            role: "user",
            content: `Location: ${regionCode}\nInput: ${message}`
          }
        ]
      });

      smartQuery = qGen.choices[0].message.content.trim();

      if(!smartQuery || smartQuery.length < 3){
        smartQuery = message;
      }

    } catch (err) {
      console.log("AI query error:", err);
    }

    ////////////////////////////////////////////////////////
    // 🔍 YOUTUBE SEARCH (ALWAYS 3)
    ////////////////////////////////////////////////////////
    let ytResults = [];

    try {

      const now = new Date();
      const windows = [24, 72, 168];

      for(const h of windows){

        const time = new Date(now.getTime() - h * 3600000).toISOString();

        const url = `https://www.googleapis.com/youtube/v3/search?key=${process.env.YOUTUBE_API_KEY}&q=${encodeURIComponent(smartQuery)}&type=video&part=snippet&maxResults=6&order=date&publishedAfter=${time}`;

        const res = await fetch(url);
        const data = await res.json();

        if(data.items?.length >= 3){
          ytResults = data.items;
          break;
        } else {
          ytResults = data.items || [];
        }
      }

      // fallback
      if(ytResults.length < 3){
        const url = `https://www.googleapis.com/youtube/v3/search?key=${process.env.YOUTUBE_API_KEY}&q=${encodeURIComponent(smartQuery)}&type=video&part=snippet&maxResults=6`;

        const res = await fetch(url);
        const data = await res.json();

        ytResults = ytResults.concat(data.items || []);
      }

      ytResults = ytResults.slice(0,3).map(v => ({
        title: v.snippet.title,
        link: `https://www.youtube.com/watch?v=${v.id.videoId}`,
        date: v.snippet.publishedAt
      }));

    } catch (err) {
      console.log("YT error:", err);
    }

    ////////////////////////////////////////////////////////
    // SEND YOUTUBE
    ////////////////////////////////////////////////////////
    if(ytResults.length === 3){

      const text = ytResults.map(r =>
        `YT|${r.title}|${r.link}`
      ).join("\n");

      io.to(roomId).emit({
        role: "ai",
        persona: "YouTube",
        text
      });
    }

    ////////////////////////////////////////////////////////
    // 🤖 AI SUMMARY (WITH MEMORY)
    ////////////////////////////////////////////////////////
    const history = rooms[roomId]
      .slice(-10)
      .filter(m => m.content !== "Welcome to XXX.live");

    const context = ytResults.map(r =>
      `${r.title} (${r.date})`
    ).join("\n");

    let aiText = "No response.";

    try {
      const r = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages: [
          { role: "system", content: "Short helpful answer. Max 5 lines." },
          ...history,
          {
            role: "user",
            content: `${message}\n\nResults:\n${context}`
          }
        ]
      });

      aiText = r?.choices?.[0]?.message?.content || "No response.";

    } catch (err) {
      console.log("AI summary error:", err);
    }

    ////////////////////////////////////////////////////////
    // SAVE AI
    ////////////////////////////////////////////////////////
    rooms[roomId].push({
      role: "assistant",
      content: aiText
    });

    ////////////////////////////////////////////////////////
    // SEND AI
    ////////////////////////////////////////////////////////
    io.to(roomId).emit({
      role: "ai",
      persona: "AI",
      text: aiText
    });

  });

  ////////////////////////////////////////////////////////////
  socket.on("disconnect", () => {
    console.log("🔴 disconnected:", socket.id);
  });

});

//////////////////////////////////////////////////////////////
// START SERVER
//////////////////////////////////////////////////////////////

const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("🔥 CLEAN CHATROOM RUNNING");
});
