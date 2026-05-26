// MyClassHub Version
const BASE_VERSION = "V.3.3.0";

async function fetchGitHubVersion() {
    const CACHE_KEY = "gh_version_cache";
    const CACHE_TIME_KEY = "gh_version_cache_time";
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

    // Check localStorage cache first
    const cachedData = localStorage.getItem(CACHE_KEY);
    const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
    const now = Date.now();

    if (cachedData && cachedTime && (now - parseInt(cachedTime) < CACHE_TTL)) {
        return cachedData;
    }

    try {
        const response = await fetch("https://api.github.com/repos/apiwishboon-spec/classhub/commits/main");
        if (response.ok) {
            const data = await response.json();
            const sha = data.sha.substring(0, 7);
            const dateStr = data.commit.committer.date; // e.g. "2026-05-26T13:08:44Z"
            const date = new Date(dateStr);
            const formattedDate = date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
            const fullVersion = `${BASE_VERSION}-${sha} (${formattedDate})`;
            
            // Cache in localStorage
            localStorage.setItem(CACHE_KEY, fullVersion);
            localStorage.setItem(CACHE_TIME_KEY, now.toString());
            return fullVersion;
        }
    } catch (e) {
        console.error("Error fetching version from GitHub:", e);
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
    // 1. Immediately inject the base fallback version
    injectVersion(BASE_VERSION);
    
    // 2. Fetch from GitHub (cached or live) and update dynamically
    const ghVersion = await fetchGitHubVersion();
    if (ghVersion) {
        injectVersion(ghVersion);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVersion);
} else {
    initVersion();
}