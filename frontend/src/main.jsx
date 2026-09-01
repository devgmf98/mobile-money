import React from 'react'
import '@fontsource-variable/inter'
// Helper to decode JWT
function decodeJWT(token) {
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

// Session timeout logic
const SESSION_TIMEOUT_MINUTES = 15;
let lastActivity = Date.now();

function setupSessionTimeout(logout, token) {
  // Token expiry check
  function checkTokenExpiry() {
    if (!token) return;
    const decoded = decodeJWT(token);
    if (decoded && decoded.exp) {
      const expiry = decoded.exp * 1000;
      if (Date.now() > expiry) {
        logout();
      }
    }
  }

  // Inactivity check
  function resetActivity() {
    lastActivity = Date.now();
  }
  function checkInactivity() {
    if (Date.now() - lastActivity > SESSION_TIMEOUT_MINUTES * 60 * 1000) {
      logout();
    }
  }

  // Listen for user activity
  ['mousemove', 'keydown', 'mousedown', 'touchstart'].forEach(evt => {
    window.addEventListener(evt, resetActivity, { passive: true });
  });

  // Check every 1 minute
  const interval = setInterval(() => {
    checkTokenExpiry();
    checkInactivity();
  }, 60 * 1000);

  // Also check on load
  checkTokenExpiry();

  // Cleanup
  return () => {
    clearInterval(interval);
    ['mousemove', 'keydown', 'mousedown', 'touchstart'].forEach(evt => {
      window.removeEventListener(evt, resetActivity);
    });
  };
}
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate, Outlet, ScrollRestoration } from 'react-router-dom'
import { useAuthStore } from './context/store';
import { canAccess } from './utils/roles'

// Theme provider + session timeout
function ThemeProvider({ children }) {
  const logout = useAuthStore((state) => state.logout);
  const token = useAuthStore((state) => state.token);
  React.useEffect(() => {
    const theme = useAuthStore.getState().theme || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    // Setup session timeout
    const cleanup = setupSessionTimeout(logout, token);
    return cleanup;
  }, [logout, token]);
  return children;
}

// Suppress React Router v7 startTransition warning since we've already opted in via the future flag
const originalWarn = console.warn
console.warn = (...args) => {
  if (args[0]?.includes?.('React Router will begin wrapping state updates in')) {
    return
  }
  originalWarn(...args)
}

// Protected Route wrapper component
/* Hiding a link does not protect the page behind it — the URL still works.
   Every admin route is admitted through the same list the sidebar draws from,
   so the two cannot disagree. A sub-admin who types a forbidden address is
   returned to their dashboard rather than logged out. */
function AdminOnly({ path, children }) {
  const user = useAuthStore((state) => state.user);
  if (!canAccess(user, path)) return <Navigate to="/admin/dashboard" replace />;
  return children;
}

function ProtectedRoute({ children, requiredRole }) {
  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (requiredRole && !requiredRole.includes(user?.role)) {
    return <Navigate to="/login" replace />
  }

  return children
}

// Pages
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import UserLayout from './components/UserLayout'
const UserDashboard = React.lazy(() => import('./pages/UserDashboard'))
const SendMoney = React.lazy(() => import('./pages/SendMoney'))
const Withdraw = React.lazy(() => import('./pages/Withdraw'))
const Transactions = React.lazy(() => import('./pages/Transactions'))
const Notifications = React.lazy(() => import('./pages/Notifications'))
const Profile = React.lazy(() => import('./pages/Profile'))
import AdminLayout from './components/AdminLayout'
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'))
const AdminUsers = React.lazy(() => import('./pages/AdminUsers'))
const AdminTransactions = React.lazy(() => import('./pages/AdminTransactions'))
const AdminNotifications = React.lazy(() => import('./pages/AdminNotifications'))
const AdminTopup = React.lazy(() => import('./pages/AdminTopup'))
const AdminWithdraw = React.lazy(() => import('./pages/AdminWithdraw'))
const AdminPushMoney = React.lazy(() => import('./pages/AdminPushMoney'))
const AdminProfile = React.lazy(() => import('./pages/AdminProfile'))
const AdminSettings = React.lazy(() => import('./pages/AdminSettings'))
const AdminTieredCommission = React.lazy(() => import('./pages/AdminTieredCommission'))
const AdminStateSettings = React.lazy(() => import('./pages/AdminStateSettings'))
const AdminStateSend = React.lazy(() => import('./pages/AdminStateSend'))
const AdminStatePending = React.lazy(() => import('./pages/AdminStatePending'))
const AdminCurrency = React.lazy(() => import('./pages/AdminCurrency'))
const AdminCurrencyRates = React.lazy(() => import('./pages/AdminCurrencyRates'))
const AdminMoneyExchange = React.lazy(() => import('./pages/AdminMoneyExchange'))
const AdminExchangeTransactions = React.lazy(() => import('./pages/AdminExchangeTransactions'))
const AgentDashboard = React.lazy(() => import('./pages/AgentDashboard'))
const AgentWithdraw = React.lazy(() => import('./pages/AgentWithdraw'))
const PendingWithdrawals = React.lazy(() => import('./pages/PendingWithdrawals'))
const PendingAdminRequests = React.lazy(() => import('./pages/PendingAdminRequests'))
const Designing = React.lazy(() => import('./pages/Designing'))
const QRScan = React.lazy(() => import('./pages/QRScan'))
const ReceiveQR = React.lazy(() => import('./pages/ReceiveQR'))
import RouteError from './pages/RouteError'

/* ---------------------------------------------------------------------------
   Page stylesheets, pinned here in module-graph order (.css-order pinned).

   These pages are lazy-loaded, and a lazy chunk's CSS is emitted AFTER the
   entry's. Left to itself that puts design-system.css - the single source of
   truth for .btn/.card/.form-group - ahead of the page stylesheets it is
   meant to override, inverting the cascade for every shared primitive.

   Importing them here makes all CSS part of the entry in one deterministic
   order, with globals.css and design-system.css last, exactly as before the
   routes were split. The pages still import their own stylesheets; those are
   the same modules, so they dedupe and the order below is what wins.
   --------------------------------------------------------------------------- */
import './styles/auth.css'
import './components/BottomNav.module.css'
import './styles/layout.css'
import './components/HamburgerMenu.css'
import './pages/UserDashboard.module.css'
import './styles/user-dashboard.css'
import './styles/footer.css'
import './styles/qr-scanner.css'
import './styles/send-money.css'
import './styles/send-money-flow.css'
import './styles/withdraw.css'
import './styles/withdraw-flow.css'
import './styles/print-receipt.css'
import './styles/transactions.css'
import './styles/transactions-flow.css'
import './styles/notifications.css'
import './styles/notifications-flow.css'
import './styles/profile.css'
import './styles/profile-flow.css'
import './styles/composition-chart.css'
import './styles/admin-dashboard.css'
import './styles/admin-users.css'
import './styles/admin-transactions.css'
import './styles/select.css'
import './styles/admin-notifications.css'
import './styles/admin-topup.css'
import './styles/admin-agent-withdraw.css'
import './styles/admin-push-money.css'
import './styles/admin-account.css'
import './styles/admin-tiered-commission.css'
import './styles/admin-state-settings.css'
import './styles/admin-state-send.css'
import './styles/admin-state-pending.css'
import './styles/admin-currency.css'
import './styles/admin-currency-rates.css'
import './styles/admin-money-exchange.css'
import './styles/admin-exchange-transactions.css'
import './pages/AgentDashboard.module.css'
import './styles/pending-withdrawals.css'
import './styles/pending-withdrawals-flow.css'
import './styles/qr-scan.css'
import './styles/receive-qr.css'

import './styles/globals.css'
// last import wins: single source of truth for shared primitives
import './styles/design-system.css'

/* React Router does not reset scroll between routes, so navigating from a
   scrolled page landed you part-way down the next one. ScrollRestoration
   scrolls to top on a new navigation and restores the old position on
   back/forward. Mounted at the root so every route gets it. */

/* Shown while a route's chunk is in flight. Deliberately plain — a heavy
   skeleton here would defeat the point of splitting the bundle. */
/* Shown while a route's chunk is in flight.

   The height matters more than the content. This used to be min-height:60vh,
   which is shorter than most pages — so if it painted at all, the document
   collapsed to 60vh and then sprang back when the real page arrived. On a
   fast connection that is a single frame, which reads as the page bouncing on
   every navigation.

   100vh is never shorter than the viewport, so the scroll height cannot
   shrink underneath you mid-navigation. */
function RouteFallback() {
  return (
    <div style={{
      display: 'grid', placeItems: 'center', minHeight: '100vh',
      color: 'var(--text-light, #64748B)', fontSize: 13,
    }}>
      Loading…
    </div>
  );
}

function RootLayout() {
  return (
    <>
      <ScrollRestoration />
      <Outlet />
    </>
  );
}

const router = createBrowserRouter(
  [
    {
      // Root route with errorElement to catch and render any route errors
      path: '/',
      element: <RootLayout />,
      errorElement: <RouteError />,
      children: [
        { path: '/', element: <Navigate to="/login" replace /> },
        { path: '/login', element: <Login /> },
        { path: '/register', element: <Register /> },
        { path: '/forgot-password', element: <ForgotPassword /> },
        {
          path: '/user',
          element: (
            <ProtectedRoute requiredRole={["user"]}>
              <UserLayout />
            </ProtectedRoute>
          ),
          children: [
            { path: 'dashboard', element: <UserDashboard /> },
            { path: 'send-money', element: <SendMoney /> },
            { path: 'scan', element: <QRScan /> },
            { path: 'receive', element: <ReceiveQR /> },
            { path: 'withdraw', element: <Withdraw /> },
            { path: 'pending-withdrawals', element: <PendingWithdrawals /> },
            { path: 'designing', element: <Designing /> },
            { path: 'transactions', element: <Transactions /> },
            { path: 'notifications', element: <Notifications /> },
            { path: 'profile', element: <Profile /> }
          ]
        },
        {
          path: '/agent',
          element: (
            <ProtectedRoute requiredRole={["agent"]}>
              <UserLayout />
            </ProtectedRoute>
          ),
          children: [
            { path: 'dashboard', element: <AgentDashboard /> },
            { path: 'send-money', element: <SendMoney /> },
            { path: 'scan', element: <QRScan /> },
            { path: 'receive', element: <ReceiveQR /> },
            { path: 'withdraw', element: <Withdraw /> },
            { path: 'pull-from-user', element: <AgentWithdraw /> },
            { path: 'pending-withdrawals', element: <PendingWithdrawals /> },
            { path: 'pending-admin-requests', element: <PendingAdminRequests /> },
            { path: 'designing', element: <Designing /> },
            { path: 'transactions', element: <Transactions /> },
            { path: 'notifications', element: <Notifications /> },
            { path: 'profile', element: <Profile /> }
          ]
        },
        {
          path: '/admin',
          element: (
            <ProtectedRoute requiredRole={["admin", "sub-admin"]}>
              <AdminLayout />
            </ProtectedRoute>
          ),
          children: [
            { path: 'dashboard', element: <AdminOnly path="/admin/dashboard"><AdminDashboard /></AdminOnly> },
            { path: 'users', element: <AdminOnly path="/admin/users"><AdminUsers /></AdminOnly> },
            { path: 'transactions', element: <AdminOnly path="/admin/transactions"><AdminTransactions /></AdminOnly> },
            { path: 'notifications', element: <AdminOnly path="/admin/notifications"><AdminNotifications /></AdminOnly> },
            { path: 'topup', element: <AdminOnly path="/admin/topup"><AdminTopup /></AdminOnly> },
            { path: 'push-money', element: <AdminOnly path="/admin/push-money"><AdminPushMoney /></AdminOnly> },
            { path: 'withdraw-agent', element: <AdminOnly path="/admin/withdraw-agent"><AdminWithdraw /></AdminOnly> },
            { path: 'tiered-commission', element: <AdminOnly path="/admin/tiered-commission"><AdminTieredCommission /></AdminOnly> },
            { path: 'currencies', element: <AdminOnly path="/admin/currencies"><AdminCurrency /></AdminOnly> },
            { path: 'currency-rates', element: <AdminOnly path="/admin/currency-rates"><AdminCurrencyRates /></AdminOnly> },
            { path: 'money-exchange', element: <AdminOnly path="/admin/money-exchange"><AdminMoneyExchange /></AdminOnly> },
            { path: 'exchange-transactions', element: <AdminOnly path="/admin/exchange-transactions"><AdminExchangeTransactions /></AdminOnly> },
            { path: 'state-settings', element: <AdminOnly path="/admin/state-settings"><AdminStateSettings /></AdminOnly> },
            { path: 'send-state', element: <AdminOnly path="/admin/send-state"><AdminStateSend /></AdminOnly> },
            { path: 'send-state-pending', element: <AdminOnly path="/admin/send-state-pending"><AdminStatePending /></AdminOnly> },
            { path: 'settings', element: <AdminOnly path="/admin/settings"><AdminSettings /></AdminOnly> },
            { path: 'profile', element: <AdminOnly path="/admin/profile"><AdminProfile /></AdminOnly> }
          ]
        }
      ]
    }
  ],
  {
    future: {
      v7_startTransition: true
    }
  }
)
 

/* Warm the route chunks once the app has settled.

   Splitting the routes means the first visit to a page fetches its chunk over
   the network. While that is in flight React shows the Suspense fallback, then
   swaps in the real page — a brief layout change that reads as the page
   shaking. The second visit is instant because the chunk is cached, which is
   exactly the "shakes once, then never again" behaviour.

   Fetching them during idle time removes the wait without giving up the
   splitting: the initial bundle stays small, and by the time anything is
   clicked the module is already in memory. Failures are ignored on purpose —
   this is an optimisation, and the normal lazy path still works if it does not
   complete. */
if (typeof window !== 'undefined') {
  const warmRouteChunks = () => {
    /* Same specifiers the React.lazy calls use, so Vite maps them to the same
       chunks rather than emitting a second copy.

       MobileDashboard and AdminCurrencyConverter are excluded because no route
       renders them — a bare glob pulled them in and Vite emitted two extra
       chunks for code that is never reached. */
    const pages = import.meta.glob([
      './pages/*.jsx',
      // no route renders these — a bare glob emitted chunks for dead code
      '!./pages/MobileDashboard.jsx',
      '!./pages/AdminCurrencyConverter.jsx',
      // already in the entry chunk (imported eagerly), so warming them does
      // nothing and only makes Rollup warn about the mixed import styles
      '!./pages/Login.jsx',
      '!./pages/Register.jsx',
      '!./pages/ForgotPassword.jsx',
      '!./pages/RouteError.jsx',
    ]);
    for (const load of Object.values(pages)) load().catch(() => {});
  };

  if ('requestIdleCallback' in window) {
    requestIdleCallback(warmRouteChunks, { timeout: 4000 });
  } else {
    setTimeout(warmRouteChunks, 1500);
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </React.StrictMode>,
)
