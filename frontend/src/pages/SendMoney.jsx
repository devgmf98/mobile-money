import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowRight, Camera, Check, CircleCheck, Info, QrCode,
  Smartphone, TriangleAlert, Wallet, X,
} from 'lucide-react';
import { useAuthStore } from '../context/store';
import { transactionAPI, authAPI } from '../utils/api';
import QRScanner from '../components/QRScanner';
import Footer from '../components/Footer';
import '../styles/send-money.css';
import '../styles/send-money-flow.css';

const n2 = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const money = (v) => 'SSP ' + n2(v).toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function SendMoney() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const suspended = !!user?.isSuspended;

  const [recipientPhone, setRecipientPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannedData, setScannedData] = useState(null);

  const balance = n2(user?.balance);
  const entered = n2(amount);

  /* The sender is debited amount + company commission — the recipient always
     gets the full amount — so every figure below has to be built from the
     server's quote, not from the amount on its own. */
  const [quote, setQuote] = useState(null);
  /* Largest sendable amount once the fee is added — server-computed, because
     the rate is tier-dependent (see the withdraw page for the same reason). */
  const [maxAmount, setMaxAmount] = useState(null);

  useEffect(() => {
    let cancelled = false;
    transactionAPI.getSendQuote(0, recipientPhone.trim())
      .then(({ data }) => { if (!cancelled) setMaxAmount(n2(data.maxAmount)); })
      .catch(() => {});
    return () => { cancelled = true; };
    /* The ceiling differs by tier, so it is re-fetched when the payee does. */
  }, [recipientPhone]);

  useEffect(() => {
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setQuote(null);
      return;
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const { data } = await transactionAPI.getSendQuote(value, recipientPhone.trim());
        if (cancelled) return;
        setQuote(data);
        if (data.maxAmount != null) setMaxAmount(n2(data.maxAmount));
      } catch {
        /* Keep the previous quote rather than showing a wrong total; the
           server re-checks the balance on submit regardless. */
      }
    }, 300);

    return () => { cancelled = true; clearTimeout(t); };
    /* Re-quotes when the recipient changes too: paying an agent is charged on
       the withdrawal tier, paying a user on the send-money tier. */
  }, [amount, recipientPhone]);

  const totalFee = quote && quote.amount === entered ? n2(quote.totalFee) : 0;
  const totalCost = entered + totalFee;
  const overBalance = amount !== '' && totalCost > balance;
  /* The server refuses some pairings outright (agent to agent, anyone to an
     admin). It reports the verdict with the quote so the form can say so
     before the user fills in an amount and presses send. */
  const blocked = quote?.allowed === false;
  const canSend = !suspended && recipientPhone.trim() !== '' && entered > 0 && !overBalance && !blocked && !loading;

  // Sending is usually a specific figure, so offer common amounts rather than
  // percentages of the balance (which suit "cash out everything", not paying).
  const PRESETS = [1000, 5000, 10000];
  const setPreset = (v) => setAmount(String(v));
  /* The fee is charged on top, so sending the whole balance would always be
     rejected. Solve for the amount whose amount + fee fits. */
  const sendAll = () =>
    setAmount(String(Math.floor((maxAmount != null ? maxAmount : balance) * 100) / 100));

  const clearRecipient = () => {
    setRecipientPhone('');
    setScannedData(null);
    setError('');
    setNotice('');
  };

  const handleSendMoney = async (e) => {
    e.preventDefault();
    if (suspended) {
      setError('Your account is suspended. You cannot perform transactions.');
      return;
    }
    /* Guard on the full cost — a balance that covers the amount but not the
       fee would otherwise be rejected by the server with a vaguer message. */
    if (totalCost > balance) {
      setError('Amount plus fees exceeds your available balance.');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { data } = await transactionAPI.sendMoney({
        recipientPhone,
        amount: entered,
        description,
      });
      setSuccess('Money sent. Reference ' + data.transaction.transactionId + '.');

      try {
        const { data: userData } = await authAPI.getProfile();
        updateUser(userData);
      } catch (err) {
        console.error('Failed to refresh balance:', err);
      }

      setTimeout(() => {
        navigate(user?.role === 'agent' ? '/agent/dashboard' : '/user/dashboard');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send money');
    } finally {
      setLoading(false);
    }
  };

  const handleQRScan = async (data) => {
    const phoneNumber = data.phoneNumber;
    setRecipientPhone(phoneNumber);
    setScannedData(data);
    setShowScanner(false);
    setError('');

    // Confirming the recipient is informational, so it uses the notice channel.
    // It previously went through setError, which showed "Verifying recipient…"
    // as a red failure even when the scan had worked.
    try {
      const response = await transactionAPI.getUserInfo(phoneNumber);
      /* The endpoint returns the user at the top level, not under `.user`, so
         the old `data?.user` check was never truthy and every valid recipient
         was reported as unregistered. */
      const found = response.data?.user || response.data;
      setNotice(found?.phone
        ? 'Recipient confirmed' + (found.name ? ': ' + found.name : '') + '.'
        : 'That number is not registered yet — the transfer may fail.');
    } catch (err) {
      setNotice('Could not verify the recipient. You can still try sending.');
    }
  };

  const handleStartScanning = () => {
    if (suspended) {
      setError('Your account is suspended. You cannot perform transactions.');
      return;
    }
    setShowScanner(true);
    setError('');
  };

  return (
    <>
      <div className="page-container send-money-page">
        <div className="page-header sm-header">
          <div>
            <h1>Send Money</h1>
            <p>Transfer to any MoneyPay number.</p>
          </div>
          <div className="sm-balance">
            <span><Wallet size={14} /> Available</span>
            <strong>{money(balance)}</strong>
          </div>
        </div>

        {suspended && (
          <div className="sm-alert is-error">
            <TriangleAlert size={17} />
            <span>Your account is suspended and cannot send money.</span>
          </div>
        )}
        {error && !suspended && (
          <div className="sm-alert is-error"><TriangleAlert size={17} /><span>{error}</span></div>
        )}
        {success && (
          <div className="sm-alert is-success"><CircleCheck size={17} /><span>{success}</span></div>
        )}

        <form onSubmit={handleSendMoney} className="sm-grid">
          {/* ---- step 1: who ---- */}
          <div className="card sm-card">
            <div className="card-header">
              <h3><Smartphone size={18} /> Recipient</h3>
              <span className="sm-step">Step 1</span>
            </div>
            <div className="card-body">
              {/* Typing a number and scanning a code are the same step, so they
                  sit side by side instead of behind separate tabs. */}
              <div className="sm-recipient-row">
                <div className="form-group">
                  <label htmlFor="send-phone">Phone number</label>
                  <input
                    id="send-phone"
                    name="recipient-phone"
                    type="tel"
                    autoComplete="tel"
                    value={recipientPhone}
                    onChange={(e) => { setRecipientPhone(e.target.value); setScannedData(null); }}
                    required
                    placeholder="+211 9XX XXX XXX"
                    disabled={suspended}
                  />
                </div>

                <span className="sm-or">or</span>

                <button
                  type="button"
                  className="sm-scan-btn"
                  onClick={handleStartScanning}
                  disabled={suspended}
                >
                  <Camera size={17} /> Scan QR
                </button>
              </div>

              {scannedData && recipientPhone && (
                <div className="sm-scanned">
                  <span className="sm-scanned-badge"><Check size={14} /></span>
                  <span>Scanned <strong>{recipientPhone}</strong></span>
                  <button type="button" className="sm-clear" onClick={clearRecipient}>
                    <X size={14} /> Clear
                  </button>
                </div>
              )}

              {notice && <p className="sm-notice"><Info size={13} /> {notice}</p>}
            </div>
          </div>

          {/* ---- step 2: how much ---- */}
          <div className="card sm-card">
            <div className="card-header">
              <h3><Wallet size={18} /> Amount</h3>
              <span className="sm-step">Step 2</span>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label htmlFor="send-amount">How much are you sending?</label>
                <div className={'sm-amount-field' + (overBalance ? ' is-invalid' : '')}>
                  <span className="sm-currency">SSP</span>
                  <input
                    id="send-amount"
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

                <div className="sm-quick">
                  {PRESETS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setPreset(v)}
                      disabled={suspended || (maxAmount != null && v > maxAmount)}
                      title={maxAmount != null && v > maxAmount ? 'More than your balance once fees are added' : undefined}
                    >
                      {v.toLocaleString('en-US')}
                    </button>
                  ))}
                  <button type="button" onClick={sendAll} disabled={suspended || balance <= 0}>All</button>
                </div>

                {!blocked && entered > 0 && quote && quote.amount === entered && totalFee > 0 && (
                  <div className="sm-fees">
                    <div className="sm-fee-row"><span>Transfer amount</span><span>{money(entered)}</span></div>
                    {quote.tier === 'withdrawal' && quote.agentCommission > 0 && (
                      <div className="sm-fee-row">
                        <span>Agent fee ({quote.agentPercent}%)</span><span>{money(quote.agentCommission)}</span>
                      </div>
                    )}
                    <div className="sm-fee-row">
                      <span>Service fee ({quote.companyPercent}%)</span><span>{money(quote.companyCommission)}</span>
                    </div>
                    <div className="sm-fee-row is-total"><span>Total deducted</span><span>{money(totalCost)}</span></div>
                    {quote.tier === 'withdrawal' && (
                      <p className="sm-fee-note">
                        Paying an agent is charged at cash-out rates.
                      </p>
                    )}
                  </div>
                )}

                {blocked
                  ? <small className="sm-error">
                      {quote?.recipientRole === 'agent'
                        ? "Agents can't send money to other agents."
                        : "You can't send money to this account."}
                    </small>
                  : overBalance
                  ? <small className="sm-error">
                      {money(totalCost)} including fees is more than your balance of {money(balance)}.
                    </small>
                  : <small className="sm-hint">Balance after this transfer: {money(balance - totalCost)}</small>}
              </div>

              <div className="form-group">
                <label htmlFor="send-description">Note <span className="sm-optional">optional</span></label>
                <textarea
                  id="send-description"
                  name="description"
                  autoComplete="off"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this transfer for?"
                  rows={2}
                  disabled={suspended}
                />
              </div>

            </div>
          </div>

          {/* Review spans both columns: the last thing before sending should
              restate who is being paid and what it leaves behind. */}
          <div className="sm-review">
            <div className="sm-review-flow">
              <span className="sm-party-chip">
                <span className="sm-party-label">From</span>
                <strong>You</strong>
              </span>
              <ArrowRight size={16} />
              <span className="sm-party-chip is-to">
                <span className="sm-party-label">To</span>
                <strong>{recipientPhone.trim() || 'No recipient yet'}</strong>
              </span>
            </div>

            <dl className="sm-review-figures">
              <div>
                <dt>Sending</dt>
                <dd className="is-amount">{money(entered)}</dd>
              </div>
              {totalFee > 0 && (
                <div>
                  <dt>Service fee</dt>
                  <dd>{money(totalFee)}</dd>
                </div>
              )}
              <div>
                <dt>Balance after</dt>
                <dd>{money(overBalance ? balance : balance - totalCost)}</dd>
              </div>
            </dl>

            <button type="submit" className="btn btn-primary btn-lg sm-send" disabled={!canSend}>
              {loading
                ? 'Sending…'
                : suspended
                  ? 'Account suspended'
                  : <>Send {entered > 0 ? money(entered) : 'money'} <ArrowRight size={16} /></>}
            </button>
          </div>
        </form>

        {/* Receiving lives on its own page; it used to be buried two tab levels
            deep inside this one. */}
        <Link to="/user/receive" className="sm-receive">
          <span className="sm-receive-icon"><QrCode size={20} /></span>
          <span className="sm-receive-text">
            <strong>Getting paid instead?</strong>
            <span>Show your QR code so someone can send you money.</span>
          </span>
          <ArrowRight size={17} />
        </Link>
      </div>

      {showScanner && (
        <QRScanner onScan={handleQRScan} onClose={() => setShowScanner(false)} />
      )}
      <Footer />
    </>
  );
}
