import { useState, useEffect } from 'react';
import { useAuthStore } from '../context/store';
import { transactionAPI, withdrawalAPI, authAPI } from '../utils/api';
import Toast from '../components/Toast';
import Footer from '../components/Footer';
import '../styles/withdraw.css';
import '../styles/withdraw-flow.css';
import { ArrowRight, Banknote, CircleCheck, ClipboardList, Clock, Phone, TriangleAlert, User, Wallet } from 'lucide-react';

const n2 = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const money = (v) => 'SSP ' + n2(v).toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function Withdraw() {
  const user = useAuthStore((state) => state.user);
  const suspended = !!user?.isSuspended;
  const updateUser = useAuthStore((state) => state.updateUser);
  const [agentId, setAgentId] = useState('');
  /* Resolved from the ID the moment it is 6 digits long, so the customer can
     check the name against the person in front of them before committing. */
  const [agentInfo, setAgentInfo] = useState(null);
  const [agentLookup, setAgentLookup] = useState('');

  useEffect(() => {
    const id = agentId.trim();
    if (!/^\d{6}$/.test(id)) {
      setAgentInfo(null);
      setAgentLookup('');
      return;
    }

    /* Debounced, and every response is checked against `cancelled` — typing
       471543 straight after 471542 fires two requests, and without this the
       slower one could overwrite the newer answer. */
    let cancelled = false;
    setAgentLookup('loading');
    const t = setTimeout(async () => {
      try {
        const { data } = await transactionAPI.getAgentInfo(id);
        if (cancelled) return;
        setAgentInfo(data);
        setAgentLookup('found');
      } catch (err) {
        if (cancelled) return;
        setAgentInfo(null);
        setAgentLookup(err?.response?.data?.message || 'No agent found with that ID');
      }
    }, 350);

    return () => { cancelled = true; clearTimeout(t); };
  }, [agentId]);

  const [userPhone, setUserPhone] = useState('');
  const [amount, setAmount] = useState('');

  /* The server debits amount + agent commission + company commission, so the
     balance preview has to ask it what the withdrawal actually costs rather
     than subtracting the amount alone. */
  const [quote, setQuote] = useState(null);
  /* The largest amount that still fits once fees are added. Only the server can
     work this out — the fee rate changes by tier, so dividing the balance by
     the current tier's rate lands in a higher tier that no longer fits. */
  const [maxAmount, setMaxAmount] = useState(null);

  useEffect(() => {
    let cancelled = false;
    transactionAPI.getWithdrawalQuote(0)
      .then(({ data }) => { if (!cancelled) setMaxAmount(n2(data.maxAmount)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setQuote(null);
      return;
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const { data } = await transactionAPI.getWithdrawalQuote(value);
        if (cancelled) return;
        setQuote(data);
        if (data.maxAmount != null) setMaxAmount(n2(data.maxAmount));
      } catch {
        /* Leave the last quote in place rather than flashing a wrong total —
           the submit button stays guarded by the server's own balance check. */
      }
    }, 300);

    return () => { cancelled = true; clearTimeout(t); };
  }, [amount]);
  const [userInfo, setUserInfo] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [toast, setToast] = useState({ message: '', type: '' });
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  // For regular users: withdraw through an agent
  const handleUserWithdraw = async (e) => {
    e.preventDefault();
    if (suspended) {
      setError('Your account is suspended. You cannot perform transactions.');
      setToast({ message: 'Your account is suspended. You cannot perform transactions.', type: 'error' });
      return;
    }
    // The button is disabled past the balance, but guard the handler too -
    // disabled state alone is not a validation.
    if (n2(amount) > n2(user?.balance)) {
      const msg = 'Amount exceeds your available balance.';
      setError(msg);
      setToast({ message: msg, type: 'error' });
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { data } = await transactionAPI.withdraw({
        agentId,
        amount: n2(amount)
      });
      
      // Refetch user profile to get updated balance
      try {
        const { data: userData } = await authAPI.getProfile();
        updateUser(userData);
      } catch (profileErr) {
        console.error('Failed to refetch user profile:', profileErr);
      }

      const successMsg = `Withdrawal initiated! Transaction ID: ${data.transaction.transactionId}`;
      setSuccess(successMsg);
      setToast({ message: `Successfully initiated withdrawal of SSP ${amount}. Meet your agent to complete the transaction.`, type: 'success' });
      setAgentId('');
      setAmount('');
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to initiate withdrawal';
      setError(errorMsg);
      setToast({ message: errorMsg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // For agents: check user balance before withdrawal
  const handleCheckUserBalance = async (e) => {
    e.preventDefault();
    if (suspended) {
      setError('Your account is suspended. You cannot perform transactions.');
      setToast({ message: 'Your account is suspended. You cannot perform transactions.', type: 'error' });
      return;
    }
    setError('');
    setUserInfo(null);
    setChecking(true);

    try {
      // Use transactionAPI to get user info by phone
      const response = await transactionAPI.getUserInfo(userPhone);
      setUserInfo(response.data.user || response.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to check user balance');
      setUserInfo(null);
    } finally {
      setChecking(false);
    }
  };

  // For agents: complete withdrawal from user
  const handleAgentWithdraw = async (e) => {
    e.preventDefault();
    if (suspended) {
      setError('Your account is suspended. You cannot perform transactions.');
      setToast({ message: 'Your account is suspended. You cannot perform transactions.', type: 'error' });
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (!userInfo) {
        const errorMsg = 'Please check user balance first';
        setError(errorMsg);
        setToast({ message: errorMsg, type: 'error' });
        setLoading(false);
        return;
      }

      const withdrawAmount = parseFloat(amount);
      if (userInfo.balance < withdrawAmount) {
        const errorMsg = `User has insufficient balance. Available: SSP ${(parseFloat(userInfo.balance) || 0).toFixed(2)}`;
        setError(errorMsg);
        setToast({ message: errorMsg, type: 'error' });
        setLoading(false);
        return;
      }

      // Use withdrawalAPI for agent withdrawal
      const { data } = await withdrawalAPI.requestWithdrawal({
        userPhone: userInfo.phone,
        amount: withdrawAmount
      });

      const successMsg = `Withdrawal processed! Transaction ID: ${data.transaction?.transactionId || ''}`;
      setSuccess(successMsg);
      setToast({ message: `Successfully processed withdrawal of SSP ${withdrawAmount}. Your balance has been updated.`, type: 'success' });
      setUserPhone('');
      setAmount('');
      setUserInfo(null);
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to process withdrawal';
      setError(errorMsg);
      setToast({ message: errorMsg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Agent view
  if (user?.role === 'agent') {
    return (
      <div className="page-container withdraw-page">
        {suspended && <div className="alert alert-danger">Your account is suspended. You cannot perform transactions.</div>}
        <div className="page-header">
          <h1>Process User Withdrawal</h1>
          <p>Check user balance and process cash withdrawal</p>
        </div>

        <div className="grid-2">
          <div className="card">
            <div className="card-header">
              <h3>Check User Balance</h3>
            </div>
            <div className="card-body">
              <form onSubmit={handleCheckUserBalance}>
                {error && <div className="alert alert-danger">{error}</div>}
                {success && <div className="alert alert-success">{success}</div>}

                <div className="form-group">
                  <label htmlFor="user-phone">User Phone Number</label>
                  <input
                    id="user-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    value={userPhone}
                    onChange={(e) => setUserPhone(e.target.value)}
                    required
                    placeholder="+211..."
                  />
                </div>

                <button type="submit" className="btn btn-primary btn-block" disabled={checking || suspended}>
                  {checking ? 'Checking...' : suspended ? 'Account Suspended' : 'Check Balance'}
                </button>
              </form>

              {userInfo && (
                <div className="user-info mt-3" style={{ padding: '1rem', backgroundColor: '#E8F7F0', borderRadius: '8px', borderLeft: '4px solid #00A86B' }}>
                  <div className="mb-2">
                    <strong>{userInfo.name}</strong>
                    <div className="text-small text-muted">{userInfo.phone}</div>
                  </div>
                  <div className="mb-2">
                    <span className="text-muted">Available Balance: </span>
                    <span className="text-success font-weight-bold" style={{ fontSize: '16px' }}>
                      SSP {(parseFloat(userInfo.balance) || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Withdrawal Amount</h3>
            </div>
            <div className="card-body">
              <form onSubmit={handleAgentWithdraw}>
                {userInfo ? (
                  <>
                    <div className="form-group">
                      <label htmlFor="agent-withdraw-amount">Withdrawal Amount (SSP)</label>
                      <input
                        id="agent-withdraw-amount"
                        name="amount"
                        type="number"
                        autoComplete="off"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        max={userInfo.balance || 0}
                      />
                      <small className="text-muted">Max: SSP {(parseFloat(userInfo.balance) || 0).toFixed(2)}</small>
                    </div>

                    <button type="submit" className="btn btn-success btn-block btn-lg" disabled={loading || suspended}>
                      {loading ? 'Processing...' : suspended ? 'Account Suspended' : 'Process Withdrawal'}
                    </button>
                  </>
                ) : (
                  <p className="text-muted text-center">Check user balance first to proceed</p>
                )}
              </form>
            </div>
          </div>
        </div>

        <div className="card mt-4">
          <div className="card-header">
            <h3><ClipboardList size={18} /> Process Guide</h3>
          </div>
          <div className="card-body">
            <div className="info-box">
              <h4>Steps:</h4>
              <ol>
                <li>Enter the user's phone number</li>
                <li>Click "Check Balance" to verify funds</li>
                <li>Review the user's available balance</li>
                <li>Enter the withdrawal amount</li>
                <li>Click "Process Withdrawal"</li>
                <li>Provide cash to user and collect confirmation</li>
              </ol>
            </div>
          </div>
        </div>

        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast({ message: '', type: '' })} 
        />
      </div>
    );
  }

  // User view (existing code)
  const balance = n2(user?.balance);
  const entered = n2(amount);
  /* Until the quote lands, fall back to the amount so the preview is never
     blank; it settles to the true cost a moment later. */
  const totalFee = quote && quote.amount === entered ? n2(quote.totalFee) : 0;
  const totalCost = entered + totalFee;
  const overBalance = amount !== '' && totalCost > balance;
  const canWithdraw = !suspended && agentId.trim().length >= 4 && entered > 0 && !overBalance && !loading;

  /* Fees are charged on top, so a plain balance x 1 would always exceed the
     balance. Solve for the amount whose amount + fee fits, using the rate the
     current quote reports (0 until one arrives, which is the old behaviour). */
  const setPortion = (fraction) => {
    const ceiling = maxAmount != null ? maxAmount : balance;
    const wanted = fraction === 1 ? ceiling : Math.min(balance * fraction, ceiling);
    setAmount(String(Math.floor(wanted * 100) / 100));
  };

  return (
    <>
      <div className="page-container withdraw-page wd-page">
        <div className="page-header wd-header">
          <div>
            <h1>Withdraw Money</h1>
            <p>Cash out through a MoneyPay agent.</p>
          </div>
          <div className="wd-balance">
            <span><Wallet size={14} /> Available</span>
            <strong>{money(balance)}</strong>
          </div>
        </div>

        {suspended && (
          <div className="wd-alert is-error">
            <TriangleAlert size={17} />
            <span>Your account is suspended and cannot withdraw.</span>
          </div>
        )}
        {error && !suspended && (
          <div className="wd-alert is-error"><TriangleAlert size={17} /><span>{error}</span></div>
        )}
        {success && (
          <div className="wd-alert is-success"><CircleCheck size={17} /><span>{success}</span></div>
        )}

        <form onSubmit={handleUserWithdraw} className="wd-grid">
          <div className="card wd-card">
            <div className="card-header">
              <h3><User size={18} /> Agent</h3>
              <span className="wd-step">Step 1</span>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label htmlFor="withdraw-agent">Agent ID</label>
                <input
                  id="withdraw-agent"
                  name="agentId"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value.replace(/\D/g, ''))}
                  required
                  placeholder="123456"
                  maxLength="6"
                  disabled={suspended}
                />
                <small className="wd-hint">Ask the agent for their 6-digit ID.</small>

                {agentLookup === 'loading' && (
                  <p className="wd-agent-status">Checking agent&hellip;</p>
                )}
                {agentLookup === 'found' && agentInfo && (
                  <div className="wd-agent-found">
                    <span className="wd-agent-avatar"><User size={16} /></span>
                    <div className="wd-agent-detail">
                      <strong>{agentInfo.name}</strong>
                      <span><Phone size={12} /> {agentInfo.phone}</span>
                    </div>
                    <CircleCheck size={16} className="wd-agent-tick" />
                  </div>
                )}
                {agentLookup === 'found' && agentInfo?.isSuspended && (
                  <p className="wd-agent-status is-error">
                    This agent is suspended and cannot process withdrawals.
                  </p>
                )}
                {agentLookup && agentLookup !== 'loading' && agentLookup !== 'found' && (
                  <p className="wd-agent-status is-error">{agentLookup}</p>
                )}
              </div>
            </div>
          </div>

          <div className="card wd-card">
            <div className="card-header">
              <h3><Banknote size={18} /> Amount</h3>
              <span className="wd-step">Step 2</span>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label htmlFor="withdraw-amount">How much do you need?</label>
                <div className={'wd-amount-field' + (overBalance ? ' is-invalid' : '')}>
                  <span className="wd-currency">SSP</span>
                  <input
                    id="withdraw-amount"
                    name="amount"
                    type="number"
                    inputMode="decimal"
                    autoComplete="off"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    disabled={suspended}
                  />
                </div>

                <div className="wd-quick">
                  <button type="button" onClick={() => setPortion(0.25)} disabled={suspended}>25%</button>
                  <button type="button" onClick={() => setPortion(0.5)} disabled={suspended}>50%</button>
                  <button type="button" onClick={() => setPortion(1)} disabled={suspended}>All</button>
                </div>

                {entered > 0 && quote && quote.amount === entered && totalFee > 0 && (
                  <div className="wd-fees">
                    <div className="wd-fee-row">
                      <span>Withdrawal amount</span><span>{money(entered)}</span>
                    </div>
                    <div className="wd-fee-row">
                      <span>Agent fee ({quote.agentPercent}%)</span><span>{money(quote.agentCommission)}</span>
                    </div>
                    <div className="wd-fee-row">
                      <span>Service fee ({quote.companyPercent}%)</span><span>{money(quote.companyCommission)}</span>
                    </div>
                    <div className="wd-fee-row is-total">
                      <span>Total deducted</span><span>{money(totalCost)}</span>
                    </div>
                  </div>
                )}

                {overBalance
                  ? <small className="wd-error">
                      {money(totalCost)} including fees is more than your balance of {money(balance)}.
                    </small>
                  : <small className="wd-hint">Balance after this withdrawal: {money(balance - totalCost)}</small>}
              </div>

              <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={!canWithdraw}>
                {loading
                  ? 'Requesting…'
                  : suspended
                    ? 'Account suspended'
                    : <>Request {entered > 0 ? money(entered) : 'withdrawal'} <ArrowRight size={16} /></>}
              </button>
            </div>
          </div>
        </form>

        {/* Was a full half-page column of static text; now a compact strip. */}
        <div className="wd-steps">
          <h4><ClipboardList size={15} /> How it works</h4>
          <ol>
            <li>Get the agent&rsquo;s 6-digit ID.</li>
            <li>Enter the ID and the amount.</li>
            <li>Submit &mdash; the agent is notified.</li>
            <li>Meet the agent to collect your cash.</li>
          </ol>
          <p className="wd-eta"><Clock size={13} /> Usually completed within 30 minutes of agent confirmation.</p>
        </div>

        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ message: '', type: '' })}
        />
      </div>
      <Footer />
    </>
  );
}