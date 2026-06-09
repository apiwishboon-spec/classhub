(function() {
  'use strict';
  
  // Base64 assets from the authentic Chromium source
  const ASSETS = {
    TREX: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQgAAAAvAgMAAABiRrxWAAAADFBMVEX///9TU1P39/f///+TS9URAAAAAXRSTlMAQObYZgAAAPpJREFUeF7d0jFKRkEMhdGLMM307itNLALyVmHvJuzTDMjdn72E95PGFEZSmeoU4YMMgxhskvQec8YSVFX1NhGcS5ywtbmC8khcZeKq+ZWJ4F8Sr2+ZCErjkJFEfcjAc/6/BMlfcz6xHdhRthYzIZhIHMcTVY1scUUiAphK8CMSPUbieTBhvD9Lj0vyV4wklEGzHpciKGOJoBp7XDcFs4RWxxM7Ey3iZ8JbzASAvMS7XLOJHTTvEkEZSeQl7DMuwVyCasqK5+XzQRYLUJlMbPXjFcn3m8eKBSjWZMJwvGIOvViAzCbUj1VEDoqFOEQGE3SyInJQLOQMJL4B7enP1UbLXJQAAAAASUVORK5CYII=',
    HORIZON: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABLAAAAAMAgMAAAAPCKxBAAAABlBMVEX///9TU1NYzE1OAAAAAXRSTlMAQObYZgAAALJJREFUeF7t1EEKAyEMhtEvMNm7sPfJEVyY+1+ltLgYAsrQCtWhbxEhQvgxIJtSZypxa/WGshgzKdbq/UihMFMlt3o/CspEYoihIMaAb6mCvM6C+BTAeyo+wN4yykV/6pVfkdLpVyI1hh7GJ6QunUoLEQlQglNP2nkQkeF8+ei9cLxMue1qxVRfk1Ej0s6AEGWfVOk0QUtnK5Xo0Lac6wpdtnQqB6VxomPaz+dgF1PaqqmeWJlz1jYUaSIAAAAASUVORK5CYII=',
    OBSTACLE_SMALL: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGYAAAAjCAMAAABRlI+PAAAADFBMVEX////////39/dTU1PhglcSAAAAAXRSTlMAQObYZgAAAPNJREFUeF7tlkEKwzAMBLXr//+5iQhU7gRRQkyhZI+DhwH74jhmO+oIJBVwURljuAXagG5QqkSgBLqg3JnxJ1Cb8SmQ3o6gpO85owGlOB4m2BNKJ11BSd01owGlOHkcIAuHkz6UNpPKgozPM54dADHjJuNhZiJxdQCQgZJeBczgCAAy3yhPJvcnmdC9mZwBIsQMFV5AkzHBNknFgcKM+oyDIFcfCAoy03m+jSMIcmoVZkKqSjr1fghyahRmoKRUHYLiSI1SMlCq5CDgX6BXmKkfn+oQ0KEyyrzoy8GbXJ9xrM/YjhUZgl9nnsyTCe9rgSRdV15CwRcIEu8GGQAAAABJRU5ErkJggg==',
    OBSTACLE_LARGE: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJYAAAAyCAMAAACJUtIoAAAACVBMVEX////39/dTU1OabbyfAAAAAXRSTlMAQObYZgAAAXhJREFUeF7t2NGqAjEMANGM///RlwvaYQndULuFPJgHUYaEI6IPhgNAOA8HZ+3U6384F5y1U6YzAZTWG+dZamnFEstBFtCKJZSHWMADLJ18z+JqpQeLdKoDC8siC5iFCQs4znIxB5B1t6F3lQWkL4N0JsF+u6GXJdbI+FKW+yWr3lhgCZ2VSag3Nlk/FnRkIRbasLCO0oulikMsvmGpeiGLZ1jOMgtIP5bODivYYUXEIVbwFCt4khVssRgsgidZwQaLd2A8m7MYLGTl4KeQQs2y4kMAMGGlmQViDIb5O6xZnnLD485dIBzqDSE1yyFdL4Iqu4XJqUUWl/NVAFSZq1P6a5aqbAUM2epQbBioWflUBABiUyhYyZoCBev8XyMAObDNOhOAfiywishVssRgsgllNGBphGjFCjA3YkUn1o/1Y3EkZFZ5isCC6NUgwDBn1RuXH96doNfAhDXfsIyJ2AnolcCVhay0kcYbW0HvCO8OwIcJ3GzkORpkFuUP/1Ec8FW1qJkAAAAASUVORK5CYII=',
    CLOUD: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC4AAAAOCAQAAAD6HOaKAAAAU0lEQVR4XrWSsQkAQAgD3X9El/ELixQpJHCfdApnUCtXz7o49cgagaGPaq4rIwAP9s/C7R7UX3inJ0BDb6qWDC7ScOR/QWjRlFizuPwLtTLj+wqH6DjD2wLtikUAAAAASUVORK5CYII='
  };

  let tapCount = 0;
  let tapTimer = null;

  function launchTrex() {
    if (document.getElementById('trex-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'trex-overlay';
    overlay.innerHTML = `
      <button id="trex-close" title="Close Game" style="position: absolute; top: 1.5rem; right: 1.5rem; background: transparent; border: none; cursor: pointer; font-size: 24px; color: #535353;">✕</button>
      <div id="trex-game-holder" style="width: 600px; max-width: 95vw; background: #fff; border-radius: var(--md-shape-corner-extra-large); overflow: hidden; box-shadow: var(--md-elevation-3); padding: 24px; position: relative; border: 1px solid var(--md-sys-color-outline-variant);">
        <h3 class="title-large" style="text-align: center; margin: 0 0 15px 0; color: #535353; font-weight: 700;">T-Rex Runner</h3>
        <canvas id="trex-canvas" width="600" height="150" style="display: block; width: 100%; height: auto; background: #f7f7f7; border-radius: var(--md-shape-corner-medium); cursor: pointer;"></canvas>
        <div style="text-align: center; margin-top: 15px; color: #757575; font-size: 0.85rem;">
          Press <b>Space</b> or <b>Tap Canvas</b> to Jump · Avoid the cacti!
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const canvas = document.getElementById('trex-canvas');
    const ctx = canvas.getContext('2d');
    const closeBtn = document.getElementById('trex-close');
    closeBtn.onclick = () => {
      cancelAnimationFrame(animId);
      overlay.remove();
    };

    // Game State
    let gameActive = false;
    let score = 0;
    let speed = 7;
    let groundX = 0;
    let trexY = 0;
    let trexVelocity = 0;
    let obstacles = [];
    let animId;

    const gravity = 0.65;
    const jumpStrength = -11;

    // Load images
    const images = {};
    Object.entries(ASSETS).forEach(([key, src]) => {
      const img = new Image();
      img.src = src;
      images[key] = img;
    });

    function reset() {
      score = 0;
      speed = 7;
      groundX = 0;
      trexY = 0;
      trexVelocity = 0;
      obstacles = [];
      gameActive = true;
    }

    function spawnObstacle() {
      const type = Math.random() > 0.5 ? 'LARGE' : 'SMALL';
      const minGap = 350 + (speed * 10);
      if (obstacles.length > 0 && (600 - obstacles[obstacles.length-1].x) < minGap) return;

      obstacles.push({
        x: 600,
        type: type,
        width: type === 'LARGE' ? 50 : 34,
        height: type === 'LARGE' ? 50 : 35
      });
    }

    function update() {
      if (!gameActive) return;

      groundX -= speed;
      if (groundX <= -600) groundX = 0;

      trexVelocity += gravity;
      trexY += trexVelocity;
      if (trexY > 0) {
        trexY = 0;
        trexVelocity = 0;
      }

      if (Math.random() < 0.02) {
        spawnObstacle();
      }

      obstacles.forEach((obs) => {
        obs.x -= speed;
        const trexBox = { x: 50, y: 80 + trexY, w: 30, h: 40 };
        const obsBox = { x: obs.x + 5, y: (obs.type === 'LARGE' ? 80 : 95) + 5, w: obs.width - 10, h: obs.height - 5 };
        
        if (trexBox.x < obsBox.x + obsBox.w &&
            trexBox.x + trexBox.w > obsBox.x &&
            trexBox.y < obsBox.y + obsBox.h &&
            trexBox.y + trexBox.h > obsBox.y) {
          gameActive = false;
        }
      });
      obstacles = obstacles.filter(o => o.x > -100);

      score++;
      if (score % 250 === 0) speed += 0.2;
    }

    function draw() {
      ctx.clearRect(0, 0, 600, 150);

      // Ground
      ctx.drawImage(images.HORIZON, Math.round(groundX), 127, 600, 12);
      ctx.drawImage(images.HORIZON, Math.round(groundX + 600), 127, 600, 12);

      // Trex
      let trexFrame = 0;
      if (gameActive) {
        if (trexY < 0) trexFrame = 0;
        else trexFrame = Math.floor(score / 8) % 2 === 0 ? 88 : 132;
      } else {
        trexFrame = score === 0 ? 0 : 220;
      }
      
      ctx.drawImage(images.TREX, trexFrame, 0, 44, 47, 50, Math.round(80 + trexY), 44, 47);

      // Obstacles
      obstacles.forEach(obs => {
        const img = obs.type === 'LARGE' ? images.OBSTACLE_LARGE : images.OBSTACLE_SMALL;
        ctx.drawImage(img, Math.round(obs.x), obs.type === 'LARGE' ? 80 : 95, obs.width, obs.height);
      });

      // Score
      ctx.fillStyle = '#535353';
      ctx.font = '16px "Courier New", Courier, monospace';
      ctx.textAlign = 'right';
      ctx.fillText(String(score).padStart(5, '0'), 580, 25);

      if (!gameActive && score > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(0, 0, 600, 150);
        ctx.fillStyle = '#535353';
        ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('G A M E  O V E R', 300, 65);
        ctx.font = '14px Arial';
        ctx.fillText('Press Space or Tap to Restart', 300, 95);
      } else if (!gameActive) {
        ctx.fillStyle = '#535353';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Ready to Run? Press Space', 300, 75);
      }
    }

    function loop() {
      update();
      draw();
      animId = requestAnimationFrame(loop);
    }

    window.onkeydown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (!gameActive) reset();
        else if (trexY === 0) trexVelocity = jumpStrength;
      }
    };
    canvas.onclick = () => {
      if (!gameActive) reset();
      else if (trexY === 0) trexVelocity = jumpStrength;
    };

    loop();
  }

  function initEasterEgg() {
    // Check multiple header selectors for M3 redesign compatibility
    const targets = [
      '.sidebar-header h2',
      '.mobile-top-left h1',
      '.nav-brand h1',
      '.nav-brand'
    ];
    
    let logo = null;
    for (const selector of targets) {
      logo = document.querySelector(selector);
      if (logo) break;
    }
    
    if (!logo) return;

    logo.style.cursor = 'help';
    logo.addEventListener('click', () => {
      tapCount++;
      clearTimeout(tapTimer);
      if (tapCount >= 5) {
        tapCount = 0;
        launchTrex();
      }
      tapTimer = setTimeout(() => tapCount = 0, 1000);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEasterEgg);
  } else {
    initEasterEgg();
  }
})();
