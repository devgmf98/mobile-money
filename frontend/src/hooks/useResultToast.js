import { useCallback, useEffect, useState } from 'react';

/* Raise a toast whenever a page records a result.

   Every one of these pages already tracks what happened -- an `error` string
   and a `success` string, set in the same handler that posted the transfer.
   What none of them did was say so anywhere the eye goes: the message was
   rendered in a panel partway down the form, which on a phone is often below
   the fold after the keyboard closes. Money moved and the screen looked
   unchanged.

   Driving the toast from the state the page already keeps means the two can
   never disagree, and adding it to a page is three lines rather than a rewrite
   of its submit handler.

   Pass either or both; an empty string or null is "nothing to report". */
export function useResultToast(success, error) {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (success) setToast({ message: String(success), type: 'success' });
  }, [success]);

  useEffect(() => {
    if (error) setToast({ message: String(error), type: 'error' });
  }, [error]);

  /* Stable, so it can be the onClose of a component that clears itself on a
     timer without restarting that timer on every render. */
  const clear = useCallback(() => setToast(null), []);

  return [toast, clear];
}

export default useResultToast;
