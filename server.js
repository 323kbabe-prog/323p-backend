//////////////////////////////////////////////////////////////
// 🔥 REAL-TIME CHATROOM (SEARCH + UI FORMAT FIXED)
//////////////////////////////////////////////////////////////

const http = require("http");
const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server, {
  cors: { origin: "*" }
});

const rooms = {};

io.on("connection", (socket) => {

  ////////////////////////////////////////////////////////////
  // JOIN ROOM
  ////////////////////////////////////////////////////////////
  socket.on("joinRoom", (roomId) => {

    socket.join(roomId);

    if(!rooms[roomId]){
      rooms[roomId] = [];
    }

    const intro = `Welcome to XXX.live`;

    socket.emit("message", {
      role:"ai",
      persona:"AI",
      text:intro
    });

    if(rooms[roomId].length === 0){
      rooms[roomId].push({
        role:"assistant",
        content:intro
      });
    }

    const count = io.sockets.adapter.rooms.get(roomId)?.size || 0;

    io.to(roomId).emit("message", {
      role:"ai",
      persona:"System",
      text:`👥 ${count} ${count === 1 ? "person" : "people"} here`
    });

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
      role:"user",
      content: message
    });

    if(rooms[roomId].length > 20){
      rooms[roomId] = rooms[roomId].slice(-20);
    }

    ////////////////////////////////////////////////////////
    // SEND USER MESSAGE
    ////////////////////////////////////////////////////////
    io.to(roomId).emit("message", {
      role:"user",
      text: message
    });

    ////////////////////////////////////////////////////////
    // 🔍 YOUTUBE SEARCH
    ////////////////////////////////////////////////////////
    let ytResults = [];

    try {
      const ytUrl = `https://www.googleapis.com/youtube/v3/search?key=${process.env.YOUTUBE_API_KEY}&q=${encodeURIComponent(message)}&type=video&part=snippet&maxResults=3`;

      const ytRes = await fetch(ytUrl);
      const ytData = await ytRes.json();

      ytResults = (ytData.items || []).map(v => ({
        title: (v.snippet.title || "").replace(/[^\w\s]/gi,''), // clean title
        link: `https://www.youtube.com/watch?v=${v.id.videoId}`
      }));

    } catch(err){
      console.log("YT error:", err);
    }

    ////////////////////////////////////////////////////////
    // 🎥 SEND YOUTUBE (🔥 FIXED FORMAT)
    ////////////////////////////////////////////////////////
    if(ytResults.length > 0){

      const ytText = ytResults.map(r =>
        `YT|${r.title}|${r.link}`
      ).join("\n");

      io.to(roomId).emit("message", {
        role:"ai",
        persona:"YouTube",
        text: ytText
      });
    }

    ////////////////////////////////////////////////////////
    // 🔍 GOOGLE (SERP)
    ////////////////////////////////////////////////////////
    let webResults = [];

    try {
      const serpUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(message)}&api_key=${process.env.SERP_KEY}`;

      const serpRes = await fetch(serpUrl);
      const serpData = await serpRes.json();

      webResults = (serpData.organic_results || [])
        .slice(0,3)
        .map(r => r.title);

    } catch(err){
      console.log("SERP error:", err);
    }

    ////////////////////////////////////////////////////////
    // 🤖 AI SUMMARY
    ////////////////////////////////////////////////////////
    const context = [
      ...ytResults.map(r => r.title),
      ...webResults
    ].join("\n");

    const r = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      temperature:0.7,
      messages:[

        {
          role:"system",
          content:`
You are a real-time AI search assistant.

Rules:
- You ALWAYS have access to live search results
- NEVER say you can't access real-time data
- Keep answers SHORT (max 5 lines)
- Be clear and useful
`
        },

        {
          role:"user",
          content:`
Query:
${message}

Search results:
${context}

Give a helpful short answer.
`
        }

      ]
    });

    const aiText = r.choices[0].message.content;

    ////////////////////////////////////////////////////////
    // SEND AI SUMMARY
    ////////////////////////////////////////////////////////
    io.to(roomId).emit("message", {
      role:"ai",
      persona:"AI summary",
      text: aiText
    });

  });

  ////////////////////////////////////////////////////////////
  // DISCONNECT
  ////////////////////////////////////////////////////////////
  socket.on("disconnect", () => {
    console.log("🔴 disconnected:", socket.id);
  });

});

//////////////////////////////////////////////////////////////
// 🚀 START SERVER
//////////////////////////////////////////////////////////////

const PORT = process.env.PORT || 10000;

server.listen(PORT, () => {
  console.log("🔥 live chat running (AI intro fixed)");
});
