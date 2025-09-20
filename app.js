// app.js — op14: description first, image AFTER desc drops
const socket = io("https://three23p-backend.onrender.com");
let audioPlayer = null, roomId = null;
let currentTopic = "cosmetics"; 

/* Overlay helpers (same as before) */
function showOverlay(){ const c=document.getElementById("warmup-center"); if(c){c.style.display="flex"; c.innerHTML="";}}
function appendOverlay(msg,color="#fff",blinking=false){ const line=document.createElement("div"); line.className="log-line"; if(blinking) line.classList.add("blinking"); line.style.background=color; line.innerText=msg; document.getElementById("warmup-center").appendChild(line); return line;}
function removeOverlayLine(line,finalMsg){ if(line){ line.innerText=finalMsg; setTimeout(()=>line.remove(),800); } }

/* Voice */
function playVoice(text){ const url="/api/voice?text="+encodeURIComponent(text); const audio=new Audio(url); audio.play(); }

/* Update UI */
function updateUI(trend){
  document.getElementById("r-title").innerText=trend.brand;
  document.getElementById("r-artist").innerText=trend.product;
  document.getElementById("r-desc").innerText=trend.description;
}

/* Run flow */
async function runLogAndLoad(){
  showOverlay();

  // === Description step ===
  let descLine=appendOverlay("✍️ drafting description…","#fff",true);
  const descRes=await fetch("/api/description");
  const descData=await descRes.json();
  removeOverlayLine(descLine,"✅ description ready");
  updateUI(descData);

  // Voice right after description
  playVoice(descData.description);

  // === Image step AFTER desc ===
  let imgLine=appendOverlay("🖼️ rendering image…","#d9f0ff",true);
  const imgRes=await fetch(`/api/image?brand=${encodeURIComponent(descData.brand)}&product=${encodeURIComponent(descData.product)}`);
  const imgData=await imgRes.json();
  removeOverlayLine(imgLine,"✅ image ready");
  document.getElementById("r-img").src=imgData.image;
  document.getElementById("r-img").style.display="block";
}

/* Confirm button */
document.getElementById("start-btn").addEventListener("click",()=>{
  document.getElementById("start-screen").style.display="none";
  document.getElementById("app").style.display="flex";
  runLogAndLoad();
});