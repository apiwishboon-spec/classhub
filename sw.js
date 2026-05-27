// Firebase MUST be imported at the very top of the service worker
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDGN83Fo7YSQYt6FbG1mj-J_fFAbFQ2rwI",
  authDomain: "classhub-e1e8b.firebaseapp.com",
  projectId: "classhub-e1e8b",
  storageBucket: "classhub-e1e8b.firebasestorage.app",
  messagingSenderId: "967849169380",
  appId: "1:967849169380:web:347cd74ee21a2b4141b7f1",
  measurementId: "G-300HW5WQC6"
});

const messaging = firebase.messaging();

// ─── Cache & PWA ──────────────────────────────────────────────────────────────

const CACHE_NAME = 'classhub-v9';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        './style.css?v=9',
        './script.js?v=9',
        './admin.js?v=9',
        './help.js?v=2',
        './version.js',
        './firebase-config.js',
        './favicon.png',
        './logo.png',
        './manifest.json',
        'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap',
        'https://unpkg.com/@phosphor-icons/web'
      ]);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Bypass for Google Analytics
  if (url.hostname.includes('google-analytics') || (url.hostname.includes('google.com') && url.pathname.includes('/g/collect'))) {
    return;
  }

  // HTML pages — network first
  if (url.pathname.endsWith('.html') || url.pathname === '/' || url.pathname === '') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Static assets — cache first
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).catch(() => {
        return new Response('', { status: 404, statusText: 'Offline' });
      });
    })
  );
});

// ─── FCM Background Push ──────────────────────────────────────────────────────

messaging.onBackgroundMessage((payload) => {
  console.log('[sw.js] Background message received:', payload);

  const title = payload.data?.title || payload.notification?.title || 'MyClassHub';
  const body  = payload.data?.body  || payload.notification?.body  || 'New update available';
  const icon  = payload.data?.icon  || './favicon.png';
  const tag   = payload.data?.tag   || 'default';

  let clickAction = './index.html';
  if (payload.data?.type === 'homework')     clickAction = './index.html#homework';
  if (payload.data?.type === 'announcement') clickAction = './index.html#announcements';
  if (payload.data?.type === 'schedule')     clickAction = './index.html#schedule';

  self.registration.showNotification(title, {
    body, icon,
    badge: './favicon.png',
    tag,
    data: { url: clickAction, ...payload.data },
    requireInteraction: true,
    vibrate: [200, 100, 200]
  });
});

// ─── Manual Notification (from main thread) ───────────────────────────────────

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, icon, tag } = event.data;
    self.registration.showNotification(title, {
      body,
      icon: icon || './favicon.png',
      badge: './favicon.png',
      tag: tag || 'classhub-notification',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      data: event.data
    });
  }
});

// ─── Notification Click ───────────────────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || './index.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes('index.html') && 'focus' in client) {
          return client.focus().then(() => {
            if (event.notification.data?.type) return client.navigate(urlToOpen);
          });
        }
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    })
  );
});