import { useEffect, useRef } from 'react';

/* The event UserLayout fires when the socket says something moved: a balance
   changed, a transaction landed, a request was settled. Pages listen for it and
   refetch, so a screen someone is already looking at updates itself instead of
   waiting for them to pull down or navigate away and back. */
export const DATA_CHANGED = 'mpay:data-changed';

export const announceDataChanged = (reason) => {
  window.dispatchEvent(new CustomEvent(DATA_CHANGED, { detail: { reason } }));
};

/* Refetch when live data changes.

   Debounced, because settling a single cash-out emits several events within a
   moment — a balance for each side, a notification, a transaction — and each
   refetch here is a real HTTP request. One refresh a beat after the last event
   shows the same thing as five would.

   The callback is held in a ref so a page can pass an inline arrow function
   without the subscription tearing down and rebuilding on every render. */
export function useLiveData(onChange, { delay = 400 } = {}) {
  const saved = useRef(onChange);
  saved.current = onChange;

  useEffect(() => {
    let timer = null;

    const handle = () => {
      clearTimeout(timer);
      timer = setTimeout(() => saved.current?.(), delay);
    };

    window.addEventListener(DATA_CHANGED, handle);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(DATA_CHANGED, handle);
    };
  }, [delay]);
}

export default useLiveData;
