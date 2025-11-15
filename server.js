// server.js — NPC Browser (Agentic Reasoning Edition)
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const path = require("path");
const OpenAI = require("openai");
const cors = require("cors");
const fs = require("fs");
const fetch = require("node-fetch");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

console.log("🚀 Agentic NPC Browser backend running...");
console.log("OPENAI_API_KEY:", !!process.env.OPENAI_API_KEY);

/* ------------------------------------------
   AGENTIC EXTRACTION ENDPOINT (gpt-4o-mini)
   ------------------------------------------ */
app.post("/api/agentic", async (req, res) => {
  try {
    const thought = req.body.thought || "";

    const prompt = `
You are an agentic reasoning module.

INPUT NPC THOUGHT:
"${thought}"

TASKS:
1. Extract ONE short summary phrase (5–9 words max) describing the perspective.
2. Extract 3–5 concise keyword clusters (2–4 words each) capturing the core ideas.

FORMAT (JSON ONLY):
{
  "summary": "summary phrase",
  "clusters": ["...", "...", "..."]
}`;

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    });

    const text = resp.choices?.[0]?.message?.content || "";
    const data = JSON.parse(text);

    res.json({
      summary: data.summary,
      clusters: data.clusters
    });

  } catch (err) {
    console.error("Agentic extraction error:", err);
    res.json({ summary: "", clusters: [] });
  }
});

/* ------------------------------------------
   STATIC + SOCKET STREAMING (unchanged)
   ------------------------------------------ */

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Agentic NPC backend running on :${PORT}`);
});