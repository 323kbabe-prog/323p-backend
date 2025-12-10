//////////////////////////////////////////////////////////////
//  Rain Man Business Engine — CLEAN VERSION + YOUTUBE ENGINE
//  • Rewrite Engine
//  • Nonsense Detector
//  • Clarity Score Engine
//  • Suggestion Engine
//  • Share System
//  • View Counter
//  • Enter Counter
//  • ⭐ Next Counter (added)
//  • YOUTUBE SEARCH ENGINE (Never Repeat)
//  • personaSearch -> emits single YouTube result
//  • Static Hosting
//////////////////////////////////////////////////////////////

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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

console.log("🚀 Rain Man Business Engine Started — YOUTUBE MODE");

// … EVERYTHING ABOVE UNCHANGED …

//////////////////////////////////////////////////////////////
// ⭐ YOUTUBE ENGINE — WITH CURRENT YEAR FILTER
//////////////////////////////////////////////////////////////

const ytMemory = {};

async function fetchYouTubeVideo(query) {
  try {
    if (!ytMemory[query]) ytMemory[query] = { list: [], used: new Set() };

    const bucket = ytMemory[query];

    if (bucket.list.length === 0 || bucket.used.size >= bucket.list.length) {

      const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
      const response = await fetch(url);
      const html = await response.text();

      const matches = [...html.matchAll(/"videoId":"(.*?)"/g)].map(m => m[1]);
      const unique = [...new Set(matches)];

      const CURRENT_YEAR = new Date().getFullYear();

      const publishedMatches = [...html.matchAll(/"publishedTimeText":\{"simpleText":"(.*?)"\}/g)]
        .map(m => m[1]);

      const dateMatches = [...html.matchAll(/"publishedAt":"(.*?)"/g)]
        .map(m => m[1]);

      const idsWithYearFilter = [];

      for (let i = 0; i < unique.length; i++) {
        let id = unique[i];

        const iso = dateMatches[i];
        if (iso && iso.startsWith(String(CURRENT_YEAR))) {
          idsWithYearFilter.push(id);
          continue;
        }

        const rel = (publishedMatches[i] || "").toLowerCase();
        if (
          rel.includes("hour") ||
          rel.includes("day") ||
          rel.includes("week") ||
          rel.includes("month")
        ) {
          idsWithYearFilter.push(id);
        }
      }

      const finalList = idsWithYearFilter.length > 0 ? idsWithYearFilter : unique;

      bucket.list = finalList;
      bucket.used = new Set();
    }

    const available = bucket.list.filter(id => !bucket.used.has(id));
    if (available.length === 0) return null;

    const videoId = available[0];
    bucket.used.add(videoId);

    // ⭐ ONLY CHANGE:
    // backend must return correct EMBED URL (NO autoplay, NO mute)
    return {
      videoId,
      title: "YouTube Result",
      embedUrl: `https://www.youtube.com/embed/${videoId}`
    };

  } catch (err) {
    console.log("YouTube scrape error:", err);
    return null;
  }
}

//////////////////////////////////////////////////////////////
// SOCKET — personaSearch returns ONE YouTube video
//////////////////////////////////////////////////////////////

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

io.on("connection", socket => {
  console.log("Socket Connected — YouTube Search Mode Enabled");

  socket.on("personaSearch", async query => {

    const c = readNext();
    c.total++;
    writeNext(c);

    try {
      const video = await fetchYouTubeVideo(query);

      if (!video) {
        socket.emit("personaChunk", { error: "No video found." });
        socket.emit("personaDone");
        return;
      }

      socket.emit("personaChunk", video);
      socket.emit("personaDone");

    } catch (err) {
      socket.emit("personaChunk", { error: "Search failed." });
      socket.emit("personaDone");
    }
  });
});

// … EVERYTHING BELOW UNCHANGED …