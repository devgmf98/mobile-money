import BottomNav from './BottomNav';
import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import mpLogo from '../assets/mp-logo.png';
import mpIcon from '../assets/mp-icon.png';
import { Banknote, Bell, ChartColumn, CircleUserRound, ClipboardList, Hourglass, LogOut, Menu, PanelLeftClose, PanelLeftOpen, QrCode, RefreshCw, Upload, User, UserCog, X } from 'lucide-react';
import { useAuthStore } from '../context/store';
import { useNotificationStore } from '../context/store';
import { notificationAPI } from '../utils/api';
import io from 'socket.io-client';
import '../styles/layout.css';
import './HamburgerMenu.css';

/* Navbar page title — keyed by the last path segment, so it works for both the
   /user and /agent trees. Titles and icons match the sidebar nav items, since
   the navbar is naming whichever one is active.

   `scan`, `receive` and `designing` are reachable inside this layout without
   having a sidebar item of their own; they get a title here rather than
   falling through to the path-segment fallback. */
const PAGE_META = {
  dashboard: { title: 'Dashboard', Icon: ChartColumn },
  'send-money': { title: 'Send Money', Icon: Upload },
  withdraw: { title: 'Withdraw', Icon: Banknote },
  'pull-from-user': { title: 'Pull from User', Icon: RefreshCw },
  'pending-admin-requests': { title: 'Admin Requests', Icon: UserCog },
  transactions: { title: 'Transactions', Icon: ClipboardList },
  notifications: { title: 'Notifications', Icon: Bell },
  profile: { title: 'Profile', Icon: User },
  scan: { title: 'Scan QR', Icon: QrCode },
  receive: { title: 'Receive', Icon: QrCode },
  designing: { title: 'Designing', Icon: ChartColumn },
};

// The one path both roles share under a different sidebar label.
const PENDING = {
  user: { title: 'Pending Withdrawals', Icon: Hourglass },
  agent: { title: 'Pending Requests', Icon: Hourglass },
};

// Keeps a new route from rendering a blank navbar.
const titleFromPath = (segment) => segment
  .split('-')
  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
  .join(' ');

export default function UserLayout() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const notifications = useNotificationStore((state) => state.notifications);
  const setNotifications = useNotificationStore((state) => state.setNotifications);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sidebarCollapsed')) || false;
    } catch (e) {
      return false;
    }
  });
  const menuRef = useRef(null);
  const toggleRef = useRef(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userRef = useRef(null);
  const userMenuRef = useRef(null);

  // Close user dropdown when viewport is small and prevent opening it on small screens
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = () => {
      if (mq.matches) setUserMenuOpen(false);
    };
    // Ensure correct state on mount
    handler();
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else mq.removeListener(handler);
    };
  }, []);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const { data } = await notificationAPI.getNotifications();
        setNotifications(data);
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    };

    fetchNotifications();

    // Connect to socket
    const socket = io(import.meta.env.VITE_SOCKET_URL || 'https://cash-app-apis.up.railway.app');
    socket.emit('join-user', user?.id);

    socket.on('new-notification', (data) => {
      addNotification(data);
    });

    // Listen for balance updates and update auth store when relevant
    socket.on('balance-updated', (payload) => {
      try {
        if (payload?.userId === user?.id) {
          // fetch current user object and update the store with new balance
          const updated = { ...user, balance: parseFloat(payload.balance) || 0 };
          // update local storage and zustand store
          localStorage.setItem('user', JSON.stringify(updated));
          // call store updater
          // import/useAuthStore here would cause hook rule issues; instead dispatch a custom event
          window.dispatchEvent(new CustomEvent('mpay:user-updated', { detail: updated }));
        }
      } catch (err) {
        console.error('Failed to apply balance update', err);
      }
    });

    return () => socket.disconnect();
  }, [user?.id]);

  // close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      const target = e.target;
      const clickedInsideMenu = menuRef.current && menuRef.current.contains(target);
      const clickedToggle = toggleRef.current && toggleRef.current.contains(target);
      const clickedInsideUser = userMenuRef.current && userMenuRef.current.contains(target);
      const clickedUser = userRef.current && userRef.current.contains(target);

      if (!clickedInsideMenu && !clickedToggle) {
        setMenuOpen(false);
      }

      if (!clickedInsideUser && !clickedUser) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // close it on navigation, so tapping a link does not leave the drawer open
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // and on Escape, which is the expected way out of any overlay
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleCollapse = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem('sidebarCollapsed', JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };

  /* The collapsed rail clips its own overflow, so the hovered label is drawn as
     a fixed element — which escapes the clip but then needs real coordinates,
     since a fixed box with auto offsets falls back to its static position and
     lands on top of the icon it is meant to name. CSS cannot know where a row
     sits, so one delegated listener writes the position onto whichever item is
     under the pointer and the stylesheet reads it back.

     Same mechanism as the admin rail, so the two behave identically. */
  const positionRailLabel = (e) => {
    if (!collapsed) return;
    const item = e.target.closest && e.target.closest('.nav-item, .sidebar-logout');
    if (!item) return;
    const r = item.getBoundingClientRect();
    item.style.setProperty('--tip-x', `${Math.round(r.right + 12)}px`);
    item.style.setProperty('--tip-y', `${Math.round(r.top + r.height / 2)}px`);
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const baseRoute = `/${user?.role || 'user'}`;

  const segment = pathname.split('/').filter(Boolean).pop() || 'dashboard';
  const pageMeta = segment === 'pending-withdrawals'
    ? (PENDING[user?.role] || PENDING.user)
    : PAGE_META[segment];
  const pageTitle = pageMeta?.title || titleFromPath(segment);
  const PageIcon = pageMeta?.Icon;

  return (
    <div className="layout">
      {/* Dims the page behind the drawer and gives a tap target to dismiss it.
          Only rendered while open, so it never intercepts clicks otherwise. */}
      {menuOpen && (
        <div
          className="sidebar-scrim"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar ${menuOpen ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`} ref={menuRef}>
        <div className="sidebar-brand">
          <img src={mpLogo} alt="MoneyPay" className="brand-logo-full" />
          <img src={mpIcon} alt="" aria-hidden="true" className="brand-logo-mark" />
          <button
            type="button"
            className="sidebar-toggle"
            onClick={toggleCollapse}
            aria-pressed={collapsed}
            aria-label={collapsed ? 'Show labels' : 'Show icons only'}
            title={collapsed ? 'Show labels' : 'Show icons only'}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>

          {/* Closes the drawer. It lives here rather than in the navbar because
              the scrim covers the navbar while the drawer is open — a close
              control up there would be unreachable. Small screens only. */}
          <button
            type="button"
            className="drawer-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="sidebar-nav" onMouseOver={positionRailLabel}>
          <NavLink to={`${baseRoute}/dashboard`} className={({ isActive }) => (isActive ? 'nav-item nav-card active' : 'nav-item nav-card')} onClick={() => { if (window.innerWidth <= 768) setMenuOpen(false); }}>
            <span className="nav-icon"><ChartColumn size={18} /></span>
            <span className="nav-label">Dashboard</span>
          </NavLink>
          <NavLink to={`${baseRoute}/send-money`} className={({ isActive }) => (isActive ? 'nav-item nav-card active' : 'nav-item nav-card')} onClick={() => { if (window.innerWidth <= 768) setMenuOpen(false); }}>
            <span className="nav-icon"><Upload size={18} /></span>
            <span className="nav-label">Send Money</span>
          </NavLink>
          {user?.role === 'user' && (
            <NavLink to={`${baseRoute}/withdraw`} className={({ isActive }) => (isActive ? 'nav-item nav-card active' : 'nav-item nav-card')} onClick={() => { if (window.innerWidth <= 768) setMenuOpen(false); }}>
              <span className="nav-icon"><Banknote size={18} /></span>
              <span className="nav-label">Withdraw</span>
            </NavLink>
          )}
          {user?.role === 'agent' && (
            <>
              <NavLink to={`${baseRoute}/pull-from-user`} className={({ isActive }) => (isActive ? 'nav-item nav-card active' : 'nav-item nav-card')} onClick={() => { if (window.innerWidth <= 768) setMenuOpen(false); }}>
                <span className="nav-icon"><RefreshCw size={18} /></span>
                <span className="nav-label">Pull from User</span>
              </NavLink>
              <NavLink to={`${baseRoute}/pending-withdrawals`} className={({ isActive }) => (isActive ? 'nav-item nav-card active' : 'nav-item nav-card')} onClick={() => { if (window.innerWidth <= 768) setMenuOpen(false); }}>
                <span className="nav-icon"><Hourglass size={18} /></span>
                <span className="nav-label">Pending Requests</span>
              </NavLink>
              <NavLink to={`${baseRoute}/pending-admin-requests`} className={({ isActive }) => (isActive ? 'nav-item nav-card active' : 'nav-item nav-card')} onClick={() => { if (window.innerWidth <= 768) setMenuOpen(false); }}>
                <span className="nav-icon"><UserCog size={18} /></span>
                <span className="nav-label">Admin Requests</span>
              </NavLink>
            </>
          )}
          {user?.role === 'user' && (
            <NavLink to={`${baseRoute}/pending-withdrawals`} className={({ isActive }) => (isActive ? 'nav-item nav-card active' : 'nav-item nav-card')} onClick={() => { if (window.innerWidth <= 768) setMenuOpen(false); }}>
              <span className="nav-icon"><Hourglass size={18} /></span>
              <span className="nav-label">Pending Withdrawals</span>
            </NavLink>
          )}
          <NavLink to={`${baseRoute}/transactions`} className={({ isActive }) => (isActive ? 'nav-item nav-card active' : 'nav-item nav-card')} onClick={() => { if (window.innerWidth <= 768) setMenuOpen(false); }}>
            <span className="nav-icon"><ClipboardList size={18} /></span>
            <span className="nav-label">Transactions</span>
          </NavLink>
          <NavLink to={`${baseRoute}/notifications`} className={({ isActive }) => (isActive ? 'nav-item nav-card active' : 'nav-item nav-card')} onClick={() => { if (window.innerWidth <= 768) setMenuOpen(false); }}>
            <span className="nav-icon"><Bell size={18} /></span>
            <span className="nav-label">Notifications</span>
            {unreadCount > 0 && <span className="badge-count">{unreadCount}</span>}
          </NavLink>
          <NavLink to={`${baseRoute}/profile`} className={({ isActive }) => (isActive ? 'nav-item nav-card active' : 'nav-item nav-card')} onClick={() => { if (window.innerWidth <= 768) setMenuOpen(false); }}>
            <span className="nav-icon"><User size={18} /></span>
            <span className="nav-label">Profile</span>
          </NavLink>
        </nav>
        <div className="sidebar-footer" onMouseOver={positionRailLabel}>
          <button className="btn btn-outline logout-mobile sidebar-logout" onClick={() => { setMenuOpen(false); handleLogout(); }}>
            <span className="btn-icon"><LogOut size={18} /></span>
            <span className="btn-label">Logout</span>
          </button>
        </div>
      </aside>

      <div className="main">
        <div className="navbar">
          {/* Small screens only. The sidebar is `display: none` below 1033px
              where the bottom nav takes over, but the bottom nav carries five
              destinations and the sidebar carries seven or eight plus logout —
              Profile, Notifications, Transactions, Pull from User and Admin
              Requests had no route in on a phone at all. This opens the sidebar
              as a drawer over the page. `toggleRef` was already wired into the
              outside-click handler; only the button was ever missing. */}
          <button
            type="button"
            className="navbar-menu-btn"
            ref={toggleRef}
            onClick={() => setMenuOpen(true)}
            aria-expanded={menuOpen}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          {/* Logo below 769px, where the sidebar is off-canvas and the navbar
              is the only thing carrying the brand. */}
          <div className="navbar-brand">
            <img src={mpLogo} alt="MoneyPay" className="navbar-brand-logo" />
          </div>

          {/* Collapsed, the rail has no room for a control beside a 38px logo
              — the toggle sat under it and read as a stray icon. It moves up
              here instead, beside the page it would expand back to. Same
              placement as the admin layout. */}
          {collapsed && (
            <button
              type="button"
              className="navbar-sidebar-toggle"
              onClick={toggleCollapse}
              aria-pressed={collapsed}
              aria-label="Show labels"
              title="Show labels"
            >
              <PanelLeftOpen size={18} />
            </button>
          )}

          {/* From 769px up the sidebar is on screen with the brand at its top,
              so repeating the logo here said nothing. This names the active
              sidebar item instead. */}
          <div className="navbar-page-title">
            {PageIcon && <PageIcon size={18} />}
            <span>{pageTitle}</span>
          </div>

          <div style={{ flex: 1 }}></div>

          <div className="navbar-icons">
            {/* Quick access to the user's own QR code. Large screens only —
                below 769px the bottom nav already covers this. */}
            <div
              className="navbar-icon-item navbar-qr"
              onClick={() => navigate(`${baseRoute}/receive`)}
              title="Show my QR code"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`${baseRoute}/receive`); } }}
            >
              <QrCode size={20} />
            </div>

            {/* Notification Icon */}
            <div
              className="navbar-icon-item"
              style={{ position: 'relative', cursor: 'pointer' }}
              onClick={() => navigate(`${baseRoute}/notifications`)}
              title="Notifications"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="navbar-badge">
                  {unreadCount}
                </span>
              )}
            </div>

            {/* Profile Avatar */}
            <div
              ref={userRef}
              className="navbar-icon-item"
              onClick={() => navigate(`${baseRoute}/profile`)}
              style={{ cursor: 'pointer', position: 'relative' }}
              title="Profile"
            >
              {/* the avatar when one is set, the fallback icon otherwise */}
              {user?.profileImage
                ? <img src={user.profileImage} alt="" className="navbar-avatar" />
                : <CircleUserRound size={28} />}
            </div>
          </div>
        </div>

        <div className="layout-body">
          <Suspense fallback={<div className="route-loading" aria-busy="true">Loading...</div>}>
            <Outlet />
          </Suspense>
        </div>
        {/* Always rendered; a media query decides whether it shows. Gating on
            window.innerWidth read the width once at render and never again, so
            the bar did not appear or disappear when the window was resized. */}
        <BottomNav />
        {/* ...existing code... */}

      </div>
    </div>
  );
}
