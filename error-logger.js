import { db } from './firebase-config.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const LOG_KEY = 'error_log_queue';
const FLUSH_INTERVAL = 30000;
const MAX_QUEUE = 50;
let queue = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
let flushTimer = null;
let consoleBuffer = [];
const CONSOLE_BUFFER_MAX = 100;
let modalCooldown = 0;

function getPageInfo() {
    return {
        page: window.location.pathname.split('/').pop() || 'index.html',
        url: window.location.href,
        userAgent: navigator.userAgent.slice(0, 200),
        screen: `${window.innerWidth}x${window.innerHeight}`,
        timestamp: new Date().toISOString()
    };
}

function enqueue(entry) {
    queue.push(entry);
    if (queue.length > MAX_QUEUE) queue.shift();
    localStorage.setItem(LOG_KEY, JSON.stringify(queue));
    scheduleFlush();
}

function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(flushQueue, FLUSH_INTERVAL);
}

async function flushQueue() {
    flushTimer = null;
    if (queue.length === 0) return;

    const batch = [...queue];
    queue = [];
    localStorage.setItem(LOG_KEY, JSON.stringify(queue));

    for (const entry of batch) {
        try {
            await addDoc(collection(db, "error_logs"), entry);
        } catch (e) {
            // silently fail
        }
    }
}

// ── Console Capture ──
const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug
};

function captureConsole(method, args) {
    const text = args.map(a => {
        try { return typeof a === 'object' ? JSON.stringify(a) : String(a); }
        catch { return String(a); }
    }).join(' ');

    consoleBuffer.push({ method, text, time: new Date().toISOString() });
    if (consoleBuffer.length > CONSOLE_BUFFER_MAX) consoleBuffer.shift();
}

console.log = function (...args) { originalConsole.log.apply(console, args); captureConsole('log', args); };
console.warn = function (...args) { originalConsole.warn.apply(console, args); captureConsole('warn', args); };
console.error = function (...args) { originalConsole.error.apply(console, args); captureConsole('error', args); };
console.info = function (...args) { originalConsole.info.apply(console, args); captureConsole('info', args); };
console.debug = function (...args) { originalConsole.debug.apply(console, args); captureConsole('debug', args); };

// ── Error Capture ──
function captureError(error, context = {}) {
    const recentConsole = consoleBuffer.slice(-20);

    const entry = {
        ...getPageInfo(),
        message: error?.message || String(error),
        stack: error?.stack?.slice(0, 500) || '',
        context,
        level: context.level || 'error',
        console: recentConsole,
        createdAt: serverTimestamp()
    };
    enqueue(entry);
    showErrorReportBar(error?.message || String(error));
}

window.onerror = function (message, source, lineno, colno, error) {
    captureError(error || message, { source, lineno, colno });
    return false;
};

window.addEventListener('unhandledrejection', function (event) {
    captureError(event.reason, { type: 'unhandledrejection' });
});

// ── Error Report Modal ──
function showErrorReportBar(errorMessage) {
    const now = Date.now();
    if (now - modalCooldown < 10000) return;
    modalCooldown = now;

    if (document.getElementById('error-report-bar')) return;

    const bar = document.createElement('div');
    bar.id = 'error-report-bar';
    bar.style.cssText = `
        position: fixed; bottom: 5rem; right: 1.5rem; z-index: 99999;
        background: var(--card-bg); border: 1px solid var(--border-color);
        border-left: 4px solid var(--danger);
        border-radius: 10px; padding: 0.75rem 1rem;
        box-shadow: 0 8px 30px rgba(0,0,0,0.2);
        max-width: 380px; width: calc(100% - 3rem);
        display: flex; flex-direction: column; gap: 0.5rem;
        animation: errorSlideUp 0.35s ease-out;
        font-size: 0.85rem;
    `;

    bar.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.5rem;">
            <span style="font-size:1.2rem;">⚠️</span>
            <span style="font-weight:600; flex:1;">Something went wrong</span>
            <button id="error-bar-close" style="background:none; border:none; cursor:pointer; font-size:1.2rem; color:var(--text-secondary);">&times;</button>
        </div>
        <div style="color:var(--text-secondary); font-size:0.75rem; word-break:break-word;">${errorMessage.slice(0, 100)}</div>
        <div style="display:flex; gap:0.5rem; margin-top:0.25rem;">
            <button id="error-report-btn" style="flex:1; padding:0.5rem; background:var(--danger); color:white; border:none; border-radius:6px; font-weight:600; cursor:pointer; font-size:0.8rem;">🐛 Report Issue</button>
            <button id="error-dismiss-btn" style="flex:1; padding:0.5rem; background:var(--bg-color); color:var(--text-main); border:1px solid var(--border-color); border-radius:6px; cursor:pointer; font-size:0.8rem;">Dismiss</button>
        </div>
    `;

    document.body.appendChild(bar);

    document.getElementById('error-bar-close').onclick = () => bar.remove();
    document.getElementById('error-dismiss-btn').onclick = () => bar.remove();
    document.getElementById('error-report-btn').onclick = () => {
        bar.remove();
        openErrorReportModal(errorMessage);
    };

    setTimeout(() => { if (bar.parentNode) bar.remove(); }, 15000);
}

function openErrorReportModal(errorMessage) {
    if (document.getElementById('error-report-modal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'error-report-modal';
    overlay.style.cssText = `
        position: fixed; top:0; left:0; width:100vw; height:100vh;
        background: rgba(0,0,0,0.7); backdrop-filter: blur(6px);
        display:flex; align-items:center; justify-content:center;
        z-index: 100000; padding: 1.5rem;
        animation: fadeIn 0.2s ease-out;
    `;

    const recentConsoleHtml = consoleBuffer.slice(-10).map(c =>
        `<div style="color:${c.method === 'error' ? 'var(--danger)' : c.method === 'warn' ? 'var(--warning)' : 'var(--text-secondary)'}; font-size:0.65rem; padding:1px 0;">${c.method.toUpperCase()}: ${c.text.slice(0, 80)}</div>`
    ).join('');

    overlay.innerHTML = `
        <div style="background:var(--card-bg); border-radius:14px; max-width:520px; width:100%; padding:1.5rem; box-shadow:0 30px 60px rgba(0,0,0,0.4); animation:modalSlideUp 0.3s ease-out; color:var(--text-main);">
            <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:1rem;">
                <span style="font-size:1.5rem;">🐛</span>
                <h3 style="margin:0; font-size:1.2rem;">Report Issue</h3>
            </div>

            <div style="background:var(--bg-color); border-radius:8px; padding:0.75rem; margin-bottom:1rem;">
                <div style="font-size:0.7rem; font-weight:600; color:var(--danger); margin-bottom:0.25rem;">AUTO-CAPTURED ERROR</div>
                <div style="font-size:0.8rem; word-break:break-word;">${errorMessage.slice(0, 200)}</div>
            </div>

            <div style="margin-bottom:1rem;">
                <label style="font-size:0.75rem; font-weight:600; color:var(--text-secondary); display:block; margin-bottom:0.25rem;">What happened? (optional)</label>
                <textarea id="report-description" placeholder="Tell me what you were doing when this happened..." class="form-input" rows="2" style="border-radius:6px; border:1px solid var(--border-color); font-size:0.85rem; resize:vertical;"></textarea>
            </div>

            <details style="margin-bottom:1rem;">
                <summary style="font-size:0.75rem; color:var(--accent-color); cursor:pointer; font-weight:600;">Console Logs (${consoleBuffer.length} captured)</summary>
                <div style="max-height:150px; overflow-y:auto; margin-top:0.5rem; background:var(--bg-color); border-radius:6px; padding:0.5rem; font-family:monospace;">
                    ${recentConsoleHtml || '<div style="color:var(--text-secondary); font-size:0.7rem;">No recent console activity.</div>'}
                </div>
            </details>

            <div style="display:flex; gap:0.75rem;">
                <button id="submit-error-report" style="flex:2; padding:0.7rem; background:var(--danger); color:white; border:none; border-radius:8px; font-weight:600; cursor:pointer;">Submit Report</button>
                <button id="close-error-modal" style="flex:1; padding:0.7rem; background:var(--bg-color); color:var(--text-main); border:1px solid var(--border-color); border-radius:8px; cursor:pointer;">Cancel</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('close-error-modal').onclick = () => overlay.remove();
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    document.getElementById('submit-error-report').onclick = async () => {
        const desc = document.getElementById('report-description').value.trim();
        const btn = document.getElementById('submit-error-report');
        btn.textContent = 'Submitting...';
        btn.disabled = true;

        // Find the last error in queue to mark it as reported
        const lastError = queue[queue.length - 1] || {};

        try {
            await addDoc(collection(db, "error_logs"), {
                ...getPageInfo(),
                message: lastError.message || errorMessage,
                stack: lastError.stack || '',
                level: 'error',
                reported: true,
                userDescription: desc || '',
                console: consoleBuffer.slice(-20),
                createdAt: serverTimestamp()
            });
            btn.textContent = '✓ Submitted!';
            btn.style.background = 'var(--success)';
            setTimeout(() => overlay.remove(), 1000);
        } catch (e) {
            btn.textContent = 'Failed — try again';
            btn.disabled = false;
        }
    };
}

// ── Styles ──
const style = document.createElement('style');
style.textContent = `
    @keyframes errorSlideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    @keyframes modalSlideUp {
        from { opacity: 0; transform: translateY(30px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
    }
`;
document.head.appendChild(style);

// ── Flush on unload ──
window.addEventListener('beforeunload', () => {
    if (queue.length > 0) flushQueue();
});

// ── Flush queued errors from previous session ──
if (queue.length > 0) {
    flushQueue();
}
