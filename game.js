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
    const name = localStorage.getItem(PLAYER_NAME_KEY) || 'Anonymous';
    try {
      await addDoc(collection(db, "game_scores"), { name, score: scoreVal, createdAt: serverTimestamp() });
    } catch (e) {}
  }

  function launchGame() {
    if (document.getElementById('dino-game-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'dino-game-overlay';
    overlay.style.cssText = `position:fixed;top:0;left:0;width:100vw;height:100vh;background:var(--bg-color,#f4f4f4);z-index:100000;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;`;

    overlay.innerHTML = `
      <div id="dino-game" style="position:relative;width:600px;max-width:94vw;height:260px;overflow:hidden;background:var(--card-bg,#fff);border:2px solid var(--border-color,#e0e0e0);border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.15);">
        <div id="dino-score" style="position:absolute;top:10px;right:14px;font-size:1.2rem;font-weight:700;color:var(--text-main,#333);z-index:10;">0</div>
        <div id="dino-ground" style="position:absolute;bottom:16px;left:10%;right:10%;height:3px;background:var(--text-secondary,#999);border-radius:2px;"></div>
        <div id="dino-character" style="position:absolute;bottom:16px;left:40px;font-size:2.8rem;line-height:1;z-index:5;user-select:none;">🦖</div>
        <div id="dino-obstacles" style="position:absolute;top:0;left:0;width:100%;height:100%;"></div>
        <div id="dino-msg" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;z-index:20;color:var(--text-main,#333);">
          <div style="font-size:1.2rem;font-weight:700;margin-bottom:4px;">🦖 Dino Runner</div>
          <div style="font-size:0.8rem;color:var(--text-secondary,#999);">Tap / Space to jump</div>
        </div>
        <div id="dino-leaderboard" style="display:none;position:absolute;top:0;left:0;width:100%;height:100%;background:var(--card-bg,#fff);z-index:25;padding:40px 20px 20px;box-sizing:border-box;overflow-y:auto;"></div>
        <div id="dino-name-display" style="position:absolute;bottom:6px;left:10px;font-size:0.65rem;color:var(--text-secondary,#bbb);z-index:10;"></div>
        <button id="dino-close" style="position:absolute;top:4px;left:6px;background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--text-secondary,#999);z-index:30;line-height:1;">✕</button>
        <button id="dino-lb-btn" style="position:absolute;top:4px;right:6px;background:none;border:none;font-size:0.75rem;cursor:pointer;color:var(--text-secondary,#999);z-index:30;display:none;">🏆 Scores</button>
      </div>
    `;

    document.body.appendChild(overlay);

    // Name prompt
    if (!localStorage.getItem(PLAYER_NAME_KEY)) {
      const name = prompt('🏆 Enter your name for the leaderboard:');
      if (name && name.trim()) localStorage.setItem(PLAYER_NAME_KEY, name.trim().slice(0, 15));
      else localStorage.setItem(PLAYER_NAME_KEY, 'Anonymous');
    }
    setTimeout(() => {
      const nd = document.getElementById('dino-name-display');
      if (nd) nd.textContent = '👤 ' + localStorage.getItem(PLAYER_NAME_KEY);
    }, 0);

    const game = document.getElementById('dino-game');
    const dino = document.getElementById('dino-character');
    const obstacles = document.getElementById('dino-obstacles');
    const scoreEl = document.getElementById('dino-score');
    const msgEl = document.getElementById('dino-msg');
    const closeBtn = document.getElementById('dino-close');
    const lbBtn = document.getElementById('dino-lb-btn');
    const lbDiv = document.getElementById('dino-leaderboard');

    let dinoY = 0, velY = 0, score = 0, gameOver = false, started = false;
    let animId = null, obsTimer = null, speedTimer = null;
    let speed = 3.5, frame = 0, submitted = false;
    let obsList = [];
    const GRAVITY = -0.5, JUMP_VEL = 7.5;
    const GROUND_Y = 16;

    dino.style.bottom = GROUND_Y + 'px';

    function jump() {
      if (gameOver) { resetGame(); return; }
      if (!started) {
        started = true; msgEl.style.display = 'none'; lbBtn.style.display = 'none';
        startObs(); startSpeed();
      }
      if (velY !== 0) return;
      velY = JUMP_VEL;
    }

    function spawnObs() {
      if (gameOver) return;
      const obs = document.createElement('div');
      obs.textContent = '🌵';
      obs.style.cssText = `position:absolute;bottom:${GROUND_Y}px;right:-40px;font-size:2rem;line-height:1;z-index:5;user-select:none;`;
      obstacles.appendChild(obs);
      obsList.push({ el: obs, x: 600 });
    }

    function startObs() {
      obsTimer = setInterval(() => {
        if (!gameOver) spawnObs();
      }, 900 + Math.random() * 600);
    }

    function startSpeed() {
      speedTimer = setInterval(() => {
        if (!gameOver && speed < 8) speed += 0.05;
      }, 500);
    }

    function resetGame() {
      gameOver = false; started = false; score = 0; speed = 3.5; submitted = false;
      dinoY = 0; velY = 0; dino.style.bottom = GROUND_Y + 'px';
      obsList.forEach(o => o.el.remove()); obsList = [];
      scoreEl.textContent = '0'; clearInterval(obsTimer); clearInterval(speedTimer);
      lbBtn.style.display = 'none'; lbDiv.style.display = 'none';
      msgEl.style.display = 'block';
      msgEl.innerHTML = `<div style="font-size:1.2rem;font-weight:700;margin-bottom:4px;">🦖 Dino Runner</div><div style="font-size:0.8rem;color:var(--text-secondary,#999);">Tap / Space to jump</div>`;
    }

    function gameLoop() {
      if (gameOver) { animId = requestAnimationFrame(gameLoop); return; }
      frame++;

      // Physics
      if (velY !== 0 || dinoY > 0) {
        dinoY += velY;
        velY += GRAVITY;
        if (dinoY <= 0) { dinoY = 0; velY = 0; }
        dino.style.bottom = (GROUND_Y + dinoY) + 'px';
      }

      // Scroll obstacles
      for (let i = obsList.length - 1; i >= 0; i--) {
        const o = obsList[i];
        o.x -= speed;
        o.el.style.right = (600 - o.x) + 'px';

        // Collision (simple bounding box)
        const DINOX = 40, DINOW = 44, DINOH = 44;
        if (o.x < DINOX + DINOW - 8 && o.x + 32 > DINOX + 8 && dinoY < 40) {
          gameOver = true; clearInterval(obsTimer); clearInterval(speedTimer);
          dino.style.transform = 'rotate(90deg)';
          const finalScore = score;
          msgEl.style.display = 'block';
          const highScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
          const isNew = finalScore > highScore;
          if (isNew) {
            localStorage.setItem(HIGH_SCORE_KEY, finalScore);
            msgEl.innerHTML = `<div style="font-size:1rem;font-weight:700;color:#da1e28;">Game Over!</div>
              <div style="font-size:0.8rem;margin:4px 0;"><span style="color:#f1c21b;">🌟 New: ${finalScore}</span></div>
              <div style="font-size:0.7rem;color:var(--text-secondary,#999);">Tap to restart</div>`;
            if (!submitted) { submitted = true; submitScore(finalScore); }
          } else {
            msgEl.innerHTML = `<div style="font-size:1rem;font-weight:700;color:#da1e28;">Game Over!</div>
              <div style="font-size:0.8rem;color:var(--text-secondary,#999);margin:4px 0;">Score: ${finalScore} | Best: ${highScore}</div>
              <div style="font-size:0.7rem;color:var(--text-secondary,#ccc);">Tap to restart</div>`;
          }
          lbBtn.style.display = 'block';
          break;
        }
        if (o.x < -50) { o.el.remove(); obsList.splice(i, 1); }
      }

      if (started && frame % 5 === 0) { score++; scoreEl.textContent = score; }
      animId = requestAnimationFrame(gameLoop);
    }

    document.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Space') { e.preventDefault(); jump(); } });
    game.addEventListener('click', jump);
    game.addEventListener('touchstart', (e) => { e.preventDefault(); jump(); }, { passive: false });

    closeBtn.addEventListener('click', () => { overlay.remove(); cancelAnimationFrame(animId); clearInterval(obsTimer); clearInterval(speedTimer); });
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape' && document.getElementById('dino-game-overlay')) { overlay.remove(); cancelAnimationFrame(animId); clearInterval(obsTimer); clearInterval(speedTimer); document.removeEventListener('keydown', esc); } });

    lbBtn.addEventListener('click', async () => {
      lbDiv.style.display = 'block';
      lbDiv.innerHTML = '<div style="font-size:0.7rem;color:var(--text-secondary,#999);text-align:center;padding:1rem;">Loading...</div>';
      const html = await fetchLeaderboard();
      lbDiv.innerHTML = `<div style="font-size:0.9rem;font-weight:700;margin-bottom:8px;">🏆 Leaderboard</div>${html}
        <button id="dino-lb-close" style="margin-top:10px;width:100%;padding:6px;border:1px solid var(--border-color,#ddd);border-radius:4px;background:var(--card-bg,#fff);cursor:pointer;font-size:0.8rem;">Close</button>`;
      document.getElementById('dino-lb-close')?.addEventListener('click', () => { lbDiv.style.display = 'none'; });
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
