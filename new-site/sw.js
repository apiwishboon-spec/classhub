const CACHE_NAME = 'classhub-m3-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './favicon.png',
  './logo.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
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
          console.warn('[SW] Fetch failed; returning offline state.', err);
          return null;
        });
      })
  );
});
