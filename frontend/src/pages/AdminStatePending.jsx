import React, { useEffect, useState } from 'react';
import { adminAPI } from '../utils/api';
import { useAuthStore } from '../context/store';
import Toast from '../components/Toast';
import Select from '../components/Select';
import '../styles/admin-state-pending.css';
import {
  Ban, Check, CircleCheck, Clock, Inbox, RefreshCw, Search, X
} from 'lucide-react';

// Status arrives in a few historical shapes; normalise once so sorting, the
// badge and the action cell can never disagree about what a row is.
const normalizeStatus = (raw) => {
  const v = (raw || '').toString().toLowerCase();
  if (v === 'completed' || v === 'received' || v === 'received_by_admin') return 'completed';
  if (v === 'cancelled' || v === 'canceled') return 'cancelled';
  return 'pending';
};

export default function AdminStatePending() {
  const [pending, setPending] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('pending_first');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast] = useState(null);
  const user = useAuthStore((s) => s.user);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await adminAPI.getPendingStateSends();
      setPending(data.pending || []);
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: 'Failed to load pending transfers' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleReceive = async (txId) => {
    if (!window.confirm('Mark this transfer as received?')) return;
    setActionLoading(txId);
    try {
      const { data } = await adminAPI.receiveStateSend(txId);
      setToast({ type: 'success', message: data.message || 'Marked received' });
      // update local state to mark as received (keep the row visible)
      setPending((prev) => prev.map(p => p.id === txId ? { ...p, status: 'completed' } : p));
      // notify dashboard to refresh commission and balances
      window.dispatchEvent(new CustomEvent('mpay:refresh-admin-commission'));
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: err?.response?.data?.message || 'Failed to mark received' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (txId) => {
    if (!window.confirm('Cancel this pending transfer and refund sender?')) return;
    setActionLoading(txId);
    try {
      const { data } = await adminAPI.cancelStateSend(txId);
      setToast({ type: 'success', message: data.message || 'Cancelled' });
      // update local state to mark as cancelled (keep the row visible) and clear commission fields
      setPending((prev) => prev.map(p => p.id === txId ? { ...p, status: 'cancelled', commission: 0, companyCommission: 0 } : p));
      // notify any listeners to refresh
      window.dispatchEvent(new CustomEvent('mpay:refresh-admin-commission'));
    } catch (err) {
      console.error(err);
      setToast({ type: 'error', message: err?.response?.data?.message || 'Failed to cancel' });
    } finally {
      setActionLoading(null);
    }
  };

  const counts = pending.reduce((acc, tx) => {
    acc[normalizeStatus(tx.status)] += 1;
    return acc;
  }, { pending: 0, completed: 0, cancelled: 0 });

  // apply search and sort
  const filtered = pending
    .filter(tx => {
      if (!searchTerm) return true;
      const q = searchTerm.trim().toLowerCase();
      const tid = (tx.transactionId || tx.id || '').toString().toLowerCase();
      return tid.includes(q);
    })
    .sort((a, b) => {
      const rank = (tx, order) => {
        const s = normalizeStatus(tx.status);
        if (order === 'pending_first') return s === 'pending' ? 0 : 1;
        if (order === 'received_first') return s === 'completed' ? 0 : 1;
        if (order === 'cancelled_first') return s === 'cancelled' ? 0 : 1;
        return s === 'completed' ? 0 : 1;
      };

      const ra = rank(a, sortOrder);
      const rb = rank(b, sortOrder);
      if (ra !== rb) return ra - rb;

      // tie-break: newest first by createdAt if available, else by id
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : null;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : null;
      if (dateA !== null && dateB !== null) return dateB - dateA;
      // fallback to comparing ids (autoincrement, so higher == newer)
      return String(b.id).localeCompare(String(a.id));
    });

  const statusBadge = (raw) => {
    const s = normalizeStatus(raw);
    if (s === 'completed') return <span className="badge badge-success"><CircleCheck size={13} /> Received</span>;
    if (s === 'cancelled') return <span className="badge badge-muted"><Ban size={13} /> Cancelled</span>;
    return <span className="badge badge-warning"><Clock size={13} /> Pending</span>;
  };

  const renderAction = (tx) => {
    const s = normalizeStatus(tx.status);
    if (s === 'cancelled') return <span className="action-note">—</span>;
    if (s === 'completed') return <span className="action-note is-done"><Check size={14} /> Settled</span>;

    // Any admin in the destination state can receive the transfer. Any admin in
    // the source state can also cancel it, along with the original sender.
    const isSender = Number(user?.id) === Number(tx.senderId);
    const isSameStateAdmin = user?.role === 'admin' && user?.state && tx.fromStateName && user.state === tx.fromStateName;
    const isReceiverForDestination = user?.role === 'admin' && user?.state && tx.toStateName && user.state === tx.toStateName;
    const busy = actionLoading === tx.id;

    if (isReceiverForDestination) {
      return (
        <button className="btn btn-primary btn-sm" onClick={() => handleReceive(tx.id)} disabled={busy}>
          {busy ? 'Processing…' : <><Check size={14} /> Mark received</>}
        </button>
      );
    }
    if (isSender || isSameStateAdmin) {
      return (
        <button className="btn btn-outline btn-danger btn-sm" onClick={() => handleCancel(tx.id)} disabled={busy}>
          {busy ? 'Processing…' : <><X size={14} /> Cancel</>}
        </button>
      );
    }
    return <span className="action-note">No action</span>;
  };

  const party = (p) => {
    const name = p?.name || (typeof p === 'string' ? p : '') || '—';
    const phone = p?.phone;
    return (
      <div className="party">
        <span className="party-name">{name}</span>
        {phone && <span className="party-phone">{phone}</span>}
      </div>
    );
  };

  return (
    <div className="page-container state-pending">
      <div className="page-header pending-header">
        <div>
          <h1>Pending Send To Destination</h1>
          <p>Transfers awaiting confirmation between admins.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* status summary */}
      <div className="pending-summary">
        <div className="summary-tile">
          <span className="tile-icon tone-warning"><Clock size={18} /></span>
          <span className="tile-value">{counts.pending}</span>
          <span className="tile-label">Pending</span>
        </div>
        <div className="summary-tile">
          <span className="tile-icon tone-success"><CircleCheck size={18} /></span>
          <span className="tile-value">{counts.completed}</span>
          <span className="tile-label">Received</span>
        </div>
        <div className="summary-tile">
          <span className="tile-icon tone-muted"><Ban size={18} /></span>
          <span className="tile-value">{counts.cancelled}</span>
          <span className="tile-label">Cancelled</span>
        </div>
      </div>

      <div className="card">
        <div className="card-header pending-toolbar">
          <div className="search-field">
            <Search size={15} />
            <input
              type="search"
              placeholder="Search by transaction ID"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search by transaction ID"
            />
          </div>
          <Select
            value={sortOrder}
            onChange={setSortOrder}
            ariaLabel="Sort order"
            className="sort-select-wrap"
            options={[
              { value: 'pending_first', label: 'Pending first' },
              { value: 'received_first', label: 'Received first' },
              { value: 'cancelled_first', label: 'Cancelled first' },
            ]}
          />
        </div>

        <div className="card-body">
          {loading ? (
            <div className="empty-state">
              <span className="empty-icon"><RefreshCw size={22} className="spin" /></span>
              <h3>Loading transfers…</h3>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon"><Inbox size={22} /></span>
              <h3>{searchTerm ? 'No matching transfers' : 'No transfers yet'}</h3>
              <p>
                {searchTerm
                  ? `Nothing matches “${searchTerm}”. Try a different transaction ID.`
                  : 'Transfers sent between admins by state will appear here.'}
              </p>
              {searchTerm && (
                <button className="btn btn-secondary btn-sm" onClick={() => setSearchTerm('')}>Clear search</button>
              )}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table pending-table">
                <thead>
                  <tr>
                    <th>Txn ID</th>
                    <th>From Destination</th>
                    <th>To Destination</th>
                    <th className="num">Amount</th>
                    <th className="num">Receiver gets</th>
                    <th className="num">Commission</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(tx => (
                    <tr key={tx.id}>
                      <td><code className="txn-id">{tx.transactionId || tx.id}</code></td>
                      <td>{tx.fromStateName || party(tx.sender)}</td>
                      <td>{tx.toStateName || party(tx.receiver)}</td>
                      <td className="num">
                        <span className="cur">{tx.currencyCode || 'SSP'}</span> {Number(tx.amount).toFixed(2)}
                      </td>
                      <td className="num strong">
                        <span className="cur">{tx.currencyCode || 'SSP'}</span> {Number(tx.receiverCredit || tx.amount).toFixed(2)}
                      </td>
                      <td className="num credit">{Number(tx.commission || tx.receiverCommission || 0).toFixed(2)}</td>
                      <td>{statusBadge(tx.status)}</td>
                      <td className="action-cell">{renderAction(tx)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
