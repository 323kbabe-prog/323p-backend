//////////////////////////////////////////////////////////////
// Blue Ocean Browser — Image Generator Backend (FIXED)
//////////////////////////////////////////////////////////////

import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();

// ------------------------------------------------------------
// Middleware
// ------------------------------------------------------------
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "2mb" }));

// ------------------------------------------------------------
// OpenAI Client
// ------------------------------------------------------------
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ------------------------------------------------------------
// Health Check
// ------------------------------------------------------------
app.get("/", (req, res) => {
  res.send("Image backend is running");
});

// ------------------------------------------------------------
// IMAGE GENERATION ENDPOINT
// ------------------------------------------------------------
app.post("/image", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Prompt is required" });
    }

    console.log("🖼️ Generating image for:", prompt);

    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024"
    });

    // 🔑 IMPORTANT: return OpenAI image response directly
    res.json(result);

  } catch (err) {
    console.error("❌ IMAGE ERROR:", err);
    res.status(500).json({ error: "Image generation failed" });
  }
});

// ------------------------------------------------------------
// Start Server (Render-compatible)
// ------------------------------------------------------------
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🟢 Image backend running on port ${PORT}`);
});