import { lazy } from 'react';

/* Survive a deploy that happened while the page was open.

   Every route here is code-split, so opening one fetches a chunk named by the
   hash of its contents -- AdminDashboard-CMX3zVng.js. A deploy rebuilds those
   with new hashes and removes the old files, but a browser holding the
   previous index.html goes on asking for the old name. It is gone, the dynamic
   import rejects, and the router shows its error page:

     Failed to fetch dynamically imported module:
     https://.../assets/AdminDashboard-CMX3zVng.js

   Nothing is broken -- the visitor simply has yesterday's index.html and
   today's assets. Fetching the page again resolves it, so that is what this
   does, once, rather than showing someone an error whose only remedy is a
   refresh they have to think of themselves.

   Once, because a chunk can also fail for reasons a reload will not mend -- a
   tunnel, a captive portal, a genuinely broken build. A flag in sessionStorage
   marks that the reload has been tried, so the second failure is allowed
   through to the error page instead of turning into a loop. It is cleared on
   the next success, and sessionStorage is per-tab and dies with it, so this
   cannot poison a later visit. */
const RELOAD_FLAG = 'mpay:chunk-reloaded';

/* Private windows and blocked site data make these throw rather than return
   null, and a storage failure must not be what stops a page from loading. */
const readFlag = () => {
  try {
    return sessionStorage.getItem(RELOAD_FLAG) === '1';
  } catch {
    return false;
  }
};

const writeFlag = (value) => {
  try {
    if (value) sessionStorage.setItem(RELOAD_FLAG, '1');
    else sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    /* Then the retry simply does not happen twice in this tab. */
  }
};

export function lazyWithRetry(factory) {
  return lazy(async () => {
    try {
      const module = await factory();
      writeFlag(false);
      return module;
    } catch (error) {
      if (readFlag()) throw error;

      writeFlag(true);
      /* reload(), not replace(): the URL is already right, and this keeps the
         entry in history so Back still goes where the visitor expects. */
      window.location.reload();

      /* Never settles. The reload is already under way, and resolving or
         rejecting here would render something for the instant before it. */
      return new Promise(() => {});
    }
  });
}

export default lazyWithRetry;
