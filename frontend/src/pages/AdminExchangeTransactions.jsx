import React, { useEffect, useMemo, useState } from 'react';
import { adminAPI } from '../utils/api';
import Select from '../components/Select';
import Footer from '../components/Footer';
import PrintReceipt from '../components/PrintReceipt';
import TransactionDetails from '../components/TransactionDetails';
import { generateTransactionDocument } from '../utils/pdf';
import '../styles/admin-exchange-transactions.css';
import { ArrowRight, ArrowRightLeft, Calendar, Download, Eye, Printer, RefreshCw, Repeat, Search, TrendingDown, TrendingUp, User } from 'lucide-react';

// Rates are DECIMAL(20,10) and amounts DECIMAL(20,6), so they arrive as padded
// strings. Render them readably without losing small values.
const fmtNum = (v, { min = 0 } = {}) => {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  const decimals = Math.abs(n) >= 1 ? 2 : 8;
  return n.toLocaleString(undefined, { minimumFractionDigits: min, maximumFractionDigits: decimals });
};

export default function AdminExchangeTransactions() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState('all');
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  /* Separate from selectedTransaction, which drives the printable receipt —
     a receipt is a summary, this is every field on the record. */
  const [detailTransaction, setDetailTransaction] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await adminAPI.getAllTransactions();
      const list = Array.isArray(data) ? data : (Array.isArray(data?.transactions) ? data.transactions : []);
      setRows(list.filter(t => t.type === 'money_exchange'));
    } catch (err) {
      console.error('Failed to load exchange transactions', err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(t => {
      if (mode !== 'all' && (t.exchangeMode || '') !== mode) return false;
      if (!q) return true;
      const hay = [
        t.transactionId, t.currencyCode, t.toCurrencyCode,
        t.sender?.name, t.description
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, mode]);

  const stats = useMemo(() => ({
    total: rows.length,
    buying: rows.filter(t => t.exchangeMode === 'buying').length,
    selling: rows.filter(t => t.exchangeMode === 'selling').length,
  }), [rows]);

  return (
    <>
    <div className="page-container exchange-tx">
      <div className="page-header extx-header">
        <div>
          <h1>Exchange Transactions</h1>
          <p>Every saved currency exchange, with the rate and mode applied at the time.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      <div className="extx-summary">
        <div className="extx-tile">
          <span className="extx-icon tone-primary"><Repeat size={18} /></span>
          <span className="extx-value">{stats.total}</span>
          <span className="extx-label">Exchanges</span>
        </div>
        <div className="extx-tile">
          <span className="extx-icon tone-success"><TrendingUp size={18} /></span>
          <span className="extx-value">{stats.buying}</span>
          <span className="extx-label">Buying</span>
        </div>
        <div className="extx-tile">
          <span className="extx-icon tone-warning"><TrendingDown size={18} /></span>
          <span className="extx-value">{stats.selling}</span>
          <span className="extx-label">Selling</span>
        </div>
      </div>

      <div className="card">
        <div className="card-header extx-toolbar">
          <h3><ArrowRightLeft size={18} /> History</h3>
          <div className="extx-toolbar-right">
            <div className="extx-search">
              <Search size={15} />
              <input
                type="search"
                placeholder="Search ID, currency or admin"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search exchange transactions"
              />
            </div>
            <Select
              value={mode}
              onChange={setMode}
              ariaLabel="Filter by mode"
              className="extx-mode"
              options={[
                { value: 'all', label: 'All modes' },
                { value: 'buying', label: 'Buying' },
                { value: 'selling', label: 'Selling' },
              ]}
            />
          </div>
        </div>

        <div className="card-body">
          {loading ? (
            <div className="empty-state">
              <span className="empty-icon"><RefreshCw size={22} className="spin" /></span>
              <h3>Loading exchanges…</h3>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon"><ArrowRightLeft size={22} /></span>
              <h3>{rows.length === 0 ? 'No exchanges saved yet' : 'No matching exchanges'}</h3>
              <p>
                {rows.length === 0
                  ? 'Saved conversions from Money Exchange will appear here.'
                  : 'Try a different search or mode filter.'}
              </p>
              {rows.length > 0 && (
                <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setMode('all'); }}>
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table extx-table">
                <thead>
                  <tr>
                    <th>Transaction</th>
                    <th>Pair</th>
                    <th className="num">Amount</th>
                    <th className="num">Converted</th>
                    <th className="num">Rate</th>
                    <th>Mode</th>
                    <th>Admin</th>
                    <th>Date</th>
                    <th className="right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => (
                    <tr key={t.id}>
                      <td><code className="extx-id">{t.transactionId}</code></td>
                      <td>
                        <span className="extx-pair">
                          <strong>{t.currencyCode || '—'}</strong>
                          <ArrowRight size={13} />
                          <strong>{t.toCurrencyCode || t.currencySymbol || '—'}</strong>
                        </span>
                      </td>
                      <td className="num">
                        {fmtNum(t.amount, { min: 2 })} <span className="cur">{t.currencyCode}</span>
                      </td>
                      <td className="num strong">
                        {fmtNum(t.convertedAmount ?? t.receiverCredit)}{' '}
                        <span className="cur">{t.toCurrencyCode || t.currencySymbol || ''}</span>
                      </td>
                      <td className="num">{fmtNum(t.exchangeRate)}</td>
                      <td>
                        {t.exchangeMode ? (
                          <span className={'badge ' + (t.exchangeMode === 'buying' ? 'badge-success' : 'badge-warning')}>
                            {t.exchangeMode === 'buying' ? 'Buying' : 'Selling'}
                          </span>
                        ) : (
                          <span className="badge badge-muted">—</span>
                        )}
                      </td>
                      <td>
                        <span className="extx-admin"><User size={13} /> {t.sender?.name || '—'}</span>
                      </td>
                      {/* the flex row lives on an inner span: putting it on the
                          <td> takes the cell out of table layout, so it stops
                          honouring vertical-align and the date rides to the top */}
                      <td className="extx-date">
                        <span className="extx-date-inner">
                          <Calendar size={13} />
                          {t.createdAt ? new Date(t.createdAt).toLocaleString(undefined, {
                            year: 'numeric', month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          }) : '—'}
                        </span>
                      </td>
                      <td className="right">
                        <div className="extx-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => setDetailTransaction(t)}
                            title="View full details"
                            aria-label={`View details for ${t.transactionId}`}
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            className="icon-btn"
                            onClick={() => generateTransactionDocument(t)}
                            title="Download receipt"
                            aria-label={`Download ${t.transactionId}`}
                          >
                            <Download size={15} />
                          </button>
                          <button
                            className="icon-btn"
                            onClick={() => setSelectedTransaction(t)}
                            title="Print receipt"
                            aria-label={`Print receipt for ${t.transactionId}`}
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
