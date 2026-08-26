import React, { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowRightLeft, Banknote, Bell, ChartColumn, CircleUserRound, CreditCard, Handshake, Inbox, Landmark, Lock, Map, Menu, PanelLeftClose, PanelLeftOpen, Plane, Repeat, Settings, TrendingUp, User, Users, Wallet, X } from 'lucide-react';
import mpLogo from '../assets/mp-logo.png';
import mpIcon from '../assets/mp-icon.png';
import { useAuthStore } from '../context/store';
import { adminAPI } from '../utils/api';
import '../styles/layout.css';

/* Title and icon shown in the navbar for the current route.
   Keep in step with the sidebar items below — same label, same icon. */
const PAGE_META = {
  '/admin/dashboard': { title: 'Dashboard', Icon: ChartColumn },
  '/admin/topup': { title: 'Topup Users', Icon: Banknote },
  '/admin/push-money': { title: 'Push Money', Icon: Handshake },
  '/admin/withdraw-agent': { title: 'Agent Withdrawal', Icon: Landmark },
  '/admin/send-state': { title: 'Send To Destination', Icon: Plane },
  '/admin/send-state-pending': { title: 'Send To Destination Pending', Icon: Inbox },
  '/admin/currencies': { title: 'Create Currency', Icon: ArrowRightLeft },
  '/admin/currency-rates': { title: 'Exchange Rates', Icon: ChartColumn },
  '/admin/money-exchange': { title: 'Money Exchange', Icon: Repeat },
  '/admin/exchange-transactions': { title: 'Exchange Transactions', Icon: ArrowRightLeft },
  '/admin/transactions': { title: 'Transactions', Icon: CreditCard },
  '/admin/users': { title: 'Users', Icon: Users },
  '/admin/notifications': { title: 'Notifications', Icon: Bell },
  '/admin/reports': { title: 'Reports', Icon: TrendingUp },
  '/admin/tiered-commission': { title: 'Tiered Commission', Icon: Wallet },
  '/admin/state-settings': { title: 'Destination Settings', Icon: Map },
  '/admin/settings': { title: 'Settings', Icon: Settings },
  '/admin/profile': { title: 'Profile', Icon: User },
};

// Fall back to the last path segment so a new route still shows something
// sensible rather than a blank navbar.
const titleFromPath = (pathname) => {
  const seg = String(pathname || '').split('/').filter(Boolean).pop() || '';
  return seg
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

export default function AdminLayout() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const pageMeta = PAGE_META[pathname];
  const pageTitle = pageMeta?.title || titleFromPath(pathname);
  const PageIcon = pageMeta?.Icon;

  /* Off-canvas drawer state for phones. Below 769px the sidebar is positioned
     off-screen and only slides in when this is true — before this existed the
     admin had no navigation at all at that width. */
  const [menuOpen, setMenuOpen] = useState(false);

  // close it on navigation, so tapping a link does not leave the drawer open
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // and on Escape, which is the expected way out of any overlay
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // Sidebar display mode. Default false => icons AND labels.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sidebarCollapsed')) || false;
    } catch (e) {
      return false;
    }
  });

  const toggleCollapse = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem('sidebarCollapsed', JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };

  const [pendingCount, setPendingCount] = useState(0);
  const [currencies, setCurrencies] = useState([]);
  const [exchangeRate, setExchangeRate] = useState(null);
  const [pairRates, setPairRates] = useState([]);
  const [rateFrom, setRateFrom] = useState('USD');
  const [rateTo, setRateTo] = useState('SSP');
  const [priceMode, setPriceMode] = useState('buying');

  // Platform base currency code (fallback to 'SSP')
  const BASE_CURRENCY = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BASE_CURRENCY) || 'SSP';

  // Rates span 8000 down to 0.000125, so precision has to adapt - a fixed
  // toFixed(4) would render the small direction as "0.0001".
  const formatRate = (n) => {
    if (n === null || !Number.isFinite(n)) return null;
    const abs = Math.abs(n);
    const dp = abs >= 1000 ? 2 : abs >= 1 ? 4 : abs >= 0.01 ? 6 : 8;
    return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: dp });
  };

  // Helper: compute effective rate for a currency based on priceType
  // Only use buying/selling prices. Treat base currency as 1 when prices are missing.
  const getEffectiveRate = (cur, side) => {
    if (!cur) return null;
    const pt = cur.priceType || 'fixed';
    const code = (cur.code || '').toUpperCase();
    if (pt === 'fixed') {
      const val = side === 'buying' ? cur.buyingPrice : cur.sellingPrice;
      if (val !== undefined && val !== null && val !== '') return Number(val);
      if (code === (BASE_CURRENCY || 'SSP').toUpperCase()) return 1;
      return null;
    }
    if (pt === 'percentage') {
      const pct = side === 'buying' ? cur.buyingPrice : cur.sellingPrice;
      if (pct !== undefined && pct !== null && pct !== '' && cur.exchangeRate !== undefined && cur.exchangeRate !== null && cur.exchangeRate !== '') {
        return Number(cur.exchangeRate) * (1 + Number(pct) / 100);
      }
      if (pct !== undefined && pct !== null && pct !== '' && code === (BASE_CURRENCY || 'SSP').toUpperCase()) {
        return 1 * (1 + Number(pct) / 100);
      }
      return null;
    }
    return null;
  };

  useEffect(() => {
    let mounted = true;
    const loadPending = async () => {
      try {
        if (!user || user.role !== 'admin') return setPendingCount(0);
        const { data } = await adminAPI.getPendingStateSendsCount();
        if (mounted) setPendingCount(Number(data.count || 0));
      } catch (err) {
        // Fail silently in production; only debug-log during development
        if (import.meta.env && import.meta.env.DEV) {
          console.debug('Failed to load pending state sends count, defaulting to 0', err?.response?.data || err.message || err);
        }
        if (mounted) setPendingCount(0);
      }
    };

    loadPending();
    const refreshHandler = () => { loadPending(); };
    window.addEventListener('mpay:refresh-admin-commission', refreshHandler);
    return () => { mounted = false; window.removeEventListener('mpay:refresh-admin-commission', refreshHandler); };
  }, [user]);

  // Load currencies for exchange rate display
  useEffect(() => {
    let mounted = true;
    const loadCurrencies = async () => {
      try {
        // Rates live in the pairwise exchangerates table, not on the currency
        // row - currencies.buyingPrice is unused and always null.
        try {
          const rr = await adminAPI.getExchangeRates();
          const rl = rr?.data?.exchangeRates || rr?.exchangeRates || [];
          if (mounted) setPairRates(Array.isArray(rl) ? rl : []);
        } catch (e) {
          if (mounted) setPairRates([]);
        }

        const res = await adminAPI.getCurrencies();
        const data = res?.data || res;
        const list = Array.isArray(data) ? data : (Array.isArray(data?.currencies) ? data.currencies : []);
        if (mounted) {
          setCurrencies(list);
          // Set default to/from if available
          // Only ever select a code that exists in the list, otherwise the
          // <select> falls back to showing its first option while state keeps
          // the stale code - the control and the value then disagree.
          const codes = list.map(c => (c.code || '').toUpperCase()).filter(Boolean);
          const base = (BASE_CURRENCY || 'SSP').toUpperCase();
          setRateFrom(prev => codes.includes(prev) ? prev
            : (codes.includes('USD') ? 'USD' : (codes[0] || prev)));
          setRateTo(prev => codes.includes(prev) ? prev
            : (codes.includes(base) ? base : (codes.find(c => c !== 'USD') || codes[0] || prev)));
        }
      } catch (err) {
        console.debug('Failed to load currencies', err);
      }
    };
    loadCurrencies();
    return () => { mounted = false; };
  }, []);

  // Calculate exchange rate
  useEffect(() => {
    if (!currencies.length) return;
    // Resolve exactly the way convertMoneyExchange does on the server:
    // direct pair first, then the inverse, then the currency-level fallback.
    const want = (a, b) => pairRates.find(p =>
      (p.fromCode || '').toUpperCase() === a && (p.toCode || '').toUpperCase() === b);

    const key = priceMode === 'buying' ? 'buyingPrice' : 'sellingPrice';
    const num = (v) => {
      if (v === undefined || v === null || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    let rate = null;

    const direct = want(rateFrom, rateTo);
    if (direct) {
      // stored as: 1 fromCode = rate * toCode
      rate = num(direct[key]);
    }

    if (rate === null) {
      const inverse = want(rateTo, rateFrom);
      const inv = inverse ? num(inverse[key]) : null;
      // stored the other way round: 1 toCode = inv * fromCode
      if (inv !== null && inv !== 0) rate = 1 / inv;
    }

    if (rate === null) {
      // last resort: the per-currency prices (unused today, kept for parity)
      const from = currencies.find(c => (c.code || '').toUpperCase() === rateFrom);
      const to = currencies.find(c => (c.code || '').toUpperCase() === rateTo);
      if (from && to) {
        const f = getEffectiveRate(from, priceMode === 'buying' ? 'selling' : 'buying');
        const t = getEffectiveRate(to, priceMode === 'buying' ? 'buying' : 'selling');
        if (f != null && t != null && Number(t) !== 0) rate = Number(f) / Number(t);
      }
    }

    if (rateFrom === rateTo) rate = 1;

    setExchangeRate(rate !== null && Number.isFinite(rate) ? rate : null);
  }, [rateFrom, rateTo, currencies, pairRates, priceMode]);

  

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={`admin-layout ${collapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Dims the page behind the drawer and gives a tap target to dismiss it.
          Only rendered while open, so it never intercepts clicks otherwise. */}
      {menuOpen && (
        <div
          className="admin-scrim"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className={`admin-sidebar sidebar ${collapsed ? 'collapsed' : ''} ${menuOpen ? 'open' : ''}`}>
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
              the scrim (z-index 999) covers the navbar (500) while the drawer
              is open — a close control up there would be unreachable. The
              drawer is 1000, so this one is on top. Phones/tablets only. */}
          <button
            type="button"
            className="admin-drawer-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar-menu">
          <span className="sidebar-group">Overview</span>
          <NavLink data-label="Dashboard" to="/admin/dashboard" className={({ isActive }) => (isActive ? 'sidebar-item active' : 'sidebar-item')}><ChartColumn size={18} /><span className="sidebar-label">Dashboard</span></NavLink>
          <span className="sidebar-group">Money movement</span>
          <NavLink data-label="Topup Users" to="/admin/topup" className={({ isActive }) => (isActive ? 'sidebar-item active' : 'sidebar-item')}><Banknote size={18} /><span className="sidebar-label">Topup Users</span></NavLink>
          <NavLink data-label="Push Money" to="/admin/push-money" className={({ isActive }) => (isActive ? 'sidebar-item active' : 'sidebar-item')}><Handshake size={18} /><span className="sidebar-label">Push Money</span></NavLink>
          <NavLink data-label="Agent Withdrawal" to="/admin/withdraw-agent" className={({ isActive }) => (isActive ? 'sidebar-item active' : 'sidebar-item')}><Landmark size={18} /><span className="sidebar-label">Agent Withdrawal</span></NavLink>
          <NavLink data-label="Send To Destination" to="/admin/send-state" className={({ isActive }) => (isActive ? 'sidebar-item active' : 'sidebar-item')}><Plane size={18} /><span className="sidebar-label">Send To Destination</span></NavLink>
          <NavLink data-label="Send To Destination Pending" to="/admin/send-state-pending" className={({ isActive }) => (isActive ? 'sidebar-item active' : 'sidebar-item')}>
            <Inbox size={18} /><span className="sidebar-label">Send To Destination Pending</span>
            {pendingCount > 0 && (
              <span style={{marginLeft:8, background:'#DC2626', color:'#fff', borderRadius:12, padding:'2px 8px', fontSize: '0.69rem'}}>{pendingCount}</span>
            )}
          </NavLink>
          <span className="sidebar-group">Currency tools</span>
          <NavLink data-label="Create Currency" to="/admin/currencies" className={({ isActive }) => (isActive ? 'sidebar-item active' : 'sidebar-item')}><ArrowRightLeft size={18} /><span className="sidebar-label">Create Currency</span></NavLink>
          <NavLink data-label="Exchange Rates" to="/admin/currency-rates" className={({ isActive }) => (isActive ? 'sidebar-item active' : 'sidebar-item')}><ChartColumn size={18} /><span className="sidebar-label">Exchange Rates</span></NavLink>
          <NavLink data-label="Money Exchange" to="/admin/money-exchange" className={({ isActive }) => (isActive ? 'sidebar-item active' : 'sidebar-item')}><Repeat size={18} /><span className="sidebar-label">Money Exchange</span></NavLink>
          <NavLink data-label="Exchange Transactions" to="/admin/exchange-transactions" className={({ isActive }) => (isActive ? 'sidebar-item active' : 'sidebar-item')}><ArrowRightLeft size={18} /><span className="sidebar-label">Exchange Transactions</span></NavLink>
          <span className="sidebar-group">Records</span>
          <NavLink data-label="Transactions" to="/admin/transactions" className={({ isActive }) => (isActive ? 'sidebar-item active' : 'sidebar-item')}><CreditCard size={18} /><span className="sidebar-label">Transactions</span></NavLink>
          <NavLink data-label="Users" to="/admin/users" className={({ isActive }) => (isActive ? 'sidebar-item active' : 'sidebar-item')}><Users size={18} /><span className="sidebar-label">Users</span></NavLink>
          <NavLink data-label="Notifications" to="/admin/notifications" className={({ isActive }) => (isActive ? 'sidebar-item active' : 'sidebar-item')}><Bell size={18} /><span className="sidebar-label">Notifications</span></NavLink>
          <NavLink data-label="Reports" to="/admin/reports" className={({ isActive }) => (isActive ? 'sidebar-item active' : 'sidebar-item')}><TrendingUp size={18} /><span className="sidebar-label">Reports</span></NavLink>
          <span className="sidebar-group">Configuration</span>
          <NavLink data-label="Tiered Commission" to="/admin/tiered-commission" className={({ isActive }) => (isActive ? 'sidebar-item active' : 'sidebar-item')}><Wallet size={18} /><span className="sidebar-label">Tiered Commission</span></NavLink>
          <NavLink data-label="Destination Settings" to="/admin/state-settings" className={({ isActive }) => (isActive ? 'sidebar-item active' : 'sidebar-item')}><Map size={18} /><span className="sidebar-label">Destination Settings</span></NavLink>
          <NavLink data-label="Settings" to="/admin/settings" className={({ isActive }) => (isActive ? 'sidebar-item active' : 'sidebar-item')}><Settings size={18} /><span className="sidebar-label">Settings</span></NavLink>
          <NavLink data-label="Profile" to="/admin/profile" className={({ isActive }) => (isActive ? 'sidebar-item active' : 'sidebar-item')}><User size={18} /><span className="sidebar-label">Profile</span></NavLink>
        </nav>

        {/* Exchange Rate Widget */}
        <div className="exchange-rate-widget">
          <div className="exchange-rate-header"><ArrowRightLeft size={18} /> Exchange Rate</div>
          <div className="exchange-rate-body">
            <div className="exchange-rate-mode">
              <select 
                value={priceMode} 
                onChange={(e) => setPriceMode(e.target.value)}
                className="exchange-rate-mode-select"
              >
                <option value="buying">Buying</option>
                <option value="selling">Selling</option>
              </select>
            </div>
            <div className="exchange-rate-inputs">
              <select 
                value={rateFrom} 
                onChange={(e) => setRateFrom(e.target.value)}
                className="exchange-rate-select"
              >
                {currencies.map(c => (
                  <option key={`${c.id}-${c.code}`} value={(c.code || '').toUpperCase()}>
                    {(c.code || '').toUpperCase()}
                  </option>
                ))}
              </select>
              <span className="exchange-rate-arrow"><ArrowRight size={18} /></span>
              <select 
                value={rateTo} 
                onChange={(e) => setRateTo(e.target.value)}
                className="exchange-rate-select"
              >
                {currencies.map(c => (
                  <option key={`${c.id}-${c.code}`} value={(c.code || '').toUpperCase()}>
                    {(c.code || '').toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="exchange-rate-display">
              {exchangeRate ? (
                <>
                  <div className="exchange-rate-value">{formatRate(exchangeRate)}</div>
                  {/* the rate itself belongs in the equation - without it this
                      read "1 USD = SSP" */}
                  <div className="exchange-rate-label">1 {rateFrom} = {formatRate(exchangeRate)} {rateTo}</div>
                </>
              ) : (
                <div className="exchange-rate-unset">
                  <span>No rate set</span>
                  <NavLink to="/admin/currency-rates">Set {rateFrom}/{rateTo} rate</NavLink>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="sidebar-footer">
          <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
            <button onClick={handleLogout} className="btn btn-danger btn-block sidebar-logout">
              <span className="btn-icon"><Lock size={18} /></span>
              <span className="btn-label">Logout</span>
            </button>
          </div>
        </div>
      </div>

      <div className="admin-main">
        <div className="admin-navbar">
          {/* Phones only — CSS hides it from 769px up, where the sidebar is
              always on screen and a menu button would be meaningless. */}
          <button
            type="button"
            className="admin-menu-btn"
            onClick={() => setMenuOpen(true)}
            aria-expanded={menuOpen}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          <div className="navbar-brand-admin">
            <NavLink to="/admin/dashboard" className={() => 'brand-link'}>
              <img src={mpLogo} alt="MoneyPay" className="navbar-logo" />
            </NavLink>
          </div>
          {/* Current page, large screens only — the navbar carries the logo
              at 768px and below, and is otherwise empty above it. */}
          <div className="navbar-page-title">
            {PageIcon && <PageIcon size={18} />}
            <span>{pageTitle}</span>
          </div>

          <div style={{ flex: 1 }}></div>
          <div className="admin-user-info">
            <div className="admin-user-details">
              <span className="admin-user-name">{user?.name}</span>
              <span className="admin-user-role">{user?.role}</span>
            </div>
            <div
              className="admin-profile-icon"
              onClick={() => navigate('/admin/profile')}
              title="Profile"
            >
              {user?.profileImage
                ? <img src={user.profileImage} alt="" className="navbar-avatar" />
                : <CircleUserRound size={28} />}
            </div>
          </div>
        </div>

        <div className="admin-body">
          <Suspense fallback={<div className="route-loading" aria-busy="true">Loading...</div>}>
            <Outlet />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
          