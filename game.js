/* Secret Dino Runner with Firestore Leaderboard — Canvas version */
import { db } from './firebase-config.js';
import { collection, addDoc, query, orderBy, limit, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

(function() {
  const TAP_TIMEOUT = 800;
  let tapCount = 0;
  let tapTimer = null;
  const HIGH_SCORE_KEY = 'dino_highscore';
  const PLAYER_NAME_KEY = 'dino_playername';

  const CANVAS_W = 600;
  const CANVAS_H = 150;
  const GROUND_Y = 120;
  const GRAVITY = 0.55;
  const JUMP_VEL = -9.5;
  const INITIAL_SPEED = 5;
  const MAX_SPEED = 12;
  const ACCELERATION = 0.0008;

  // Audio context for generated sound effects
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (C) {
        audioCtx = new C();
        if (audioCtx.state === 'suspended') audioCtx.resume();
      }
    }
    return audioCtx;
  }

  function playJumpSound() {
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(420, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(760, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } catch(e) {}
  }

  function playScoreSound() {
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(1320, ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.18);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.18);
    } catch(e) {}
  }

  function playHitSound() {
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(40, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch(e) {}
  }

  // Obstacle type definitions
  const OBSTACLE_TYPES = [
    { type: 'cactus_small', width: 18, height: 36, color: '#5cb85c', minSpeed: 0 },
    { type: 'cactus_large', width: 26, height: 48, color: '#4a9a4a', minSpeed: 0 },
    { type: 'pterodactyl', width: 42, height: 34, color: '#535353', minSpeed: 7 },
  ];

  function getRandomObstacle(speed) {
    const available = OBSTACLE_TYPES.filter(o => speed >= o.minSpeed);
    return available[Math.floor(Math.random() * available.length)];
  }

  // ==================== CANVAS DRAWING ====================

  function drawGround(ctx, scroll) {
    const groundTop = GROUND_Y;
    ctx.fillStyle = '#535353';
    ctx.fillRect(0, groundTop, CANVAS_W, 2);

    const step = 8;
    for (let x = -scroll % step; x < CANVAS_W; x += step) {
      const offset = Math.sin((x + scroll) * 0.3) * 2;
      ctx.fillRect(x, groundTop + 2 + offset, 2, 2);
    }
  }

  function drawCloud(ctx, x, y) {
    ctx.fillStyle = '#e8e8e8';
    ctx.beginPath();
    ctx.ellipse(x, y, 18, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 12, y - 2, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x - 10, y + 1, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTRex(ctx, x, y, frame, jumping, crashed, ducking) {
    ctx.save();
    ctx.translate(x, y);

    if (crashed) ctx.rotate(-0.25);

    const bodyColor = '#535353';
    const darkColor = '#3a3a3a';

    if (ducking) {
      // Flattened ducking pose
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.ellipse(2, -11, 13, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(16, -14, 9, 6, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(20, -16, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(21, -16, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(10, -11);
      ctx.lineTo(22, -11);
      ctx.stroke();
      ctx.strokeStyle = bodyColor;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(6, -6);
      ctx.lineTo(3, -2);
      ctx.stroke();
      ctx.fillStyle = bodyColor;
      ctx.fillRect(-4, -2, 8, 4);
      ctx.fillRect(3, -2, 8, 4);
      ctx.fillStyle = darkColor;
      ctx.fillRect(-5, 2, 9, 2);
      ctx.fillRect(2, 2, 9, 2);
      ctx.restore();
      return;
    }

    // Tail
    ctx.fillStyle = darkColor;
    ctx.beginPath();
    ctx.moveTo(-5, -8);
    ctx.lineTo(-22, -5);
    ctx.lineTo(-20, -14);
    ctx.closePath();
    ctx.fill();

    // Body
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(2, -19, 11, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.ellipse(16, -32, 9, 8, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Jaw
    ctx.beginPath();
    ctx.ellipse(18, -25, 7, 5, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Eye ridge
    ctx.fillStyle = darkColor;
    ctx.beginPath();
    ctx.ellipse(18, -36, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(20, -33, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(21, -33, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Mouth line
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(8, -28);
    ctx.lineTo(24, -28);
    ctx.stroke();

    // Arms
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(6, -14);
    ctx.lineTo(3, -9);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(4, -15);
    ctx.lineTo(1, -10);
    ctx.stroke();

    // Legs
    ctx.fillStyle = bodyColor;
    if (jumping) {
      ctx.fillRect(-4, -5, 6, 6);
      ctx.fillRect(2, -5, 6, 6);
    } else if (crashed) {
      ctx.fillRect(-5, -4, 6, 5);
      ctx.fillRect(2, -4, 6, 5);
    } else {
      const alt = frame % 2 === 0;
      ctx.fillRect(-5, alt ? -6 : -4, 6, alt ? 7 : 5);
      ctx.fillRect(3, alt ? -4 : -6, 6, alt ? 5 : 7);
    }

    // Feet
    ctx.fillStyle = darkColor;
    ctx.fillRect(-6, 0, 8, 2.5);
    ctx.fillRect(2, 0, 8, 2.5);

    ctx.restore();
  }

  function drawCactusSmall(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#5cb85c';
    ctx.beginPath();
    roundRect(ctx, -4, -30, 8, 30, 2);
    ctx.fill();
    ctx.fillRect(-10, -20, 7, 4);
    ctx.fillRect(4, -16, 7, 4);
    ctx.fillRect(-5, -32, 10, 3);
    ctx.restore();
  }

  function drawCactusLarge(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#4a9a4a';
    ctx.beginPath();
    roundRect(ctx, -6, -44, 12, 44, 2);
    ctx.fill();
    ctx.fillRect(-13, -30, 7, 4);
    ctx.fillRect(7, -26, 7, 4);
    ctx.fillRect(-11, -18, 6, 4);
    ctx.fillRect(6, -14, 6, 4);
    ctx.fillRect(-7, -46, 14, 3);
    ctx.restore();
  }

  function drawPterodactyl(ctx, x, y, frame) {
    const halfH = 17;
    ctx.save();
    ctx.translate(x, y - halfH);
    ctx.fillStyle = '#535353';
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    const wingUp = frame % 2 === 0;
    ctx.beginPath();
    if (wingUp) {
      ctx.moveTo(-4, -2);
      ctx.lineTo(-1, -16);
      ctx.lineTo(4, -2);
    } else {
      ctx.moveTo(-4, -2);
      ctx.lineTo(-1, -10);
      ctx.lineTo(4, -2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(15, 1);
    ctx.lineTo(8, 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(6, -1, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawObstacle(ctx, obs, x, y, frame) {
    switch (obs.type) {
      case 'cactus_small': drawCactusSmall(ctx, x, y); break;
      case 'cactus_large': drawCactusLarge(ctx, x, y); break;
      case 'pterodactyl': drawPterodactyl(ctx, x, y, frame); break;
    }
  }

  function drawScore(ctx, score, highScore) {
    ctx.save();
    ctx.fillStyle = '#535353';
    ctx.font = 'bold 14px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(String(score).padStart(5, '0'), CANVAS_W - 14, 8);
    if (highScore > 0) {
      ctx.font = '11px "Courier New", monospace';
      ctx.fillStyle = '#999';
      ctx.fillText('HI ' + String(highScore).padStart(5, '0'), CANVAS_W - 14, 26);
    }
    ctx.restore();
  }

  function drawFlash(ctx) {
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ==================== GAME CLASS ====================

  class Game {
    constructor(canvas, onClose) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.onClose = onClose;

      this.reset();
      this.setupEvents();
    }

    reset() {
      this.state = 'waiting';
      this.speed = INITIAL_SPEED;
      this.distance = 0;
      this.score = 0;
      this.frame = 0;
      this.trexX = 50;
      this.trexY = 0;
      this.trexVelY = 0;
      this.ducking = false;
      this.obstacles = [];
      this.clouds = [];
      this.scroll = 0;
      this.lastObstacleX = CANVAS_W + 200;
      this.minGap = 300;
      this.highScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
      this.submitted = false;
      this.lastMilestone = 0;
      this.flashTimer = 0;
      this.spawnTimer = Math.floor(Math.random() * 100) + 60;

      for (let i = 0; i < 2; i++) {
        this.clouds.push({ x: Math.random() * CANVAS_W, y: 20 + Math.random() * 30, speed: 0.3 + Math.random() * 0.4 });
      }
    }

    setupEvents() {
      this._onKey = (e) => {
        if (e.key === ' ' || e.key === 'Space' || e.key === 'ArrowUp') {
          e.preventDefault();
          if (this.state === 'crashed') this.restart();
          else if (this.state !== 'waiting') this.jump();
          else { this.start(); this.jump(); }
        }
        if (e.key === 'ArrowDown' && this.state === 'running') {
          this.ducking = true;
        }
      };
      this._onKeyUp = (e) => {
        if (e.key === 'ArrowDown') this.ducking = false;
      };
      this._onClick = () => {
        if (this.state === 'waiting') { this.start(); this.jump(); }
        else if (this.state === 'crashed') this.restart();
        else this.jump();
      };
      this._onTouchStart = (e) => {
        e.preventDefault();
        if (this.state === 'waiting') { this.start(); this.jump(); }
        else if (this.state === 'crashed') this.restart();
        else this.jump();
      };

      document.addEventListener('keydown', this._onKey);
      document.addEventListener('keyup', this._onKeyUp);
      this.canvas.addEventListener('click', this._onClick);
      this.canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
    }

    destroy() {
      document.removeEventListener('keydown', this._onKey);
      document.removeEventListener('keyup', this._onKeyUp);
      this.canvas.removeEventListener('click', this._onClick);
      this.canvas.removeEventListener('touchstart', this._onTouchStart);
      if (this._animId) cancelAnimationFrame(this._animId);
    }

    start() {
      this.state = 'running';
      playJumpSound();
    }

    jump() {
      if (this.trexY > 0) return;
      this.trexVelY = JUMP_VEL;
      playJumpSound();
    }

    restart() {
      this.reset();
      this.state = 'waiting';
      this.render();
    }

    spawnObstacle() {
      const minDist = Math.max(this.minGap, 200 + (MAX_SPEED - this.speed) * 20);
      if (CANVAS_W - this.lastObstacleX < minDist) return;
      if (this.obstacles.length >= 3) return;

      const type = getRandomObstacle(this.speed);
      const isPterodactyl = type.type === 'pterodactyl';
      const obs = {
        type: type.type,
        width: type.width,
        height: type.height,
        x: CANVAS_W + 10,
        y: isPterodactyl ? GROUND_Y - 35 + Math.random() * 15 : GROUND_Y,
      };
      this.obstacles.push(obs);
      this.lastObstacleX = obs.x;
    }

    checkCollision(obs) {
      const margin = 4;
      const trexW = 30;
      const trexH = this.ducking ? 20 : 38;
      const trexB = GROUND_Y - this.trexY;

      const obsLeft = obs.x;
      const obsRight = obs.x + obs.width;
      const obsTop = obs.y - obs.height;
      const obsBottom = obs.y;

      return (
        this.trexX + margin < obsRight &&
        this.trexX + trexW - margin > obsLeft &&
        trexB - trexH + margin < obsBottom &&
        trexB - margin > obsTop
      );
    }

    update() {
      if (this.state !== 'running') return;

      this.frame++;

      // Speed progression
      if (this.speed < MAX_SPEED) this.speed += ACCELERATION;

      // TRex physics
      if (this.trexVelY !== 0 || this.trexY > 0) {
        this.trexY += this.trexVelY;
        this.trexVelY += GRAVITY;
        if (this.trexY <= 0) {
          this.trexY = 0;
          this.trexVelY = 0;
        }
      }

      // Ducking resets when airborne
      if (this.trexY > 0) this.ducking = false;

      // Ground scroll
      this.scroll += this.speed;

      // Distance & Score
      this.distance += this.speed;
      const prevScore = this.score;
      this.score = Math.floor(this.distance / 10);
      if (this.score > prevScore) {
        if (this.score % 100 === 0 && this.score > 0) {
          playScoreSound();
          this.flashTimer = 4;
        }
      }

      // Spawn obstacles
      this.spawnTimer--;
      if (this.spawnTimer <= 0) {
        this.spawnObstacle();
        this.spawnTimer = Math.floor(Math.random() * 60) + 50;
      }

      // Move obstacles
      for (let i = this.obstacles.length - 1; i >= 0; i--) {
        const obs = this.obstacles[i];
        obs.x -= this.speed;
        if (obs.x + obs.width < -20) {
          this.obstacles.splice(i, 1);
          continue;
        }
        if (this.checkCollision(obs)) {
          this.crash();
          return;
        }
      }

      // Move clouds
      for (const cloud of this.clouds) {
        cloud.x -= cloud.speed;
        if (cloud.x + 30 < 0) {
          cloud.x = CANVAS_W + 20;
          cloud.y = 15 + Math.random() * 35;
        }
      }
    }

    crash() {
      this.state = 'crashed';
      playHitSound();
      const finalScore = this.score;
      if (finalScore > this.highScore) {
        this.highScore = finalScore;
        localStorage.setItem(HIGH_SCORE_KEY, finalScore);
        if (!this.submitted) {
          this.submitted = true;
          submitScore(finalScore);
        }
      }
    }

    render() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      // Background
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Clouds
      for (const cloud of this.clouds) {
        drawCloud(ctx, cloud.x, cloud.y);
      }

      // Ground
      drawGround(ctx, this.scroll);

      // Obstacles
      for (const obs of this.obstacles) {
        drawObstacle(ctx, obs, obs.x + obs.width / 2, obs.y, this.frame);
      }

      // TRex
      const trexBottom = GROUND_Y - this.trexY;
      const animFrame = Math.floor(this.frame / 3);
      drawTRex(ctx, this.trexX + 15, trexBottom, animFrame,
        this.trexY > 0 || this.trexVelY !== 0,
        this.state === 'crashed',
        this.ducking && this.trexY <= 0);

      // Score
      drawScore(ctx, this.score, this.highScore);

      // Flash effect
      if (this.flashTimer > 0) {
        drawFlash(ctx);
        this.flashTimer--;
      }

      // Start / game over messages
      if (this.state === 'waiting') {
        ctx.fillStyle = '#535353';
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Dino Runner', CANVAS_W / 2, CANVAS_H / 2 - 10);
        ctx.font = '13px system-ui, sans-serif';
        ctx.fillStyle = '#999';
        ctx.fillText('Tap / Space to jump', CANVAS_W / 2, CANVAS_H / 2 + 14);
      }

      if (this.state === 'crashed') {
        this.drawGameOver(ctx);
      }
    }

    drawGameOver(ctx) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.fillStyle = '#da1e28';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText('Game Over!', CANVAS_W / 2, CANVAS_H / 2 - 22);

      ctx.fillStyle = '#535353';
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillText('Score: ' + this.score, CANVAS_W / 2, CANVAS_H / 2 + 2);

      ctx.fillStyle = '#999';
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText('Best: ' + this.highScore, CANVAS_W / 2, CANVAS_H / 2 + 22);

      if (this.submitted && this.score > 0) {
        ctx.fillStyle = '#f1c21b';
        ctx.font = '11px system-ui, sans-serif';
        ctx.fillText('New High Score!', CANVAS_W / 2, CANVAS_H / 2 + 42);
      }

      ctx.fillStyle = '#bbb';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText('Tap to restart', CANVAS_W / 2, CANVAS_H / 2 + 58);
    }

    gameLoop() {
      this.update();
      this.render();
      this._animId = requestAnimationFrame(() => this.gameLoop());
    }
  }

  // ==================== FIRESTORE ====================

  async function fetchLeaderboard() {
    try {
      const q = query(collection(db, "game_scores"), orderBy("score", "desc"), limit(10));
      const snap = await getDocs(q);
      let html = '', rank = 1;
      snap.forEach(d => {
        const data = d.data();
        html += `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #eee;font-size:0.8rem;">
          <span>${rank}. ${escapeHtml(data.name || '???')}</span>
          <span style="font-weight:700;">${data.score}</span>
        </div>`;
        rank++;
      });
      return html || '<div style="font-size:0.8rem;color:#999;text-align:center;">No scores yet. Be the first!</div>';
    } catch (e) {
      return '<div style="font-size:0.8rem;color:#999;text-align:center;">Leaderboard unavailable</div>';
    }
  }

  async function submitScore(scoreVal) {
    const name = localStorage.getItem(PLAYER_NAME_KEY) || 'Anonymous';
    try {
      await addDoc(collection(db, "game_scores"), { name, score: scoreVal, createdAt: serverTimestamp() });
    } catch (e) {}
  }

  // ==================== LAUNCH ====================

  function launchGame() {
    if (document.getElementById('dino-game-overlay')) return;

    // Name prompt
    if (!localStorage.getItem(PLAYER_NAME_KEY)) {
      const name = prompt('Enter your name for the leaderboard:');
      if (name && name.trim()) localStorage.setItem(PLAYER_NAME_KEY, name.trim().slice(0, 15));
      else localStorage.setItem(PLAYER_NAME_KEY, 'Anonymous');
    }

    const overlay = document.createElement('div');
    overlay.id = 'dino-game-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:var(--bg-color,#f4f4f4);z-index:100000;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;';

    overlay.innerHTML = `
      <div id="dino-game" style="position:relative;width:600px;max-width:94vw;border-radius:12px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.15);border:2px solid var(--border-color,#e0e0e0);background:var(--card-bg,#fff);">
        <canvas id="dino-canvas" width="600" height="150" style="display:block;width:100%;height:auto;cursor:pointer;"></canvas>
        <div id="dino-name-display" style="position:absolute;bottom:4px;left:8px;font-size:0.6rem;color:var(--text-secondary,#bbb);z-index:10;"></div>
        <button id="dino-close" style="position:absolute;top:4px;left:6px;background:none;border:none;font-size:1.1rem;cursor:pointer;color:var(--text-secondary,#999);z-index:30;line-height:1;padding:2px 4px;">✕</button>
        <button id="dino-lb-btn" style="position:absolute;top:4px;right:6px;background:none;border:none;font-size:0.7rem;cursor:pointer;color:var(--text-secondary,#999);z-index:30;padding:2px 4px;">Scores</button>
        <div id="dino-leaderboard" style="display:none;position:absolute;top:0;left:0;width:100%;height:150px;background:var(--card-bg,#fff);z-index:25;padding:32px 14px 10px;box-sizing:border-box;overflow-y:auto;"></div>
      </div>
    `;

    document.body.appendChild(overlay);

    setTimeout(() => {
      const nd = document.getElementById('dino-name-display');
      if (nd) nd.textContent = localStorage.getItem(PLAYER_NAME_KEY);
    }, 0);

    const canvas = document.getElementById('dino-canvas');
    const closeBtn = document.getElementById('dino-close');
    const lbBtn = document.getElementById('dino-lb-btn');
    const lbDiv = document.getElementById('dino-leaderboard');

    const game = new Game(canvas, () => {});
    game.gameLoop();

    closeBtn.addEventListener('click', () => {
      game.destroy();
      overlay.remove();
    });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape' && document.getElementById('dino-game-overlay')) {
        game.destroy();
        overlay.remove();
        document.removeEventListener('keydown', esc);
      }
    });

    lbBtn.addEventListener('click', async () => {
      if (lbDiv.style.display === 'block') {
        lbDiv.style.display = 'none';
        return;
      }
      lbDiv.style.display = 'block';
      lbDiv.innerHTML = '<div style="font-size:0.7rem;color:var(--text-secondary,#999);text-align:center;padding:0.5rem;">Loading...</div>';
      const html = await fetchLeaderboard();
      lbDiv.innerHTML = '<div style="font-size:0.85rem;font-weight:700;margin-bottom:6px;">Leaderboard</div>' + html +
        '<button id="dino-lb-close" style="margin-top:8px;width:100%;padding:5px;border:1px solid var(--border-color,#ddd);border-radius:4px;background:var(--card-bg,#fff);cursor:pointer;font-size:0.75rem;">Close</button>';
      document.getElementById('dino-lb-close')?.addEventListener('click', () => {
        lbDiv.style.display = 'none';
      });
    });
  }

  // ==================== TAP CODE ====================

  function initTapCode() {
    const target = document.querySelector('.nav-brand h1') || document.querySelector('.nav-brand') || document.querySelector('h1');
    if (!target) return;
    target.addEventListener('click', () => {
      tapCount++;
      if (tapTimer) clearTimeout(tapTimer);
      if (tapCount >= 5) { tapCount = 0; launchGame(); return; }
      tapTimer = setTimeout(() => { tapCount = 0; }, TAP_TIMEOUT);
    });
    target.style.cursor = 'pointer';
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initTapCode);
  else initTapCode();
})();
