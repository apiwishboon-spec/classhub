const CACHE_NAME = 'classhub-v36';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/404.html',
  '/style.css',
  '/script.js',
  '/admin.js',
  '/admin.html',
  '/ad-inquiry.html',
  '/ad-renew.html',
  '/chat.html',
  '/chat.js',
  '/contact.html',
  '/pass-change.html',
  '/privacy.html',
  '/terms.html',
  '/vote.html',
  '/export.html',
  '/maintenance.html',
  '/game.js',
  '/chess-game.js',
  '/help.js',
  '/bug-report.js',
  '/profanity-filter.js',
  '/firebase-config.js',
  '/version.js',
  '/visits.js',
  '/favicon.png',
  '/logo.png',
  '/prompayqr.png'
];

const CDN_ASSETS = [
  'https://unpkg.com/@phosphor-icons/web',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Some static assets failed to cache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET') return;

  if (url.hostname === 'www.googletagmanager.com' ||
      url.hostname === 'www.google-analytics.com' ||
      url.hostname === 'firestore.googleapis.com' ||
      url.hostname === 'firebaseinstallations.googleapis.com' ||
      url.hostname === 'securetoken.googleapis.com' ||
      url.hostname === 'identitytoolkit.googleapis.com' ||
      url.pathname.includes('firestore.googleapis.com') ||
      url.pathname.includes('firebaseinstallations.googleapis.com')) {
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => new Response('', { status: 408 }));
      })
    );
    return;
  }

  if (url.hostname === 'api.imgbb.com' || url.hostname === 'api.inwcloud.shop') {
    return;
  }

  let path = url.pathname;

  if (path.endsWith('.html')) {
    const cleanPath = path.slice(0, -5);
    const rewritePath = cleanPath === '/index' ? '/' : cleanPath;

    event.respondWith(
      caches.match(rewritePath).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(rewritePath, clone));
          }
          return response;
        }).catch(() => {
          return caches.match('/404.html').then(fallback => {
            return fallback || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/html' } });
          });
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(event.request).then(response => {
        if (response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.destination === 'image') {
          return new Response(
            '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23262626" width="200" height="200"/><text fill="%23525252" x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="14" font-family="IBM Plex Sans,sans-serif">Offline</text></svg>',
            { headers: { 'Content-Type': 'image/svg+xml' } }
          );
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
