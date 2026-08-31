import { useState, useEffect } from 'react';
import SkeletonRows from '../components/SkeletonRows';
import { adminAPI } from '../utils/api';
import PrintReceipt from '../components/PrintReceipt';
import Footer from '../components/Footer';
import CompositionChart from '../components/CompositionChart';
import '../styles/admin-dashboard.css';
import { useAuthStore } from '../context/store';
import { ArrowRightLeft, ArrowUpRight, Banknote, Bell, CircleCheck, Clock, Coins, CreditCard, Files, Landmark, MapPin, TrendingUp, Users, Wallet, X } from 'lucide-react';
import { typeLabel } from '../data/transactionTypes';

// Exchange cards are built from the currencies that actually exist, so adding
// a currency adds a card with no code change.

// Six- and seven-figure totals are unreadable without separators, and DECIMAL
// columns arrive from Sequelize as strings, so coerce before formatting.
const money = (v) => 'SSP ' + (Number(v) || 0).toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const count = (v) => (Number(v) || 0).toLocaleString('en-US');

/* money() hardcodes SSP; these cards each carry their own currency. */
const amount = (v, code) => (code || 'SSP') + ' ' + (Number(v) || 0).toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [commission, setCommission] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const user = useAuthStore((state) => state.user);
  const [adminStateCommission, setAdminStateCommission] = useState(null);
  const [moneyExchangeTransactions, setMoneyExchangeTransactions] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [currencies, setCurrencies] = useState([]);
  const [exchangeFromDate, setExchangeFromDate] = useState('');
  const [exchangeToDate, setExchangeToDate] = useState('');
  const [exchangeSortByAdminAsc, setExchangeSortByAdminAsc] = useState(null); // null = no sort, true = asc, false = desc
  const [exchangeSelectedAdmin, setExchangeSelectedAdmin] = useState('all');
  const [exchangeModeFilter, setExchangeModeFilter] = useState('all');

  // Build unique admin list from fetched money exchange transactions
  const exchangeAdmins = (() => {
    const map = new Map();
    (moneyExchangeTransactions || []).forEach(t => {
      const id = t.sender?.phone || '';
      const name = t.sender?.name || t.sender?.phone || id;
      if (id && !map.has(id)) map.set(id, { id, name });
    });
    return Array.from(map.values());
  })();

  /* The commission cards come from getStats now, so a state send refreshes
     them by refetching stats rather than a separate commission endpoint. */
  const fetchStats = async () => {
    try {
      const { data } = await adminAPI.getStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch admin stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // One card per currency in the system. Codes that already carry exchanges are
  // unioned in, so a currency deleted from the table keeps showing its history
  // instead of the count silently vanishing.
  /* Server-sorted and zero-filled from the Currencies table, so every
     configured currency has a card even before it earns anything. */
  const commissionByCurrency = stats?.myCommissionByCurrency || [];

  const exchangeCodes = (() => {
    const byCurrency = stats?.myExchangesByCurrency || {};
    const codes = new Set();
    for (const c of currencies) {
      const code = String(c?.code || '').toUpperCase();
      if (code) codes.add(code);
    }
    for (const code of Object.keys(byCurrency)) {
      if (code) codes.add(String(code).toUpperCase());
    }
    return [...codes].sort((a, b) => {
      // currencies the admin actually exchanged in come first, then alphabetical
      const na = byCurrency[a]?.count || 0;
      const nb = byCurrency[b]?.count || 0;
      if (na !== nb) return nb - na;
      return a.localeCompare(b);
    });
  })();

  useEffect(() => {
    const fetchMoneyExchangeTransactions = async () => {
      try {
        const { data } = await adminAPI.getAllTransactions();
        // Filter for money_exchange transactions and get the latest 5
        const exchangeTransactions = data.filter(t => t.type === 'money_exchange').slice(0, 5);
        setMoneyExchangeTransactions(exchangeTransactions);
        /* The Recent Transactions card below reads from the same response —
           everything except exchanges, which already have their own card. No
           second request is needed. */
        setRecentTransactions(data.filter(t => t.type !== 'money_exchange').slice(0, 5));
      } catch (error) {
        console.error('Failed to fetch money exchange transactions:', error);
      } finally {
        setLoadingRecent(false);
      }
    };

    const fetchCurrencies = async () => {
      try {
        const { data } = await adminAPI.getCurrencies();
        setCurrencies(data.currencies || []);
      } catch (error) {
        console.error('Failed to fetch currencies:', error);
        setCurrencies([]);
      }
    };

    fetchStats();
    fetchMoneyExchangeTransactions();
    fetchCurrencies();

    // fetch admin's assigned state commission percent
    (async () => {
      try {
        const statesRes = await adminAPI.getStateSettings();
        const states = statesRes.data.states || [];
        const myStateId = user?.state;
        if (myStateId) {
          const found = states.find(s => s.id === myStateId || String(s.id) === String(myStateId));
          if (found) setAdminStateCommission(Number(found.commissionPercent || 0));
          else setAdminStateCommission(null);
        } else {
          setAdminStateCommission(null);
        }
      } catch (err) {
        console.error('Failed to load state settings', err);
        setAdminStateCommission(null);
      }
    })();

    // Listen for commission refresh events
    const handleRefreshCommission = () => {
      fetchStats();
    };
    window.addEventListener('mpay:refresh-admin-commission', handleRefreshCommission);
    
    return () => {
      window.removeEventListener('mpay:refresh-admin-commission', handleRefreshCommission);
    };
  }, []);

  useEffect(() => {
    const fetchCommission = async () => {
      try {
        const { data } = await adminAPI.getCommission();
        setCommission(data);
      } catch (err) {
        console.error('Failed to load commission settings', err);
      }
    };
    fetchCommission();
  }, []);

  const filteredMoneyExchangeTransactions = moneyExchangeTransactions.filter(t => {
    const txDate = new Date(t.createdAt);
    const from = exchangeFromDate ? new Date(exchangeFromDate) : null;
    const to = exchangeToDate ? new Date(exchangeToDate) : null;
    if (from && txDate < from) return false;
    if (to) {
      const toDateEnd = new Date(to);
      toDateEnd.setHours(23, 59, 59, 999);
      if (txDate > toDateEnd) return false;
    }
    // filter by selected admin if any
    if (exchangeSelectedAdmin && exchangeSelectedAdmin !== 'all') {
      const senderId = t.sender?.phone || '';
      if (String(senderId) !== String(exchangeSelectedAdmin)) return false;
    }
    // filter by mode if selected
    if (exchangeModeFilter && exchangeModeFilter !== 'all') {
      const exchangeInfo = t.description ? t.description.split(': ')[1] : '';
      const parts = exchangeInfo ? exchangeInfo.split(' (') : ['',''];
      const modeStr = (parts[1] || '').replace(')', '').toLowerCase();
      if (!modeStr || modeStr !== exchangeModeFilter) return false;
    }
    return true;
  });

  // Sort by admin name if requested
  const sortedMoneyExchangeTransactions = (() => {
    if (exchangeSortByAdminAsc === null) return filteredMoneyExchangeTransactions;
    const copy = [...filteredMoneyExchangeTransactions];
    copy.sort((a, b) => {
      const nameA = a.sender?.name || a.sender?.phone || '';
      const nameB = b.sender?.name || b.sender?.phone || '';
      if (!nameA && !nameB) return 0;
      if (!nameA) return exchangeSortByAdminAsc ? -1 : 1;
      if (!nameB) return exchangeSortByAdminAsc ? 1 : -1;
      return exchangeSortByAdminAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });
    return copy;
  })();

  /* ---- breakdowns ---------------------------------------------------------
     Rendered as composition bars rather than a pie/one-bar chart: these
     breakdowns are usually a single category today (one role, one status) and
     a pie of one slice reads as broken. Rows are built from the grouped API
     data, so a new role or status appears on its own.

     Colours live in composition-chart.css, keyed by the entity name so a
     changing count never repaints the survivors.
     ------------------------------------------------------------------------ */

  const titleCase = (v) => {
    const t = String(v ?? '').replace(/_/g, ' ').trim();
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Unknown';
  };

  // COUNT() comes back as a string on some drivers, so coerce before plotting.
  const toRows = (rows, field) =>
    (Array.isArray(rows) ? rows : [])
      .map((r) => ({
        key: String(r?.[field] ?? '').toLowerCase(),
        name: titleCase(r?.[field]),
        value: Number(r?.count) || 0,
      }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value);

  const roleRows = toRows(stats?.usersByRole, 'role');
  const statusRows = toRows(stats?.transactionsByStatus, 'status');

  return (
    <>
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="dashboard-brand">
          <div className="brand-text">
            <h1>MoneyPay Admin Dashboard</h1>
            <p className="text-muted">Monitor your MoneyPay system and manage operations</p>
            {/* .dash-location replaces an inline font-size, which no stylesheet
                could override — the responsive sizing could not reach it */}
            {user?.currentLocation && (
              <p className="dash-location">
                <MapPin size={18} /> {user.currentLocation.city}, {user.currentLocation.country}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="dashboard-grid grid-4">
        {/* My Wallet card removed for admin users */}

        <div className="stat-card">
          <div className="stat-icon tone-info"><Users size={28} /></div>
          <div className="stat-content">
            <p className="stat-label">Total Users</p>
            <h3 className="stat-value">{count(stats?.totalUsers)}</h3>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon tone-dark"><CreditCard size={28} /></div>
          <div className="stat-content">
            <p className="stat-label">Total Transactions</p>
            <h3 className="stat-value">{count(stats?.totalTransactions)}</h3>
          </div>
        </div>

        {/* Money in, then money out — Total Cash counts top-ups, the
            two cards after it count cash-outs. */}
        <div className="stat-card">
          <div className="stat-icon tone-info"><TrendingUp size={28} /></div>
          <div className="stat-content">
            <p className="stat-label">Total Cash</p>
            <h3 className="stat-value">{money(stats?.totalTopupVolume)}</h3>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon tone-dark"><ArrowUpRight size={28} /></div>
          <div className="stat-content">
            <p className="stat-label">Total Cash Out</p>
            <h3 className="stat-value">{money(stats?.totalVolume)}</h3>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon tone-success"><CircleCheck size={28} /></div>
          <div className="stat-content">
            <p className="stat-label">Completed</p>
            <h3 className="stat-value">{count(stats?.completedTransactions)}</h3>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon tone-warning"><Banknote size={28} /></div>
          <div className="stat-content">
            <p className="stat-label">You Cashed Out</p>
            <h3 className="stat-value">{money(stats?.totalAdminCashOut)}</h3>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon tone-success"><Landmark size={28} /></div>
          <div className="stat-content">
            <p className="stat-label">Company Benefits</p>
            <h3 className="stat-value">{money(stats?.companyBenefits)}</h3>
          </div>
        </div>
      </div>

      {/* One card per currency rather than a single blended figure: these
          commissions are earned in different currencies and cannot be added
          together. Driven by the Currencies table, so adding a currency adds
          a card with no code change. */}
      <div className="exchange-currency-row">
        <div className="exchange-currency-head">
          <h3><Coins size={17} /> Admin Destination Send Commission</h3>
          <span>Earned on destination sends &middot; one card per currency</span>
        </div>
        {commissionByCurrency.length === 0 ? (
          <div className="exchange-currency-empty">
            <Coins size={20} />
            <span>No currencies yet. Add one under Currencies and a card appears here.</span>
          </div>
        ) : (
          <div className="dashboard-grid">
            {commissionByCurrency.map((c) => (
              <div className="stat-card" key={c.code}>
                <div className="stat-icon tone-primary"><Coins size={28} /></div>
                <div className="stat-content">
                  <p className="stat-label">Admin Transfer Commission {c.code}</p>
                  <h3 className="stat-value">{amount(c.total, c.code)}</h3>
                  <p className="stat-sub">{count(c.count)} {c.count === 1 ? 'send' : 'sends'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Exchanges made by THIS admin, split by currency. Kept out of Total
          Cash Out because a conversion is not a cash-out, and exchanges
          never carry commission. */}
      <div className="exchange-currency-row">
        <div className="exchange-currency-head">
          <h3><ArrowRightLeft size={17} /> My exchanges by currency</h3>
          <span>Not included in Total Cash Out · no commission applied</span>
        </div>
        {exchangeCodes.length === 0 ? (
          <div className="exchange-currency-empty">
            <ArrowRightLeft size={20} />
            <span>No currencies yet. Add one under Currencies and a card appears here.</span>
          </div>
        ) : (
        <div className="dashboard-grid">
          {exchangeCodes.map((code) => {
            const entry = stats?.myExchangesByCurrency?.[code] || { count: 0, total: 0 };
            return (
              <div className="stat-card" key={code}>
                <div className="stat-icon tone-info"><ArrowRightLeft size={28} /></div>
                <div className="stat-content">
                  <p className="stat-label">Exchanges in {code}</p>
                  <h3 className="stat-value">{count(entry.count)}</h3>
                  <p className="stat-sub">
                    {Number(entry.total || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} {code} converted
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>
          <div className="charts-grid grid-2">
            <div className="card">
              <div className="card-header">
                <h3>User Distribution</h3>
              </div>
              <div className="card-body">
                {!loading && (
                  roleRows.length > 0 ? (
                    <CompositionChart rows={roleRows} scheme="role" caption="registered users" />
                  ) : (
                    <div className="chart-empty"><Users size={20} /><span>No users yet.</span></div>
                  )
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3>Transaction Status</h3>
              </div>
              <div className="card-body">
                {!loading && (
                  statusRows.length > 0 ? (
                    <CompositionChart rows={statusRows} scheme="status" caption="transactions" />
                  ) : (
                    <div className="chart-empty"><CreditCard size={20} /><span>No transactions yet.</span></div>
                  )
                )}
              </div>
            </div>
          </div>

          <div className="card mt-4">
        <div className="card-header exchange-header-row">
          <h3><ArrowRightLeft size={18} /> Recent Money Exchange Transactions</h3>
          <div className="exchange-filters">
            <input 
              type="date"
              value={exchangeFromDate}
              onChange={(e) => setExchangeFromDate(e.target.value)}
              className="exchange-filter"
              title="From Date"
            />
            <input 
              type="date"
              value={exchangeToDate}
              onChange={(e) => setExchangeToDate(e.target.value)}
              className="exchange-filter"
              title="To Date"
            />
            <select
              value={exchangeModeFilter}
              onChange={(e) => setExchangeModeFilter(e.target.value)}
              className="exchange-filter"
              title="Filter by Mode"
            >
              <option value="all">All Modes</option>
              <option value="buying">Buying</option>
              <option value="selling">Selling</option>
            </select>
            <select
              value={exchangeSelectedAdmin}
              onChange={(e) => setExchangeSelectedAdmin(e.target.value)}
              className="exchange-filter"
              title="Filter by Admin"
            >
              <option value="all">All Admins</option>
              {exchangeAdmins.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            {(exchangeFromDate || exchangeToDate) && (
              <button
                onClick={() => { setExchangeFromDate(''); setExchangeToDate(''); }}
                className="exchange-filter-clear"
              >
                <X size={18} /> Clear
              </button>
            )}
          </div>
        </div>
        <div className="card-body">
          {sortedMoneyExchangeTransactions.length > 0 ? (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>From</th>
                    <th>To</th>
                    <th>Amount</th>
                    <th>Converted</th>
                    <th>Mode</th>
                    <th style={{ cursor: 'pointer' }} onClick={() => setExchangeSortByAdminAsc(prev => prev === null ? true : (prev ? false : null))}>
                      Admin{exchangeSortByAdminAsc === null ? '' : (exchangeSortByAdminAsc ? ' ▲' : ' ▼')}
                    </th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedMoneyExchangeTransactions.map((transaction) => {
                    const exchangeInfo = transaction.description ? transaction.description.split(': ')[1] : '';
                    const [amounts, mode] = exchangeInfo ? exchangeInfo.split(' (') : ['', ''];
                    const [fromAmount, toAmount] = amounts ? amounts.split(' → ') : ['', ''];
                    return (
                      <tr key={transaction.id}>
                        <td>
                          <span style={{ fontWeight: 600, color: '#087443' }}>
                            {transaction.currencyCode}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, color: '#166534' }}>
                            {transaction.currencySymbol || 'N/A'}
                          </span>
                        </td>
                        <td>{fromAmount || transaction.amount}</td>
                        <td>{toAmount || '-'}</td>
                        <td>
                          <span style={{ fontSize: '11px', textTransform: 'capitalize' }}>
                            {mode ? mode.replace(')', '') : '-'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '11.5px' }}>
                            {transaction.sender?.name || transaction.sender?.phone || 'Admin'}
                          </span>
                        </td>
                        <td style={{ fontSize: '11px', color: '#666' }}>
                          {new Date(transaction.createdAt).toLocaleDateString()} {new Date(transaction.createdAt).toLocaleTimeString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted">
              {moneyExchangeTransactions.length === 0 ? 'No money exchange transactions yet' : 'No transactions match the selected date range'}
            </p>
          )}
        </div>
      </div>

      {/* Recent Transactions — everything except exchanges, which have their
          own card above. Uses the same .recent-tx-* markup as the user and
          agent dashboards so all three tables read identically. */}
      <div className="card mt-4 recent-tx-card">
        <div className="card-header flex-between">
          <h3><Clock size={18} /> Recent Transactions</h3>
          <a href="/admin/transactions" className="recent-tx-all">See all</a>
        </div>
        <div className="card-body">
          {loadingRecent ? (
            <SkeletonRows count={5} />
          ) : recentTransactions.length === 0 ? (
            <div className="recent-tx-empty-state">
              <span className="recent-tx-empty-icon"><Files size={22} /></span>
              <h4>No transactions yet</h4>
              <p>Transfers, top-ups and cash-outs will appear here.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table recent-tx-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>From</th>
                    <th>Reference</th>
                    <th>Date</th>
                    <th className="right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((tx, idx) => (
                    <tr key={tx.transactionId || idx}>
                      <td>
                        <span className={'badge tx-type is-' + tx.type}>{typeLabel(tx.type)}</span>
                      </td>
                      <td>
                        <span className="recent-tx-type">{tx.sender?.name || tx.sender?.phone || '—'}</span>
                      </td>
                      <td><span className="recent-tx-ref">{tx.transactionId || '—'}</span></td>
                      <td>
                        <span className="recent-tx-date">
                          {tx.createdAt
                            ? new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : 'N/A'}
                        </span>
                      </td>
                      <td className="right">
                        {/* the admin view is not one account's ledger, so there
                            is no "outgoing" here — no +/- sign, just the amount */}
                        <span className="recent-tx-amount">
                          {money(tx.amount)}
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
        <div className="card-header">
          <h3>Quick Actions</h3>
        </div>
        <div className="card-body">
          <div className="actions-grid">
            <a href="/admin/users" className="action-card">
              <div className="action-icon tone-info"><Users size={28} /></div>
              <h4>Manage Users</h4>
              <p>View and manage users</p>
            </a>
            <a href="/admin/transactions" className="action-card">
              <div className="action-icon tone-dark"><CreditCard size={28} /></div>
              <h4>View Transactions</h4>
              <p>Monitor all transactions</p>
            </a>
            <a href="/admin/notifications" className="action-card">
              <div className="action-icon tone-warning"><Bell size={28} /></div>
              <h4>Send Notifications</h4>
              <p>Notify users</p>
            </a>
            <a href="/admin/tiered-commission" className="action-card">
              <div className="action-icon tone-success"><Wallet size={28} /></div>
              <h4>Tiered Commission</h4>
              <p>Manage send-money commission tiers</p>
            </a>
            <a href="/admin/reports" className="action-card">
              <div className="action-icon tone-dark"><TrendingUp size={28} /></div>
              <h4>Reports</h4>
              <p>View detailed reports</p>
            </a>
          </div>
        </div>
      </div>
      {selectedTransaction && (
        <PrintReceipt
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
        />
      )}
    </div>
    <Footer />
    </>
  );
}
