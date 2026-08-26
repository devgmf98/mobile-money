import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Banknote, Clock, History, Home, QrCode, Send } from 'lucide-react';
import styles from './BottomNav.module.css';

const userNavItems = [
  { label: 'Dashboard', icon: <Home />, to: '/user/dashboard' },
  { label: 'Send', icon: <Send />, to: '/user/send-money' },
  { label: 'Scan', icon: <QrCode />, to: '/user/scan' },
  { label: 'Withdraw', icon: <Banknote />, to: '/user/withdraw' },
  { label: 'Pendings', icon: <Clock />, to: '/user/pending-withdrawals' },
];

const agentNavItems = [
  { label: 'Dashboard', icon: <Home />, to: '/agent/dashboard' },
  { label: 'Send', icon: <Send />, to: '/agent/send-money' },
  { label: 'Scan', icon: <QrCode />, to: '/agent/scan' },
  { label: 'History', icon: <History />, to: '/agent/transactions' },
  { label: 'Pendings', icon: <Clock />, to: '/agent/pending-withdrawals' },
];

export default function BottomNav() {
  const location = useLocation();
  const isAgent = location.pathname.startsWith('/agent');
  const navItems = isAgent ? agentNavItems : userNavItems;

  return (
    <nav className={styles.bottomNav}>
      {navItems.map((item, idx) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            [styles.navItem, isActive ? styles.active : ''].join(' ')
          }
          end
        >
          <span className={styles.icon}>{item.icon}</span>
          <span className={styles.label}>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
