import { db } from "./firebase-config.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Auto-redirect visitors of legally blocked pages to the 451 page.
// Blocked paths are managed in the admin panel (settings/legal_blocks).

function normalizePath(p) {
    if (!p) return '/';
    let path = String(p).split('?')[0];
    if (path.endsWith('/')) path = path.slice(0, -1);
    if (path.endsWith('.html')) path = path.slice(0, -5);
    return path || '/';
}

onSnapshot(doc(db, "settings", "legal_blocks"), (snap) => {
    const paths = snap.exists() && Array.isArray(snap.data().paths)
        ? snap.data().paths.map(normalizePath)
        : [];

    if (!paths.length) return;

    const current = normalizePath(window.location.pathname);
    if (current.startsWith('/451')) return;

    if (paths.includes(current)) {
        window.location.replace('/451?url=' + encodeURIComponent(window.location.pathname));
    }
}, (error) => {
    console.error('Legal block check failed:', error);
});
