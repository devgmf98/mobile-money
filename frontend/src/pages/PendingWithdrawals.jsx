import { useState, useEffect } from 'react';
import { useAuthStore } from '../context/store';
import Toast from '../components/Toast';
import Footer from '../components/Footer';
import { withdrawalAPI, authAPI } from '../utils/api';
import '../styles/pending-withdrawals.css';
import '../styles/pending-withdrawals-flow.css';
import { Calendar, Check, Inbox, RefreshCw, TriangleAlert, X } from 'lucide-react';

export default function PendingWithdrawals() {
  const user = useAuthStore((state) => state.user);
  const suspended = !!user?.isSuspended;
  const updateUser = useAuthStore((state) => state.updateUser);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [processingAction, setProcessingAction] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [showToast, setShowToast] = useState(false);


  useEffect(() => {
    fetchPendingRequests();
    // eslint-disable-next-line
  }, []);

  const fetchPendingRequests = async () => {
    try {
      setLoading(true);
      let response;
      if (user?.role === 'admin') {
        response = await withdrawalAPI.getAgentWithdrawalRequests();
      } else {
        response = await withdrawalAPI.getPendingRequests();
      }
      setPendingRequests(response.data.requests || []);
    } catch (error) {
      console.error('Failed to fetch pending requests:', error);
      setToastMessage('Failed to load pending requests');
      setToastType('error');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId) => {
    setProcessingId(requestId);
    setProcessingAction('approve');
    try {
      // Use admin endpoint if current user is an admin
      if (user?.role === 'admin') {
        await withdrawalAPI.approveAdminWithdrawalRequest({ requestId });
      } else {
        await withdrawalAPI.approveRequest({ requestId });
      }
      setToastMessage('Withdrawal request approved successfully');
      setToastType('success');
      setShowToast(true);
      // Fetch latest profile and update wallet balance
      try {
        const { data: userData } = await authAPI.getProfile();
        updateUser(userData);
      } catch (e) {}
      // was window.location.reload() - a full app restart to refresh one list
      fetchPendingRequests();
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to approve request';
      setToastMessage(message);
      setToastType('error');
      setShowToast(true);
      // If request was already processed by someone else, refresh list
      if (error.response?.status === 409) fetchPendingRequests();
    } finally {
      setProcessingId(null);
      setProcessingAction(null);
    }
  };

  const handleReject = async (requestId) => {
    setProcessingId(requestId);
    setProcessingAction('reject');
    try {
      // Use admin endpoint if current user is an admin
      if (user?.role === 'admin') {
        await withdrawalAPI.rejectAdminWithdrawalRequest({ requestId });
      } else {
        await withdrawalAPI.rejectRequest({ requestId });
      }
      setToastMessage('Withdrawal request rejected');
      setToastType('success');
      setShowToast(true);
      // Fetch latest profile and update wallet balance
      try {
        const { data: userData } = await authAPI.getProfile();
        updateUser(userData);
      } catch (e) {}
      // was window.location.reload() - a full app restart to refresh one list
      fetchPendingRequests();
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to reject request';
      setToastMessage(message);
      setToastType('error');
      setShowToast(true);
      if (error.response?.status === 409) fetchPendingRequests();
    } finally {
      setProcessingId(null);
      setProcessingAction(null);
    }
  };

  const n2 = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  const money = (v) => 'SSP ' + n2(v).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Robustly extract the counterparty across the admin and agent payload shapes.
  const partyOf = (r) => {
    const p = r.agent || r.user || r.agentId || r.userId || {};
    return { name: p.name || 'Unknown', phone: p.phone || '' };
  };

  const initials = (name) => String(name || '?')
    .trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  const totalValue = pendingRequests.reduce((sum, r) => sum + n2(r.amount), 0);

  return (
    <>
      <div className="page-container pw-page">
        <div className="page-header pw-header">
          <div>
            <h1>Withdrawal Requests</h1>
            <p>Review and approve cash-out requests waiting on you.</p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchPendingRequests}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'pw-spin' : ''} /> Refresh
          </button>
        </div>

        {suspended && (
          <div className="pw-alert">
            <TriangleAlert size={17} />
            <span>Your account is suspended, so you cannot approve or reject requests.</span>
          </div>
        )}

        {loading ? (
          <div className="pw-empty">
            <span className="pw-empty-icon"><RefreshCw size={22} className="pw-spin" /></span>
            <h3>Loading requests…</h3>
          </div>
        ) : pendingRequests.length === 0 ? (
          <div className="pw-empty">
            <span className="pw-empty-icon"><Inbox size={22} /></span>
            <h3>Nothing pending</h3>
            <p>Every withdrawal request has been dealt with.</p>
          </div>
        ) : (
          <>
            <div className="pw-summary">
              <div className="pw-summary-item">
                <span>Waiting</span>
                <strong>{pendingRequests.length}</strong>
              </div>
              <div className="pw-summary-item">
                <span>Total value</span>
                <strong>{money(totalValue)}</strong>
              </div>
            </div>

            <div className="pw-grid">
              {pendingRequests.map((request) => {
                const party = partyOf(request);
                const agentFee = n2(request.agentCommission);
                const companyFee = n2(request.companyCommission);
                const fees = agentFee + companyFee;
                const busy = processingId === request.id;

                return (
                  <div key={request.id} className="card pw-card">
                    <div className="pw-card-top">
                      <span className="pw-avatar">{initials(party.name)}</span>
                      <div className="pw-party">
                        <strong>{party.name}</strong>
                        {party.phone && <span>{party.phone}</span>}
                      </div>
                      <span className="badge badge-warning pw-status">Pending</span>
                    </div>

                    <div className="pw-amount">
                      <span>Withdrawal amount</span>
                      <strong>{money(request.amount)}</strong>
                    </div>

                    {/* The amount is the headline above, so the breakdown starts
                        at the fees rather than repeating it. */}
                    <dl className="pw-breakdown">
                      <div>
                        <dt>Agent commission ({n2(request.agentCommissionPercent)}%)</dt>
                        <dd>{money(agentFee)}</dd>
                      </div>
                      <div>
                        <dt>Company commission ({n2(request.companyCommissionPercent)}%)</dt>
                        <dd>{money(companyFee)}</dd>
                      </div>
                      <div className="pw-total">
                        <dt>Total user pays</dt>
                        <dd>{money(n2(request.amount) + fees)}</dd>
                      </div>
                    </dl>

                    <p className="pw-time">
                      <Calendar size={13} />
                      {request.createdAt
                        ? new Date(request.createdAt).toLocaleDateString() + ' · ' +
                          new Date(request.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Unknown time'}
                    </p>

                    <div className="pw-actions">
                      <button
                        type="button"
                        className="pw-btn is-approve"
                        onClick={() => handleApprove(request.id)}
                        disabled={busy || suspended}
                      >
                        {busy && processingAction === 'approve'
                          ? <><span className="pw-spinner" /> Approving…</>
                          : <><Check size={15} /> Approve</>}
                      </button>
                      <button
                        type="button"
                        className="pw-btn is-reject"
                        onClick={() => handleReject(request.id)}
                        disabled={busy || suspended}
                      >
                        {busy && processingAction === 'reject'
                          ? <><span className="pw-spinner" /> Rejecting…</>
                          : <><X size={15} /> Reject</>}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {showToast && (
          <Toast
            message={toastMessage}
            type={toastType}
            onClose={() => setShowToast(false)}
          />
        )}
      </div>
      <Footer />
    </>
  );
}