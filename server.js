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

    return {
      videoId,
      title: "YouTube Result",
      embedUrl: `https://www.youtube.com/embed/${videoId}`  // ⭐ FIXED — NO AUTOPLAY HERE
    };

  } catch (err) {
    console.log("YouTube scrape error:", err);
    return null;
  }
}