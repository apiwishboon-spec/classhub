// MyClassHub Version
const BASE_VERSION = "force-update-010";

// Force clear all old caches on load
if ('caches' in window) {
    caches.keys().then(keys => {
        keys.forEach(k => {
            if (k.startsWith('classhub-')) caches.delete(k);
        });
    });
}

async function fetchGitHubVersion() {
    const CACHE_KEY = "gh_version_cache";
    const CACHE_TIME_KEY = "gh_version_cache_time";
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

    // Check localStorage cache first
    let cachedData = localStorage.getItem(CACHE_KEY);
    const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
    const now = Date.now();

    // Clear old cache format (which contained hyphens) if found
    if (cachedData && cachedData.includes('-')) {
        localStorage.removeItem(CACHE_KEY);
        localStorage.removeItem(CACHE_TIME_KEY);
        cachedData = null;
    }

    if (cachedData && cachedTime && (now - parseInt(cachedTime) < CACHE_TTL)) {
        return cachedData;
    }

    try {
        const response = await fetch("https://api.github.com/repos/apiwishboon-spec/classhub/commits/main");
        if (response.ok) {
            const data = await response.json();
            const sha = data.sha.substring(0, 7);
            
            // Cache in localStorage
            localStorage.setItem(CACHE_KEY, sha);
            localStorage.setItem(CACHE_TIME_KEY, now.toString());
            return sha;
        }
    } catch (e) {
        console.error("Error fetching commit ID from GitHub:", e);
    }
    return null;
}

function injectVersion(versionStr) {
    const versionElements = document.querySelectorAll('.app-version');
    versionElements.forEach(el => {
        el.textContent = versionStr;
    });
}

// Run on DOM ready
async function initVersion() {
    // 1. Immediately inject the base fallback commit ID
    injectVersion(BASE_VERSION);
    
    // 2. Fetch from GitHub (cached or live) and update dynamically
    const ghVersion = await fetchGitHubVersion();
    if (ghVersion) {
        injectVersion(ghVersion);
    }
}

// Recruitment Message for Developers
console.log(
    "%c 🚀 MYCLASSHUB %c Do you want to join our team? %c 📧 apiwish.boon@gmail.com ",
    "background: #6366f1; color: white; padding: 5px 10px; border-radius: 5px 0 0 5px; font-weight: bold; font-family: system-ui;",
    "background: #1e1e2e; color: #a6adc8; padding: 5px 10px; font-family: system-ui;",
    "background: #6366f1; color: white; padding: 5px 10px; border-radius: 0 5px 5px 0; font-weight: bold; font-family: system-ui;"
);

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVersion);
} else {
    initVersion();
}