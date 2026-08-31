import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowRightLeft, ArrowUp, Banknote, CircleCheck, CreditCard, Download, Eye, Inbox, Printer, Search, Store, Upload, X } from 'lucide-react';
import Footer from '../components/Footer';
import TransactionDetails from '../components/TransactionDetails';
import PrintReceipt from '../components/PrintReceipt';
import { transactionAPI } from '../utils/api';
import { generateTransactionDocument } from '../utils/pdf';
import { useAuthStore } from '../context/store';
import '../styles/transactions.css';
import '../styles/transactions-flow.css';

const n2 = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const money = (v) => 'SSP ' + n2(v).toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Every value the transactions.type enum can hold. The old map covered four of
// nine, so the rest fell through and rendered the raw column value.
const TYPE_ICONS = {
  transfer: Upload,
  topup: Inbox,
  withdrawal: Banknote,
  user_withdraw: Banknote,
  agent_deposit: Store,
  agent_cash_out_money: Banknote,
  admin_push: Upload,
  admin_state_push: Upload,
  money_exchange: ArrowRightLeft,
};

const TYPE_LABELS = {
  transfer: 'Transfer',
  topup: 'Account top-up',
  withdrawal: 'Withdrawal',
  user_withdraw: 'Withdrawal',
  agent_deposit: 'Agent deposit',
  agent_cash_out_money: 'Agent cash out',
  admin_push: 'Refunded by admin',
  admin_state_push: 'Destination push',
  money_exchange: 'Money exchange',
};

const STATUS_TONE = {
  completed: 'success',
  pending: 'warning',
  failed: 'danger',
  cancelled: 'muted',
};

export default function Transactions() {
  const [searchParams] = useSearchParams();
  const transactionIdParam = searchParams.get('id');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchId, setSearchId] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  /* Separate from selectedTransaction, which drives the printable receipt —
     a receipt is a summary, this is every field on the record. */
  const [detailTransaction, setDetailTransaction] = useState(null);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const { data } = await transactionAPI.getTransactions();
        setTransactions(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to fetch transactions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  const isOutgoing = (tx) => tx.senderId === user?.id;

  const titleOf = (tx) => {
    const out = isOutgoing(tx);
    const other = out ? tx.receiver : tx.sender;
    const who = other?.name || other?.phone || 'Unknown';

    switch (tx.type) {
      case 'transfer':
        return out ? `Sent to ${who}` : `Received from ${who}`;
      case 'agent_deposit':
        return out ? `Deposit to ${who}` : `Deposit from ${who}`;
      case 'withdrawal':
      case 'user_withdraw':
        return 'Withdrawal';
      case 'topup':
        return 'Account top-up';
      default:
        return TYPE_LABELS[tx.type] || String(tx.type || '').replace(/_/g, ' ');
    }
  };

  const filtered = useMemo(() => {
    let list = transactions;

    // The URL param is a string and tx.id is an int(11), so a strict compare
    // was always false and deep links rendered an empty list.
    if (transactionIdParam) {
      return list.filter((t) => String(t.id) === String(transactionIdParam));
    }

    if (filter !== 'all') list = list.filter((t) => t.status === filter);
    if (typeFilter !== 'all') list = list.filter((t) => t.type === typeFilter);

    const q = searchId.trim().toLowerCase();
    if (q) {
      list = list.filter((t) =>
        String(t.transactionId || '').toLowerCase().includes(q) ||
        String(t.sender?.name || '').toLowerCase().includes(q) ||
        String(t.receiver?.name || '').toLowerCase().includes(q));
    }
    return list;
  }, [transactions, transactionIdParam, filter, typeFilter, searchId]);

  const totals = useMemo(() => filtered.reduce((acc, t) => {
    if (isOutgoing(t)) acc.out += n2(t.amount);
    else acc.in += n2(t.amount);
    return acc;
  }, { in: 0, out: 0 }), [filtered, user?.id]);

  const typesPresent = useMemo(
    () => [...new Set(transactions.map((t) => t.type).filter(Boolean))],
    [transactions]);

  const hasFilters = filter !== 'all' || typeFilter !== 'all' || searchId.trim() !== '';

  const resetFilters = () => {
    setFilter('all');
    setTypeFilter('all');
    setSearchId('');
  };

  return (
    <>
      <div className="page-container tx-page">
        <div className="page-header tx-header">
          <div>
            <h1>Transaction History</h1>
            <p>Every payment in and out of your account.</p>
          </div>
        </div>

        {!transactionIdParam && !loading && transactions.length > 0 && (
          <div className="tx-summary">
            <div className="tx-summary-item">
              <span>Showing</span>
              <strong>{filtered.length}</strong>
            </div>
            <div className="tx-summary-item">
              <span><ArrowDown size={12} /> Received</span>
              <strong className="is-in">{money(totals.in)}</strong>
            </div>
            <div className="tx-summary-item">
              <span><ArrowUp size={12} /> Sent</span>
              <strong className="is-out">{money(totals.out)}</strong>
            </div>
          </div>
        )}

        <div className="card tx-card">
          {!transactionIdParam && (
            <div className="card-header tx-toolbar">
              <div className="tx-search">
                <Search size={15} />
                <input
                  type="text"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  placeholder="Search by reference or name"
                  aria-label="Search transactions"
                />
                {searchId && (
                  <button type="button" onClick={() => setSearchId('')} aria-label="Clear search">
                    <X size={14} />
                  </button>
                )}
              </div>

              <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by status">
                <option value="all">All statuses</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Filter by type">
                <option value="all">All types</option>
                {typesPresent.map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t] || t.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          )}

          <div className="card-body tx-body">
            {loading ? (
              <div className="tx-empty"><h3>Loading transactions…</h3></div>
            ) : filtered.length === 0 ? (
              <div className="tx-empty">
                <span className="tx-empty-icon"><Inbox size={22} /></span>
                <h3>{hasFilters ? 'Nothing matches those filters' : 'No transactions yet'}</h3>
                <p>{hasFilters
                  ? 'Try a different search or clear the filters.'
                  : 'Money you send or receive will appear here.'}</p>
                {hasFilters && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={resetFilters}>
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <ul className="tx-list">
                {filtered.map((tx) => {
                  const out = isOutgoing(tx);
                  const Icon = TYPE_ICONS[tx.type] || CreditCard;
                  const tone = STATUS_TONE[tx.status] || 'muted';

                  return (
                    <li key={tx.id} className="tx-row">
                      <span className={'tx-icon ' + (out ? 'is-out' : 'is-in')}>
                        <Icon size={17} />
                      </span>

                      <div className="tx-main">
                        <strong className="tx-title">{titleOf(tx)}</strong>
                        <span className="tx-meta">
                          <span className="tx-ref">{tx.transactionId}</span>
                          {/* The type earns a slot only when it says something the
                              title does not — on a top-up both read "Account
                              top-up", which wrapped and doubled the row height
                              for no information. */}
                          {(TYPE_LABELS[tx.type] || tx.type) !== titleOf(tx) && (
                            <>
                              <span className="tx-dot">·</span>
                              <span className="tx-type-label">{TYPE_LABELS[tx.type] || tx.type}</span>
                            </>
                          )}
                          <span className="tx-dot">·</span>
                          {/* The date rides the meta line rather than owning a
                              column, which is what forced the reference to
                              truncate to "TXN5…" on a phone. */}
                          {/* Two spellings of the same moment, swapped by CSS: the
                              year costs ~35px, which on a phone is the difference
                              between showing "TXN265771339" and "T…". */}
                          <span className="tx-when tx-when-full">
                            {new Date(tx.createdAt).toLocaleDateString()}
                            {' '}
                            {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="tx-when tx-when-short">
                            {new Date(tx.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })}
                            {' '}
                            {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </span>
                      </div>

                      <div className="tx-right">
                        {/* direction is carried by the sign and the icon, not colour alone */}
                        <strong className={'tx-amount ' + (out ? 'is-out' : 'is-in')}>
                          {out ? '−' : '+'} {money(tx.amount)}
                        </strong>
                        <span className={'tx-status is-' + tone}>
                          {tx.status === 'completed' && <CircleCheck size={12} />}
                          {tx.status}
                        </span>
                      </div>

                      <div className="tx-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => setDetailTransaction(tx)}
                          title="View full details"
                          aria-label={`View details for ${tx.transactionId}`}
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => generateTransactionDocument(tx)}
                          title="Download receipt"
                          aria-label={`Download receipt for ${tx.transactionId}`}
                        >
                          <Download size={15} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => setSelectedTransaction(tx)}
                          title="View and print receipt"
                          aria-label={`Open receipt for ${tx.transactionId}`}
                        >
                          <Printer size={15} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {detailTransaction && (
          <TransactionDetails
            transaction={detailTransaction}
            onClose={() => setDetailTransaction(null)}
          />
        )}
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
