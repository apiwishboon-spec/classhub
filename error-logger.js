import { db } from './firebase-config.js';
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const LOG_KEY = 'error_log_queue';
const FLUSH_INTERVAL = 30000;
const MAX_QUEUE = 20;
let queue = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
let flushTimer = null;

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
            // silently fail — don't create infinite loop
        }
    }
}

function captureError(error, context = {}) {
    const entry = {
        ...getPageInfo(),
        message: error?.message || String(error),
        stack: error?.stack?.slice(0, 500) || '',
        context,
        level: context.level || 'error',
        createdAt: serverTimestamp()
    };
    enqueue(entry);
}

window.onerror = function (message, source, lineno, colno, error) {
    captureError(error || message, { source, lineno, colno });
    return false;
};

window.addEventListener('unhandledrejection', function (event) {
    captureError(event.reason, { type: 'unhandledrejection' });
});

// Flush on page unload — best effort
window.addEventListener('beforeunload', () => {
    if (queue.length > 0) {
        flushQueue();
    }
});

// Flush immediately on first load if there are queued errors from previous session
if (queue.length > 0) {
    flushQueue();
}
