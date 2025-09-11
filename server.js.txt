// server.js — Render backend for 323drop
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // later you can lock this to your domain
    methods: ["GET", "POST"]
  }
});

// serve static files from public/
app.use(express.static(path.join(__dirname, "public")));

// handle socket.io chat
io.on("connection", (socket) => {
  console.log("🔌 user connected:", socket.id);

  // join room from client
  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    console.log(`👥 ${socket.id} joined room ${roomId}`);
  });

  // broadcast chat message to room
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
