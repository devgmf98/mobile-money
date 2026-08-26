import React, { useState, useEffect } from 'react';
import styles from './UserDashboard.module.css';
import '../styles/user-dashboard.css';
import { ArrowDown, ArrowUp, Banknote, ChartColumn, Clock, Files, Hand, HandCoins, Inbox, Landmark, MapPin, Send, Upload, User, Wallet } from 'lucide-react';
import { useAuthStore } from '../context/store';
import { transactionAPI, authAPI } from '../utils/api';
import Footer from '../components/Footer';
import { useNavigate } from 'react-router-dom';
import { txLabel } from '../data/transactionTypes';

/* Sets the account number the way a bank prints one: digits only, in groups of
   four. "+211912399537" reads as "2119 1239 9537". The country-code plus is
   dropped because it marks the value as a phone number, which is the opposite
   of the intent. Anything with no digits at all is passed through untouched. */
const accountCode = (phone) => {
  if (!phone) return '—';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return String(phone);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
};

export default function UserDashboard() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const updateUser = useAuthStore((state) => state.updateUser);
  const [transactions, setTransactions] = useState([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [stats, setStats] = useState(null);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 1032px)').matches);

  // matchMedia only fires when the breakpoint is actually crossed. The old
  // resize handler ran on every resize tick and read window.innerWidth, which
  // forces a synchronous layout each time, then set state at the same rate.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1032px)');
    const onChange = (e) => setIsMobile(e.matches);
    // addListener is the pre-Safari-14 spelling
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingTx(true);
        
        // Fetch user profile
        const { data: userData } = await authAPI.getProfile();
        updateUser(userData);

        // Fetch stats
        const { data: statsData } = await transactionAPI.getStats();
        setStats(statsData);

        // Fetch transactions
        const { data } = await transactionAPI.getTransactions();
        const recent = data.slice(0, 10);
        setTransactions(recent);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoadingTx(false);
      }
    };

    fetchData();
  }, [updateUser]);

  // A transaction is outgoing if it is typed 'sent' or this user is the sender.
  const isOutgoing = (tx) => tx.type === 'sent' || tx.senderId === user?.id;

  const txDate = (v) => (v
    ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'N/A');

  const txAmount = (tx) =>
    (isOutgoing(tx) ? '-' : '+') + 'SSP ' +
    (parseFloat(tx.amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* Both views are plain JSX, not components. Declaring them as components
     inside this one gave them a new identity on every render, so React
     unmounted and remounted the whole subtree each time - which is what made
     the dashboard visibly refresh itself. */
  const mobileView = (
    <div className={styles.home}>
      {/* Green header */}
      <header className={styles.homeHeader}>
        <div>
          <span className={styles.homeGreeting}>Welcome back</span>
          <h2 className={styles.homeName}>{user?.name || 'User'}</h2>
        </div>
      </header>

      {/* Wallet balance - white card */}
          <div className={styles.balanceCard}>
            <div className={styles.balanceTop}>
              <span className={styles.balanceLabel}>My Balance</span>
            </div>

            <div className={styles.balanceAmount}>
              <span className={styles.currency}>SSP</span>
              {(parseFloat(user?.balance) || 0).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>

            {/* the account the money sits in — still the real number, but set
                in 4-digit groups so it reads as an account code rather than a
                phone number */}
            <div className={styles.balanceFoot}>
              <span className={styles.balanceAccountLabel}>Account</span>
              <span className={styles.balanceAccount}>{accountCode(user?.phone)}</span>
            </div>
          </div>

      {/* Actions */}
      <div className={styles.actions}>
        <button className={styles.actionBtnPrimary} onClick={() => navigate('/user/send-money')}><Send /><span>Send Money</span></button>
        <button className={styles.actionBtnPrimary} onClick={() => navigate('/user/withdraw')}><Banknote /><span>Cash Out</span></button>
        <button className={styles.actionBtn} onClick={() => navigate('/user/receive')}><HandCoins /><span>Receive</span></button>
        <button className={styles.actionBtn} onClick={() => navigate('/user/pending-withdrawals')}><Clock /><span>Pendings</span></button>
      </div>

      {/* History Stats */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span>History</span>
        </div>
        <div className={styles.statsGrid}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Money Sent</span>
            <span className={styles.statValue}>SSP {(parseFloat(stats?.totalSent) || 0).toFixed(2)}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Total Received</span>
            <span className={styles.statValue}>SSP {(parseFloat(stats?.totalReceived) || 0).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span>Recent Transactions</span>
          <a href="/user/transactions" className={styles.seeAll}>See all</a>
        </div>
        <div className={styles.transactionsList}>
          {loadingTx ? (
            <p style={{ textAlign: 'center', color: '#64748B' }}>Loading transactions...</p>
          ) : transactions.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#64748B' }}>No transactions yet</p>
          ) : (
            transactions.map((tx, idx) => (
              <div key={idx} className={styles.transactionItem}>
                <div className={styles.txIcon}>
                  {tx.type === 'sent' || tx.senderId === user?.id ? (
                    <ArrowUp style={{ color: '#DC2626' }} />
                  ) : (
                    <ArrowDown style={{ color: '#16A34A' }} />
                  )}
                </div>
                <div className={styles.txInfo}>
                  <span className={styles.txType}>
                    {txLabel(tx, isOutgoing(tx))}
                  </span>
                  <span className={styles.txDate}>
                    {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                  </span>
                </div>
                <span className={styles.txAmount}>
                  {tx.type === 'sent' || tx.senderId === user?.id ? '-' : '+'}SSP {parseFloat(tx.amount || 0).toFixed(2)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ...existing code... */}
    </div>
  );

  // Desktop View Component
  const desktopView = (
    <>
      <div className="dashboard-container">
        <div className="dashboard-header">
          <div>
            <h1>Welcome, {user?.name}! <Hand size={18} /></h1>
            <p className="text-muted">Your MoneyPay Dashboard</p>
            {user?.currentLocation && (
              <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
                <MapPin size={18} /> {user.currentLocation.city}, {user.currentLocation.country}
              </p>
            )}
          </div>
        </div>

        <div className="dashboard-grid grid-4 user-stats">
          <div className="stat-card balance-card">
            <div className="stat-icon balance tone-primary"><Wallet size={28} /></div>
            <div className="stat-content wallet-content-fix">
              <p className="stat-label">My Wallet</p>
              <h3 className="stat-value">
                {user && user.balance !== undefined && user.balance !== null
                  ? `SSP ${(parseFloat(user.balance) || 0).toFixed(2)}`
                  : 'SSP 0.00'}
              </h3>
              <p className="balance-sub">Available Balance</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon sent tone-error"><Upload size={28} /></div>
            <div className="stat-content">
              <p className="stat-label">Money Sent</p>
              <h3 className="stat-value" title={`SSP ${(parseFloat(stats?.totalSent) || 0).toFixed(2)}`}>SSP {(parseFloat(stats?.totalSent) || 0).toFixed(2)}</h3>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon received tone-success"><Inbox size={28} /></div>
            <div className="stat-content">
              <p className="stat-label">Total Received</p>
              <h3 className="stat-value" title={`SSP ${(parseFloat(stats?.totalReceived) || 0).toFixed(2)}`}>SSP {(parseFloat(stats?.totalReceived) || 0).toFixed(2)}</h3>
            </div>
          </div>

          {/* own row, below the other three — an explicit class rather than
              :nth-child(4), which would move if a tile is ever added */}
          <div className="stat-card total-tx">
            <div className="stat-icon transactions tone-dark"><ChartColumn size={28} /></div>
            <div className="stat-content">
              <p className="stat-label">Total Transactions</p>
              <h3 className="stat-value">{stats?.totalTransactions || 0}</h3>
            </div>
          </div>
        </div>

        {/* Recent transactions — the data was already being fetched for the
            mobile view; desktop simply never rendered it. */}
        <div className="card mt-4 recent-tx-card">
          <div className="card-header flex-between">
            <h3><Clock size={18} /> Recent Transactions</h3>
            <a href="/user/transactions" className="recent-tx-all">See all</a>
          </div>
          <div className="card-body">
            {loadingTx ? (
              <p className="recent-tx-empty">Loading transactions…</p>
            ) : transactions.length === 0 ? (
              <div className="recent-tx-empty-state">
                <span className="recent-tx-empty-icon"><Files size={22} /></span>
                <h4>No transactions yet</h4>
                <p>Money you send or receive will appear here.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table recent-tx-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Reference</th>
                      <th>Date</th>
                      <th className="right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.slice(0, 5).map((tx, idx) => (
                      <tr key={tx.transactionId || idx}>
                        <td>
                          <span className="recent-tx-type">
                            <span className={'recent-tx-dir ' + (isOutgoing(tx) ? 'is-out' : 'is-in')}>
                              {isOutgoing(tx) ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                            </span>
                            {txLabel(tx, isOutgoing(tx))}
                          </span>
                        </td>
                        <td><span className="recent-tx-ref">{tx.transactionId || '—'}</span></td>
                        <td><span className="recent-tx-date">{txDate(tx.createdAt)}</span></td>
                        <td className="right">
                          <span className={'recent-tx-amount ' + (isOutgoing(tx) ? 'is-out' : 'is-in')}>
                            {txAmount(tx)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="card mt-4">
          <div className="card-header flex-between">
            <h3>Quick Actions</h3>
          </div>
          <div className="card-body">
            <div className="actions-grid">
              <a href="/user/send-money" className="action-card">
                <div className="action-icon tone-primary"><Upload size={28} /></div>
                <h4>Send Money</h4>
                <p>Transfer to another user</p>
              </a>
              <a href="/user/receive" className="action-card">
                <div className="action-icon tone-success"><Landmark size={28} /></div>
                <h4>Receive</h4>
                <p>Show your QR code</p>
              </a>
              <a href="/user/withdraw" className="action-card">
                <div className="action-icon tone-error"><Banknote size={28} /></div>
                <h4>Withdraw</h4>
                <p>Cash out to agent</p>
              </a>
              <a href="/user/transactions" className="action-card">
                <div className="action-icon tone-dark"><Files size={28} /></div>
                <h4>Transactions</h4>
                <p>View history</p>
              </a>
              <a href="/user/profile" className="action-card">
                <div className="action-icon tone-info"><User size={28} /></div>
                <h4>Profile</h4>
                <p>Manage account</p>
              </a>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );

  return isMobile ? mobileView : desktopView;
}
