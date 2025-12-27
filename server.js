<html lang="en">
<head>

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "2×-AI Engine",
  "applicationCategory": "AI Foresight System",
  "operatingSystem": "Web",
  "publisher": {
    "@type": "Organization",
    "name": "Blue Ocean Browser",
    "url": "https://blueoceanbrowser.com"
  },
  "description": "A real-time AI engine that reasons over public internet signals to generate six-month future insight."
}
</script>

<meta name="description" content="Blue Ocean Browser powers the 2×-AI Engine — a real-time AI foresight system that reasons over public internet signals to generate six-month future insight.">

<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0,user-scalable=no">
<title>Blue Ocean Browser — 2×-AI Engine | Real-Time AI Foresight</title>

<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-FB5FLT606Z"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  gtag('js', new Date());
  gtag('config', 'G-FB5FLT606Z');
</script>

<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">

<style>
:root { --blue:#1e6bff; }
body, html {
  margin:0; padding:0; width:100%;
  font-family:"Inter",sans-serif;
  background:#f7fbff; color:#111;
}
.container {
  max-width:720px;
  margin:0 auto;
  padding:36px 20px 60px;
}
h1 {
  font-size:36px;
  font-weight:700;
  margin-bottom:6px;
  color:var(--blue);
}
.subtitle { font-size:15px; color:var(--blue); margin-bottom:20px; }
.summary { font-size:14px; margin-bottom:28px; }
.search-row { display:flex; align-items:center; gap:8px; }
#search-box {
  flex:1; height:44px; padding:0 16px;
  border-radius:24px; border:1px solid var(--blue);
  font-size:16px; outline:none;
}
#search-box:focus { box-shadow:0 0 0 2px rgba(30,107,255,0.25); }
#mic {
  width:44px; height:44px; border-radius:50%;
  border:1px solid var(--blue); background:#fff;
  cursor:pointer; font-size:18px; color:var(--blue);
}
#status { margin-top:12px; font-size:14px; color:var(--blue); }

#loader-text {
  display:none;
  margin-top:6px;
  margin-bottom:12px;
  font-size:16px;
  font-weight:500;
  color:var(--blue);
}

.controls { margin:16px 0; display:flex; gap:20px; align-items:center; }
.control-btn {
  margin-bottom: 0; background:none; border:0px solid var(--blue);
  color:var(--blue); font-size:15px; font-weight:500;
  cursor:pointer; padding:6px 0px; border-radius:18px;
}

/* Inactive */
.control-btn.primary.persona-btn {
  background:#fff;
  border:1px solid var(--blue);
  padding:6px 14px;
  color:var(--blue);
}

/* Active */
.control-btn.primary.persona-btn.active {
  background:var(--blue);
  color:#fff;
}

.control-btn:hover { text-decoration:underline; }
#report { margin:16px 0; font-size:16px; line-height:1.6; }
#report a { color:var(--blue); text-decoration:none; }
#report a:hover { text-decoration:underline; }
footer { margin-top:50px; font-size:12px; color:var(--blue); }
</style>
</head>

<body>
<div class="container">

<!-- Row 1 -->
<div class="controls">
  <button class="control-btn primary persona-btn"
          onclick="window.location.href='?persona=MARKETS'">
    Google Finance
  </button>

  <button class="control-btn primary persona-btn"
          onclick="window.location.href='?persona=BUSINESS'">
    LinkedIn
  </button>
</div>

<!-- Row 2 -->
<div class="controls">
  <button class="control-btn primary persona-btn"
          onclick="window.location.href='?persona=AMAZON'">
    amazon
  </button>
  
  <button class="control-btn primary persona-btn"
        onclick="window.location.href='?persona=YOUTUBER'">
  YouTuber
</button>
  
  <div style="display:none;">
  2×-AI Engine is a real-time AI foresight system built by Blue Ocean Browser.
  The engine reasons over public internet signals to model six-month future formation.
</div>
  
</div>

<h1> BLUE OCEAN BROWSER — Female </h1>
<div class="subtitle">AI foresight reports and voice podcasts based on what’s happening now.</div>

<h2 style="font-size:18px;font-weight:500;color:#1e6bff;">
  Execution layer for the 2×-AI Engine — Real-Time AI Foresight
</h2>

<div class="summary">
  <div>1. The system starts automatically and shows a future-focused report.</div>
  <div>2. You can type a topic at any time to run it again.</div>
  <div>3. <a href="blueoceanbrowser8ballengine.html" style="color:#0A6CFF;text-decoration:underline;">2×-AI Engine</a> — The AI Foresight Engine projects a plausible future six months ahead.</div>
  <div>4. Reports generated from real-time data across the Internet.</div>
</div>

<div id="loader-text">0%</div>

<div id="search-wrapper" class="search-row">
  <input id="search-box" placeholder="Type a query" />
  <button id="mic">2x</button>
</div>

<div id="status">2×-AI Engine Analyzing real-time internet…</div>

<div class="controls action-controls">
  <button class="control-btn listen-btn">&gt; Listen</button>
  <button class="control-btn stop-btn">|| Stop</button>
  <button class="control-btn next-btn">Next future angle →</button>
</div>

<div id="report"></div>

<footer>© 2025 Blue Ocean Browser · All Rights Reserved</footer>
</div>

<script>
const BACKEND = "https://three23p-backend.onrender.com";

const params = new URLSearchParams(window.location.search);
// ⭐ X — manual mode flag
const IS_MANUAL = params.get("manual") === "1";

let ACTIVE_PERSONA =
  params.get("persona") === "MARKETS" ? "MARKETS" :
  params.get("persona") === "AMAZON" ? "AMAZON" :
  params.get("persona") === "YOUTUBER" ? "YOUTUBER" :
  "BUSINESS";

/* ===================== VOICE ===================== */
const VOICE_SETTINGS = { lang:"en-US", rate:1, pitch:1, volume:1 };
function stopSpeech(){ window.speechSynthesis.cancel(); }

function getReadableText(){
  const el=document.getElementById("report");
  if(!el) return "";
  const clone=el.cloneNode(true);
  clone.querySelectorAll("a").forEach(a=>a.remove());
  clone.querySelectorAll("strong").forEach(h=>{
    if(h.textContent.includes("Current Signals")){
      let n=h;
      while(n.nextSibling) n.parentNode.removeChild(n.nextSibling);
      h.parentNode.removeChild(h);
    }
  });
  return clone.textContent.replace(/\s+/g," ").trim();
}

function speakReport(){
  stopSpeech();
  requestAnimationFrame(()=>{
    const text=getReadableText();
    if(!text) return;
    const u=new SpeechSynthesisUtterance(text);
    Object.assign(u,VOICE_SETTINGS);
    u.onend=()=>{
      const p=new SpeechSynthesisUtterance("If you want the next report, say next.");
      Object.assign(p,VOICE_SETTINGS);
      p.onend=()=>listenForNextCommand();
      window.speechSynthesis.speak(p);
    };
    window.speechSynthesis.speak(u);
  });
}

function listenForNextCommand(){
  if(!("webkitSpeechRecognition" in window)) return;
  const r=new webkitSpeechRecognition();
  r.lang="en-US"; r.interimResults=false; r.continuous=true;
  r.onresult=e=>{
    for(let i=e.resultIndex;i<e.results.length;i++){
      if(e.results[i][0].transcript.toLowerCase().includes("next")){
        r.stop(); runNext(); break;
      }
    }
  };
  r.onerror=()=>{ try{r.start();}catch{} };
  r.onend=()=>{ try{r.start();}catch{} };
  r.start();
}

function linkify(t){ return t.replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank">$1</a>'); }
function sixMonthDateLabel(){
  const d=new Date(); d.setMonth(d.getMonth()+6);
  return d.toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});
}

function sanitizeAndFormatReport(rawReport,topic){
  let title=topic;
  if(ACTIVE_PERSONA==="AMAZON"){
    const m=rawReport.match(/•\s*([^\n]+)/);
    if(m&&m[1]) title=m[1].trim();
  }
  const header=`<div style="font-weight:600;margin-bottom:4px;">${title}<br>Outlook · ${sixMonthDateLabel()}</div>`;
  let story=rawReport.replace("Six-Month Reality:",header+"Six-Month Reality:");

  // ⭐ SIGNAL SOURCE LABEL ONLY
  if (ACTIVE_PERSONA === "MARKETS") {
    story = story.replace(
      /(https?:\/\/[^\s<]+)/,
      'Signal source:<br>$1'
    );
  }

  return story.replace(/^\s*\*+\s*$/gm,"");
}

let loadTimer=null,loadValue=0;
function startLoading(){
  clearInterval(loadTimer); loadValue=0;
  loaderText.style.display="block"; loaderText.textContent = "Auto searching: 0%";
  loadTimer=setInterval(()=>{ loadValue=loadValue<90?loadValue+Math.random()*4|0:77; loaderText.textContent = `Auto searching: ${loadValue}%`; },180);
}
function finishLoading(){
  clearInterval(loadTimer);
  loaderText.textContent = "Auto searching: 100%";

  /* ⭐ ONLY CHANGE X — scroll search bar to the top */
  document.getElementById("search-wrapper").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  setTimeout(()=>loaderText.style.display="none",400);
}

const box=document.getElementById("search-box");

// ⭐ FINAL FIX — refresh ONLY on first interaction
box.addEventListener("pointerdown", () => {
  if (IS_MANUAL) return;   // ← this line fixes everything
  const url = new URL(window.location.href);
  url.searchParams.set("manual", "1");
  window.location.href = url.toString();
});

const status=document.getElementById("status");
const report=document.getElementById("report");
const loaderText=document.getElementById("loader-text");

async function run(topic){
  if(!topic) return;
  stopSpeech(); startLoading();
  status.textContent="Analyzing real-time internet sources…";
  report.textContent="";
  try{
    const r = await fetch(`${BACKEND}/run`,{
  method:"POST",
  headers:{ "Content-Type":"application/json" },
  body: JSON.stringify({
    topic,
    persona: ACTIVE_PERSONA,
    manual: IS_MANUAL
  })
});
    const d=await r.json();
    if(d.report){
      report.innerHTML = linkify(
        sanitizeAndFormatReport(d.report,box.value)
      ).replace(/\n/g,"<br>");
      speakReport();
    }
  } finally{ finishLoading(); }
}

async function runNext(){
  stopSpeech(); startLoading();
  report.textContent="";
  box.value="";
  status.textContent="2×-AI Engine Analyzing real-time internet...";
  try{
    const r=await fetch(`${BACKEND}/next`,{
      method:"POST",headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ lastTopic:"", persona:ACTIVE_PERSONA })
    });
    const d=await r.json();

    if (ACTIVE_PERSONA === "MARKETS") {
      box.value = d.topic || "AI infrastructure stocks";
    } else if (ACTIVE_PERSONA === "AMAZON") {
      const m = d.report && d.report.match(/•\s*([^\n]+)/);
      if (m && m[1]) box.value = m[1].trim();
    } else if (ACTIVE_PERSONA === "YOUTUBER") {
  box.value = d.topic || "";
}

    if(d.report){
      report.innerHTML = linkify(
        sanitizeAndFormatReport(d.report,box.value)
      ).replace(/\n/g,"<br>");
      speakReport();
    }
  } finally{ finishLoading(); }
}

document.querySelectorAll(".listen-btn").forEach(b=>b.onclick=speakReport);
document.querySelectorAll(".stop-btn").forEach(b=>b.onclick=stopSpeech);
document.querySelectorAll(".next-btn").forEach(b=>b.onclick=runNext);
document.getElementById("mic").onclick = () => {
  if (IS_MANUAL) {
    run(box.value.trim());
  } else {
    runNext();
  }
};
box.addEventListener("keydown",e=>{ if(e.key==="Enter") run(box.value.trim()); });

window.onload = () => {
  document.querySelectorAll(".persona-btn").forEach(btn=>{
    if (btn.getAttribute("onclick").includes(ACTIVE_PERSONA)) {
      btn.classList.add("active");
    }
  });

  if (IS_MANUAL) {
    // ⭐ ensure caret is visible and blinking
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);
  } else {
    runNext();
  }
};
</script>
</body>
</html>