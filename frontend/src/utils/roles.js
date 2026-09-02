/* What a sub-admin may reach, in one place. The sidebar reads it to decide
   what to draw and the router reads it to decide what to admit, so a page
   cannot appear in one and be refused by the other — or, worse, stay reachable
   by typing its URL after being hidden from the menu.

   The server enforces the same split independently (staffMiddleware); this
   list is what the person sees, not what protects the data. */
export const SUB_ADMIN_PATHS = [
  '/admin/dashboard',
  '/admin/topup',
  '/admin/push-money',
  '/admin/withdraw-agent',
  '/admin/send-state',
  '/admin/send-state-pending',
  '/admin/money-exchange',
  '/admin/exchange-transactions',
  '/admin/transactions',
  '/admin/notifications',
  /* Sub-admins answer customer messages, so the inbox is theirs too. */
  '/admin/messages',
  '/admin/settings',
  '/admin/profile',
];

export const isSubAdmin = (user) => user?.role === 'sub-admin';

/* Admins keep everything; a sub-admin is held to the list above. */
export function canAccess(user, path) {
  if (!isSubAdmin(user)) return true;
  return SUB_ADMIN_PATHS.includes(path);
}

/* Anyone who works the counter — an admin or a sub-admin. Pages that act on a
   destination use this rather than testing for 'admin', which silently hid
   them from sub-admins. */
export const isStaff = (user) => user?.role === 'admin' || user?.role === 'sub-admin';
