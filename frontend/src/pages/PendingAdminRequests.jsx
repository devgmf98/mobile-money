import { useState, useEffect } from 'react';
import { withdrawalAPI } from '../utils/api';
import Footer from '../components/Footer';
import '../styles/admin-requests.css';
import { Check, ClipboardCheck, Inbox, TriangleAlert, X } from 'lucide-react';

/* DECIMAL columns arrive from Sequelize as strings; coerce before formatting. */
const money = (v) => 'SSP ' + (Number(v) || 0).toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/* "2 hours ago" answers the question an approver actually has — how long has
   this been waiting — which a raw timestamp does not. The exact time stays in
   the tooltip for anyone who needs it. */
const relative = (iso) => {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 'Unknown date';
  const mins = Math.round((Date.now() - then.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return mins + (mins === 1 ? ' minute ago' : ' minutes ago');
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
  const days = Math.round(hrs / 24);
  if (days < 30) return days + (days === 1 ? ' day ago' : ' days ago');
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const initialOf = (name) => (name || '?').trim().charAt(0).toUpperCase();

export default function PendingAdminRequests() {
  const [withdrawalRequests, setWithdrawalRequests] = useState([]);
  const [approvingId, setApprovingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchWithdrawalRequests = async () => {
      try {
        setLoading(true);
        const { data } = await withdrawalAPI.getAgentWithdrawalRequests();
        setWithdrawalRequests(data.requests || []);
      } catch (err) {
        console.error('Failed to fetch withdrawal requests:', err);
        setError(err.response?.data?.message || 'Could not load requests. Try again shortly.');
      } finally {
        setLoading(false);
      }
    };

    fetchWithdrawalRequests();
  }, []);

  const handleApproveWithdrawal = async (requestId) => {
    setApprovingId(requestId);
    setError('');
    try {
      await withdrawalAPI.approveAdminWithdrawalRequest({ requestId });
      setWithdrawalRequests(withdrawalRequests.filter((r) => r.id !== requestId));

      // Dispatch event to refresh agent dashboard stats
      window.dispatchEvent(new CustomEvent('mpay:withdrawal-approved'));
    } catch (err) {
      console.error('Failed to approve withdrawal:', err);
      /* Was a blocking alert(), which interrupts the page and gives no clue
         which request failed once dismissed. */
      setError(err.response?.data?.message || 'Failed to approve withdrawal');
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectWithdrawal = async (requestId) => {
    setRejectingId(requestId);
    setError('');
    try {
      await withdrawalAPI.rejectAdminWithdrawalRequest({ requestId, reason: 'Rejected by agent' });

      // Dispatch event to refresh agent dashboard stats
      window.dispatchEvent(new CustomEvent('mpay:withdrawal-rejected'));
      setWithdrawalRequests(withdrawalRequests.filter((r) => r.id !== requestId));
    } catch (err) {
      console.error('Failed to reject withdrawal:', err);
      setError(err.response?.data?.message || 'Failed to reject withdrawal');
    } finally {
      setRejectingId(null);
    }
  };

  return (
    <>
      <div className="dashboard-container par-page">
        <header className="par-header">
          <h1 className="par-title">Admin Withdrawal Requests</h1>
          <p className="par-sub">Approve or reject admin cash out requests from your agent account.</p>
        </header>

        <div className="card par-card">
          <div className="card-header">
            <h3><ClipboardCheck size={18} /> Pending requests</h3>
            <span className={'par-count' + (withdrawalRequests.length === 0 ? ' is-zero' : '')}>
              {withdrawalRequests.length}
            </span>
          </div>
          <div className="card-body">
            {error && (
              <div className="par-error">
                <TriangleAlert size={15} />
                <span>{error}</span>
              </div>
            )}

            {loading ? (
              <p className="par-loading">Loading requests…</p>
            ) : withdrawalRequests.length === 0 ? (
              <div className="par-empty">
                <span className="par-empty-icon"><Inbox size={22} /></span>
                <h4>Nothing waiting</h4>
                <p>Admin cash out requests will appear here for you to approve.</p>
              </div>
            ) : (
              <div className="par-list">
                {withdrawalRequests.map((request) => {
                  const name = request.user?.name || request.user?.phone || 'Unknown admin';
                  const busy = approvingId === request.id || rejectingId === request.id;
                  return (
                    <div className="par-item" key={request.id}>
                      <span className="par-avatar">{initialOf(name)}</span>
                      <span className="par-who">
                        <span className="par-name">{name}</span>
                        <span className="par-when" title={new Date(request.createdAt).toLocaleString()}>
                          Requested {relative(request.createdAt)}
                        </span>
                      </span>
                      <span className="par-amount">{money(request.amount)}</span>
                      <div className="par-actions">
                        <button
                          type="button"
                          onClick={() => handleApproveWithdrawal(request.id)}
                          disabled={busy}
                          className="par-approve"
                        >
                          {approvingId === request.id ? 'Approving…' : <><Check size={15} /> Approve</>}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRejectWithdrawal(request.id)}
                          disabled={busy}
                          className="par-reject"
                        >
                          {rejectingId === request.id ? 'Rejecting…' : <><X size={15} /> Reject</>}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
