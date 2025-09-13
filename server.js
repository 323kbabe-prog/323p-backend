/* ---------------- Socket.IO ---------------- */
io.on("connection", (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  // 🔎 Debug: log every event this socket sends
  socket.onAny((event, ...args) => {
    console.log("📡 Received event:", event, args);
  });

  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    socket.roomId = roomId;
    console.log(`👥 ${socket.id} joined room: ${roomId}`);
  });

  // Freeze trend for a room
  socket.on("lockTrend", ({ roomId, trend }) => {
    if (roomId && trend) {
      roomFeeds[roomId] = trend;
      console.log(`🔒 Locked trend for room ${roomId}`);
    } else {
      console.warn("⚠️ lockTrend called without roomId or trend:", roomId, trend);
    }
  });

  socket.on("chatMessage", ({ roomId, user, text }) => {
    console.log(`💬 [${roomId}] ${user}: ${text}`);
    io.to(roomId).emit("chatMessage", { user, text });
  });

  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.id} (room ${socket.roomId || "none"})`);
  });
});
