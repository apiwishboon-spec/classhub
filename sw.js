const CACHE_NAME = 'classhub-v1';
const ASSETS = [
  '/',
  '/style.css',
  '/script.js',
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
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  // Ignore external API/analytics requests
  if (event.request.url.startsWith('https://www.googletagmanager.com') || 
      event.request.url.startsWith('https://www.google-analytics.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
