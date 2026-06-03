/* Secret Dino Runner with Firestore Leaderboard — Tap logo 5x fast */
import { db } from './firebase-config.js';
import { collection, addDoc, query, orderBy, limit, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

(function() {
  const TAP_TIMEOUT = 800;
  let tapCount = 0;
  let tapTimer = null;
  const HIGH_SCORE_KEY = 'dino_highscore';
  const PLAYER_NAME_KEY = 'dino_playername';

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
    let name = localStorage.getItem(PLAYER_NAME_KEY);
    if (!name) {
      name = prompt('🏆 New High Score! Enter your name for the leaderboard:');
      if (!name || name.trim() === '') name = 'Anonymous';
      name = name.trim().slice(0, 15);
      localStorage.setItem(PLAYER_NAME_KEY, name);
    }
    try {
      await addDoc(collection(db, "game_scores"), { name, score: scoreVal, createdAt: serverTimestamp() });
    } catch (e) { /* silently fail */ }
  }

  function launchGame() {
    if (document.getElementById('dino-game-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'dino-game-overlay';
    overlay.style.cssText = `position:fixed;top:0;left:0;width:100vw;height:100vh;background:#f7f7f7;z-index:100000;display:flex;align-items:center;justify-content:center;font-family:'IBM Plex Sans',monospace;`;

    overlay.innerHTML = `
      <div id="dino-game" style="position:relative;width:600px;max-width:96vw;height:280px;overflow:hidden;background:#fff;border:2px solid #e0e0e0;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,0.2);">
        <div id="dino-score" style="position:absolute;top:10px;right:14px;font-size:1.1rem;font-weight:700;color:#535353;z-index:10;">0</div>
        <div id="dino-ground" style="position:absolute;bottom:0;width:100%;height:2px;background:#535353;"></div>
        <div id="dino-character" style="position:absolute;bottom:0;left:40px;width:30px;height:40px;z-index:5;">
          <div style="width:100%;height:100%;background:#535353;border-radius:4px 4px 2px 2px;position:relative;">
            <div style="position:absolute;top:-6px;left:4px;width:8px;height:6px;background:#535353;border-radius:3px 3px 0 0;"></div>
            <div style="position:absolute;top:2px;right:-4px;width:6px;height:6px;background:#fff;border-radius:50%;border:2px solid #535353;"></div>
          </div>
        </div>
        <div id="dino-obstacles" style="position:absolute;top:0;left:0;width:100%;height:100%;"></div>
        <div id="dino-msg" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;z-index:20;color:#535353;">
          <div style="font-size:1rem;font-weight:700;margin-bottom:4px;">🏃 Dino Runner</div>
          <div style="font-size:0.75rem;color:#999;">Tap / Space to jump</div>
        </div>
        <div id="dino-leaderboard" style="display:none;position:absolute;top:0;left:0;width:100%;height:100%;background:#fff;z-index:25;padding:40px 20px 20px;box-sizing:border-box;overflow-y:auto;"></div>
        <button id="dino-close" style="position:absolute;top:4px;left:6px;background:none;border:none;font-size:1.2rem;cursor:pointer;color:#999;z-index:30;line-height:1;">✕</button>
        <button id="dino-lb-btn" style="position:absolute;top:4px;right:6px;background:none;border:none;font-size:0.75rem;cursor:pointer;color:#999;z-index:30;display:none;">🏆 Scores</button>
      </div>
    `;

    document.body.appendChild(overlay);

    const game = document.getElementById('dino-game');
    const dino = document.getElementById('dino-character');
    const obstacles = document.getElementById('dino-obstacles');
    const scoreEl = document.getElementById('dino-score');
    const msgEl = document.getElementById('dino-msg');
    const closeBtn = document.getElementById('dino-close');
    const lbBtn = document.getElementById('dino-lb-btn');
    const lbDiv = document.getElementById('dino-leaderboard');

    let isJumping = false, jumpVel = 0, dinoBottom = 0, score = 0;
    let gameOver = false, started = false, animId = null;
    let obsTimer = null, speedTimer = null, speed = 5;
    let obstaclesList = [], frame = 0, submitted = false;
    const GRAVITY = -0.6, JUMP_FORCE = 10;
    const DINO_WIDTH = 30, DINO_HEIGHT = 40;

    dino.style.bottom = '0px';

    if (document.documentElement.hasAttribute('data-theme')) {
      overlay.style.background = '#1a1a1a';
      game.style.background = '#222';
      game.style.borderColor = '#444';
    }

    function jump() {
      if (gameOver) { resetGame(); return; }
      if (!started) { started = true; msgEl.style.display = 'none'; lbBtn.style.display = 'none'; startObstacles(); startSpeedUp(); }
      if (isJumping) return;
      isJumping = true; jumpVel = JUMP_FORCE;
    }

    function spawnObstacle() {
      if (gameOver) return;
      const obs = document.createElement('div');
      const h = 18 + Math.random() * 22;
      obs.style.cssText = `position:absolute;bottom:0;right:-20px;width:14px;height:${h}px;background:#535353;border-radius:3px 3px 0 0;z-index:5;`;
      obstacles.appendChild(obs);
      obstaclesList.push({ el: obs, x: 600, w: 14, h });
    }

    let minObsInterval = 60;
    function startObstacles() {
      obsTimer = setInterval(() => { if (!gameOver) { spawnObstacle(); minObsInterval = Math.max(25, minObsInterval - 0.3); } }, Math.max(minObsInterval, 400 + Math.random() * 300));
    }
    function startSpeedUp() {
      speedTimer = setInterval(() => { if (!gameOver) speed += 0.1; }, 500);
    }

    async function resetGame() {
      gameOver = false; started = false; score = 0; speed = 5; minObsInterval = 60; submitted = false;
      dinoBottom = 0; dino.style.bottom = '0px';
      obstaclesList.forEach(o => o.el.remove()); obstaclesList = [];
      scoreEl.textContent = '0'; dino.style.transform = '';
      clearInterval(obsTimer); clearInterval(speedTimer);
      isJumping = false; jumpVel = 0; lbBtn.style.display = 'none'; lbDiv.style.display = 'none';
      msgEl.style.display = 'block';
      msgEl.innerHTML = `<div style="font-size:1rem;font-weight:700;margin-bottom:4px;">🏃 Dino Runner</div><div style="font-size:0.75rem;color:#999;">Tap / Space to jump</div>`;
    }

    function gameLoop() {
      if (gameOver) { animId = requestAnimationFrame(gameLoop); return; }
      frame++;
      if (isJumping) {
        dinoBottom += jumpVel; jumpVel += GRAVITY;
        if (dinoBottom <= 0) { dinoBottom = 0; isJumping = false; jumpVel = 0; }
        dino.style.bottom = dinoBottom + 'px';
      }
      for (let i = obstaclesList.length - 1; i >= 0; i--) {
        const o = obstaclesList[i];
        o.x -= speed;
        o.el.style.right = (600 - o.x) + 'px';
        if (40 + DINO_WIDTH > o.x + 4 && 40 < o.x + 14 - 4 && dinoBottom < o.h && dinoBottom + DINO_HEIGHT > 0) {
          gameOver = true; clearInterval(obsTimer); clearInterval(speedTimer);
          dino.style.transform = 'rotate(90deg)'; dino.style.transformOrigin = 'bottom center';
          const finalScore = score;
          msgEl.style.display = 'block';
          const highScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
          const isNewHigh = finalScore > highScore;
          if (isNewHigh) {
            localStorage.setItem(HIGH_SCORE_KEY, finalScore);
            msgEl.innerHTML = `
              <div style="font-size:1rem;font-weight:700;color:#da1e28;">Game Over!</div>
              <div style="font-size:0.8rem;margin:4px 0;">
                <span style="color:#f1c21b;">🌟 New High Score: ${finalScore}</span>
              </div>
              <div style="font-size:0.7rem;color:#999;">Tap to restart</div>
            `;
            if (!submitted) { submitted = true; submitScore(finalScore); }
          } else {
            msgEl.innerHTML = `
              <div style="font-size:1rem;font-weight:700;color:#da1e28;">Game Over!</div>
              <div style="font-size:0.8rem;color:#999;margin:4px 0;">Score: ${finalScore} | Best: ${highScore}</div>
              <div style="font-size:0.7rem;color:#ccc;">Tap to restart</div>
            `;
          }
          lbBtn.style.display = 'block';
          break;
        }
        if (o.x < -30) { o.el.remove(); obstaclesList.splice(i, 1); }
      }
      if (started && frame % 4 === 0) { score++; scoreEl.textContent = score; }
      animId = requestAnimationFrame(gameLoop);
    }

    document.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Space') { e.preventDefault(); jump(); } });
    game.addEventListener('click', jump);
    game.addEventListener('touchstart', (e) => { e.preventDefault(); jump(); }, { passive: false });

    closeBtn.addEventListener('click', () => { overlay.remove(); cancelAnimationFrame(animId); clearInterval(obsTimer); clearInterval(speedTimer); });
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape' && document.getElementById('dino-game-overlay')) { overlay.remove(); cancelAnimationFrame(animId); clearInterval(obsTimer); clearInterval(speedTimer); document.removeEventListener('keydown', esc); } });

    lbBtn.addEventListener('click', async () => {
      lbDiv.style.display = 'block';
      lbBtn.textContent = '✕ Close';
      lbDiv.innerHTML = '<div style="font-size:0.7rem;color:#999;text-align:center;padding:1rem;">Loading...</div>';
      const html = await fetchLeaderboard();
      lbDiv.innerHTML = `
        <div style="font-size:0.9rem;font-weight:700;margin-bottom:8px;">🏆 Leaderboard</div>
        ${html}
        <button id="dino-lb-close" style="margin-top:10px;width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;background:#fff;cursor:pointer;font-size:0.8rem;">Close</button>
      `;
      lbBtn.onclick = () => { lbDiv.style.display = 'none'; lbBtn.textContent = '🏆 Scores'; };
      document.getElementById('dino-lb-close')?.addEventListener('click', () => { lbDiv.style.display = 'none'; lbBtn.textContent = '🏆 Scores'; });
    });

    animId = requestAnimationFrame(gameLoop);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initTapCode);
  else initTapCode();
})();
