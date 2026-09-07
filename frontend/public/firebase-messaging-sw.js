/* Service worker for push that arrives with the tab closed.

   Served from the site root and registered by src/utils/firebase.js. It runs
   outside the app entirely — no bundler, no modules, no imports from src —
   which is why the config is repeated here rather than shared. Keep the two in
   step: they name the same Firebase project.

   The compat builds are used because a service worker cannot use ES module
   imports in every browser that supports push, and importScripts can. */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCuSsE9hGJVpKuUjE75cxWUrubtgj4LuUQ',
  authDomain: 'otp-verify-d14e2.firebaseapp.com',
  projectId: 'otp-verify-d14e2',
  storageBucket: 'otp-verify-d14e2.firebasestorage.app',
  messagingSenderId: '68158580848',
  appId: '1:68158580848:web:27d0c555a869cc24da6cb5',
});

const messaging = firebase.messaging();

/* Only reached for a data-only message. A payload carrying a `notification`
   block is drawn by the browser itself, and handling it here as well would
   show the same thing twice. */
messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || payload?.data?.title || 'MoneyPay';
  const body = payload?.notification?.body || payload?.data?.message || '';

  self.registration.showNotification(title, {
    body,
    icon: '/favicon-192.png',
    badge: '/favicon-32.png',
    /* The server's own notification id, so the same event arriving twice
       replaces its entry rather than stacking a duplicate underneath. */
    tag: payload?.data?.id ? String(payload.data.id) : undefined,
  });
});

/* Focus the tab that is already open rather than opening a second one. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const open = clients.find((client) => 'focus' in client);
        if (open) return open.focus();
        return self.clients.openWindow('/');
      })
  );
});
