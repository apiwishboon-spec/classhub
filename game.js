/* Secret Dino Runner — Tap the logo 5 times fast to unlock */

(function() {
  const TAP_TIMEOUT = 800;
  let tapCount = 0;
  let tapTimer = null;

  // Attach to logo/title
  function initTapCode() {
    const target = document.querySelector('.nav-brand h1') || document.querySelector('.nav-brand') || document.querySelector('h1');
    if (!target) return;

    target.addEventListener('click', (e) => {
      tapCount++;
      if (tapTimer) clearTimeout(tapTimer);
      if (tapCount >= 5) {
        tapCount = 0;
        launchGame();
        return;
      }
      tapTimer = setTimeout(() => { tapCount = 0; }, TAP_TIMEOUT);
    });

    // Make cursor pointer to hint it's clickable
    target.style.cursor = 'pointer';
  }

  function launchGame() {
    if (document.getElementById('dino-game-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'dino-game-overlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: #f7f7f7; z-index: 100000; display: flex;
      align-items: center; justify-content: center;
      font-family: 'IBM Plex Sans', monospace;
    `;

    overlay.innerHTML = `
      <div id="dino-game" style="position: relative; width: 600px; max-width: 96vw; height: 250px; overflow: hidden; background: #fff; border: 2px solid #e0e0e0; border-radius: 8px; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
        <div id="dino-score" style="position: absolute; top: 12px; right: 16px; font-size: 1.2rem; font-weight: 700; color: #535353; z-index: 10;">0</div>
        <div id="dino-highscore" style="position: absolute; top: 12px; right: 100px; font-size: 0.8rem; font-weight: 600; color: #999; z-index: 10;">HI: 0</div>
        <div id="dino-ground" style="position: absolute; bottom: 0; width: 100%; height: 2px; background: #535353;"></div>
        <div id="dino-character" style="position: absolute; bottom: 0; left: 40px; width: 30px; height: 40px; z-index: 5; transition: none;">
          <div style="width:100%;height:100%;background:#535353;border-radius:4px 4px 2px 2px;position:relative;">
            <div style="position:absolute;top:-6px;left:4px;width:8px;height:6px;background:#535353;border-radius:3px 3px 0 0;"></div>
            <div style="position:absolute;top:2px;right:-4px;width:6px;height:6px;background:#fff;border-radius:50%;border:2px solid #535353;"></div>
          </div>
        </div>
        <div id="dino-obstacles" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></div>
        <div id="dino-msg" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; z-index: 20; color: #535353;">
          <div style="font-size: 1rem; font-weight: 700; margin-bottom: 6px;">🏃 Dino Runner</div>
          <div style="font-size: 0.8rem; color: #999;">Tap / Space to jump</div>
        </div>
        <button id="dino-close" style="position: absolute; top: 6px; left: 8px; background: none; border: none; font-size: 1.3rem; cursor: pointer; color: #999; z-index: 20; line-height: 1;">✕</button>
      </div>
    `;

    document.body.appendChild(overlay);

    const game = document.getElementById('dino-game');
    const dino = document.getElementById('dino-character');
    const obstacles = document.getElementById('dino-obstacles');
    const scoreEl = document.getElementById('dino-score');
    const hiEl = document.getElementById('dino-highscore');
    const msgEl = document.getElementById('dino-msg');
    const closeBtn = document.getElementById('dino-close');

    const HIGH_SCORE_KEY = 'dino_highscore';
    let highScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY)) || 0;
    hiEl.textContent = 'HI: ' + highScore;

    let isJumping = false;
    let jumpVel = 0;
    let dinoBottom = 0;
    let score = 0;
    let gameOver = false;
    let started = false;
    let animId = null;
    let obsTimer = null;
    let speedTimer = null;
    let speed = 5;
    let obstaclesList = [];
    let frame = 0;
    const GRAVITY = -0.6;
    const JUMP_FORCE = 10;
    const DINO_WIDTH = 30;
    const DINO_HEIGHT = 40;
    const GROUND_Y = 0;
    const GAME_WIDTH = 600;
    const GAME_HEIGHT = 250;
    let minObsInterval = 60;

    dino.style.bottom = '0px';
    dino.style.left = '40px';

    // Dark mode support
    if (document.documentElement.hasAttribute('data-theme')) {
      overlay.style.background = '#1a1a1a';
      game.style.background = '#222';
      game.style.borderColor = '#444';
    }

    function jump() {
      if (gameOver) {
        resetGame();
        return;
      }
      if (!started) {
        started = true;
        msgEl.style.display = 'none';
        startObstacles();
        startSpeedUp();
      }
      if (isJumping) return;
      isJumping = true;
      jumpVel = JUMP_FORCE;
    }

    function spawnObstacle() {
      if (gameOver) return;
      const obs = document.createElement('div');
      const h = 20 + Math.random() * 20;
      obs.style.cssText = `
        position: absolute; bottom: 0; right: -20px; width: 16px; height: ${h}px;
        background: #535353; border-radius: 3px 3px 0 0; z-index: 5;
      `;
      obstacles.appendChild(obs);
      obstaclesList.push({ el: obs, x: GAME_WIDTH, w: 16, h });
    }

    function startObstacles() {
      obsTimer = setInterval(() => {
        if (gameOver) return;
        spawnObstacle();
        // Gradually reduce interval
        minObsInterval = Math.max(25, minObsInterval - 0.3);
      }, Math.max(minObsInterval, 400 + Math.random() * 300));
    }

    function startSpeedUp() {
      speedTimer = setInterval(() => {
        if (gameOver) return;
        speed += 0.1;
      }, 500);
    }

    function resetGame() {
      gameOver = false;
      started = false;
      score = 0;
      speed = 5;
      minObsInterval = 60;
      dinoBottom = 0;
      dino.style.bottom = '0px';
      obstaclesList.forEach(o => o.el.remove());
      obstaclesList = [];
      scoreEl.textContent = '0';
      msgEl.style.display = 'block';
      dino.style.transform = '';
      clearInterval(obsTimer);
      clearInterval(speedTimer);
      isJumping = false;
      jumpVel = 0;
    }

    function gameLoop() {
      if (gameOver) {
        animId = requestAnimationFrame(gameLoop);
        return;
      }
      frame++;

      // Physics
      if (isJumping) {
        dinoBottom += jumpVel;
        jumpVel += GRAVITY;
        if (dinoBottom <= 0) {
          dinoBottom = 0;
          isJumping = false;
          jumpVel = 0;
        }
        dino.style.bottom = dinoBottom + 'px';
      }

      // Scroll obstacles
      for (let i = obstaclesList.length - 1; i >= 0; i--) {
        const o = obstaclesList[i];
        o.x -= speed;
        o.el.style.right = (GAME_WIDTH - o.x) + 'px';

        // Collision
        const dinoLeft = 40;
        const dinoRight = 40 + DINO_WIDTH;
        const obsLeft = o.x;
        const obsRight = o.x + o.w;
        const obsTop = o.h;
        const dinoTop = dinoBottom + DINO_HEIGHT;

        if (dinoRight > obsLeft + 4 && dinoLeft < obsRight - 4 && dinoBottom < obsTop && dinoTop > 0) {
          gameOver = true;
          clearInterval(obsTimer);
          clearInterval(speedTimer);
          const finalScore = score;
          if (finalScore > highScore) {
            highScore = finalScore;
            localStorage.setItem(HIGH_SCORE_KEY, highScore);
            hiEl.textContent = 'HI: ' + highScore;
          }
          msgEl.style.display = 'block';
          msgEl.innerHTML = `
            <div style="font-size: 1rem; font-weight: 700; color: #da1e28;">Game Over!</div>
            <div style="font-size: 0.8rem; color: #999; margin: 4px 0;">Score: ${finalScore}</div>
            <div style="font-size: 0.7rem; color: #ccc;">Tap / Space to restart</div>
          `;
          dino.style.transform = 'rotate(90deg)';
          dino.style.transformOrigin = 'bottom center';
          break;
        }

        // Remove off-screen
        if (o.x < -30) {
          o.el.remove();
          obstaclesList.splice(i, 1);
        }
      }

      // Update score (runs regardless of obstacles)
      if (started && frame % 4 === 0) {
        score++;
        scoreEl.textContent = score;
      }

      animId = requestAnimationFrame(gameLoop);
    }

    // Controls
    document.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Space') {
        e.preventDefault();
        jump();
      }
    });

    game.addEventListener('click', jump);
    game.addEventListener('touchstart', (e) => {
      e.preventDefault();
      jump();
    }, { passive: false });

    closeBtn.addEventListener('click', () => {
      overlay.remove();
      cancelAnimationFrame(animId);
      clearInterval(obsTimer);
      clearInterval(speedTimer);
    });

    // Close on Escape
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape' && document.getElementById('dino-game-overlay')) {
        overlay.remove();
        cancelAnimationFrame(animId);
        clearInterval(obsTimer);
        clearInterval(speedTimer);
        document.removeEventListener('keydown', esc);
      }
    });

    animId = requestAnimationFrame(gameLoop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTapCode);
  } else {
    initTapCode();
  }
})();
