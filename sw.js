const CACHE_NAME = 'classhub-v12';
const ASSETS = [
  '/',
  '/style.css?v=13',
  '/script.js?v=13',
  '/admin.js?v=14',
  '/admin.html',
  '/index.html',
  '/ad-inquiry',
  '/game.js?v=2',
  '/chess-game.js?v=2',
  '/help.js?v=3',
  '/favicon.png',
  '/logo.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Ignore external API/analytics/firebase requests
  if (event.request.url.startsWith('https://www.googletagmanager.com') || 
      event.request.url.startsWith('https://www.google-analytics.com') ||
      event.request.url.includes('firestore.googleapis.com') ||
      event.request.url.includes('firebaseinstallations.googleapis.com') ||
      event.request.url.includes('googleapis.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request).catch(err => {
          console.warn('[SW] Fetch failed; returning offline error.', err);
          // Optional: Return a custom offline page or null
          return null;
        });
      })
  );
});
