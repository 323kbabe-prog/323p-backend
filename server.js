import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/* =========================
   IMAGE GENERATION ONLY
========================= */
app.post("/image", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.json({});

    const img = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024"
    });

    res.json({
      url: img.data[0].url
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({});
  }
});

/* =========================
   START
========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🖼️ Image backend running on", PORT);
});