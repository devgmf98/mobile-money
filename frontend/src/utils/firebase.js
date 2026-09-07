import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';

import { showSystemNotification } from '../hooks/useSystemNotifications';

/* Firebase for the browser.

   These values are not secrets. A web API key identifies the project to
   Google's servers and is designed to ship in client code; what protects the
   project is its security rules and, here, the fact that sending a push needs
   the service-account credential, which lives only on the server. */
const firebaseConfig = {
  apiKey: 'AIzaSyCuSsE9hGJVpKuUjE75cxWUrubtgj4LuUQ',
  authDomain: 'otp-verify-d14e2.firebaseapp.com',
  projectId: 'otp-verify-d14e2',
  storageBucket: 'otp-verify-d14e2.firebasestorage.app',
  messagingSenderId: '68158580848',
  appId: '1:68158580848:web:27d0c555a869cc24da6cb5',
};

const app = initializeApp(firebaseConfig);

/* Registers this browser for push and hands the token to the server.

   Everything is guarded. Messaging needs a secure context and a service
   worker, so it is simply unavailable in Safari's private mode, in an insecure
   context, and in a few browsers outright — none of which should stop someone
   using the site. A failure here costs a notification, not a session. */
export async function startWebPush(registerToken) {
  try {
    if (!(await isSupported())) return null;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      return null;
    }

    /* The worker Firebase hands background messages to. It lives at the site
       root because a service worker can only control pages at or below its own
       path, and this one has to cover the whole site. */
    const registration = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js'
    );

    const messaging = getMessaging(app);

    /* VAPID key, from Firebase Console > Project settings > Cloud Messaging >
       Web Push certificates. Without it getToken rejects, which is why this is
       skipped rather than attempted when the variable is unset. */
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn('[push] VITE_FIREBASE_VAPID_KEY is not set - web push is off.');
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) return null;

    await registerToken(token);

    /* A push arriving while the tab is open is not drawn by the browser, so it
       is drawn here — and skipped when the tab is focused, since the page is
       already updating itself live. */
    onMessage(messaging, (payload) => {
      showSystemNotification({
        title: payload?.notification?.title || payload?.data?.title || 'MoneyPay',
        body: payload?.notification?.body || payload?.data?.message || '',
        tag: payload?.data?.id,
      });
    });

    return token;
  } catch (error) {
    console.warn('[push] Web push unavailable:', error?.message || error);
    return null;
  }
}

export default app;
