const CACHE_NAME = 'classhub-v4';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        './style.css?v=4',
        './script.js?v=4',
        './admin.js?v=4',
        './help.js?v=1',
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
  // Ignore non-GET requests (such as analytics POST requests or forms)
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  
  // Bypass Service Worker caching entirely for Google Analytics and external Google collectors
  if (url.hostname.includes('google-analytics') || url.hostname.includes('google.com') && url.pathname.includes('/g/collect')) {
    return;
  }
  
  // HTML pages — network first (latest version always)
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
  
  // Static assets — cache first with graceful error catch
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).catch((err) => {
        console.warn(`[SW] Network fetch failed or was blocked for: ${event.request.url}`);
        // Return a basic empty response or offline indicator to prevent uncaught promise rejection crashes
        return new Response('', { status: 404, statusText: 'Offline/Blocked' });
      });
    })
  );
});

// Listen for messages from the main thread to show notifications
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, icon, tag } = event.data;
    
    self.registration.showNotification(title, {
      body: body,
      icon: icon || './favicon.png',
      badge: './favicon.png',
      tag: tag || 'classhub-notification',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      data: event.data
    });
  }
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const urlToOpen = './index.html';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes('index.html') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});