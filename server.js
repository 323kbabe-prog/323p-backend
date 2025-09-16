/* ---------------- Daily Picks ---------------- */
async function generateDailyPicks() {
  dailyPicks = [];
  const usedIndexes = new Set();

  while (dailyPicks.length < 3) {
    // pick a random index from the TOP50_COSMETICS pool
    const idx = Math.floor(Math.random() * TOP50_COSMETICS.length);
    if (usedIndexes.has(idx)) continue; // skip if already chosen
    usedIndexes.add(idx);

    const pick = TOP50_COSMETICS[idx];
    const persona = randomPersona();
    const description = await makeDescription(pick.brand, pick.product);
    const imageUrl = await generateImageUrl(pick.brand, pick.product, persona);

    dailyPicks.push({
      brand: decorateTextWithEmojis(pick.brand),
      product: decorateTextWithEmojis(pick.product),
      persona,
      description,
      hashtags: ["#BeautyTok", "#NowTrending"],
      image: imageUrl,
      refresh: 3000
    });
  }

  dailyDate = new Date().toISOString().slice(0, 10);

  // Save picks so they persist across restarts
  fs.writeFileSync(PICKS_FILE, JSON.stringify({ dailyDate, dailyPicks }, null, 2));

  console.log(`🌅 Daily Picks Generated (${dailyDate}):`);
  dailyPicks.forEach((p, idx) => {
    console.log(`${idx + 1}. ${p.brand} – ${p.product}`);
  });
}
