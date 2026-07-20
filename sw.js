const CACHE_NAME = 'classhub-v27';
const ASSETS = [
  '/',
  '/style.css?v=27',
  '/script.js?v=27',
  '/admin.js?v=21',
  '/admin',
  '/index.html',
  '/ad-inquiry',
  '/ad-renew',
  '/chat',
  '/contact',
  '/pass-change',
  '/privacy',
  '/terms',
  '/vote',
  '/game.js?v=3',
  '/chess-game.js?v=3',
  '/help.js?v=4',
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
  if (event.request.url.startsWith('https://www.googletagmanager.com') || 
      event.request.url.startsWith('https://www.google-analytics.com') ||
      event.request.url.includes('firestore.googleapis.com') ||
      event.request.url.includes('firebaseinstallations.googleapis.com') ||
      event.request.url.includes('googleapis.com')) {
    return;
  }

  let url = new URL(event.request.url);
  let path = url.pathname;

  if (path.endsWith('.html')) {
    path = path.slice(0, -5);
    if (path === '/index') path = '/';
    event.respondWith(
      caches.match(path).then(cached => {
        return cached || fetch(event.request).catch(err => {
          console.warn('[SW] Fetch failed.', err);
          return null;
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request).catch(err => {
          console.warn('[SW] Fetch failed.', err);
          return null;
        });
      })
  );
});
