import { useEffect } from 'react';
import io from 'socket.io-client';

import { announceDataChanged } from './useLiveData';
import showSystemNotification, {
  requestNotificationPermission,
} from './useSystemNotifications';
import { startWebPush } from '../utils/firebase';
import { authAPI, notificationAPI } from '../utils/api';
import { useAuthStore, useNotificationStore } from '../context/store';

/* Everything a signed-in session needs to hear about: the notification list,
   the socket that keeps it current, browser notifications, and push.

   This lived inside UserLayout, which is why an admin never received a live
   notification of any kind. AdminLayout has its own chrome and never had this,
   so an admin's socket was never opened, their room never joined, and every
   notification addressed to them waited until a page reload happened to
   refetch it -- including an agent approving or declining the cash-out they
   had just asked for.

   A hook rather than a copy, so the two layouts cannot drift apart. */
export function useRealtimeSession() {
  const user = useAuthStore((state) => state.user);
  // Notifications live in their own store, not the auth one.
  const setNotifications = useNotificationStore((state) => state.setNotifications);
  const addNotification = useNotificationStore((state) => state.addNotification);

  useEffect(() => {
    if (!user?.id) return undefined;

    const fetchNotifications = async () => {
      try {
        const { data } = await notificationAPI.getNotifications();
        setNotifications(data);
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    };

    fetchNotifications();

    /* Asked for here, where a session already exists, rather than on first
       paint: a prompt before anyone has seen the site is the one people
       dismiss for good. */
    requestNotificationPermission().then((permission) => {
      /* Only once permission is actually granted: getToken rejects otherwise,
         and registering a service worker for a browser that has said no is
         work nobody asked for. */
      if (permission !== 'granted') return;
      startWebPush((token) => authAPI.registerDeviceToken(token));
    });

    /* The socket lives on the same host as the API. The fallback used to name
       a different service outright, so an environment that forgot
       VITE_SOCKET_URL connected somewhere real and simply never received an
       event -- a silent failure that looks like the server not emitting. */
    const socketUrl =
      import.meta.env.VITE_SOCKET_URL ||
      String(import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '') ||
      window.location.origin;

    /* The server reads the identity from this token and ignores any id the
       client claims, so a connection without one joins nothing. */
    const socket = io(socketUrl, {
      auth: { token: localStorage.getItem('token') },
    });

    /* Joined on every connect, not once at setup. Events are addressed to a
       per-user room, and a socket that has not announced itself is in no room
       at all -- so after any reconnect the old code went quiet for good while
       still looking connected. */
    const join = () => socket.emit('join-user', user.id);
    socket.on('connect', join);
    join();

    socket.on('new-notification', (data) => {
      addNotification(data);
      announceDataChanged('notification');
      // Into the browser's own notification centre as well as the bell, so it
      // reaches someone whose window is behind something else.
      showSystemNotification({
        title: data?.title || 'MoneyPay',
        body: data?.message || '',
        tag: data?.id ?? data?._id,
      });
    });

    // Balance updates go straight to the store — it is the number on screen.
    socket.on('balance-updated', (payload) => {
      try {
        if (String(payload?.userId) === String(user.id)) {
          const updated = { ...user, balance: parseFloat(payload.balance) || 0 };
          localStorage.setItem('user', JSON.stringify(updated));
          // Dispatched rather than set directly: calling the store hook here
          // would break the rules of hooks.
          window.dispatchEvent(new CustomEvent('mpay:user-updated', { detail: updated }));
        }
        // The lists behind the figure are stale either way, including on the
        // other side of a transfer whose id is not this user's.
        announceDataChanged('balance');
      } catch (err) {
        console.error('Failed to apply balance update', err);
      }
    });

    socket.on('transaction-updated', () => announceDataChanged('transaction'));

    return () => {
      /* Every listener, not just the ones added by name.

         io() caches by URL and hands the same socket back on the next call, so
         handlers left attached here are still attached on the run after this
         one -- and one arriving notification is then handled twice, shown
         twice and counted twice. The JavaScript client reconnects a reused
         socket perfectly well, measured rather than assumed, so the listeners
         are the only thing to clean up. */
      socket.removeAllListeners();
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
}

export default useRealtimeSession;
