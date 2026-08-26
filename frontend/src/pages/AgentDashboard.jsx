import { useState, useEffect } from 'react';
import { useAuthStore } from '../context/store';
import { transactionAPI } from '../utils/api';
import { ArrowDown, ArrowDownLeft, ArrowUp, ArrowUpRight, ChartColumn, Clock, CreditCard, Files, Hand, Inbox, Landmark, RefreshCw, Smartphone, Upload, Wallet } from 'lucide-react';
import styles from './AgentDashboard.module.css';
import { txLabel } from '../data/transactionTypes';

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
  if (isMobile) {
    return (
      <div className={styles.container}>
        {/* Balance Card */}
        <div className={styles.balanceCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <span className={styles.balanceLabel}>My Balance</span>
            <CreditCard style={{ height: 32, width: 48, color: '#fff' }} />
          </div>
          <span className={styles.balanceAmount} style={{ fontSize: '1.97rem', letterSpacing: '2px', margin: '18px 0 8px 0', color: '#fff' }}>
            {user && user.balance !== undefined && user.balance !== null
              ? `${(parseFloat(user.balance) || 0).toFixed(2)}`
              : '0.00'}
            <span className={styles.currency} style={{ color: '#fff', marginLeft: 8 }}>SSP</span>
          </span>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: 16 }}>
            <span style={{ fontSize: '1rem', letterSpacing: '2px', opacity: 0.85 }}>**** **** **** {user?.agentId?.slice(-4) || '5678'}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className={styles.actions}>
          <button 
            className={styles.actionBtn}
            onClick={() => handleNavigate('/agent/send-money')}
          >
            <span><Upload size={18} /></span>
            <span>Send Money</span>
          </button>
          <button 
            className={styles.actionBtn}
            onClick={() => handleNavigate('/agent/receive')}
          >
            <span>�</span>
            <span>Receive</span>
          </button>
          <button 
            className={styles.actionBtn}
            onClick={() => handleNavigate('/agent/pull-from-user')}
          >
            <span><RefreshCw size={18} /></span>
            <span>Pull from User</span>
          </button>
          <button 
            className={styles.actionBtn}
            onClick={() => handleNavigate('/agent/transactions')}
          >
            <span><ChartColumn size={18} /></span>
            <span>Transactions</span>
          </button>
        </div>

        {/* History Section */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>Statistics</h3>
          </div>
          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <div className={styles.statLabel}>Money Sent</div>
              <div className={styles.statValue}>SSP {formatCurrency(stats.totalSent)}</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statLabel}>Money Received</div>
              <div className={styles.statValue}>SSP {formatCurrency(stats.totalReceived)}</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statLabel}>Commission Earned</div>
              <div className={styles.statValue}>SSP {formatCurrency(stats.commissionEarned)}</div>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>Recent Transactions</h3>
            <a href="/agent/transactions" className={styles.seeAllLink}>See all</a>
          </div>
          {loading ? (
            <div className={styles.loadingText}>Loading transactions...</div>
          ) : transactions.length > 0 ? (
            <div className={styles.transactionsList}>
              {transactions.map(tx => (
                <div key={tx.id} className={styles.transactionItem}>
                  <div className={styles.txHeader}>
                    <span className={styles.txType}>
                      {tx.type === 'send' ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />} {tx.type === 'send' ? 'Sent to' : 'Received from'}
                    </span>
                    <span className={styles.txAmount}>
                      {tx.type === 'send' ? '-' : '+'}{formatCurrency(tx.amount)}
                    </span>
                  </div>
                  <div className={styles.txDetails}>
                    <span className={styles.txName}>{tx.recipientName || tx.senderName}</span>
                    <span className={styles.txDate}>
                      {new Date(tx.createdAt).toLocaleDateString('en-PH')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.loadingText}>No transactions yet</div>
          )}
        </div>
      </div>
    );
  }

  // Desktop View
  return (
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
  );
}
