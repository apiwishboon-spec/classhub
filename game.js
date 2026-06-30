(function () {
  'use strict';

  // ─── EASTER EGG TRIGGERS ────────────────────────────────────────────
  // Rainbow:  click "MyClassHub" 3 times
  // Arrow:    click commit hash once
  // Chess:    click search icon 4 times

  let rainbowClicks = 0, rainbowTimer = null;
  let chessClicks = 0, chessTimer = null;

  function initEasterEggs() {
    // -- Rainbow: logo title --
    const logo = document.querySelector('.nav-brand h1');
    if (logo) {
      logo.style.cursor = 'help';
      logo.addEventListener('click', () => {
        rainbowClicks++;
        clearTimeout(rainbowTimer);
        if (rainbowClicks >= 3) {
          rainbowClicks = 0;
          launchRainbow();
        }
        rainbowTimer = setTimeout(() => rainbowClicks = 0, 1200);
      });
    }

    // -- Arrow Swipe: commit hash in footer --
    const commitEl = document.querySelector('.commit-hash');
    if (commitEl) {
      commitEl.addEventListener('click', () => {
        launchArrowSwipe();
      });
    }

    // -- Chess: search icon --
    const searchIcon = document.querySelector('.search-icon');
    if (searchIcon) {
      searchIcon.style.cursor = 'pointer';
      searchIcon.addEventListener('click', (e) => {
        chessClicks++;
        clearTimeout(chessTimer);
        if (chessClicks >= 4) {
          chessClicks = 0;
          e.stopPropagation();
          e.preventDefault();
          launchChess();
          return;
        }
        chessTimer = setTimeout(() => chessClicks = 0, 2000);
      });
    }
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────
  let _cleanup = null;
  function makeOverlay(id, html, cleanup) {
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    const o = document.createElement('div');
    o.id = id;
    o.className = 'game-overlay';
    o.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:10000;';
    o.innerHTML = html;
    _cleanup = cleanup || null;
    o.addEventListener('click', (e) => {
      if (e.target === o) {
        if (_cleanup) { _cleanup(); _cleanup = null; }
        o.remove();
      }
    });
    document.body.appendChild(o);
    return o;
  }

  // ─── GAME 1 — FIND THE RAINBOW ──────────────────────────────────────
  let rainbowGameOver = false;
  let rainbowBox = null;

  function launchRainbow() {
    const overlay = makeOverlay('game-rainbow', `
      <div class="gr-modal" style="background:#ffb6c1;border-radius:12px;padding:1.5rem;max-width:540px;width:95%;text-align:center;font-family:'IBM Plex Sans',sans-serif;position:relative;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <button class="gr-close" style="position:absolute;top:8px;right:12px;background:none;border:none;font-size:1.4rem;cursor:pointer;color:#333;">✕</button>
        <div id="gr-play-box" style="background:#00f;color:#ff0;padding:2rem 1.5rem;margin-bottom:1rem;border-radius:8px;">
          <h2 style="margin:0 0 0.5rem;font-size:1.6rem;">Find the Rainbow</h2>
          <p style="margin:0 0 1rem;font-size:0.9rem;">Press the buttons until you find it!</p>
          <button id="gr-play-btn" style="background:#ff0;color:#00f;border:none;padding:0.5rem 1rem;font-weight:700;font-size:1rem;border-radius:4px;cursor:pointer;">Play now</button>
        </div>
        <div id="gr-grid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;max-width:400px;margin:0 auto;"></div>
        <p id="gr-status" style="margin-top:0.75rem;font-size:0.85rem;color:#666;">&nbsp;</p>
      </div>
    `);
    overlay.querySelector('.gr-close').onclick = () => overlay.remove();

    const grid = document.getElementById('gr-grid');
    const playBox = document.getElementById('gr-play-box');
    const playBtn = document.getElementById('gr-play-btn');
    const statusEl = document.getElementById('gr-status');
    const GRID_SIZE = 25;
    let btns = [];

    function buildGrid() {
      grid.innerHTML = '';
      btns = [];
      for (let i = 0; i < GRID_SIZE; i++) {
        const cell = document.createElement('div');
        const btn = document.createElement('button');
        btn.className = 'gr-btn';
        btn.style.cssText =
          'width:100%;aspect-ratio:1;background:#ff0;border:3px solid #00f;cursor:pointer;position:relative;transition:all 0.1s;border-radius:2px;';
        btn.innerHTML = '<span style="font-size:0;">🌈</span>';
        btn.dataset.idx = i;
        cell.appendChild(btn);
        grid.appendChild(cell);
        btns.push(btn);
      }
    }

    function resetGame() {
      rainbowGameOver = false;
      rainbowBox = null;
      btns.forEach(b => {
        b.style.background = '#ff0';
        b.style.cursor = 'pointer';
        b.querySelector('span').textContent = '';
        b.querySelector('span').style.fontSize = '0';
        b.disabled = false;
      });
    }

    function hideBox() { playBox.style.display = 'none'; }
    function showBox() { playBox.style.display = 'block'; }

    function placeRainbow() {
      const idx = Math.floor(Math.random() * GRID_SIZE);
      rainbowBox = idx;
      btns[idx].querySelector('span').textContent = '🌈';
      btns.forEach(b => {
        b.onclick = () => {
          if (rainbowGameOver) return;
          b.style.background = '#00f';
          b.disabled = true;
          const span = b.querySelector('span');
          if (span.textContent === '🌈') {
            span.style.fontSize = '2rem';
            rainbowGameOver = true;
            btns.forEach(x => { x.disabled = true; x.onclick = null; });
            statusEl.textContent = '🌈 You found it! Play again in 3s...';
            setTimeout(() => {
              resetGame();
              placeRainbow();
              showBox();
              statusEl.textContent = 'Click Play now!';
            }, 3000);
          }
        };
      });
    }

    playBtn.onclick = () => {
      resetGame();
      placeRainbow();
      hideBox();
      statusEl.textContent = 'Find the rainbow!';
    };

    buildGrid();
    statusEl.textContent = 'Click Play now!';
  }

  // ─── GAME 2 — ARROW SWIPE ──────────────────────────────────────────
  function launchArrowSwipe() {
    function cleanupArrowSwipe() { gameActive = false; if (animFrame) cancelAnimationFrame(animFrame); animFrame = null; }
    const overlay = makeOverlay('game-arrow', `
      <div class="ga-modal" style="background:#fff;border-radius:12px;padding:1.5rem;max-width:400px;width:95%;text-align:center;font-family:'IBM Plex Sans',sans-serif;position:relative;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <button class="ga-close" style="position:absolute;top:8px;right:12px;background:none;border:none;font-size:1.4rem;cursor:pointer;color:#333;">✕</button>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
          <h3 style="margin:0;">⬡ Swipe</h3>
          <button id="ga-restart" style="background:#ccc;border:none;border-radius:4px;padding:6px 10px;cursor:pointer;font-size:0.85rem;">↻ Restart</button>
        </div>
        <div id="ga-progress-bg" style="width:100%;height:8px;background:#ccc;border-radius:4px;margin-bottom:0.5rem;">
          <div id="ga-progress" style="width:100%;height:8px;background:#00cc99;border-radius:4px;transition:width 0.3s;"></div>
        </div>
        <div style="font-size:2.5rem;font-weight:700;margin-bottom:0.5rem;user-select:none;" id="ga-score">0</div>
        <div id="ga-arrow-area" style="min-height:220px;display:flex;align-items:center;justify-content:center;background:#f5f5f5;border-radius:8px;cursor:pointer;user-select:none;touch-action:none;">
          <i id="ga-arrow-icon" class="ph ph-arrow-circle-up" style="font-size:160px;"></i>
        </div>
        <p style="margin-top:0.75rem;font-size:0.75rem;color:#999;">Blue = follow · Red = reverse · swipe the correct way!</p>
      </div>
    `, cleanupArrowSwipe);
    overlay.querySelector('.ga-close').onclick = () => { cleanupArrowSwipe(); overlay.remove(); }; _cleanup = null;

    const dirs = ['up', 'right', 'down', 'left'];
    const arrowArea = document.getElementById('ga-arrow-area');
    const arrowIcon = document.getElementById('ga-arrow-icon');
    const scoreEl = document.getElementById('ga-score');
    const progressEl = document.getElementById('ga-progress');
    const restartBtn = document.getElementById('ga-restart');

    let score = 0, direction, isReverse, gameActive = true;
    const GAME_DURATION = 30000;
    let startTime = Date.now();
    let animFrame;
    let startX = 0, startY = 0;

    function getRandomInt(max) { return Math.floor(Math.random() * max); }

    function nextArrow() {
      direction = dirs[getRandomInt(4)];
      isReverse = getRandomInt(2);
      const color = isReverse ? '#ff6384' : '#36a2eb';
      const phIcon = 'ph-arrow-circle-' + direction;
      arrowIcon.className = 'ph ' + phIcon;
      arrowIcon.style.color = color;
    }

    function correctDir() {
      if (!isReverse) return direction;
      const m = { up: 'down', down: 'up', left: 'right', right: 'left' };
      return m[direction];
    }

    function checkSwipe(ex, ey) {
      if (!gameActive) return;
      const expected = correctDir();
      let correct = false;
      if (expected === 'up' && ey < startY) correct = true;
      else if (expected === 'down' && ey > startY) correct = true;
      else if (expected === 'right' && ex > startX) correct = true;
      else if (expected === 'left' && ex < startX) correct = true;

      if (correct) {
        score += 10;
        scoreEl.textContent = score;
        nextArrow();
      } else {
        score = Math.max(0, score - 10);
        scoreEl.textContent = score;
      }
      startX = startY = 0;
    }

    function endGame() {
      gameActive = false;
      cancelAnimationFrame(animFrame);
      arrowArea.innerHTML = `
        <div style="text-align:center;">
          <div style="font-size:3rem;font-weight:700;">${score}</div>
          <div style="font-size:1rem;color:#666;">final score</div>
          <button id="ga-play-again" style="margin-top:1rem;background:#333;color:#fff;border:none;padding:0.5rem 1.5rem;border-radius:6px;cursor:pointer;">Play Again</button>
        </div>
      `;
      document.getElementById('ga-play-again').onclick = () => { overlay.remove(); launchArrowSwipe(); };
    }

    function updateTimer() {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, GAME_DURATION - elapsed);
      const pct = (remaining / GAME_DURATION) * 100;
      progressEl.style.width = pct + '%';
      if (pct <= 10) progressEl.style.background = '#ff3300';
      else if (pct <= 25) progressEl.style.background = '#ff9f40';
      else progressEl.style.background = '#00cc99';
      if (remaining <= 0) { endGame(); return; }
      animFrame = requestAnimationFrame(updateTimer);
    }

    // Mouse events
    arrowArea.addEventListener('mousedown', (e) => {
      startX = e.screenX; startY = e.screenY;
    });
    arrowArea.addEventListener('mouseup', (e) => {
      if (startX === 0 && startY === 0) return;
      checkSwipe(e.screenX, e.screenY);
      startX = startY = 0;
    });
    // Touch events
    arrowArea.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      startX = t.screenX; startY = t.screenY;
    }, { passive: true });
    arrowArea.addEventListener('touchend', (e) => {
      if (startX === 0 && startY === 0) return;
      const t = e.changedTouches[0];
      checkSwipe(t.screenX, t.screenY);
      startX = startY = 0;
    }, { passive: true });

    restartBtn.onclick = () => { overlay.remove(); launchArrowSwipe(); };

    nextArrow();
    startTime = Date.now();
    gameActive = true;
    score = 0;
    scoreEl.textContent = '0';
    updateTimer();
  }

  // ─── GAME 3 — CHESS (CodePen embed) ─────────────────────────────────
  function launchChess() {
    const overlay = makeOverlay('game-chess', `
      <div class="gc-modal" style="background:#1a1a1a;border-radius:12px;max-width:560px;width:95%;text-align:center;position:relative;box-shadow:0 20px 60px rgba(0,0,0,0.5);overflow:hidden;">
        <button class="gc-close" style="position:absolute;top:8px;right:14px;background:none;border:none;font-size:1.5rem;cursor:pointer;color:#fff;z-index:10;">✕</button>
        <div style="padding:0.75rem 0 0;color:#fff;">
          <h3 style="margin:0;font-family:'IBM Plex Sans',sans-serif;">♔ Chess</h3>
        </div>
        <div style="display:flex;justify-content:center;padding:0;margin-top:0.25rem;">
          <iframe src="https://codepen.io/jak_e/embed/JjRGQPY" style="width:100%;height:520px;border:none;overflow:hidden;" scrolling="no" title="Chess"></iframe>
        </div>
      </div>
    `);
    overlay.querySelector('.gc-close').onclick = () => overlay.remove();
  }

  // ─── BOOT ──────────────────────────────────────────────────────────
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', initEasterEggs);
  else initEasterEggs();
})();
