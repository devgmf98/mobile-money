/* Browser notifications for events the socket delivers.

   Local rather than push. A push notification would arrive with the tab
   closed, but that needs a Web Push subscription, VAPID keys and a server that
   sends them — none of which exist here yet. This covers the tab being open
   and not looked at, which is the case that was silently doing nothing.

   Everything below is defensive: Notification is missing entirely in some
   browsers and in any insecure context, and throws rather than returning false
   in others. A wallet must not fail to show a balance because a notification
   could not be posted. */

const supported = () =>
  typeof window !== 'undefined' && 'Notification' in window;

/* Asked for after sign-in rather than on first paint. A permission prompt that
   appears before anyone has seen what the site does is the one people dismiss
   permanently, and the browser never asks again. */
export async function requestNotificationPermission() {
  if (!supported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;

  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

/* Posts one notification.

   Skipped while the tab is focused: the page already updates itself live, and
   a banner about something visible on screen is noise. */
export function showSystemNotification({ title, body, tag }) {
  if (!supported() || Notification.permission !== 'granted') return false;

  /* Suppressed only when the page is genuinely in front of the person.

     visibilityState alone was not that: a tab stays "visible" while its window
     sits behind another application entirely, so someone working in another
     window got nothing at all -- which is the case a notification exists for.
     hasFocus is what distinguishes the two. */
  const looking =
    typeof document !== 'undefined' &&
    document.visibilityState === 'visible' &&
    (typeof document.hasFocus !== 'function' || document.hasFocus());
  if (looking) return false;

  try {
    const notification = new Notification(title || 'MoneyPay', {
      body: body || '',
      /* Files that actually exist in public/ — a missing icon silently
         degrades to the browser's generic one, which looks like a bug. */
      icon: '/favicon-192.png',
      badge: '/favicon-32.png',
      /* The server's own id, so the same event arriving twice — a reconnect
         replaying it, say — replaces its entry rather than stacking. */
      tag: tag ? String(tag) : undefined,
      renotify: false,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    return true;
  } catch {
    /* Some browsers throw on construction rather than refusing politely. */
    return false;
  }
}

export default showSystemNotification;
