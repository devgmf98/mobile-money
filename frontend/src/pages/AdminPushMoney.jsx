import { useState, useEffect } from 'react';
import {
  ArrowRight,
  ArrowLeftRight,
  Banknote,
  CircleCheck,
  Info,
  Phone,
  Send,
  TriangleAlert,
  X,
} from 'lucide-react';
import { adminAPI, transactionAPI } from '../utils/api';
import Footer from '../components/Footer';
import '../styles/admin-push-money.css';

const n2 = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const money = (v) => 'SSP ' + n2(v).toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function AdminPushMoney() {
  const [fromPhone, setFromPhone] = useState('');
  const [toPhone, setToPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  /* Resolve the sender so the admin can see whose wallet they are about to
     debit, and how much is in it, before committing. A push is applied
     immediately, so there is no later screen to catch a wrong number. */
  const [sender, setSender] = useState(null);
  const [senderState, setSenderState] = useState('');

  useEffect(() => {
    const phone = fromPhone.trim();
    if (phone.length < 6) {
      setSender(null);
      setSenderState('');
      return;
    }

    let cancelled = false;
    setSenderState('loading');
    const t = setTimeout(async () => {
      try {
        const { data } = await transactionAPI.getUserInfo(phone);
        if (cancelled) return;
        const found = data?.user || data;
        setSender(found?.phone ? found : null);
        setSenderState(found?.phone ? 'found' : 'missing');
      } catch {
        if (cancelled) return;
        setSender(null);
        setSenderState('missing');
      }
    }, 350);

    return () => { cancelled = true; clearTimeout(t); };
  }, [fromPhone]);

  const amt = n2(amount);
  const samePhone = fromPhone.trim() !== '' && fromPhone.trim() === toPhone.trim();
  /* Only guard once the sender has actually resolved — an unknown number is
     the server's call to reject, not a reason to block the form. */
  const senderBalance = sender ? n2(sender.balance) : null;
  const overBalance = senderBalance !== null && amt > senderBalance;
  const canSend = fromPhone.trim() !== '' && toPhone.trim() !== '' && amt > 0 && !samePhone && !overBalance && !loading;

  const swap = () => {
    setFromPhone(toPhone);
    setToPhone(fromPhone);
  };

  const clearForm = () => {
    setFromPhone('');
    setToPhone('');
    setAmount('');
    setMessage(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (!fromPhone.trim() || !toPhone.trim() || amt <= 0) {
      setMessage({ type: 'error', text: 'Enter both phone numbers and an amount greater than 0.' });
      return;
    }
    if (samePhone) {
      setMessage({ type: 'error', text: 'The sender and recipient cannot be the same number.' });
      return;
    }

    setLoading(true);
    try {
      const { data } = await adminAPI.pushMoney({
        fromPhone: fromPhone.trim(),
        toPhone: toPhone.trim(),
        amount: amt,
      });
      setMessage({ type: 'success', text: 'Transfer complete. Reference ' + data.transactionId + '.' });
      setFromPhone('');
      setToPhone('');
      setAmount('');
    } catch (err) {
      setMessage({ type: 'error', text: err?.response?.data?.message || err.message || 'Transfer failed.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="page-container push-money-page">
        <div className="page-header pm-header">
          <div>
            <h1>Admin Push Money</h1>
            <p>Move funds directly from one user&rsquo;s wallet to another.</p>
          </div>
          {(fromPhone || toPhone || amount) && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={clearForm}>
              <X size={15} /> Clear
            </button>
          )}
        </div>

        {message && (
          <div className={'pm-alert ' + (message.type === 'success' ? 'is-success' : 'is-error')} role="alert">
            {message.type === 'success' ? <CircleCheck size={17} /> : <TriangleAlert size={17} />}
            <span>{message.text}</span>
          </div>
        )}

        <div className="card pm-card">
          <div className="card-header">
            <h3><Send size={18} /> Transfer details</h3>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              {/* sender -> recipient */}
              <div className="pm-flow">
                <div className="pm-party">
                  <span className="pm-party-tag">From</span>
                  <div className="form-group">
                    <label htmlFor="pm-from"><Phone size={14} /> Sender phone</label>
                    <input
                      id="pm-from"
                      type="tel"
                      inputMode="tel"
                      autoComplete="off"
                      value={fromPhone}
                      onChange={(e) => setFromPhone(e.target.value)}
                      placeholder="+211 9XX XXX XXX"
                    />

                    {senderState === 'loading' && (
                      <p className="pm-lookup">Checking&hellip;</p>
                    )}
                    {senderState === 'found' && sender && (
                      <div className="pm-lookup-found">
                        <span className="pm-lookup-name">{sender.name || sender.phone}</span>
                        <span className="pm-lookup-balance">{money(sender.balance)}</span>
                      </div>
                    )}
                    {senderState === 'missing' && (
                      <p className="pm-lookup is-error">No account with that number.</p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  className="pm-swap"
                  onClick={swap}
                  title="Swap sender and recipient"
                  aria-label="Swap sender and recipient"
                >
                  <ArrowLeftRight size={16} />
                </button>

                <div className="pm-party">
                  <span className="pm-party-tag is-to">To</span>
                  <div className="form-group">
                    <label htmlFor="pm-to"><Phone size={14} /> Recipient phone</label>
                    <input
                      id="pm-to"
                      type="tel"
                      inputMode="tel"
                      autoComplete="off"
                      value={toPhone}
                      onChange={(e) => setToPhone(e.target.value)}
                      placeholder="+211 9XX XXX XXX"
                    />
                  </div>
                </div>
              </div>

              {samePhone && (
                <p className="pm-error"><TriangleAlert size={13} /> Sender and recipient must be different.</p>
              )}

              {/* amount */}
              <div className="form-group pm-amount-group">
                <label htmlFor="pm-amount"><Banknote size={14} /> Amount</label>
                <div className="pm-amount-field">
                  <span className="pm-currency">SSP</span>
                  <input
                    id="pm-amount"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    autoComplete="off"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                {overBalance ? (
                  <small className="pm-hint is-error">
                    {money(amt)} is more than {sender?.name || 'the sender'} has ({money(senderBalance)}).
                  </small>
                ) : senderBalance !== null && amt > 0 ? (
                  <small className="pm-hint">
                    Debited from the sender, leaving {money(senderBalance - amt)}.
                  </small>
                ) : (
                  <small className="pm-hint">Debited from the sender and credited to the recipient.</small>
                )}
              </div>

              {/* summary */}
              <div className="pm-summary">
                <div className="pm-summary-route">
                  <span className="pm-chip">{fromPhone.trim() || 'Sender'}</span>
                  <ArrowRight size={15} />
                  <span className="pm-chip is-to">{toPhone.trim() || 'Recipient'}</span>
                </div>
                <strong className="pm-summary-amount">{money(amt)}</strong>
              </div>

              <div className="pm-actions">
                <button type="submit" className="btn btn-primary" disabled={!canSend}>
                  <Send size={16} /> {loading ? 'Sending…' : 'Send transfer'}
                </button>
                <p className="pm-note">
                  <Info size={13} /> Applied immediately and recorded in transaction history.
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
