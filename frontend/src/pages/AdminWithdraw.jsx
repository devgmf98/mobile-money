import { useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  BadgeCheck,
  CircleCheck,
  ClipboardList,
  Info,
  Search,
  TriangleAlert,
  User,
  Wallet,
  X,
} from 'lucide-react';
import Footer from '../components/Footer';
import '../styles/admin-agent-withdraw.css';
import api from '../utils/api';

const n2 = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const money = (v) => 'SSP ' + n2(v).toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const initials = (name) => String(name || '?')
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map(w => w[0])
  .join('')
  .toUpperCase();

export default function AdminWithdraw() {
  const [agentId, setAgentId] = useState('');
  const [amount, setAmount] = useState('');
  const [agentInfo, setAgentInfo] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  const balance = n2(agentInfo?.balance);
  const entered = n2(amount);
  const remaining = balance - entered;
  const overBalance = agentInfo && amount !== '' && entered > balance;
  const canWithdraw = !!agentInfo && entered > 0 && !overBalance && !loading;

  const needsApproval = useMemo(() => {
    if (!agentInfo || typeof agentInfo.autoAdminCashout === 'undefined') return null;
    return !agentInfo.autoAdminCashout;
  }, [agentInfo]);

  const handleCheckAgent = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setAgentInfo(null);
    setChecking(true);

    try {
      const response = await api.get('/admin/find-agent', { params: { agentId } });
      setAgentInfo(response.data);
    } catch (err) {
      if (err.response && err.response.status === 404) {
        setError('No agent found with that Agent ID.');
      } else {
        setError(err?.response?.data?.message || 'Failed to search for agent.');
      }
      setAgentInfo(null);
    } finally {
      setChecking(false);
    }
  };

  const clearAgent = () => {
    setAgentInfo(null);
    setAgentId('');
    setAmount('');
    setError('');
    setSuccess('');
  };

  const setPortion = (fraction) => {
    setAmount(String(Math.floor(balance * fraction * 100) / 100));
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!agentInfo) {
      setError('Search for an agent first.');
      return;
    }
    if (entered <= 0) {
      setError('Amount must be greater than 0.');
      return;
    }
    if (entered > balance) {
      setError('Amount exceeds the agent’s available balance.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/admin/withdraw-from-agent', {
        agentId: agentInfo.id,
        amount: entered,
      });
      const data = response.data;

      // If a pending request was created (agent approval needed), prefer that message
      if (data.request && !data.agent) {
        setSuccess('Withdrawal request created and sent to the agent for approval.');
        setAmount('');
      } else if (data.agent) {
        setSuccess('Withdrawal successful. Agent balance is now ' + money(data.agent?.balance) + '.');
        // Merge returned agent data with existing displayed info, but preserve the
        // agent's `autoAdminCashout` flag unless the server explicitly returned it.
        setAgentInfo((prev) => {
          const merged = { ...(prev || {}), ...(data.agent || {}) };
          if (typeof data.agent.autoAdminCashout === 'undefined' && prev && typeof prev.autoAdminCashout !== 'undefined') {
            merged.autoAdminCashout = prev.autoAdminCashout;
          }
          return merged;
        });
        setAmount('');
      } else {
        setSuccess(data.message || 'Withdrawal processed.');
        setAmount('');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to process withdrawal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="page-container agent-withdraw-page">
        <div className="page-header aw-header">
          <div>
            <h1>Agent Withdrawal</h1>
            <p>Search for an agent and remove funds from their account.</p>
          </div>
          {agentInfo && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={clearAgent}>
              <X size={15} /> Start over
            </button>
          )}
        </div>

        {/* page-level alerts, so they stay visible whichever card is in play */}
        {error && (
          <div className="aw-alert is-error" role="alert">
            <TriangleAlert size={17} /> <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="aw-alert is-success" role="status">
            <CircleCheck size={17} /> <span>{success}</span>
          </div>
        )}

        <div className="aw-grid">
          {/* ---------- step 1: find the agent ---------- */}
          <div className="card aw-card">
            <div className="card-header">
              <h3><Search size={18} /> Find agent</h3>
              <span className="aw-step">Step 1</span>
            </div>
            <div className="card-body">
              <form onSubmit={handleCheckAgent}>
                <div className="form-group">
                  <label htmlFor="agent-id"><User size={14} /> Agent ID</label>
                  <div className="aw-search-field">
                    <input
                      id="agent-id"
                      name="agentId"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={agentId}
                      onChange={(e) => setAgentId(e.target.value)}
                      required
                      placeholder="123456"
                    />
                    <button type="submit" className="btn btn-primary" disabled={checking || !agentId.trim()}>
                      <Search size={15} /> {checking ? 'Searching…' : 'Search'}
                    </button>
                  </div>
                  <small className="aw-hint">The agent&rsquo;s 6-digit Agent ID.</small>
                </div>
              </form>

              {agentInfo && (
                <div className="aw-agent">
                  <div className="aw-agent-top">
                    <span className="aw-avatar">{initials(agentInfo.name)}</span>
                    <div className="aw-agent-id">
                      <strong>{agentInfo.name}</strong>
                      <span>{agentInfo.phone}</span>
                    </div>
                    <span className="badge badge-warning aw-role">Agent</span>
                  </div>

                  <div className="aw-balance">
                    <span className="aw-balance-label"><Wallet size={14} /> Available balance</span>
                    <strong className="aw-balance-value">{money(agentInfo.balance)}</strong>
                  </div>

                  {needsApproval !== null && (
                    <div className={'aw-approval ' + (needsApproval ? 'is-warn' : 'is-ok')}>
                      {needsApproval
                        ? <><TriangleAlert size={15} /> This agent must approve the withdrawal.</>
                        : <><BadgeCheck size={15} /> No approval needed &mdash; processed immediately.</>}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ---------- step 2: withdraw ---------- */}
          <div className={'card aw-card' + (agentInfo ? '' : ' is-locked')}>
            <div className="card-header">
              <h3><ArrowDownToLine size={18} /> Withdraw funds</h3>
              <span className="aw-step">Step 2</span>
            </div>
            <div className="card-body">
              {agentInfo ? (
                <form onSubmit={handleWithdraw}>
                  <div className="form-group">
                    <label htmlFor="withdraw-amount"><ArrowDownToLine size={14} /> Amount</label>
                    <div className={'aw-amount-field' + (overBalance ? ' is-invalid' : '')}>
                      <span className="aw-currency">SSP</span>
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
                        inputMode="decimal"
                      />
                    </div>

                    <div className="aw-quick">
                      <button type="button" onClick={() => setPortion(0.25)}>25%</button>
                      <button type="button" onClick={() => setPortion(0.5)}>50%</button>
                      <button type="button" onClick={() => setPortion(1)}>Max</button>
                    </div>

                    {overBalance
                      ? <small className="aw-error">Exceeds the available balance of {money(balance)}.</small>
                      : <small className="aw-hint">Removed from the agent&rsquo;s account.</small>}
                  </div>

                  <div className="aw-summary">
                    <div className="aw-summary-row">
                      <span>Current balance</span>
                      <strong>{money(balance)}</strong>
                    </div>
                    <div className="aw-summary-row">
                      <span>Withdrawing</span>
                      <strong className="is-out">&minus; {money(entered)}</strong>
                    </div>
                    <div className="aw-summary-row is-total">
                      <span>Balance after</span>
                      <strong>{money(overBalance ? balance : remaining)}</strong>
                    </div>
                  </div>

                  <button type="submit" className="btn btn-danger btn-block" disabled={!canWithdraw}>
                    <ArrowDownToLine size={16} /> {loading ? 'Processing…' : 'Complete withdrawal'}
                  </button>

                  {needsApproval && (
                    <p className="aw-approval-note">
                      <Info size={13} /> This will be sent to the agent as a request, not withdrawn straight away.
                    </p>
                  )}
                </form>
              ) : (
                <div className="empty-state aw-empty">
                  <span className="empty-icon"><Search size={22} /></span>
                  <h3>No agent selected</h3>
                  <p>Search for an agent to unlock the withdrawal form.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ---------- guide ---------- */}
        <div className="card aw-guide">
          <div className="card-header">
            <h3><ClipboardList size={18} /> Withdrawal guide</h3>
          </div>
          <div className="card-body">
            <div className="aw-guide-grid">
              <div className="aw-guide-col">
                <h4>How it works</h4>
                <ol className="aw-steps">
                  <li>Enter the agent&rsquo;s 6-digit Agent ID.</li>
                  <li>Search to load their account and balance.</li>
                  <li>Review the current balance.</li>
                  <li>Enter the amount to withdraw.</li>
                  <li>Complete the withdrawal.</li>
                  <li>Check the confirmation for the new balance.</li>
                </ol>
              </div>

              <div className="aw-guide-col is-warn">
                <h4><TriangleAlert size={15} /> Before you confirm</h4>
                <ul className="aw-notes">
                  <li>Check the Agent ID matches the right account.</li>
                  <li>Withdrawals cannot exceed the available balance.</li>
                  <li>Some agents must approve the request first.</li>
                  <li>Every withdrawal is recorded in transaction history.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
