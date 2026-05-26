// Firebase Cloud Messaging Service Worker
// This service worker handles push notifications even when the app is closed

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

// Handle background push notifications
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.data?.title || payload.notification?.title || 'MyClassHub';
  const notificationBody = payload.data?.body || payload.notification?.body || 'New update available';
  const notificationIcon = payload.data?.icon || './favicon.png';
  const tag = payload.data?.tag || 'default';

  // Determine click action URL
  let clickAction = './index.html';
  if (payload.data?.type === 'homework') {
    clickAction = './index.html#homework';
  } else if (payload.data?.type === 'announcement') {
    clickAction = './index.html#announcements';
  } else if (payload.data?.type === 'schedule') {
    clickAction = './index.html#schedule';
  }

  self.registration.showNotification(notificationTitle, {
    body: notificationBody,
    icon: notificationIcon,
    badge: './favicon.png',
    tag: tag,
    data: {
      url: clickAction,
      ...payload.data
    },
    requireInteraction: true,
    vibrate: [200, 100, 200]
  });
});

// Handle notification click - open the app at the relevant section
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || './index.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there's already a window/tab open with the target URL
      for (const client of windowClients) {
        if (client.url.includes('index.html') && 'focus' in client) {
          return client.focus().then(() => {
            // Navigate to the specific section if needed
            if (event.notification.data?.type) {
              return client.navigate(urlToOpen);
            }
          });
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});