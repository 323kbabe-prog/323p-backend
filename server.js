// server.js — 323p backend
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// ✅ Serve index.html directly from root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ✅ Socket.io chat logic
io.on("connection", (socket) => {
  console.log("🔌 user connected:", socket.id);

  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    console.log(`👥 ${socket.id} joined room ${roomId}`);
  });

  socket.on("chatMessage", ({ roomId, user, text }) => {
    io.to(roomId).emit("chatMessage", { user, text });
  });

  socket.on("disconnect", () => {
    console.log("❌ user disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
