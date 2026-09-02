import { useState, useEffect } from 'react';
import SkeletonRows from '../components/SkeletonRows';
import { adminAPI } from '../utils/api';
import Footer from '../components/Footer';
import TransactionDetails from '../components/TransactionDetails';
import PrintReceipt from '../components/PrintReceipt';
import { generateTransactionDocument } from '../utils/pdf';
import '../styles/admin-transactions.css';
import { ArrowDownLeft, ArrowUpRight, Download, Eye, Printer, Receipt, RefreshCw, X } from 'lucide-react';

// Human labels for the Transaction type enum, which was rendered raw.
const TYPE_LABELS = {
  transfer: 'Transfer',
  topup: 'Top-up',
  withdrawal: 'Withdrawal',
  user_withdraw: 'User withdrawal',
  agent_deposit: 'Agent deposit',
  agent_cash_out_money: 'Agent cash out',
  admin_push: 'Refunded by admin',
  admin_state_push: 'State push',
  money_exchange: 'Money exchange',
};

const typeLabel = (t) => TYPE_LABELS[t] || (t || '').replace(/_/g, ' ');

// The amount column hardcoded "SSP", so a USD exchange displayed as SSP.
// Use the currency actually recorded on the row.
const fmtAmount = (tx) => {
  const n = Number(tx.amount) || 0;
  const code = tx.currencyCode || 'SSP';
  return { code, value: n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) };
};

const who = (u) => u?.name || u?.phone || '—';

function Party({ icon, label, person, tone }) {
  return (
    <span className={'tx-party' + (tone ? ' is-' + tone : '')}>
      {icon}
      <span>
        <strong>{who(person)}</strong>
        {person?.phone && person?.name ? <em>{person.phone}</em> : null}
        {label ? <i className="tx-party-role">{label}</i> : null}
      </span>
    </span>
  );
}

/* Who took part in a transaction.

   A state push is not a transfer between two people at the moment it is
   created. It is a request: the sender pushes money toward a destination, and
   nobody on the other side has done anything yet. Naming the addressee as a
   party while the transfer sits pending claimed a participation that had not
   happened — and, once any admin could settle any transfer, named the wrong
   person outright, because whoever ends up confirming it need not be the admin
   it was addressed to.

   So a pending push has exactly one party, the sender. A settled one has two:
   the sender, and whoever acted on it — marked it received, or cancelled it.

   Every other type still reads sender to receiver, because for those the two
   sides really are fixed when the row is written. */
function Parties({ tx }) {
  const isPush = tx.type === 'admin_state_push';

  if (isPush) {
    const settled = tx.status === 'completed' || tx.status === 'cancelled';
    /* Transfers completed before settledById existed record no settler. The
       addressee is the best evidence of who took delivery, so it stands in
       there — but never for a cancellation, where the acting person is the
       whole point and guessing would be inventing one. */
    const actor = tx.settledBy || (tx.status === 'completed' ? tx.receiver : null);

    return (
      <div className="tx-parties">
        <Party icon={<ArrowUpRight size={13} />} person={tx.sender} label="Sender" />
        {settled && actor ? (
          <Party
            icon={tx.status === 'cancelled' ? <X size={13} /> : <ArrowDownLeft size={13} />}
            person={actor}
            tone={tx.status === 'cancelled' ? 'cancelled' : null}
            label={tx.status === 'cancelled' ? 'Cancelled' : 'Receiver'}
          />
        ) : (
          <span className="tx-party is-none">Awaiting receipt</span>
        )}
      </div>
    );
  }

  return (
    <div className="tx-parties">
      <Party icon={<ArrowUpRight size={13} />} person={tx.sender} />
      {tx.receiver ? (
        <Party icon={<ArrowDownLeft size={13} />} person={tx.receiver} />
      ) : (
        <span className="tx-party is-none">No recipient</span>
      )}
    </div>
  );
}

export default function AdminTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  /* Separate from selectedTransaction, which drives the printable receipt —
     a receipt is a summary, this is every field on the record. */
  const [detailTransaction, setDetailTransaction] = useState(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const { data } = await adminAPI.getAllTransactions();
        setTransactions(data);
      } catch (error) {
        console.error('Failed to fetch transactions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  const filteredTransactions = (filter === 'all'
    ? transactions
    : transactions.filter(t => t.status === filter))
    .filter(t => typeFilter === 'all' ? true : t.type === typeFilter)
    .filter(t => {
      const txDate = new Date(t.createdAt);
      const from = fromDate ? new Date(fromDate) : null;
      const to = toDate ? new Date(toDate) : null;
      if (from && txDate < from) return false;
      if (to) {
        const toDateEnd = new Date(to);
        toDateEnd.setHours(23, 59, 59, 999);
        if (txDate > toDateEnd) return false;
      }
      return true;
    })
    .filter(t => 
      t.transactionId.toLowerCase().includes(search.toLowerCase()) ||
      t.sender?.phone?.includes(search) ||
      t.receiver?.phone?.includes(search)
    );

  const getStatusBadge = (status) => {
    const badges = {
      completed: 'badge-success',
      pending: 'badge-warning',
      failed: 'badge-danger',
      cancelled: 'badge-primary'
    };
    return badges[status] || 'badge-primary';
  };

  const handleDownload = (tx) => {
    generateTransactionDocument(tx);
  };

  return (
    <>
    <div className="page-container admin-tx">
      <div className="page-header">
        <h1>All Transactions</h1>
        <p>Monitor system-wide transactions</p>
      </div>

      <div className="card">
        <div className="card-header flex-between">
          <h3>Transactions ({filteredTransactions.length})</h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input 
              type="text"
              placeholder="Search by ID or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="filter-select"
              style={{ flex: 1, minWidth: '200px' }}
            />
            <input 
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="filter-select"
              title="From Date"
            />
            <input 
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="filter-select"
              title="To Date"
            />
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select 
              value={typeFilter} 
              onChange={(e) => setTypeFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Types</option>
              <option value="transfer">Transfer</option>
              <option value="topup">Topup</option>
              <option value="withdrawal">Withdrawal</option>
              <option value="money_exchange">Money Exchange</option>
              <option value="admin_push">Refunded by admin</option>
              <option value="admin_state_push">Admin State Push</option>
            </select>
            {(fromDate || toDate) && (
              <button
                onClick={() => { setFromDate(''); setToDate(''); }}
                style={{
                  padding: '6px 12px',
                  background: '#DC2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: '600'
                }}
                title="Clear date range"
              >
                <X size={18} /> Clear Dates
              </button>
            )}
          </div>
        </div>

        <div className="card-body">
          {loading ? (
            <div className="empty-state">
              <span className="empty-icon"><RefreshCw size={22} className="spin" /></span>
              <SkeletonRows count={5} />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon"><Receipt size={22} /></span>
              <h3>No transactions found</h3>
              <p>Nothing matches the current search and filters.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Transaction</th>
                    <th>Parties</th>
                    <th>Type</th>
                    <th className="num">Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th className="right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map(tx => (
                    <tr key={tx.id}>
                      <td><code className="tx-id">{tx.transactionId}</code></td>
                      <td><Parties tx={tx} /></td>
                      <td>
                        <span className={'badge tx-type is-' + tx.type}>{typeLabel(tx.type)}</span>
                      </td>
                      <td className="num">
                        <span className="tx-cur">{fmtAmount(tx).code}</span> {fmtAmount(tx).value}
                      </td>
                      <td>
                        <span className={`badge ${getStatusBadge(tx.status)}`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="tx-when">
                        {tx.createdAt
                          ? new Date(tx.createdAt).toLocaleString(undefined, {
                              year: 'numeric', month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })
                          : '—'}
                      </td>
                      <td className="right">
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
                            className="icon-btn"
                            onClick={() => handleDownload(tx)}
                            title="Download transaction"
                            aria-label={`Download ${tx.transactionId}`}
                          >
                            <Download size={15} />
                          </button>
                          <button
                            className="icon-btn"
                            onClick={() => setSelectedTransaction(tx)}
                            title="Print receipt"
                            aria-label={`Print receipt for ${tx.transactionId}`}
                          >
                            <Printer size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
