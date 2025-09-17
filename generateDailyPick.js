const path = require("path");
const fs = require("fs");
const OpenAI = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const PICKS_FILE = path.join(__dirname, "dailyPicks.json");

// ... keep same pools/persona/helpers as in server.js ...

async function generateDailyPicks() {
  // pick random product, persona, description, image
  // (same logic as server.js)
  const dailyDate = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(PICKS_FILE, JSON.stringify({ dailyDate, dailyPicks }, null, 2));
  console.log(`🌅 Daily Pick Generated (${dailyDate})`);
  console.log(`📂 File saved to ${PICKS_FILE}`);
}

generateDailyPicks();
