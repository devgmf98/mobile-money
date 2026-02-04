import { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../context/store';
import { useNotificationStore } from '../context/store';
import { notificationAPI } from '../utils/api';
import io from 'socket.io-client';
import '../styles/layout.css';

export default function UserLayout() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const notifications = useNotificationStore((state) => state.notifications);
  const setNotifications = useNotificationStore((state) => state.setNotifications);
  const addNotification = useNotificationStore((state) => state.addNotification);
  const navigate = useNavigate();
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
    const socket = io('http://localhost:8080');
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

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const baseRoute = `/${user?.role || 'user'}`;

  return (
    <div className="layout">
      <aside className={`sidebar ${menuOpen ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`} ref={menuRef}>
        <div className="sidebar-brand">
          <span className="brand-icon">💰</span>
          <span className="brand-label">MoneyPay</span>
        </div>
        <button className="sidebar-toggle" onClick={toggleCollapse} title={collapsed ? 'Expand' : 'Collapse'}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <nav className="sidebar-nav">
          <Link to={`${baseRoute}/dashboard`} className="nav-item nav-card">
            <span className="nav-icon">📊</span>
            <span className="nav-label">Dashboard</span>
          </Link>
          <Link to={`${baseRoute}/send-money`} className="nav-item nav-card">
            <span className="nav-icon">📤</span>
            <span className="nav-label">Send Money</span>
          </Link>
          {user?.role === 'user' && (
            <Link to={`${baseRoute}/withdraw`} className="nav-item nav-card">
              <span className="nav-icon">💵</span>
              <span className="nav-label">Withdraw</span>
            </Link>
          )}
          {user?.role === 'agent' && (
            <>
              <Link to={`${baseRoute}/pull-from-user`} className="nav-item nav-card">
                <span className="nav-icon">🔄</span>
                <span className="nav-label">Pull from User</span>
              </Link>
              <Link to={`${baseRoute}/pending-withdrawals`} className="nav-item nav-card">
                <span className="nav-icon">⏳</span>
                <span className="nav-label">Pending Requests</span>
              </Link>
              <Link to={`${baseRoute}/pending-admin-requests`} className="nav-item nav-card">
                <span className="nav-icon">👨‍💼</span>
                <span className="nav-label">Admin Requests</span>
              </Link>
            </>
          )}
          {user?.role === 'user' && (
            <Link to={`${baseRoute}/pending-withdrawals`} className="nav-item nav-card">
              <span className="nav-icon">⏳</span>
              <span className="nav-label">Pending Withdrawals</span>
            </Link>
          )}
          <Link to={`${baseRoute}/transactions`} className="nav-item nav-card">
            <span className="nav-icon">📋</span>
            <span className="nav-label">Transactions</span>
          </Link>
          <Link to={`${baseRoute}/notifications`} className="nav-item nav-card">
            <span className="nav-icon">🔔</span>
            <span className="nav-label">Notifications</span>
            {unreadCount > 0 && <span className="badge-count">{unreadCount}</span>}
          </Link>
          <Link to={`${baseRoute}/profile`} className="nav-item nav-card">
            <span className="nav-icon">👤</span>
            <span className="nav-label">Profile</span>
          </Link>
        </nav>
        <div className="sidebar-footer">
          <button className="btn btn-outline logout-mobile sidebar-logout" onClick={() => { setMenuOpen(false); handleLogout(); }}>
            <span className="btn-icon">🔒</span>
            <span className="btn-label">Logout</span>
          </button>
        </div>
      </aside>

      <div className="main">
        <div className="navbar">
          <div className="navbar-brand">
            <h2>💰 MoneyPay</h2>
          </div>

          <button ref={toggleRef} className="menu-toggle" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen(s => !s)}>
            {menuOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 6H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>

          <div className="navbar-user" ref={userRef}>
            <div
              className="user-info"
              onClick={() => {
                if (typeof window !== 'undefined' && window.matchMedia('(min-width: 769px)').matches) {
                  setUserMenuOpen(s => !s);
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              <span className="user-name">{user?.name}</span>
              <span className="user-role">{user?.role}</span>
            </div>

            {userMenuOpen && (
              <div className="user-dropdown" ref={userMenuRef}>
                <button className="btn btn-outline" onClick={() => { setUserMenuOpen(false); handleLogout(); }}>Logout</button>
              </div>
            )}
          </div>
        </div>

        <div className="layout-body">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
