async function loadTrend() {
  uiLog("Fetching trend...");
  const res = await fetch("https://three23p-backend.onrender.com/api/trend?room=" + roomId);
  currentTrend = await res.json();
  uiLog("Trend loaded: " + currentTrend.brand + " - " + currentTrend.product);

  document.getElementById("r-title").innerText = currentTrend.brand;
  document.getElementById("r-artist").innerText = currentTrend.product;
  document.getElementById("r-persona").innerText = currentTrend.persona
    ? `👤 Featuring ${currentTrend.persona}`
    : "";
  document.getElementById("r-desc").innerText = currentTrend.description;
  document.getElementById("social-btn").style.display = "block";

  if (currentTrend.image) {
    document.getElementById("r-img").src = currentTrend.image;
    document.getElementById("r-img").style.display = "block";
    document.getElementById("r-fallback").style.display = "none";
  } else {
    document.getElementById("r-img").style.display = "none";
    document.getElementById("r-fallback").style.display = "block";
  }
  cycleTrend();
}
