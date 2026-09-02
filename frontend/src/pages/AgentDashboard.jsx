import { useState, useEffect } from 'react';
import SkeletonRows from '../components/SkeletonRows';
import Footer from '../components/Footer';
import { useAuthStore } from '../context/store';
import { transactionAPI } from '../utils/api';
import { ArrowDown, ArrowDownLeft, ArrowUp, ArrowUpRight, ChartColumn, Clock, CreditCard, Files, Hand, HandCoins, Inbox, Landmark, RefreshCw, Send, Smartphone, Upload, Wallet } from 'lucide-react';
import styles from './DashboardMobile.module.css';
import { txLabel } from '../data/transactionTypes';

/* Digits only, in groups of four — the same shaping the user dashboard gives
   an account number, so the two cards read alike. */
const accountCode = (phone) => {
  if (!phone) return '—';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return String(phone);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
};

export default function AgentDashboard() {
  const { user } = useAuthStore();
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 1032px)').matches);
  const [stats, setStats] = useState({
    totalSent: 0,
    totalReceived: 0,
    commissionEarned: 0
  });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Handle window resize for responsive design
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

  // Fetch stats and transactions
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [statsRes, txRes] = await Promise.all([
          transactionAPI.getStats(),
          transactionAPI.getTransactions()
        ]);
        
        if (statsRes.data) {
          setStats(statsRes.data);
        }
        if (txRes.data) {
          setTransactions(txRes.data.slice(0, 10)); // Last 10 transactions
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) {
      fetchData();
    }
  }, [user]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
  };

  /* Same helpers the user dashboard's Recent Transactions table uses, so both
     tables read a transaction the same way. A transaction is outgoing if it is
     typed 'sent' or this account is the sender. */
  const isOutgoing = (tx) => tx.type === 'sent' || tx.senderId === user?.id;

  const txDate = (v) => (v
    ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'N/A');

  const txAmount = (tx) =>
    (isOutgoing(tx) ? '-' : '+') + 'SSP ' + formatCurrency(tx.amount);

  const handleNavigate = (path) => {
    window.location.href = path;
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  // Mobile View
  /* Deliberately the same shape as the user's mobile dashboard, class for
     class, off the shared DashboardMobile stylesheet: a green header, a white
     balance card, four action tiles, then History and Recent Transactions.
     The two were drifting into different products — this one had a green
     gradient balance card, its own transaction row markup, and class names
     that only existed in its own stylesheet. What differs now is the content,
     which is the only thing that should. */
  if (isMobile) {
    return (
      <div className={styles.home}>
        <header className={styles.homeHeader}>
          <div>
            <span className={styles.homeGreeting}>Welcome back</span>
            <h2 className={styles.homeName}>{user?.name || 'Agent'}</h2>
          </div>
        </header>

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

          {/* The user's card shows their account code here. An agent's working
              identity is the agent ID, so that is what goes in the same slot —
              same row, same treatment, the identifier that is actually useful. */}
          <div className={styles.balanceFoot}>
            <span className={styles.balanceAccountLabel}>{user?.agentId ? 'Agent ID' : 'Account'}</span>
            <span className={styles.balanceAccount}>{user?.agentId || accountCode(user?.phone)}</span>
          </div>
        </div>

        {/* The two that move money are the primary pair, as on the user side. */}
        <div className={styles.actions}>
          <button className={styles.actionBtnPrimary} onClick={() => handleNavigate('/agent/send-money')}><Send /><span>Send Money</span></button>
          <button className={styles.actionBtnPrimary} onClick={() => handleNavigate('/agent/pull-from-user')}><RefreshCw /><span>Pull from User</span></button>
          <button className={styles.actionBtn} onClick={() => handleNavigate('/agent/receive')}><HandCoins /><span>Receive</span></button>
          <button className={styles.actionBtn} onClick={() => handleNavigate('/agent/transactions')}><ChartColumn /><span>Transactions</span></button>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span>History</span>
          </div>
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Money Sent</span>
              <span className={styles.statValue}>SSP {formatCurrency(stats.totalSent)}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Money Received</span>
              <span className={styles.statValue}>SSP {formatCurrency(stats.totalReceived)}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Commission Earned</span>
              <span className={styles.statValue}>SSP {formatCurrency(stats.commissionEarned)}</span>
            </div>
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span>Recent Transactions</span>
            <a href="/agent/transactions" className={styles.seeAll}>See all</a>
          </div>
          <div className={styles.transactionsList}>
            {loading ? (
              <SkeletonRows count={4} />
            ) : transactions.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#64748B' }}>No transactions yet</p>
            ) : (
              transactions.map((tx, idx) => (
                <div key={tx.id || idx} className={styles.transactionItem}>
                  <div className={styles.txIcon}>
                    {isOutgoing(tx)
                      ? <ArrowUp style={{ color: '#DC2626' }} />
                      : <ArrowDown style={{ color: '#16A34A' }} />}
                  </div>
                  <div className={styles.txInfo}>
                    <span className={styles.txType}>{txLabel(tx, isOutgoing(tx))}</span>
                    <span className={styles.txDate}>
                      {tx.createdAt
                        ? new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'N/A'}
                    </span>
                  </div>
                  <span className={styles.txAmount}>
                    {isOutgoing(tx) ? '-' : '+'}SSP {(parseFloat(tx.amount) || 0).toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // Desktop View
  return (
    <>
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>Welcome, {user?.name}! <Hand size={18} /></h1>
          <p className="text-muted">Your Agent Dashboard</p>
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
            <h3 className="stat-value">SSP {formatCurrency(stats.totalSent)}</h3>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon received tone-success"><Inbox size={28} /></div>
          <div className="stat-content">
            <p className="stat-label">Money Received</p>
            <h3 className="stat-value">SSP {formatCurrency(stats.totalReceived)}</h3>
          </div>
        </div>

        <div className="stat-card total-tx">
          <div className="stat-icon transactions tone-dark"><ChartColumn size={28} /></div>
          <div className="stat-content">
            <p className="stat-label">Commission Earned</p>
            <h3 className="stat-value">SSP {formatCurrency(stats.commissionEarned)}</h3>
          </div>
        </div>
      </div>

      {/* Recent Transactions — the data was already being fetched for the
          mobile view; the desktop view simply never rendered it. */}
      <div className="card mt-4 recent-tx-card">
        <div className="card-header flex-between">
          <h3><Clock size={18} /> Recent Transactions</h3>
          <a href="/agent/transactions" className="recent-tx-all">See all</a>
        </div>
        <div className="card-body">
          {loading ? (
            <SkeletonRows count={4} />
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

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header flex-between">
          <h3>Quick Actions</h3>
        </div>
        <div className="card-body">
          <div className="actions-grid">
            <a href="/agent/send-money" className="action-card">
              <div className="action-icon tone-primary"><Upload size={28} /></div>
              <h4>Send Money</h4>
              <p>Transfer to users</p>
            </a>
            <a href="/agent/receive" className="action-card">
              <div className="action-icon tone-success"><Landmark size={28} /></div>
              <h4>Receive</h4>
              <p>Show your QR code</p>
            </a>
            <a href="/agent/scan" className="action-card">
              <div className="action-icon tone-info"><Smartphone size={28} /></div>
              <h4>Scan</h4>
              <p>Scan QR codes</p>
            </a>
            <a href="/agent/pull-from-user" className="action-card">
              <div className="action-icon tone-info"><RefreshCw size={28} /></div>
              <h4>Pull from User</h4>
              <p>Request money</p>
            </a>
            <a href="/agent/transactions" className="action-card">
              <div className="action-icon tone-dark"><ChartColumn size={28} /></div>
              <h4>Transactions</h4>
              <p>View history</p>
            </a>
          </div>
        </div>
      </div>

    </div>
    <Footer />
    </>
  );
}
