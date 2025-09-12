<style>
  body {
    margin:0;
    color:#fff;
    font-family: 'Inter', sans-serif;
    display:flex;
    flex-direction:column;
    align-items:center;
    background: linear-gradient(-45deg, #ff00cc, #3333ff, #00ffee, #ff9900);
    background-size: 400% 400%;
    animation: gradientShift 12s ease infinite;
  }
  @keyframes gradientShift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  #start-btn {
    background:linear-gradient(90deg,#00ffcc,#00aaff);
    color:#000;font-size:22px;font-weight:bold;
    padding:16px 32px;border:none;border-radius:30px;cursor:pointer;
    box-shadow:0 0 20px rgba(0,255,204,.5);
    transition:transform .2s ease;
    text-transform:lowercase;
  }
  #start-btn:hover { transform:scale(1.05); }

  .card {
    background:rgba(20,20,20,0.8);
    border-radius:24px; padding:24px; margin:20px auto; max-width:600px;
    backdrop-filter: blur(10px);
    border:2px solid transparent;
    box-shadow:0 0 25px rgba(0,255,204,.4);
    animation: pulseBorder 3s infinite alternate;
  }
  @keyframes pulseBorder {
    0% { box-shadow:0 0 15px rgba(255,0,255,.5); }
    100% { box-shadow:0 0 35px rgba(0,255,255,.7); }
  }

  .social-btn {
    display:inline-block;
    padding:16px 32px;
    background:linear-gradient(90deg,#ff00ff,#00ffff);
    color:#000; font-size:18px; font-weight:bold;
    border-radius:30px;
    box-shadow:0 0 15px rgba(255,0,255,.6);
    font-family:'Inter',sans-serif;
    text-transform:lowercase;
    margin:10px 0;
    cursor:pointer;
  }
</style>

<div id="start-screen">
  <button id="start-btn">🔊 tap in w/ voice rn</button>
</div>

<div id="app" style="display:none; max-width:700px;">
  <section class="card">
    <div class="title" id="r-title">—</div>
    <div class="artist" id="r-artist">—</div>

    <button id="social-btn" class="social-btn">🍜 enter 323 instant noodle social</button>

    <p class="desc" id="r-desc">—</p>
    <div id="voice-status"></div>
    <img id="r-img" alt="trend image" style="display:none;" />
    <div id="r-fallback">no image yet</div>

    <div id="chat-box" style="display:none;">
      <div id="messages"></div>
      <input id="chat-input" type="text" placeholder="type a message..." />
      <button id="chat-send">send</button>
      <p id="room-label"></p>
    </div>
  </section>
</div>

<!-- Load logic from Render -->
<script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
<script src="https://three23p-backend.onrender.com/app.js"></script>
