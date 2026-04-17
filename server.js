//////////////////////////////////////////////////////////////
// 🔥 REAL-TIME CHATROOM (PERSONALIZED + MEMORY + ALWAYS 3 YT)
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
  socket.on("sendMessage", async ({ roomId, message, lang }) => {

    if(!message) return;

    if(!rooms[roomId]) rooms[roomId] = [];

    ////////////////////////////////////////////////////////
    // 🌍 PERSONALIZATION (LANG → REGION)
    ////////////////////////////////////////////////////////
    const userLang = (lang || "en-US").toLowerCase();

    let regionCode = "US";
    let relevanceLanguage = "en";

    if(userLang.includes("zh")){
      regionCode = "TW";
      relevanceLanguage = "zh";
    }
    else if(userLang.includes("ko")){
      regionCode = "KR";
      relevanceLanguage = "ko";
    }
    else if(userLang.includes("ja")){
      regionCode = "JP";
      relevanceLanguage = "ja";
    }
    else if(userLang.includes("en")){
      regionCode = "US";
      relevanceLanguage = "en";
    }

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
    // SEND USER
    ////////////////////////////////////////////////////////
    io.to(roomId).emit("message", {
      role:"user",
      text: message
    });

    ////////////////////////////////////////////////////////
    // 🔍 YOUTUBE (ALWAYS 3 + MAX FRESH)
    ////////////////////////////////////////////////////////
    let ytResults = [];

    try {

      const now = new Date();
      const windows = [24, 72, 168];

      for(const hours of windows){

        const time = new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();

        const ytUrl = `https://www.googleapis.com/youtube/v3/search?key=${process.env.YOUTUBE_API_KEY}&q=${encodeURIComponent(message + " trending")}&type=video&part=snippet&maxResults=6&order=date&publishedAfter=${time}&regionCode=${regionCode}&relevanceLanguage=${relevanceLanguage}`;

        const ytRes = await fetch(ytUrl);
        const ytData = await ytRes.json();

        if(ytData.items && ytData.items.length >= 3){
          ytResults = ytData.items;
          break;
        } else {
          ytResults = ytData.items || [];
        }
      }

      //////////////////////////////////////////////////////
      // fallback
      //////////////////////////////////////////////////////
      if(ytResults.length < 3){

        const ytUrl = `https://www.googleapis.com/youtube/v3/search?key=${process.env.YOUTUBE_API_KEY}&q=${encodeURIComponent(message)}&type=video&part=snippet&maxResults=6&regionCode=${regionCode}&relevanceLanguage=${relevanceLanguage}`;

        const ytRes = await fetch(ytUrl);
        const ytData = await ytRes.json();

        ytResults = ytResults.concat(ytData.items || []);
      }

      //////////////////////////////////////////////////////
      // ensure exactly 3
      //////////////////////////////////////////////////////
      ytResults = ytResults.slice(0,3).map(v => ({
        title: (v.snippet.title || "").replace(/[^\w\s]/gi,''),
        link: `https://www.youtube.com/watch?v=${v.id.videoId}`,
        date: v.snippet.publishedAt
      }));

    } catch(err){
      console.log("YT error:", err);
    }

    ////////////////////////////////////////////////////////
    // SEND YOUTUBE
    ////////////////////////////////////////////////////////
    if(ytResults.length === 3){

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
    // 🔍 SERP (UNCHANGED)
    ////////////////////////////////////////////////////////
    let webResults = [];

    try {
      const serpUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(message)}&api_key=${process.env.SERP_KEY}&tbs=qdr:d`;

      const serpRes = await fetch(serpUrl);
      const serpData = await serpRes.json();

      webResults = (serpData.organic_results || [])
        .slice(0,3)
        .map(r => r.title);

    } catch(err){
      console.log("SERP error:", err);
    }

    ////////////////////////////////////////////////////////
    // 🤖 AI WITH MEMORY
    ////////////////////////////////////////////////////////
    const history = rooms[roomId].slice(-10);

    const context = [
      ...ytResults.map(r => `${r.title} (${r.date})`),
      ...webResults
    ].join("\n");

    const aiMessages = [
      {
        role:"system",
        content:`
You are a real-time AI search assistant.

Rules:
- Follow conversation memory
- Use latest search results
- Keep answers SHORT (max 5 lines)
`
      },

      ...history.map(m => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content
      })),

      {
        role:"user",
        content:`
Latest question:
${message}

Search:
${context}
`
      }
    ];

    const r = await openai.chat.completions.create({
      model:"gpt-4o-mini",
      temperature:0.7,
      messages: aiMessages
    });

    const aiText = r.choices[0].message.content;

    ////////////////////////////////////////////////////////
    // SAVE AI MEMORY
    ////////////////////////////////////////////////////////
    rooms[roomId].push({
      role:"assistant",
      content: aiText
    });

    ////////////////////////////////////////////////////////
    // SEND AI
    ////////////////////////////////////////////////////////
    io.to(roomId).emit("message", {
      role:"ai",
      persona:"AI summary",
      text: aiText
    });

  });

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
  console.log("🔥 live chat running (FINAL PERSONALIZED)");
});

