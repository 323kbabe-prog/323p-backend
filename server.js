// ... keep existing imports and setup ...

let nextPickCache = null;
let generatingNext = false;

/* store chat + locked trend per room */
const roomData = {}; // { roomId: { history:[], trend:null } }

// ... keep TOP50_COSMETICS, helpers, makeDescription, generateImageUrl, generateVoice, generateNextPick ...

io.on("connection", (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    socket.roomId = roomId;
    console.log(`👥 ${socket.id} joined room: ${roomId}`);

    // if room has stored history + locked trend, send to new joiner
    if(roomData[roomId]){
      socket.emit("chatHistory",{ history:roomData[roomId].history, trend:roomData[roomId].trend });
    }
  });

  socket.on("lockTrend", ({roomId,trend})=>{
    if(!roomData[roomId]) roomData[roomId] = { history:[], trend:null };
    roomData[roomId].trend = trend;
    console.log(`🔒 Feed locked for room ${roomId}`);
  });

  socket.on("chatMessage", ({ roomId, user, text }) => {
    if(!roomData[roomId]) roomData[roomId]={ history:[], trend:null };
    roomData[roomId].history.push({ user, text });
    io.to(roomId).emit("chatMessage", { user, text });
  });

  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.id} (room ${socket.roomId || "none"})`);
  });
});
