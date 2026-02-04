import { useState } from 'react';
import Footer from '../components/Footer';
import '../styles/withdraw.css';

export default function AdminWithdraw() {
  const [agentId, setAgentId] = useState('');
  const [amount, setAmount] = useState('');
  const [agentInfo, setAgentInfo] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleCheckAgent = async (e) => {
    e.preventDefault();
    setError('');
    setAgentInfo(null);
    setChecking(true);

    try {
      const response = await fetch(`http://localhost:8080/api/admin/find-agent?agentId=${encodeURIComponent(agentId)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(response.status === 404 ? 'Agent not found' : 'Failed to check agent');
      }

      const data = await response.json();
      setAgentInfo(data);
    } catch (err) {
      setError(err.message || 'Failed to check agent');
      setAgentInfo(null);
    } finally {
      setChecking(false);
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (!agentInfo) {
        setError('Please check agent first');
        setLoading(false);
        return;
      }

      const withdrawAmount = parseFloat(amount);
      if (withdrawAmount <= 0) {
        setError('Amount must be greater than 0');
        setLoading(false);
        return;
      }

      const response = await fetch('http://localhost:8080/api/admin/withdraw-from-agent', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ agentId: agentInfo._id, amount: withdrawAmount })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to withdraw from agent');
      }

        // If a pending request was created (agent approval needed), prefer that message
        if (data.request && !data.agent) {
          setSuccess('Withdrawal request created and sent to agent for approval');
          // keep agentInfo as-is so admin can still see agent details, but clear form inputs
          setAgentId('');
          setAmount('');
        } else if (data.agent) {
          // Immediate processing returned updated agent object
          setSuccess(`Withdrawal successful! Agent new balance: SSP ${(parseFloat(data.agent?.balance) || 0).toFixed(2)}`);
          // Merge returned agent data with existing displayed info,
          // but preserve the agent's `autoAdminCashout` flag unless the server explicitly returned it.
          setAgentInfo((prev) => {
            const merged = { ...(prev || {}), ...(data.agent || {}) };
            if (typeof data.agent.autoAdminCashout === 'undefined' && prev && typeof prev.autoAdminCashout !== 'undefined') {
              merged.autoAdminCashout = prev.autoAdminCashout;
            }
            return merged;
          });
          setAgentId('');
          setAmount('');
        } else {
          setSuccess(data.message || 'Withdrawal processed');
          setAgentId('');
          setAmount('');
        }
    } catch (err) {
      setError(err.message || 'Failed to process withdrawal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <div className="page-container">
      <div className="page-header">
        <h1>Agent Withdrawal</h1>
        <p>Search agent and withdraw funds from their account</p>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h3>Search Agent</h3>
          </div>
          <div className="card-body">
            <form onSubmit={handleCheckAgent}>
              {error && <div className="alert alert-danger">{error}</div>}
              {success && <div className="alert alert-success">{success}</div>}

              <div className="form-group">
                <label htmlFor="agent-id">Agent ID</label>
                <input
                  id="agent-id"
                  name="agentId"
                  type="text"
                  autoComplete="off"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  required
                  placeholder="e.g., 123456"
                />
                <small className="text-muted">Enter the agent's 6-digit Agent ID</small>
              </div>

              <button type="submit" className="btn btn-primary btn-block" disabled={checking}>
                {checking ? 'Searching...' : 'Search Agent'}
              </button>
            </form>

            {agentInfo && (
              <div className="user-info mt-3" style={{ padding: '1rem', backgroundColor: '#fff7ed', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
                <div className="mb-2">
                  <strong>{agentInfo.name}</strong>
                  <div className="text-small text-muted">{agentInfo.phone}</div>
                </div>
                <div className="mb-2">
                  <span className="text-muted">Current Balance: </span>
                  <span className="text-danger font-weight-bold" style={{ fontSize: '18px' }}>
                    SSP {(parseFloat(agentInfo.balance) || 0).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-muted">Status: </span>
                  <span className="badge badge-warning">
                    Agent
                  </span>
                </div>
                {typeof agentInfo.autoAdminCashout !== 'undefined' && (
                  <div style={{ marginTop: '8px' }}>
                    {!agentInfo.autoAdminCashout ? (
                      <div style={{ color: '#b45309', fontWeight: 600 }}>⚠️ Needs approval by this agent</div>
                    ) : (
                      <div style={{ color: '#065f46', fontWeight: 600 }}>✅ Approval not needed by this agent</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Withdraw Amount</h3>
          </div>
          <div className="card-body">
            <form onSubmit={handleWithdraw}>
              {agentInfo ? (
                <>
                  <div className="form-group">
                    <label htmlFor="withdraw-amount">Withdraw Amount (SSP)</label>
                    <input
                      id="withdraw-amount"
                      name="amount"
                      type="number"
                      autoComplete="off"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                    <small className="text-muted">Enter amount to remove from agent account</small>
                  </div>

                  <button type="submit" className="btn btn-danger btn-block btn-lg" disabled={loading}>
                    {loading ? 'Processing...' : 'Complete Withdrawal'}
                  </button>
                </>
              ) : (
                <p className="text-muted text-center">Search agent first to proceed</p>
              )}
            </form>
          </div>
        </div>
      </div>

      <div className="card mt-4">
        <div className="card-header">
          <h3>📋 Withdrawal Guide</h3>
        </div>
        <div className="card-body">
          <div className="info-box">
            <h4>Steps:</h4>
            <ol>
              <li>Enter the agent's phone number</li>
              <li>Click "Search Agent" to find and view their account</li>
              <li>Review current balance</li>
              <li>Enter the withdrawal amount</li>
              <li>Click "Complete Withdrawal"</li>
              <li>Confirm success message shows new balance</li>
            </ol>
          </div>
          <div className="info-box warning">
            <h4>⚠️ Important:</h4>
            <ul>
              <li>Ensure correct phone number before proceeding</li>
              <li>Withdrawals are recorded in transaction history</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
    <Footer />
    </>
  );
}
