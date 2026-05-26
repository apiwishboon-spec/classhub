// MyClassHub Version
const APP_VERSION = "V.3.2.1";

function injectVersion() {
    const versionElements = document.querySelectorAll('.app-version');
    versionElements.forEach(el => {
        el.textContent = APP_VERSION;
    });
}

// Run on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectVersion);
} else {
    injectVersion();
}