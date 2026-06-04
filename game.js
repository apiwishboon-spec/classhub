(function() {
    'use strict';
    
    // Base64 assets from the authentic Chromium source
    const ASSETS = {
        TREX: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQgAAAAvAgMAAABiRrxWAAAADFBMVEX///9TU1P39/f///+TS9URAAAAAXRSTlMAQObYZgAAAPpJREFUeF7d0jFKRkEMhdGLMM307itNLALyVmHvJuzTDMjdn72E95PGFEZSmeoU4YMMgxhskvQec8YSVFX1NhGcS5ywtbmC8khcZeKq+ZWJ4F8Sr2+ZCErjkJFEfcjAc/6/BMlfcz6xHdhRthYzIZhIHMcTVY1scUUiAphK8CMSPUbieTBhvD9Lj0vyV4wklEGzHpciKGOJoBp7XDcFs4RWxxM7Ey3iZ8JbzASAvMS7XLOJHTTvEkEZSeQl7DMuwVyCasqK5+XzQRYLUJlMbPXjFcn3m8eKBSjWZMJwvGIOvViAzCbUj1VEDoqFOEQGE3SyInJQLOQMJL4B7enP1UbLXJQAAAAASUVORK5CYII=',
        HORIZON: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABLAAAAAMAgMAAAAPCKxBAAAABlBMVEX///9TU1NYzE1OAAAAAXRSTlMAQObYZgAAALJJREFUeF7t1EEKAyEMhtEvMNm7sPfJEVyY+1+ltLgYAsrQCtWhbxEhQvgxIJtSZypxa/WGshgzKdbq/UihMFMlt3o/CspEYoihIMaAb6mCvM6C+BTAeyo+wN4yykV/6pVfkdLpVyI1hh7GJ6QunUoLEQlQglNP2nkQkeF8+ei9cLxMue1qxVRfk1Ej0s6AEGWfVOk0QUtnK5Xo0Lac6wpdtnQqB6VxomPaz+dgF1PaqqmeWJlz1jYUaSIAAAAASUVORK5CYII=',
        OBSTACLE_SMALL: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGYAAAAjCAMAAABRlI+PAAAADFBMVEX////////39/dTU1PhglcSAAAAAXRSTlMAQObYZgAAAPNJREFUeF7tlkEKwzAMBLXr//+5iQhU7gRRQkyhZI+DhwH74jhmO+oIJBVwURljuAXagG5QqkSgBLqg3JnxJ1Cb8SmQ3o6gpO85owGlOB4m2BNKJ11BSd01owGlOHkcIAuHkz6UNpPKgozPM54dADHjJuNhZiJxdQCQgZJeBczgCAAy3yhPJvcnmdC9mZwBIsQMFV5AkzHBNknFgcKM+oyDIFcfCAoy03m+jSMIcmoVZkKqSjr1fghyahRmoKRUHYLiSI1SMlCq5CDgX6BXmKkfn+oQ0KEyyrzoy8GbXJ9xrM/YjhUZgl9nnsyTCe9rgSRdV15CwRcIEu8GGQAAAABJRU5ErkJggg==',
        OBSTACLE_LARGE: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJYAAAAyCAMAAACJUtIoAAAACVBMVEX////39/dTU1OabbyfAAAAAXRSTlMAQObYZgAAAXhJREFUeF7t2NGqAjEMANGM///RlwvaYQndULuFPJgHUYaEI6IPhgNAOA8HZ+3U6384F5y1U6YzAZTWG+dZamnFEstBFtCKJZSHWMADLJ18z+JqpQeLdKoDC8siC5iFCQs4znIxB5B1t6F3lQWkL4N0JsF+u6GXJdbI+FKW+yWr3lhgCZ2VSag3Nlk/FnRkIRbasLCO0oulikMsvmGpeiGLZ1jOMgtIP5bODivYYUXEIVbwFCt4khVssRgsgidZwQaLd2A8m7MYLGTl4KeQQs2y4kMAMGGlmQViDIb5O6xZnnLD485dIBzqDSE1yyFdL4Iqu4XJqUUWl/NVAFSZq1P6a5aqbAUM2epQbBioWflUBABiUyhYyZoCBev8XyMAObDNOhOAfiyxmHU0YNlldGAphGjFCjA3YkUn1o/1Y3EkZFZ5isCC6NUgwDBn1RuXH96doNfAhDXfsIyJ2AnolcCVhay0kcYbW0HvCO8OwIcJ3GzkORpkFuUP/1Ec8FW1qJkAAAAASUVORK5CYII=',
        CLOUD: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC4AAAAOCAQAAAD6HOaKAAAAU0lEQVR4XrWSsQkAQAgD3X9El/ELixQpJHCfdApnUCtXz7o49cgagaGPaq4rIwAP9s/C7R7UX3inJ0BDb6qWDC7ScOR/QWjRlFizuPwLtTLj+qkH6DjD2wLtikUAAAAASUVORK5CYII='
    };

    let tapCount = 0;
    let tapTimer = null;

    function launchTrex() {
        if (document.getElementById('trex-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'trex-overlay';
        overlay.innerHTML = `
            <button id="trex-close" title="Close Game">✕</button>
            <div id="trex-game-holder" style="width: 600px; max-width: 95vw; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 30px 70px rgba(0,0,0,0.25); padding: 20px; position: relative; border: 1px solid #eee;">
                <h3 style="text-align: center; margin: 0 0 15px 0; color: #535353; font-weight: 600;">Authentic T-Rex Runner</h3>
                <canvas id="trex-canvas" width="600" height="150" style="display: block; width: 100%; height: auto; background: #f7f7f7; cursor: pointer;"></canvas>
                <div style="text-align: center; margin-top: 15px; color: #999; font-size: 0.8rem;">
                    Press <b>Space</b> or <b>Tap</b> to Jump · Catch the high score!
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
        let speed = 6;
        let groundX = 0;
        let trexY = 0;
        let trexVelocity = 0;
        let obstacles = [];
        let clouds = [];
        let animId;

        const gravity = 0.6;
        const jumpStrength = -10;

        // Load images
        const images = {};
        Object.entries(ASSETS).forEach(([key, src]) => {
            const img = new Image();
            img.src = src;
            images[key] = img;
        });

        function reset() {
            score = 0;
            speed = 6;
            groundX = 0;
            trexY = 0;
            trexVelocity = 0;
            obstacles = [];
            clouds = [];
            gameActive = true;
        }

        function spawnObstacle() {
            const type = Math.random() > 0.5 ? 'LARGE' : 'SMALL';
            obstacles.push({
                x: 600,
                type: type,
                width: type === 'LARGE' ? 50 : 34,
                height: type === 'LARGE' ? 50 : 35
            });
        }

        function update() {
            if (!gameActive) return;

            // Ground & Clouds
            groundX -= speed;
            if (groundX <= -600) groundX = 0;

            // Trex Physics
            trexVelocity += gravity;
            trexY += trexVelocity;
            if (trexY > 0) {
                trexY = 0;
                trexVelocity = 0;
            }

            // Obstacles
            if (Math.random() < 0.01 && (obstacles.length === 0 || obstacles[obstacles.length-1].x < 400)) {
                spawnObstacle();
            }

            obstacles.forEach((obs, i) => {
                obs.x -= speed;
                // Collision
                if (obs.x < 84 && obs.x > 34 && trexY > -obs.height + 10) {
                    gameActive = false;
                }
            });
            obstacles = obstacles.filter(o => o.x > -100);

            score++;
            if (score % 500 === 0) speed += 0.5;
        }

        function draw() {
            ctx.clearRect(0, 0, 600, 150);

            // Ground
            ctx.drawImage(images.HORIZON, groundX, 127, 600, 12);
            ctx.drawImage(images.HORIZON, groundX + 600, 127, 600, 12);

            // Trex (Simplified sprite animation)
            const trexFrame = Math.floor(score / 10) % 2 === 0 ? 88 : 132;
            ctx.drawImage(images.TREX, gameActive ? trexFrame : 220, 0, 44, 47, 44, 80 + trexY, 44, 47);

            // Obstacles
            obstacles.forEach(obs => {
                const img = obs.type === 'LARGE' ? images.OBSTACLE_LARGE : images.OBSTACLE_SMALL;
                ctx.drawImage(img, obs.x, obs.type === 'LARGE' ? 80 : 95, obs.width, obs.height);
            });

            // Score
            ctx.fillStyle = '#535353';
            ctx.font = '16px "Courier New", Courier, monospace';
            ctx.textAlign = 'right';
            ctx.fillText(String(score).padStart(5, '0'), 580, 25);

            if (!gameActive && score > 0) {
                ctx.fillStyle = 'rgba(255,255,255,0.8)';
                ctx.fillRect(0, 0, 600, 150);
                ctx.fillStyle = '#535353';
                ctx.font = 'bold 24px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('G A M E  O V E R', 300, 70);
                ctx.font = '14px Arial';
                ctx.fillText('Press Space to Restart', 300, 100);
            } else if (!gameActive) {
                ctx.fillStyle = '#535353';
                ctx.font = 'bold 18px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('Ready to Run?', 300, 75);
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
        const logo = document.querySelector('.nav-brand h1') || document.querySelector('.nav-brand');
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

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initEasterEgg);
    else initEasterEgg();
})();
