(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const playBtn = document.getElementById("playBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const menu = document.getElementById("menu");
  const toast = document.getElementById("toast");
  const topScoreEl = document.getElementById("topScore");
  const bottomScoreEl = document.getElementById("bottomScore");

  const targetScore = 7;
  const state = {
    w: 0,
    h: 0,
    dpr: 1,
    running: false,
    paused: false,
    last: 0,
    particles: [],
    sparks: [],
    powerups: [],
    nextPowerup: 0,
    topScore: 0,
    bottomScore: 0,
    lastHit: "bottom",
    audio: null,
    pointers: new Map(),
  };

  const players = {
    top: {
      label: "P2",
      color: "#37e7ff",
      glow: "rgba(55, 231, 255, 0.36)",
      x: 0,
      targetX: 0,
      y: 0,
      w: 0,
      h: 14,
      boostUntil: 0,
    },
    bottom: {
      label: "P1",
      color: "#ff4f7d",
      glow: "rgba(255, 79, 125, 0.38)",
      x: 0,
      targetX: 0,
      y: 0,
      w: 0,
      h: 14,
      boostUntil: 0,
    },
  };

  const ball = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    r: 11,
    speed: 0,
    spin: 0,
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const rand = (min, max) => min + Math.random() * (max - min);

  function resize() {
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.w = window.innerWidth;
    state.h = window.innerHeight;
    canvas.width = Math.floor(state.w * state.dpr);
    canvas.height = Math.floor(state.h * state.dpr);
    canvas.style.width = `${state.w}px`;
    canvas.style.height = `${state.h}px`;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

    const paddleW = clamp(state.w * 0.28, 86, 158);
    const paddleH = clamp(state.h * 0.018, 10, 16);
    players.top.w = paddleW;
    players.bottom.w = paddleW;
    players.top.h = paddleH;
    players.bottom.h = paddleH;
    players.top.y = clamp(state.h * 0.105, 50, 82);
    players.bottom.y = state.h - players.top.y;
    players.top.x = clamp(players.top.x || state.w / 2, paddleW / 2, state.w - paddleW / 2);
    players.bottom.x = clamp(players.bottom.x || state.w / 2, paddleW / 2, state.w - paddleW / 2);
    players.top.targetX = players.top.x;
    players.bottom.targetX = players.bottom.x;
    ball.r = clamp(Math.min(state.w, state.h) * 0.024, 9, 16);
    if (!state.running) resetBall(Math.random() > 0.5 ? 1 : -1);
  }

  function initAudio() {
    if (state.audio) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    state.audio = new AudioContext();
  }

  function blip(type = "tap") {
    if (!state.audio) return;
    const now = state.audio.currentTime;
    const osc = state.audio.createOscillator();
    const gain = state.audio.createGain();
    const freq = type === "score" ? 180 : type === "power" ? 640 : 420;
    osc.type = type === "score" ? "sawtooth" : "triangle";
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * (type === "score" ? 0.65 : 1.35), now + 0.11);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(type === "score" ? 0.18 : 0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    osc.connect(gain).connect(state.audio.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  function buzz(ms = 25) {
    if (navigator.vibrate) navigator.vibrate(ms);
  }

  function resetBall(direction) {
    ball.x = state.w / 2;
    ball.y = state.h / 2;
    const base = clamp(Math.min(state.w, state.h) * 0.62, 300, 500);
    ball.speed = base;
    ball.vx = rand(-0.28, 0.28) * base;
    ball.vy = direction * base * 0.68;
    ball.spin = 0;
  }

  function resetMatch() {
    state.topScore = 0;
    state.bottomScore = 0;
    state.powerups = [];
    state.sparks = [];
    state.particles = [];
    state.nextPowerup = 1.3;
    updateScore();
    resetBall(Math.random() > 0.5 ? 1 : -1);
  }

  function showToast(text, ms = 900) {
    toast.textContent = text;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      toast.textContent = "";
    }, ms);
  }

  function updateScore() {
    topScoreEl.textContent = state.topScore;
    bottomScoreEl.textContent = state.bottomScore;
  }

  function startGame() {
    initAudio();
    if (state.audio?.state === "suspended") state.audio.resume();
    resetMatch();
    state.running = true;
    state.paused = false;
    pauseBtn.textContent = "II";
    menu.classList.add("is-hidden");
    showToast("Go", 520);
    state.last = performance.now();
    requestAnimationFrame(loop);
  }

  function togglePause() {
    if (!state.running) return;
    state.paused = !state.paused;
    pauseBtn.textContent = state.paused ? ">" : "II";
    showToast(state.paused ? "Pause" : "Go", 650);
    if (!state.paused) {
      state.last = performance.now();
      requestAnimationFrame(loop);
    }
  }

  function finish(winner) {
    state.running = false;
    state.paused = false;
    menu.classList.remove("is-hidden");
    playBtn.textContent = "Rejouer";
    showToast(`${winner === "bottom" ? "P1" : "P2"} gagne`, 1400);
    blip("score");
    buzz(80);
  }

  function spawnPowerup() {
    const types = ["wide", "blast", "curve"];
    state.powerups.push({
      type: types[Math.floor(Math.random() * types.length)],
      x: rand(state.w * 0.18, state.w * 0.82),
      y: rand(state.h * 0.28, state.h * 0.72),
      r: clamp(Math.min(state.w, state.h) * 0.028, 12, 19),
      ttl: 7,
      pulse: rand(0, Math.PI * 2),
    });
  }

  function applyPowerup(type) {
    const player = players[state.lastHit] || players.bottom;
    if (type === "wide") {
      player.boostUntil = performance.now() + 5200;
      showToast(`${player.label} large`, 760);
    } else if (type === "blast") {
      ball.vx *= 1.18;
      ball.vy *= 1.18;
      showToast("Turbo", 650);
    } else {
      ball.spin += state.lastHit === "bottom" ? rand(-150, 150) : rand(-150, 150);
      showToast("Curve", 650);
    }
    blip("power");
    buzz(35);
    burst(ball.x, ball.y, "#b7ff45", 18);
  }

  function burst(x, y, color, count = 12) {
    for (let i = 0; i < count; i += 1) {
      const a = rand(0, Math.PI * 2);
      const s = rand(80, 280);
      state.sparks.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand(0.35, 0.75),
        max: 0.75,
        color,
      });
    }
  }

  function addTrail(dt) {
    state.particles.push({
      x: ball.x,
      y: ball.y,
      r: ball.r * rand(0.28, 0.55),
      life: 0.34,
      max: 0.34,
      color: ball.vy > 0 ? "#37e7ff" : "#ff4f7d",
    });
    if (state.particles.length > 70) state.particles.splice(0, state.particles.length - 70);
    for (const p of state.particles) p.life -= dt;
    state.particles = state.particles.filter((p) => p.life > 0);
  }

  function updatePaddles(dt) {
    const now = performance.now();
    for (const player of [players.top, players.bottom]) {
      const activeW = now < player.boostUntil ? player.w * 1.42 : player.w;
      const speed = Math.max(15, 22 * dt * 60);
      player.x += (player.targetX - player.x) / speed;
      player.x = clamp(player.x, activeW / 2 + 10, state.w - activeW / 2 - 10);
    }
  }

  function collidePaddle(player, side) {
    const now = performance.now();
    const activeW = now < player.boostUntil ? player.w * 1.42 : player.w;
    const half = activeW / 2;
    const isTop = side === "top";
    const withinX = ball.x + ball.r > player.x - half && ball.x - ball.r < player.x + half;
    const withinY = isTop
      ? ball.y - ball.r <= player.y + player.h / 2 && ball.y > player.y
      : ball.y + ball.r >= player.y - player.h / 2 && ball.y < player.y;
    if (!withinX || !withinY) return;

    const hit = clamp((ball.x - player.x) / half, -1, 1);
    const dir = isTop ? 1 : -1;
    const speed = Math.min(Math.hypot(ball.vx, ball.vy) * 1.045 + 12, clamp(Math.min(state.w, state.h) * 1.18, 660, 920));
    ball.vx = hit * speed * 0.74 + (player.x - player.targetX) * -0.8;
    ball.vy = dir * speed * Math.max(0.54, 1 - Math.abs(hit) * 0.22);
    ball.y = isTop ? player.y + player.h / 2 + ball.r + 1 : player.y - player.h / 2 - ball.r - 1;
    ball.spin = hit * 130;
    state.lastHit = side;
    blip("tap");
    buzz(18);
    burst(ball.x, ball.y, player.color, 10);
  }

  function score(side) {
    if (side === "top") state.topScore += 1;
    if (side === "bottom") state.bottomScore += 1;
    updateScore();
    blip("score");
    buzz(55);
    burst(ball.x, ball.y, side === "top" ? players.top.color : players.bottom.color, 28);
    if (state.topScore >= targetScore) return finish("top");
    if (state.bottomScore >= targetScore) return finish("bottom");
    showToast(`${side === "top" ? "P2" : "P1"} marque`, 780);
    resetBall(side === "top" ? 1 : -1);
  }

  function update(dt) {
    if (!state.running || state.paused) return;
    state.nextPowerup -= dt;
    if (state.nextPowerup <= 0 && state.powerups.length < 2) {
      spawnPowerup();
      state.nextPowerup = rand(4.2, 6.8);
    }

    updatePaddles(dt);
    ball.vx += ball.spin * dt;
    ball.spin *= 0.985;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x - ball.r < 8) {
      ball.x = ball.r + 8;
      ball.vx = Math.abs(ball.vx);
      burst(ball.x, ball.y, "#ffd166", 6);
    }
    if (ball.x + ball.r > state.w - 8) {
      ball.x = state.w - ball.r - 8;
      ball.vx = -Math.abs(ball.vx);
      burst(ball.x, ball.y, "#ffd166", 6);
    }

    collidePaddle(players.top, "top");
    collidePaddle(players.bottom, "bottom");

    for (const power of state.powerups) {
      power.ttl -= dt;
      power.pulse += dt * 5;
      const dist = Math.hypot(ball.x - power.x, ball.y - power.y);
      if (dist < ball.r + power.r) {
        power.ttl = -1;
        applyPowerup(power.type);
      }
    }
    state.powerups = state.powerups.filter((power) => power.ttl > 0);

    if (ball.y < -ball.r * 2) score("bottom");
    if (ball.y > state.h + ball.r * 2) score("top");

    addTrail(dt);
    for (const s of state.sparks) {
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 0.985;
      s.vy *= 0.985;
    }
    state.sparks = state.sparks.filter((s) => s.life > 0);
  }

  function drawCourt() {
    ctx.clearRect(0, 0, state.w, state.h);
    const mid = state.h / 2;
    ctx.fillStyle = "#08070f";
    ctx.fillRect(0, 0, state.w, state.h);

    ctx.fillStyle = "rgba(55, 231, 255, 0.06)";
    ctx.fillRect(0, 0, state.w, mid);
    ctx.fillStyle = "rgba(255, 79, 125, 0.07)";
    ctx.fillRect(0, mid, state.w, mid);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.13)";
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 14]);
    ctx.beginPath();
    ctx.moveTo(18, mid);
    ctx.lineTo(state.w - 18, mid);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    for (let x = 28; x < state.w; x += 42) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, state.h);
      ctx.stroke();
    }
  }

  function roundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  function drawPaddle(player) {
    const now = performance.now();
    const w = now < player.boostUntil ? player.w * 1.42 : player.w;
    const h = player.h;
    const x = player.x - w / 2;
    const y = player.y - h / 2;
    ctx.shadowColor = player.glow;
    ctx.shadowBlur = 24;
    ctx.fillStyle = player.color;
    roundedRect(x, y, w, h, h / 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
    roundedRect(x + w * 0.16, y + 2, w * 0.68, 2, 1);
    ctx.fill();
  }

  function drawBall() {
    for (const p of state.particles) {
      ctx.globalAlpha = p.life / p.max;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const gradient = ctx.createRadialGradient(ball.x - ball.r * 0.35, ball.y - ball.r * 0.35, 2, ball.x, ball.y, ball.r * 1.7);
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.24, "#ffd166");
    gradient.addColorStop(1, ball.vy > 0 ? "#37e7ff" : "#ff4f7d");
    ctx.shadowColor = "rgba(255, 209, 102, 0.55)";
    ctx.shadowBlur = 28;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawPowerups() {
    for (const power of state.powerups) {
      const pulse = Math.sin(power.pulse) * 2.5;
      const r = power.r + pulse;
      ctx.shadowColor = "rgba(183, 255, 69, 0.36)";
      ctx.shadowBlur = 22;
      ctx.fillStyle = power.type === "wide" ? "#b7ff45" : power.type === "blast" ? "#ffd166" : "#a854ff";
      ctx.beginPath();
      ctx.arc(power.x, power.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#08070f";
      ctx.font = `900 ${Math.max(12, r * 0.85)}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(power.type === "wide" ? "W" : power.type === "blast" ? "B" : "C", power.x, power.y + 1);
    }
  }

  function drawSparks() {
    for (const s of state.sparks) {
      ctx.globalAlpha = Math.max(0, s.life / s.max);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawTouchHints() {
    if (state.running) return;
    ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
    ctx.font = "800 13px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("P2 zone", state.w / 2, state.h * 0.23);
    ctx.fillText("P1 zone", state.w / 2, state.h * 0.77);
  }

  function render() {
    drawCourt();
    drawPowerups();
    drawPaddle(players.top);
    drawPaddle(players.bottom);
    drawBall();
    drawSparks();
    drawTouchHints();
  }

  function loop(now) {
    const dt = Math.min((now - state.last) / 1000 || 0, 0.033);
    state.last = now;
    update(dt);
    render();
    if (state.running && !state.paused) requestAnimationFrame(loop);
  }

  function assignPointer(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const side = y < state.h / 2 ? "top" : "bottom";
    state.pointers.set(event.pointerId, side);
    players[side].targetX = x;
    canvas.setPointerCapture?.(event.pointerId);
  }

  function movePointer(event) {
    const side = state.pointers.get(event.pointerId);
    if (!side) return;
    const rect = canvas.getBoundingClientRect();
    players[side].targetX = clamp(event.clientX - rect.left, 8, state.w - 8);
  }

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (!state.running) return;
    assignPointer(event);
  });
  canvas.addEventListener("pointermove", (event) => {
    event.preventDefault();
    movePointer(event);
  });
  canvas.addEventListener("pointerup", (event) => state.pointers.delete(event.pointerId));
  canvas.addEventListener("pointercancel", (event) => state.pointers.delete(event.pointerId));

  playBtn.addEventListener("click", startGame);
  pauseBtn.addEventListener("click", togglePause);
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.running && !state.paused) togglePause();
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch(() => {});
    });
  }

  resize();
  render();
})();
