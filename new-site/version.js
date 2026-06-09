const BASE_VERSION = "f649e09";

async function fetchGitHubVersion() {
  const CACHE_KEY = "gh_version_cache";
  const CACHE_TIME_KEY = "gh_version_cache_time";
  const CACHE_TTL = 5 * 60 * 1000;

  let cachedData = localStorage.getItem(CACHE_KEY);
  const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
  const now = Date.now();

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

async function initVersion() {
  injectVersion(BASE_VERSION);
  const ghVersion = await fetchGitHubVersion();
  if (ghVersion) {
    injectVersion(ghVersion);
  }
}

console.log(
  "%c 🚀 MYCLASSHUB %c Do you want to join our team? %c 📧 apiwish.boon@gmail.com ",
  "background: #3F51B5; color: white; padding: 5px 10px; border-radius: 5px 0 0 5px; font-weight: bold; font-family: system-ui;",
  "background: #1e1e2e; color: #a6adc8; padding: 5px 10px; font-family: system-ui;",
  "background: #3F51B5; color: white; padding: 5px 10px; border-radius: 0 5px 5px 0; font-weight: bold; font-family: system-ui;"
);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initVersion);
} else {
  initVersion();
}
