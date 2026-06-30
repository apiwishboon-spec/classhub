(function () {
  'use strict';

  // ─── EASTER EGG TRIGGERS ────────────────────────────────────────────
  // Rainbow:  click "MyClassHub" 5 times
  // Arrow:    click version number 3 times
  // Chess:    click help (?) button 7 times

  let rainbowClicks = 0, rainbowTimer = null;
  let arrowClicks = 0, arrowTimer = null;
  let chessClicks = 0, chessTimer = null;

  function initEasterEggs() {
    // -- Rainbow: logo title --
    const logo = document.querySelector('.nav-brand h1');
    if (logo) {
      logo.style.cursor = 'help';
      logo.addEventListener('click', () => {
        rainbowClicks++;
        clearTimeout(rainbowTimer);
        if (rainbowClicks >= 5) {
          rainbowClicks = 0;
          launchRainbow();
        }
        rainbowTimer = setTimeout(() => rainbowClicks = 0, 1200);
      });
    }

    // -- Arrow Swipe: version number --
    const versionEl = document.querySelector('.app-version');
    if (versionEl) {
      versionEl.style.cursor = 'pointer';
      versionEl.addEventListener('click', (e) => {
        e.stopPropagation();
        arrowClicks++;
        clearTimeout(arrowTimer);
        if (arrowClicks >= 3) {
          arrowClicks = 0;
          launchArrowSwipe();
        }
        arrowTimer = setTimeout(() => arrowClicks = 0, 1200);
      });
    }

    // -- Chess: help button (capture phase to intercept before help.js listener) --
    document.body.addEventListener('click', (e) => {
      const btn = e.target.closest('#help-btn');
      if (!btn) return;
      chessClicks++;
      clearTimeout(chessTimer);
      if (chessClicks >= 7) {
        chessClicks = 0;
        e.stopPropagation();
        e.preventDefault();
        launchChess();
        return;
      }
      chessTimer = setTimeout(() => chessClicks = 0, 2000);
    }, true);
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

  // ─── GAME 3 — CHESS ────────────────────────────────────────────────
  function launchChess() {
    const overlay = makeOverlay('game-chess', `
      <div class="gc-modal" style="background:#1a1a1a;border-radius:12px;max-width:700px;width:95%;text-align:center;position:relative;box-shadow:0 20px 60px rgba(0,0,0,0.5);overflow:hidden;">
        <button class="gc-close" style="position:absolute;top:8px;right:14px;background:none;border:none;font-size:1.5rem;cursor:pointer;color:#fff;z-index:10;">✕</button>
        <div style="padding:1rem 0 0;color:#fff;">
          <h3 style="margin:0;font-family:'IBM Plex Sans',sans-serif;">♔ Chess</h3>
          <p style="margin:0.25rem 0 0;font-size:0.75rem;color:#999;">Click a piece, then click where to move — 2-player local</p>
        </div>
        <div style="display:flex;justify-content:center;padding:1rem;">
          <div id="chessboard-container" style="width:480px;max-width:100%;aspect-ratio:1;"></div>
        </div>
        <div id="chess-status" style="color:#aaa;font-size:0.85rem;padding:0 1rem 1rem;">White's turn</div>
      </div>
    `);
    overlay.querySelector('.gc-close').onclick = () => overlay.remove();

    const boardEl = document.getElementById('chessboard-container');
    const statusEl = document.getElementById('chess-status');

    // Simple chess implementation
    const PIECES = {
      'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
      'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
    };

    // Initial board
    let board = [
      ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
      ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
      ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ];
    let turn = 'white';
    let selected = null;

    function isWhite(p) { return p === p.toUpperCase() && p !== ''; }
    function isBlack(p) { return p === p.toLowerCase() && p !== ''; }
    function owner(p) { return isWhite(p) ? 'white' : (isBlack(p) ? 'black' : null); }

    function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

    function cloneBoard(b) { return b.map(row => [...row]); }

    function generateMoves(b, r, c) {
      const p = b[r][c];
      if (!p) return [];
      const moves = [];
      const color = owner(p);
      const type = p.toUpperCase();
      const enemy = color === 'white' ? 'black' : 'white';

      const addIf = (tr, tc) => {
        if (!inBounds(tr, tc)) return false;
        const t = b[tr][tc];
        if (t === '') { moves.push([tr, tc]); return true; }
        if (owner(t) === enemy) { moves.push([tr, tc]); return false; }
        return false;
      };

      if (type === 'P') {
        const dir = color === 'white' ? -1 : 1;
        const startRow = color === 'white' ? 6 : 1;
        if (inBounds(r + dir, c) && b[r + dir][c] === '') {
          moves.push([r + dir, c]);
          if (r === startRow && b[r + 2 * dir][c] === '') moves.push([r + 2 * dir, c]);
        }
        for (const dc of [-1, 1]) {
          const nr = r + dir, nc = c + dc;
          if (inBounds(nr, nc) && owner(b[nr][nc]) === enemy) moves.push([nr, nc]);
        }
      } else if (type === 'N') {
        const offsets = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
        for (const [dr, dc] of offsets) {
          const nr = r + dr, nc = c + dc;
          if (inBounds(nr, nc) && owner(b[nr][nc]) !== color) moves.push([nr, nc]);
        }
      } else if (type === 'B') {
        for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]])
          for (let i = 1; i < 8; i++) if (!addIf(r + dr * i, c + dc * i)) break;
      } else if (type === 'R') {
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]])
          for (let i = 1; i < 8; i++) if (!addIf(r + dr * i, c + dc * i)) break;
      } else if (type === 'Q') {
        for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]])
          for (let i = 1; i < 8; i++) if (!addIf(r + dr * i, c + dc * i)) break;
      } else if (type === 'K') {
        for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]])
          addIf(r + dr, c + dc);
      }
      return moves;
    }

    function isInCheck(b, color) {
      const king = color === 'white' ? 'K' : 'k';
      let kr = -1, kc = -1;
      for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++)
          if (b[r][c] === king) { kr = r; kc = c; }
      if (kr === -1) return true;
      const enemy = color === 'white' ? 'black' : 'white';
      for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++)
          if (owner(b[r][c]) === enemy) {
            const enemyMoves = generateMoves(b, r, c);
            for (const [mr, mc] of enemyMoves)
              if (mr === kr && mc === kc) return true;
          }
      return false;
    }

    function getLegalMoves(b, r, c) {
      const raw = generateMoves(b, r, c);
      const legal = [];
      for (const [tr, tc] of raw) {
        const nb = cloneBoard(b);
        nb[tr][tc] = nb[r][c];
        nb[r][c] = '';
        if (nb[tr][tc].toUpperCase() === 'P' && (tr === 0 || tr === 7))
          nb[tr][tc] = turn === 'white' ? 'Q' : 'q';
        if (!isInCheck(nb, owner(b[r][c]))) legal.push([tr, tc]);
      }
      return legal;
    }

    function hasLegalMoves(b, color) {
      for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++)
          if (owner(b[r][c]) === color && getLegalMoves(b, r, c).length > 0) return true;
      return false;
    }

    function renderBoard() {
      let html = '<table style="border-collapse:collapse;width:100%;aspect-ratio:1;table-layout:fixed;">';
      const squareSize = 60;
      for (let r = 0; r < 8; r++) {
        html += '<tr>';
        for (let c = 0; c < 8; c++) {
          const isLight = (r + c) % 2 === 0;
          const bg = isLight ? '#f0d9b5' : '#b58863';
          const p = board[r][c];
          const isSelected = selected && selected[0] === r && selected[1] === c;
          const isLegal = selected && getLegalMoves(board, selected[0], selected[1]).some(([mr, mc]) => mr === r && mc === c);
          let style = `background:${bg};width:${squareSize}px;height:${squareSize}px;text-align:center;font-size:2rem;cursor:pointer;position:relative;`;
          if (isSelected) style += `outline:3px solid #ff0;outline-offset:-3px;`;
          style += 'box-sizing:border-box;';
          html += `<td class="ch-cell" data-r="${r}" data-c="${c}" style="${style}">`;
          if (p) {
            const pieceColor = isWhite(p) ? '#fff' : '#000';
            html += `<span style="filter:drop-shadow(0 1px 1px rgba(0,0,0,0.3));color:${pieceColor};">${PIECES[p]}</span>`;
          }
          if (isLegal) {
            const isCapture = p !== '';
            if (isCapture)
              html += `<div style="position:absolute;top:0;left:0;width:100%;height:100%;border-radius:50%;background:rgba(0,0,0,0.1);box-sizing:border-box;border:4px solid rgba(0,0,0,0.2);"></div>`;
            else
              html += `<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:12px;height:12px;border-radius:50%;background:rgba(0,0,0,0.25);"></div>`;
          }
          html += '</td>';
        }
        html += '</tr>';
      }
      html += '</table>';
      boardEl.innerHTML = html;

      boardEl.querySelectorAll('.ch-cell').forEach(td => {
        td.addEventListener('click', () => {
          const r = parseInt(td.dataset.r);
          const c = parseInt(td.dataset.c);
          const p = board[r][c];

          if (selected) {
            const [sr, sc] = selected;
            const legal = getLegalMoves(board, sr, sc);
            const isTarget = legal.some(([mr, mc]) => mr === r && mc === c);

            if (isTarget) {
              // Make move
              board[r][c] = board[sr][sc];
              board[sr][sc] = '';
              if (board[r][c].toUpperCase() === 'P' && (r === 0 || r === 7))
                board[r][c] = turn === 'white' ? 'Q' : 'q';
              turn = turn === 'white' ? 'black' : 'white';
              selected = null;

              // Check game state
              if (isInCheck(board, turn)) {
                if (!hasLegalMoves(board, turn)) {
                  statusEl.textContent = `♚ Checkmate! ${turn === 'white' ? 'Black' : 'White'} wins!`;
                  renderBoard();
                  return;
                }
                statusEl.textContent = `${turn === 'white' ? 'White' : 'Black'} is in check!`;
              } else if (!hasLegalMoves(board, turn)) {
                statusEl.textContent = 'Stalemate — Draw!';
              } else {
                statusEl.textContent = `${turn === 'white' ? 'White' : 'Black'}'s turn`;
              }
              renderBoard();
              return;
            }

            // Clicking own piece = reselect
            if (owner(p) === turn) {
              selected = [r, c];
              renderBoard();
              return;
            }
            selected = null;
            renderBoard();
            return;
          }

          if (owner(p) === turn) {
            selected = [r, c];
            renderBoard();
          }
        });
      });
    }

    // Reset
    board = [
      ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
      ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
      ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ];
    turn = 'white';
    selected = null;
    statusEl.textContent = "White's turn";
    renderBoard();
  }

  // ─── BOOT ──────────────────────────────────────────────────────────
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', initEasterEggs);
  else initEasterEggs();
})();
