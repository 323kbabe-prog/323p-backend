<!DOCTYPE html>
<!-- CONNECTAING V8 — ASK NULL — meet null — 08:04 2026/07/01 -->
<html>
<head>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-FB5FLT606Z"></script>

<script>
window.dataLayer = window.dataLayer || [];

function gtag(){
  dataLayer.push(arguments);
}

gtag('js', new Date());

gtag('config', 'G-FB5FLT606Z', {
  page_path: window.location.pathname
});


</script>

<link
rel="icon"
type="image/png"
href="https://images.squarespace-cdn.com/content/v1/6784e2cf16887b12d499fa90/0e3a143e-d11f-4b3e-af68-9725286ded1b/quick+smart+camera_20260526_074737_0000_Original.jpeg?format=750w"
/>

<meta charset="UTF-8" />

<title>
Ask Null — Contextual Intelligence Camera AI
</title>

<meta
name="description"
content="Ask Null is a camera AI that explores contextual intelligence through images, connecting real-world objects to trends, news, culture, technology, and emerging opportunities. Pre-AGI Condition, SCGM, and CFM research."
/>

<meta
name="keywords"
content="
Ask Null,
camera AI,
contextual intelligence,
SCGM,
CFM,
Pre-AGI,
Social Context Generating Model,
Chaos Feeling-Perception Model,
visual complexity,
affective emergence,
AI camera,
image AI,
AI search,
trend discovery,
culture analysis,
technology trends,
emerging opportunities
"
/>

<meta
property="og:title"
content="Ask Null — Contextual Intelligence Camera AI"
/>

<meta
property="og:description"
content="Ask Null explores contextual intelligence through images. Discover trends, news, culture, technology, and emerging opportunities from reality."
/>

<meta
property="og:type"
content="website"
/>

<meta
property="og:image"
content="https://images.squarespace-cdn.com/content/v1/6784e2cf16887b12d499fa90/0e3a143e-d11f-4b3e-af68-9725286ded1b/quick+smart+camera_20260526_074737_0000_Original.jpeg?format=750w"
/>

<meta
name="twitter:card"
content="summary_large_image"
/>

<meta name="theme-color" content="#000000" />
<meta
name="viewport"
content="width=device-width, initial-scale=1, viewport-fit=cover"
/>

<script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>

<style>

html{
  scrollbar-width:none;
}

body{
  -ms-overflow-style:none;
}

body::-webkit-scrollbar{
  display:none;
}

*{
  box-sizing:border-box;
  -webkit-tap-highlight-color:transparent;
}

html,
body{
  margin:0;
  padding:0;
  width:100%;
  height:100%;
  background:#000;
  overflow:hidden;
  -webkit-overflow-scrolling:touch;
}

body{
  position:relative;
touch-action:manipulation;


  font-family:
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;

  color:#111;

  -webkit-font-smoothing:antialiased;
  text-rendering:optimizeLegibility;
}

#cameraWrap{
  position:fixed;
  inset:0;
  background:transparent;
  overflow:hidden;
  z-index:1;
}

#video{
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
  object-fit:cover;
  background:#000;
  display:block;
}

#helper{
  position:absolute;
  inset:0;

display:flex;
flex-direction:column;
align-items:center;
justify-content:center; 

  z-index:10;

  color:#fff;

  font-size:24px;
  font-weight:700;

  letter-spacing:-0.5px;

  text-align:center;

  padding:30px;

  pointer-events:auto; 

  text-shadow:
    0 2px 20px rgba(0,0,0,0.6);
}

#roomOverlay{
  position:fixed;
  inset:0;

  background:rgba(255,255,255,0.06);

  backdrop-filter:blur(30px) saturate(180%);
  -webkit-backdrop-filter:blur(30px) saturate(180%);

  z-index:99999;

  display:none;
  flex-direction:column;
  overflow:hidden;

  padding:
  max(env(safe-area-inset-top), 4px)
  16px
  calc(env(safe-area-inset-bottom) + 14px)
  16px;
}

#roomTitle{
  font-size:18px;
  font-weight:700;
}

#closeRoom{
  font-size:32px;
  line-height:1;
  cursor:pointer;
}

#roomMessages{
  flex:1;
  min-height:0;
  overflow-y:auto;
  overflow-x:hidden;
  margin-top:18px;
  padding-bottom:40px;
  -webkit-overflow-scrolling:touch;

  display:flex;
  flex-direction:column;
  align-items:center;

  scroll-behavior:smooth;
}

#roomMessages img{
  -webkit-user-drag:none;
  user-select:none;
}

#roomMessages *{
  overflow-wrap:break-word;
}

#roomInput{
margin-top:0px;
margin-bottom:8px;
  width:100%;
  height:58px;

  border:none;
  outline:none;

  font-size:14px;

  background:
    rgba(255,255,255,0.78);

  backdrop-filter:
    blur(20px)
    saturate(180%);

  -webkit-backdrop-filter:
    blur(20px)
    saturate(180%);

  border-radius:999px;

  padding:0 22px;

  color:#111;

  position:relative;
  z-index:5;

  flex-shrink:0;

  box-shadow:
    0 8px 30px rgba(0,0,0,0.06);
}

#roomInput::placeholder{
  color:#8d8d8d;
}

.aiDot{
  width:6px;
  height:6px;
  border-radius:999px;
  background:#fff;
  opacity:0.3;
  animation:aiBounce 1s infinite;
}

.aiDot:nth-child(2){
  animation-delay:0.15s;
}

.aiDot:nth-child(3){
  animation-delay:0.3s;
}

@keyframes moreBlink{

  0%{
    opacity:0.25;
  }

  50%{
    opacity:1;
  }

  100%{
    opacity:0.25;
  }

}

@keyframes aiBounce{

  0%{
    opacity:0.25;
    transform:translateY(0px);
  }

  50%{
    opacity:1;
    transform:translateY(-3px);
  }

  100%{
    opacity:0.25;
    transform:translateY(0px);
  }
}

#appBgLogo{
  position:fixed;
  inset:0;

  background-image:url("https://images.squarespace-cdn.com/content/6784e2cf16887b12d499fa90/08a644b5-0c16-4359-b3bb-15aee60cb9e5/ASK+NULL+%281%29.png?content-type=image%2Fpng");

  background-repeat:no-repeat;
  background-position:center;
  background-size:220px;

  opacity:0.35;

  z-index:0;
  pointer-events:none;
}

#modeBar{

position:fixed;
top:18px;
left:16px;
right:16px;

display:flex;
gap:8px;

z-index:999;
}

#modeBar button{

flex:1;

border:none;

background:#fff;

color:#111;

font-size:11px;
font-weight:900;

padding:10px 12px;

border-radius:999px;
}

#dailyNullsScreen{

display:none;

position:fixed;
inset:0;

background:#000;

color:#fff;

z-index:998;

overflow-y:auto;

padding:
90px
16px
40px
16px;
}

.dailyNullCard{

background:#fff;

color:#111;

border-radius:22px;

padding:14px;

margin-bottom:16px;

max-width:420px;
margin-left:auto;
margin-right:auto;
}

#firstNextBtn{
  display:none;
}

</style>
</head>

<body>
<div id="appBgLogo"></div>
<div id="modeBar">

<button
id="createNullBtn"
onclick="showCreateNull()"
>
ASK NULL
</button>

<button
id="dailyNullsBtn"
onclick="showDailyNulls()"
>
DAILY NULLS
</button>



</div>

<div id="dailyNullsScreen">

<div
style="
font-size:24px;
font-weight:900;
margin-bottom:6px;
"
>
DAILY NULLS
</div>

<div
style="
font-size:13px;
opacity:.7;
margin-bottom:20px;
"
>
New Null searches every hour.
</div>

<div id="publicNullsScreen"
style="
display:none;
position:fixed;
inset:0;
background:#000;
color:#fff;
z-index:998;
overflow-y:auto;
padding:90px 16px 40px 16px;
">

<div
style="
font-size:24px;
font-weight:900;
margin-bottom:20px;
">
PUBLIC NULLS
</div>

<div id="publicNullsCards">
Loading...
</div>

</div>


<div
id="dailyNullCountdown"
style="
font-size:12px;
font-weight:700;
opacity:.55;
margin-top:4px;
margin-bottom:20px;
"
>
Loading...
</div>

<div id="dailyNullsCards"></div>


</div>

<div id="cameraWrap">

  <video
    id="video"
    autoplay
    playsinline
    muted
  ></video>

<input
  id="uploadImage"
  type="file"
  accept="image/*"
  style="display:none"
>


<img
id="capturePreview"
style="
position:absolute;
inset:0;
width:100%;
height:100%;
object-fit:cover;
display:none;
z-index:4;
"
/>

<div id="helper">

  <div>
    TAP THE IMAGE ON THE SCREEN TO SEARCH THE INTERNET
  </div>

  <div style="margin-top:16px;"></div>

<button
id="uploadBtn"
style="
margin-top:18px;
padding:10px 18px;
border:none;
border-radius:999px;
background:#fff;
color:#111;
font-size:12px;
font-weight:900;
cursor:pointer;
pointer-events:auto;
box-shadow:0 4px 16px rgba(0,0,0,.18);
"
>
UPLOAD IMAGE
</button>

<button
id="publicNullsBtn"
style="
margin-top:12px;
padding:10px 18px;
border:none;
border-radius:999px;
background:#fff;
color:#111;
font-size:12px;
font-weight:900;
cursor:pointer;
pointer-events:auto;
box-shadow:0 4px 16px rgba(0,0,0,.18);
"
onclick="showPublicNulls()"
>
PUBLIC NULLS
</button>


</div>


</div>

<div id="roomOverlay">

<div
id="roomHeader"
style="
display:flex;
align-items:center;
justify-content:space-between;
gap:16px;
padding-top:4px;
padding-bottom:0px;
"
>

<div
style="
display:flex;
align-items:center;
gap:14px;
min-width:0;

background:#fff;
padding:10px;
border-radius:16px;
"
>

<div
style="
display:flex;
flex-direction:column;
gap:2px;
min-width:0;
"
>

<div
id="roomTitle"
style="
font-size:18px;
font-weight:900;
letter-spacing:-0.7px;
color:#111;
line-height:1;
margin-top:0px;
"
>
Ask Null
</div>

<div
style="
display:flex;
align-items:center;
gap:6px;
"
>

<div
id="roomIdText"
style="
font-size:11px;
font-weight:300;
color:#111;
line-height:1;
letter-spacing:-0.3px;
"
>
#room
</div>

</div>

</div>

</div>

<div
id="closeRoom"
style="
width:39px;
height:39px;
margin-top:5px;

border-radius:999px;

display:flex;
align-items:center;
justify-content:center;

font-size:20px;
font-weight:400;
line-height:1;

background:#f5f5f5;
color:#111;

flex-shrink:0;
cursor:pointer;

box-shadow:
0 2px 10px rgba(0,0,0,0.04);
"
>
×
</div>

</div>

  <div id="roomMessages"></div>

<div
style="
display:flex;
justify-content:center;
margin-bottom:12px;
"
>

<button
id="firstNextBtn"
onclick="
nextClicked = true;

this.style.display='none';

socket.emit(
'roomMessage',
{ text:'Null Feed' }
);

showAITyping();
" 
style="
cursor:pointer;
font-size:13px;
font-weight:700;
padding:8px 12px;
border-radius:999px;
background:#000;
color:#fff;
border:1px solid #111;
"
>
NULL Feed
</button>

</div>

  <input
    id="roomInput"
    placeholder="Ask"
    autocomplete="off"
  />

</div>

<script>
const cameraWrap =
  document.getElementById(
    "cameraWrap"
  );



const capturePreview =
  document.getElementById(
    "capturePreview"
  );

const roomIdText =
  document.getElementById(
    "roomIdText"
  );

const socket =
  io("https://three23p-backend.onrender.com");




const video =
  document.getElementById("video");

const helper =
  document.getElementById("helper");

const roomOverlay =
  document.getElementById(
    "roomOverlay"
  );

const roomMessages =
  document.getElementById(
    "roomMessages"
  );

const roomInput =
  document.getElementById(
    "roomInput"
  );

const closeRoom =
  document.getElementById(
    "closeRoom"
  );

const dailyNullsScreen =
  document.getElementById(
    "dailyNullsScreen"
  );

const publicNullsScreen =
document.getElementById(
"publicNullsScreen"
);

const publicNullsCards =
document.getElementById(
"publicNullsCards"
);


const dailyNullsCards =
  document.getElementById(
    "dailyNullsCards"
  );

const dailyNullCountdown =
  document.getElementById(
    "dailyNullCountdown"
  );

let dailyNullsNextRefresh = null;

let dailyNullCountdownStarted =
  false;

let captureLock = false;
let lastCaptureTime = 0;
let aiTyping = false;
let nextClicked = false;
let imageIntroText = "";

async function startCamera(){

  try{

    const stream =
      await navigator.mediaDevices.getUserMedia({

        video:{
          facingMode:{
            ideal:"environment"
          }
        },

        audio:false
      });

    video.srcObject = stream;

video.onloadedmetadata = async () => {

  try{

    await video.play();

helper.style.display = "flex";


  }catch(err){

    console.log(
      "video play failed",
      err
    );

  }

};

    //////////////////////////////////////////////////
    // SAFETY CHECK
    //////////////////////////////////////////////////

    setTimeout(()=>{

      if(
        !video.videoWidth
      ){

        helper.style.display =
          "flex";

        helper.innerHTML =
          "OPEN IN CHROME<br>FOR CAMERA";

      }

    },4000);

  }catch(err){

    console.log(err);

    const ua =
      navigator.userAgent;

    if(
      ua.includes("LinkedIn")
    ){

      helper.innerHTML =
        "OPEN IN CHROME<br>FOR CAMERA";

    }else{

      helper.innerText =
        "ALLOW CAMERA ACCESS";

    }
  }
}

window.onload = async () => {

 
  await startCamera();
};

const uploadImage =
  document.getElementById("uploadImage");

document
  .getElementById("uploadBtn")
  .onclick = e => {

    e.stopPropagation();

    uploadImage.click();

};

uploadImage.onchange = e => {

  const file = e.target.files[0];

  if(!file) return;

  const img = new Image();

  img.onload = () => {

    const canvas =
      document.createElement("canvas");

    const maxWidth = 1080;

    const scale =
      Math.min(
        1,
        maxWidth / img.width
      );

    canvas.width =
      img.width * scale;

    canvas.height =
      img.height * scale;

    const ctx =
      canvas.getContext("2d");

    ctx.drawImage(
      img,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const imageDataUrl =
      canvas.toDataURL(
        "image/jpeg",
        0.6
      );

    helper.innerHTML = `
<div
style="
display:flex;
align-items:center;
gap:10px;
"
>

<span>
CREATING AI LIVE ROOM
</span>

<div
style="
display:flex;
gap:4px;
margin-top:2px;
"
>

<div class="aiDot"></div>
<div class="aiDot"></div>
<div class="aiDot"></div>

</div>

</div>
`;

    socket.emit(
      "imageUpload",
      {
        imageDataUrl,
        roomMode:true,
        askMode:false
      }
    );

  };

  img.src =
    URL.createObjectURL(file);

};



async function captureImage(){

  const now = Date.now();

  if(
    captureLock ||
    now - lastCaptureTime < 1500
  ){
    return;
  }
gtag('event', 'capture_image');

  captureLock = true;

  lastCaptureTime = now;

  try{

    if(
      !video.videoWidth ||
      !video.videoHeight
    ){

      helper.innerText =
        "CAMERA STILL LOADING";

      captureLock = false;

      return;
    }

    helper.innerHTML = `
<div
style="
display:flex;
align-items:center;
gap:10px;
"
>

<span>
CREATING AI LIVE ROOM
</span>

<div
style="
display:flex;
gap:4px;
margin-top:2px;
"
>

<div class="aiDot"></div>
<div class="aiDot"></div>
<div class="aiDot"></div>

</div>

</div>
`;

    const canvas =
      document.createElement("canvas");

    const vw =
      video.videoWidth || 1080;

    const vh =
      video.videoHeight || 1920;

    canvas.width = 1080;

    canvas.height =
      vh * (1080 / vw);

    const ctx =
      canvas.getContext("2d");

    ctx.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const imageDataUrl =
  canvas.toDataURL(
    "image/jpeg",
    0.58
  );

capturePreview.src =
  imageDataUrl;

capturePreview.style.display =
  "block";

    socket.emit(
      "imageUpload",
      {
        imageDataUrl,
        roomMode:true,
        askMode:false
      }
    );

  }catch(err){

    helper.innerText =
      "CAPTURE FAILED";

  }finally{

    captureLock = false;
  }
}

cameraWrap.addEventListener(
  "click",
  async e => {

    if (
      e.target.closest("#uploadBtn") ||
      e.target.closest("#uploadImage")
    ){
      e.stopPropagation();
      return;
    }

    e.preventDefault();

    await captureImage();

  }
);



closeRoom.onclick = () => {

  localStorage.removeItem("displayName");
  localStorage.removeItem("roomId");
  localStorage.removeItem("imageIntroText");

  history.replaceState(
    {},
    "",
    "/"
  );

  location.reload();
};


roomInput.onkeydown = e => {

  if(e.key !== "Enter") return;

  const text =
    roomInput.value.trim();

  if(!text) return;
gtag('event', 'send_room_message');
  socket.emit(
    "roomMessage",
    { text }
  );

  showAITyping();

  roomInput.value = "";
};

socket.on(
  "imageAiIntro",
  text => {

hideAITyping();

    imageIntroText =
      text
        .split("\n")[0]
        .trim();

roomInput.style.display = "block";

document.getElementById(
  "firstNextBtn"
).style.display = "block";

    localStorage.setItem(
      "imageIntroText",
      imageIntroText
    );

    const savedDisplayName =
      localStorage.getItem(
        "displayName"
      );

    if(savedDisplayName){

      roomIdText.innerText =
        savedDisplayName +
        " • " +
        imageIntroText;

    }
  }
);


socket.on("roomCreated",data => {



localStorage.setItem(
  "displayName",
  data.displayName
);


localStorage.setItem(
  "roomId",
  data.roomId
);

history.replaceState(
  {},
  "",
  `/?room=${data.roomId}`
);


if(imageIntroText){
  localStorage.setItem(
    "imageIntroText",
    imageIntroText
  );
}

  gtag('event', 'create_live_room');

  helper.innerHTML =
    "AI LIVE ROOM<br>CONNECTED";

roomOverlay.style.display = "flex";

roomInput.style.display = "none";

roomIdText.innerText =
  data.displayName;

  capturePreview.style.display =
    "none";



document.getElementById(
  "firstNextBtn"
).style.display = "none";


});

//////////////////////////////////////////////////
// ROOM MESSAGE CARDS
//////////////////////////////////////////////////

socket.on("roomMessages",messages => {
roomOverlay.style.display = "flex";

roomInput.style.display = "block";

roomInput.disabled = false;

roomInput.placeholder = "Ask";


if(messages.length > 0){

const btn =
  document.getElementById("firstNextBtn");

const hasFeed =
  messages.some(
    m => m.aiBeing
  );

if(btn){

btn.style.display =
  nextClicked || hasFeed
    ? "none"
    : "block";


}
} 

const savedRoomId =
  localStorage.getItem("roomId");

const savedIntro =
  localStorage.getItem("imageIntroText");

const savedDisplayName =
  localStorage.getItem(
    "displayName"
  );

if(savedDisplayName && savedIntro){

  roomIdText.innerText =
    savedDisplayName +
    " • " +
    savedIntro;

}else if(savedRoomId && savedIntro){

  roomIdText.innerText =
    "#" +
    savedRoomId +
    " • " +
    savedIntro;

}

const latestCard = messages[messages.length - 1];

if (
  latestCard &&
  latestCard.showNextButton
){
  nextClicked = false;
}


roomMessages.innerHTML =

messages.map(m => {

if(
  m.aiBeing &&
m.text 
){

return `

<div
style="
width:100%;
display:flex;
justify-content:center;
margin-bottom:14px;
"
>

<div
style="
max-width:340px;
background:#fff;
color:#111;
border-radius:22px;
padding:16px;
border:1px solid #ececec;
box-shadow:
0 2px 10px rgba(0,0,0,0.04);
"
>

<div
style="
font-size:12px;
font-weight:700;
letter-spacing:0px;
opacity:.45;
margin-bottom:8px;
text-align:center;
"
>
${m.from}
</div>

<div
style="
font-size:14px;
line-height:1.55;
text-align:center;
font-weight:500;
"
>
${m.text}
</div>

</div>

</div>

${
m.showNextButton && !nextClicked
? `


<div
style="
width:100%;
display:flex;
justify-content:center;
margin-top:-4px;
margin-bottom:16px;
"
>

<button
onclick="
nextClicked = true;

socket.emit(
  'roomMessage',
  { text:'Null Feed' }
);

showAITyping();
"


style="
cursor:pointer;
font-size:13px;
font-weight:900;
padding:8px 12px;
border-radius:999px;
background:#000;
color:#fff;
border:1px solid #111;
"
>
NULL Feed
</button>

</div>

`
: ""
}

`;

}

//////////////////////////////////////////////////
// AI IMAGE CARD
//////////////////////////////////////////////////

if(m.image){

const isLatestImage =

  messages
    .filter(x => x.image)
    .indexOf(m)

===

  messages
    .filter(x => x.image)
    .length - 1;

return `

<div
style="
width:100%;
display:flex;
flex-direction:column;
align-items:center;
margin-bottom:18px;
"
>

<div
style="
width:100%;
max-width:420px;
background:#fff;
border-radius:24px;
overflow:hidden;
border:none;
box-shadow:
0 2px 10px rgba(0,0,0,0.04);
"
>

<div
data-share-card
style="
padding:14px;
display:flex;
flex-direction:column;
gap:10px;
"
>



<div data-share-content>

${m.aiText ? `
<div
style="
font-size:14px;
line-height:1.55;
color:#111;
padding-bottom:12px;
"
>
${m.aiText}
</div>
` : ""}

${m.ask ? `
<div
style="
padding-top:12px;
"
>

<a
href="${m.link || '#'}"
target="_blank"
rel="noopener noreferrer"
style="
display:block;
text-decoration:none;
color:#111;
padding-top:0px;
"
>

<div
style="
font-size:14px;
font-weight:500;
letter-spacing:0px;
opacity:.45;
margin-bottom:6px;
"
>

${m.searchLabel || "NULL Search"}

</div>

${m.nullReason ? `
<div
style="
font-size:13px;
line-height:1.45;
opacity:.75;
margin-bottom:8px;
"
>
${m.nullReason}
</div>
` : ""}


<div
style="
font-size:14px;
line-height:1.35;
font-weight:900;
"
>
${m.ask}
</div>

<div
style="
font-size:11px;
font-weight:700;
padding-top:6px;
text-transform:uppercase;
animation:moreBlink 1.4s infinite;
display:flex;
justify-content:flex-end;
"
>
(read)
</div>

<img
src="${m.image}"
style="
width:100%;
border-radius:12px;
margin-top:8px;
"
/>

</a>

</div>
` : ""}


</div>

<div
style="
display:flex;
justify-content:center;
align-items:center;
gap:12px;
padding-top:2px;
"
>

<span
data-link="${m.link || ''}"

onclick="
shareCard(
  this,
  this.dataset.link
)
"
style="
cursor:pointer;
font-size:13px;
font-weight:700;
padding:8px 12px;
border-radius:999px;
background:#000;
color:#fff;
border:1px solid #111;
margin-left:4px;
"
>
share
</span>

</div>

</div>

</div>

${messages.filter(x => x.image).slice(-1)[0] === m && !nextClicked ? `

<button
onclick="
nextClicked = true;

socket.emit(
  'roomMessage',
  { text:'Null Feed' }
);

showAITyping();
"


style="
cursor:pointer;
font-size:13px;
font-weight:700;
padding:8px 12px;
border-radius:999px;
background:#000;
color:#fff;
border:1px solid #111;
margin-left:4px;
"
>
NULL Feed
</button>

` : ""}

</div>

</div>

`;
}

//////////////////////////////////////////////////
// AI ASK CARD
//////////////////////////////////////////////////

if (m.jobCard) {

return `

<div
style="
width:100%;
display:flex;
flex-direction:column;
align-items:center;
margin-bottom:18px;
">

<div
data-share-card
data-share-read="true"
style="
border:1px solid #ececec;
max-width:340px;
background:#fff;
color:#000;
padding:16px;
border-radius:24px;
display:flex;
flex-direction:column;
gap:12px;
box-shadow:0 2px 10px rgba(0,0,0,0.12);
">

<div data-share-content>

<div
style="
font-size:14px;
font-weight:300;
opacity:.45;
margin-bottom:8px;
">
Null (AGI NETWORK) Feed
</div>

<div
style="
font-size:13px;
font-weight:300;
opacity:.55;
margin-bottom:10px;
line-height:1.4;
">
One job I think you should notice today:
</div>

<div
style="
display:flex;
justify-content:flex-start;
align-items:center;
gap:16px;
margin-top:4px;
margin-bottom:12px;
">

<a
href="${m.jobCard.link}"
target="_blank"
style="
cursor:pointer;
font-size:11px;
font-weight:600;
background:#000;
color:#fff;
padding:6px 8px;
border-radius:999px;
display:inline-block;
line-height:1;
text-decoration:none;
">
Check
</a>

<span
data-link="${m.jobCard.link}"
onclick="
shareCard(
  this,
  this.dataset.link
)
"
style="
cursor:pointer;
font-size:11px;
font-weight:600;
background:#000;
color:#fff;
padding:6px 8px;
border-radius:999px;
display:inline-block;
line-height:1;
">
Share
</span>

</div>

<div
style="
font-size:14px;
line-height:1.45;
font-weight:300;
word-break:break-word;
">
${m.jobCard.title}
</div>

<div
style="
font-size:14px;
line-height:1.45;
font-weight:300;
margin-top:4px;
">
${m.jobCard.company}
</div>

<div
style="
font-size:14px;
line-height:1.45;
font-weight:300;
opacity:.55;
">
${m.jobCard.location}
</div>

${m.jobCard.salary ? `
<div
style="
font-size:14px;
line-height:1.45;
font-weight:300;
opacity:.55;
">
${m.jobCard.salary}
</div>
` : ""}

${m.jobCard.type ? `
<div
style="
font-size:14px;
line-height:1.45;
font-weight:300;
opacity:.55;
">
${m.jobCard.type}
</div>
` : ""}

${m.jobCard.posted ? `
<div
style="
font-size:14px;
line-height:1.45;
font-weight:300;
opacity:.55;
">
${m.jobCard.posted}
</div>
` : ""}

</div>

</div>

`;
}




if(m.ask && !m.image){

return `

<div
style="
width:100%;
display:flex;
flex-direction:column;
align-items:center;
margin-bottom:18px;
"
>

<div
  data-share-card
  data-share-read="${m.showRead !== false}"
  style="
    border:1px solid #ececec;
    max-width:340px;
    background:#fff;
    color:#000;
    padding:16px;
    border-radius:24px;
    display:flex;
    flex-direction:column;
    gap:12px;
    box-shadow:0 2px 10px rgba(0,0,0,0.12);
  "
>

<div data-share-content>


<div
style="
font-size:14px;
font-weight:300;
opacity:.45;
margin-bottom:8px;
"
>
${m.searchLabel || ""}
</div>
<div
style="
font-size:13px;
font-weight:300;
opacity:.55;
margin-bottom:10px;
line-height:1.4;
"
>
One I think you should notice today:
</div>


${m.nullReason ? `
<div
style="
font-size:13px;
line-height:1.45;
opacity:.75;
margin-bottom:8px;
"
>
${m.nullReason}
</div>
` : ""}


<div
style="
display:flex;
justify-content:flex-start;
align-items:center;
gap:16px;
margin-top:4px;
margin-bottom:12px;
"
>

${m.showRead !== false ? `
<a
href="${m.link || '#'}"
target="_blank"
style="
cursor:pointer;
font-size:11px;
font-weight:600;
background:#000;
color:#fff;
padding:6px 8px;
border-radius:999px;
display:inline-block;
line-height:1;
text-decoration:none; 
  "
>
Check
</a>
` : ""}


<span
onclick="shareCard(this)"
style="
cursor:pointer;
font-size:11px;
font-weight:600;
background:#000;
color:#fff;
padding:6px 8px;
border-radius:999px;
display:inline-block;
line-height:1; 
"
>
Share
</span>

</div>

<div
style="
font-size:14px;
line-height:1.45;
font-weight:300;
word-break:break-word;
"
>
${m.ask}
</div>

</div>

</div>

</div>

${
m.aiBeing &&
m === messages
  .filter(x => x.aiBeing)
  .slice(-1)[0] &&
!nextClicked

? `



<div
style="
width:100%;
display:flex;
justify-content:center;
margin-top:-4px;
margin-bottom:16px;
"
>

<button
onclick="
nextClicked = true;


socket.emit(
  'roomMessage',
  { text:'Null Feed' }
);

showAITyping();
"


style="
cursor:pointer;
font-size:13px;
font-weight:700;
padding:8px 12px;
border-radius:999px;
background:#000;
color:#fff;
border:1px solid #111;
"
>
NULL Feed
</button>

</div>

`
: ""
}

`;
}

//////////////////////////////////////////////////
// HUMAN CARD
//////////////////////////////////////////////////

return `

<div
style="
width:100%;
display:flex;
justify-content:center;
margin-top:18px;
margin-bottom:14px;
">


<div
style="
max-width:78%;
background:#f5f5f5;
border-radius:22px;
padding:12px 14px;
display:flex;
flex-direction:column;
gap:6px;
border:1px solid #ececec;
"
>

<div
style="
font-size:10px;
font-weight:700;
letter-spacing:0.3px;
opacity:0.45;
"
>
${m.from || ""}
</div>

<div
style="
font-size:14px;
line-height:1.5;
color:#111;
word-break:break-word;
"
>
${m.text || ""}
</div>

</div>

</div>

`;

}).join("");

if(aiTyping){

const typing =
document.createElement("div");

typing.id = "aiTyping";

typing.style.display = "flex";
typing.style.alignItems = "center";
typing.style.gap = "4px";

typing.style.padding = "10px 14px";

typing.style.background = "#000";

typing.style.borderRadius = "18px";

typing.style.width = "fit-content";

typing.style.marginBottom = "18px";


typing.innerHTML = `
<div class="aiDot"></div>
<div class="aiDot"></div>
<div class="aiDot"></div>
`;

roomMessages.appendChild(
typing
);
}

requestAnimationFrame(() => {

roomMessages.scrollTop =
roomMessages.scrollHeight;

});




});

socket.on("roomClosed",() => {

  roomOverlay.style.display =
    "none";
});

function showAITyping(){

  hideAITyping();

  aiTyping = true;

  const wrap =
    document.createElement("div");

  wrap.id = "aiTyping";

  wrap.style.display = "flex";
  wrap.style.alignItems = "center";
  wrap.style.gap = "4px";

  wrap.style.padding = "10px 14px";

  wrap.style.background = "#000";

  wrap.style.borderRadius = "18px";

  wrap.style.width = "fit-content";

  wrap.style.marginBottom = "14px";

  wrap.innerHTML = `
    <div class="aiDot"></div>
    <div class="aiDot"></div>
    <div class="aiDot"></div>
  `;

roomMessages.insertAdjacentElement(
  "beforeend",
  wrap
);

  roomMessages.scrollTop =
    roomMessages.scrollHeight;
}

function hideAITyping(){

  aiTyping = false;

  const existing =
    document.getElementById(
      "aiTyping"
    );

  if(existing){
    existing.remove();
  }
}

socket.on(
  "aiTypingStart",
  () => {

    showAITyping();

  }
);

socket.on("aiTypingStop", () => {

  requestAnimationFrame(() => {

    requestAnimationFrame(() => {

      hideAITyping();

    });

  });

});


//////////////////////////////////////////////////
// SOCKET RECONNECT
//////////////////////////////////////////////////

socket.on(
  "disconnect",
  () => {

    helper.style.display =
      "flex";

    helper.innerHTML =
      "RECONNECTING...";

  }
);

socket.on(
  "connect",
  () => {

const urlRoomId =
  new URLSearchParams(window.location.search)
    .get("room");

if(urlRoomId){
  socket.emit("rejoinRoom", {
    roomId:urlRoomId
  });
  return;
}


    const savedRoomId =
      localStorage.getItem(
        "roomId"
      );

    const savedIntro =
      localStorage.getItem(
        "imageIntroText"
      );

const savedDisplayName =
  localStorage.getItem(
    "displayName"
  );

if(savedDisplayName){

  roomIdText.innerText =
    savedDisplayName;

}else if(savedRoomId){

  roomIdText.innerText =
    "#" + savedRoomId;

}


if(savedRoomId){

  if(savedIntro){

    roomInput.style.display = "block";

    document.getElementById(
      "firstNextBtn"
    ).style.display = "block";

  }

  socket.emit(
    "rejoinRoom",
    {
      roomId:savedRoomId
    }
  );

  return;
}

    if(
      roomOverlay.style.display !==
      "flex"
    ){

      helper.style.display =
        "flex";

     helper.innerHTML = `

<div>
TAP THE IMAGE ON THE SCREEN TO SEARCH THE INTERNET
</div>

<div style="margin-top:16px;"></div>

<button
id="uploadBtn"
style="
margin-top:18px;
padding:10px 18px;
border:none;
border-radius:999px;
background:#fff;
color:#111;
font-size:12px;
font-weight:900;
cursor:pointer;
pointer-events:auto;
box-shadow:0 4px 16px rgba(0,0,0,.18);
"
>
UPLOAD IMAGE
</button>

<button
id="publicNullsBtn"
onclick="showPublicNulls()"
style="
margin-top:12px;
padding:10px 18px;
border:none;
border-radius:999px;
background:#fff;
color:#111;
font-size:12px;
font-weight:900;
cursor:pointer;
pointer-events:auto;
box-shadow:0 4px 16px rgba(0,0,0,.18);
"
>
PUBLIC NULLS
</button>

`;

document
.getElementById("uploadBtn")
.onclick = e => {

  e.stopPropagation();

  uploadImage.click();

};



    }

  }
);

//////////////////////////////////////////////////
// SHARE CARD
//////////////////////////////////////////////////
function startDailyNullCountdown(){

  if(
    dailyNullCountdownStarted
  ){
    return;
  }

  dailyNullCountdownStarted =
    true;

  setInterval(() => {

    if(
      !dailyNullsNextRefresh
    ){
      return;
    }

    const diff =

      dailyNullsNextRefresh -

      Date.now();

    if(diff <= 0){

      dailyNullCountdown.innerText =
        "Refreshing...";

      return;
    }

    const mins =
      Math.floor(
        diff / 1000 / 60
      );

    const secs =
      Math.floor(
        (diff / 1000) % 60
      );

    dailyNullCountdown.innerText =

      "Next refresh in " +

      String(mins)
        .padStart(2,"0")

      +

      ":"

      +

      String(secs)
        .padStart(2,"0");

  },1000);

}

function showCreateNull(){

  dailyNullsScreen.style.display =
    "none";

  cameraWrap.style.display =
    "block";
}

async function showDailyNulls(){

  cameraWrap.style.display =
    "none";

  dailyNullsScreen.style.display =
    "block";

  await loadDailyNulls();
}

async function showPublicNulls(){

  cameraWrap.style.display = "none";

  dailyNullsScreen.style.display = "none";

  publicNullsScreen.style.display = "block";

  await loadPublicNulls();

}

async function loadPublicNulls(){

  publicNullsCards.innerHTML = "Loading...";

  const res =
    await fetch(
      "https://three23p-backend.onrender.com/public-nulls"
    );

  const data =
    await res.json();

  publicNullsCards.innerHTML =
    data.map(item => `

<div class="dailyNullCard">

<img
src="${item.image}"
style="
width:100%;
aspect-ratio:1/1;
object-fit:cover;
border-radius:12px;
">

<div
style="
font-size:20px;
font-weight:900;
margin-top:10px;
">
${item.identity}
</div>

<div
style="
font-size:13px;
margin-top:8px;
line-height:1.45;
">
${item.intro}
</div>

</div>

`).join("");

}

async function loadDailyNulls(){

  dailyNullsCards.innerHTML =
    "loading...";

  const res =
    await fetch(
      "https://three23p-backend.onrender.com/daily-nulls"
    );




  const data =
    await res.json();

dailyNullsNextRefresh =

  new Date(
    data.updatedAt
  ).getTime()

  +

  60 * 60 * 1000;

startDailyNullCountdown();




  dailyNullsCards.innerHTML =

    data.cards.map(card => `

<div
class="dailyNullCard"
data-share-card
data-share-read="true"
>


<div data-share-content>

<div
style="
font-size:11px;
font-weight:900;
opacity:.5;
"
>
${card.category}
</div>

<div
style="
font-size:20px;
font-weight:900;
margin-top:6px;
"
>
${card.identity}
</div>

<div
style="
font-size:13px;
line-height:1.45;
margin-top:8px;
"
>
${card.intro}
</div>

<div
style="
margin-top:12px;
font-size:16px;
font-weight:600;
line-height:1.4;
"
>
${card.title}
</div>

</div>

<a
href="${card.link}"
target="_blank"
style="
text-decoration:none;
color:#111;
"
>

<div
style="
font-size:11px;
font-weight:700;
padding-top:6px;
text-transform:uppercase;
animation:moreBlink 1.4s infinite;
display:flex;
justify-content:flex-end;
"
>
(read)
</div>

<img
src="${card.image}"
style="
width:100%;
aspect-ratio:1/1;
object-fit:cover;
border-radius:12px;
margin-top:10px;
"
/>

</a>

<div
style="
display:flex;
gap:12px;
margin-top:12px;
"
>

<span
data-link="${card.link}"

onclick="
shareCard(
  this,
  this.dataset.link
)
"
style="
cursor:pointer;
font-size:13px;
font-weight:700;
padding:8px 12px;
border-radius:999px;
background:#000;
color:#fff;
display:inline-block;
"
>
Share
</span>

</div>

</div>


`).join("");
}


async function shareCard(el, link){
gtag('event', 'share_card');

  try{

    const card =
      el.closest('[data-share-card]');

    if(!card) return;

const content =
  card.querySelector(
    "[data-share-content]"
  );

const text =
  content?.textContent
    ?.replace(/\s+/g, " ")
    .trim() || "";


    const image =
      card.parentElement.querySelector("img");

    const imageUrl =
      image?.src;

const newsLink =
  card.querySelector("a")?.href ||
  link ||
  "";



const shareTitle =
  "ASK NULL";

const shareText =
  text;

console.log(text);

const shareData =
  card.dataset.shareRead === "true"
  ? {
      title: "ASK NULL",
      text: `ASK NULL\n\n${text}`,
      url: newsLink
    }
  : {
      title: "ASK NULL",
      text: `ASK NULL\n\n${text}`
    };





    //////////////////////////////////////////////////
    // SHARE DATA
    //////////////////////////////////////////////////

    //////////////////////////////////////////////////
    // TRY IMAGE SHARE
    //////////////////////////////////////////////////

  if(navigator.share){

  try{

await navigator.share(shareData);

    return;

  }catch(err){

    if(err.name === "AbortError"){
      return;
    }

    console.log(err);

  }

}

    //////////////////////////////////////////////////
    // FALLBACK
    //////////////////////////////////////////////////

await navigator.clipboard.writeText(

  shareTitle +
  "\n\n" +
  text +
  "\n\n" +
  newsLink

);

    alert("copied");

  }catch(err){

    console.log(err);
  }
}

</script>

</body>
</html>
