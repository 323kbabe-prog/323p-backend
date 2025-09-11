// server.js — unified backend for 323p (chat + drops + voice, all real)
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const OpenAI = require("openai");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// --- OpenAI client ---
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ✅ Serve index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// --- Real Drops API (AI-generated) ---
app.get("/api/trend", async (req, res) => {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a playful AI trend generator. Always reply in JSON with keys: product, brand, description, hashtags (array)." },
        { role: "user", content: "Generate one AI-native cosmetic drop." }
      ]
    });

    let text = completion.choices[0].message.content;
    if (text.startsWith("```")) {
      text = text.replace(/```json|```/g, "").trim();
    }
    const data = JSON.parse(text);

    res.json(data);
  } catch (err) {
    console.error("❌ trend error", err.message);
    res.status(500).json({ error: "trend fetch failed" });
  }
});

// --- Real Voice API using OpenAI TTS ---
app.get("/api/voice", async (req, res) => {
  try {
    const text = req.query.text || "no text provided";
    console.log(`🔊 Generating voice for: ${text}`);

    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",  // fast + natural
      voice: "alloy",            // change to verse/coral if you like
      input: text
    });

    const buffer = Buffer.from(await speech.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.end(buffer);
  } catch (err) {
    console.error("❌ Voice error", err.message);
    res.status(500).json({ error: "Voice generation failed" });
  }
});

// --- Socket.IO Chat ---
io.on("connection", (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    socket.roomId = roomId;
    console.log(`👥 ${socket.id} joined room: ${roomId}`);
  });

  socket.on("chatMessage", ({ roomId, user, text }) => {
    console.log(`💬 [${roomId}] ${user}: ${text}`);
    io.to(roomId).emit("chatMessage", { user, text });
  });

  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.id} (room ${socket.roomId || "none"})`);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
