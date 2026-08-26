import { useState, useEffect } from 'react';
import { useAuthStore } from '../context/store';
import Toast from '../components/Toast';
import Footer from '../components/Footer';
import { transactionAPI, withdrawalAPI } from '../utils/api';
import '../styles/pull-money.css';
import { Banknote, ClipboardList, Search, TriangleAlert, User, Wallet } from 'lucide-react';

/* DECIMAL columns arrive from Sequelize as strings; coerce before formatting. */
const money = (v) => 'SSP ' + (Number(v) || 0).toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const n2 = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

export default function AgentWithdraw() {
  const user = useAuthStore((state) => state.user);
  const suspended = !!user?.isSuspended;
  const [userPhone, setUserPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  /* The empty state keyed off the phone field alone, so it appeared the moment
     someone started typing — telling them the customer does not exist before
     anything had been looked up. */
  const [searched, setSearched] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [showToast, setShowToast] = useState(false);
  /* The customer is debited amount + agent fee + service fee, and the old
     "Commission Breakdown" showed the amount twice and no commission at all.
     Priced by the server so this matches what approval actually charges. */
  const [quote, setQuote] = useState(null);

  const customerPhone = userInfo?.phoneNumber || userInfo?.phone || '';

  useEffect(() => {
    const value = parseFloat(amount);
    if (!customerPhone || !Number.isFinite(value) || value <= 0) {
      setQuote(null);
      return;
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const { data } = await transactionAPI.getWithdrawalQuote(value, customerPhone);
        if (!cancelled) setQuote(data);
      } catch {
        /* keep the last quote rather than flashing a wrong total */
      }
    }, 300);

    return () => { cancelled = true; clearTimeout(t); };
  }, [amount, customerPhone]);

  /* Ceiling for this customer, not for the agent — fetched once per customer
     so the "All" button cannot propose an amount approval would reject. */
  const [maxAmount, setMaxAmount] = useState(null);

  useEffect(() => {
    if (!customerPhone) { setMaxAmount(null); return; }
    let cancelled = false;
    transactionAPI.getWithdrawalQuote(0, customerPhone)
      .then(({ data }) => { if (!cancelled) setMaxAmount(n2(data.maxAmount)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [customerPhone]);

  




  // Manual search button always shows toast for user found/not found
  // Normalize phone number for search and withdrawal
  function normalizePhone(input) {
    let digits = input.replace(/(?!^\+)\D/g, '');
    if (digits.startsWith('211')) return '+' + digits;
    if (digits.length === 9 && digits.startsWith('9')) return '+211' + digits;
    if (digits.length === 10 && digits.startsWith('0')) return '+211' + digits.slice(1);
    return input.trim();
  }

  const handleSearchUser = async (e) => {
    e.preventDefault();
    if (suspended) {
      setToastMessage('Your account is suspended. You cannot perform transactions.');
      setToastType('error');
      setShowToast(true);
      return;
    }
    if (!userPhone.trim()) {
      setToastMessage('Please enter a user phone number');
      setToastType('error');
      setShowToast(true);
      return;
    }
    setSearching(true);
    setSearched(true);
    try {
      const normalized = normalizePhone(userPhone);
      const response = await transactionAPI.getUserInfo(normalized);
      // Support both {user: {...}} and direct user object
      const user = response.data.user || response.data;
      if (user && (user.phone || user.phoneNumber)) {
        setUserInfo(user);
        setToastMessage('User found successfully');
        setToastType('success');
        setShowToast(true);
      } else {
        setUserInfo(null);
        setToastMessage('User not found');
        setToastType('error');
        setShowToast(true);
      }
    } catch (error) {
      setUserInfo(null);
      setToastMessage(error.response?.data?.message || 'Failed to search user');
      setToastType('error');
      setShowToast(true);
    } finally {
      setSearching(false);
    }
  };

  // Handle withdrawal request submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (suspended) {
      setToastMessage('Your account is suspended. You cannot perform transactions.');
      setToastType('error');
      setShowToast(true);
      return;
    }

    if (!userInfo) {
      setToastMessage('Please search and select a user first');
      setToastType('error');
      setShowToast(true);
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setToastMessage('Please enter a valid amount');
      setToastType('error');
      setShowToast(true);
      return;
    }

    setLoading(true);
    try {
      // Support both user.phone and user.phoneNumber
      const phone = userInfo.phoneNumber || userInfo.phone;
      const normalized = normalizePhone(phone);
      const response = await withdrawalAPI.requestWithdrawal({
        userPhone: normalized,
        amount: parseFloat(amount)
      });

      setToastMessage('Withdrawal request sent successfully. Waiting for user approval.');
      setToastType('success');
      setShowToast(true);

      // Clear form
      setUserPhone('');
      setAmount('');
      setUserInfo(null);

      setTimeout(() => {
        // Optional: Navigate to transactions or pending requests
      }, 2000);
    } catch (error) {
      setToastMessage(error.response?.data?.message || 'Failed to send withdrawal request');
      setToastType('error');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  const entered = n2(amount);
  const priced = quote && quote.amount === entered ? quote : null;
  const totalFee = priced ? n2(priced.totalFee) : 0;
  const totalCost = entered + totalFee;
  const customerBalance = n2(userInfo?.balance);
  const overBalance = amount !== '' && totalCost > customerBalance;

  const setPortion = (fraction) => {
    const ceiling = maxAmount != null ? maxAmount : customerBalance;
    const wanted = fraction === 1 ? ceiling : Math.min(customerBalance * fraction, ceiling);
    setAmount(String(Math.floor(wanted * 100) / 100));
  };

  return (
    <>
      <div className="page-container pull-money-container pm-page">
        <header className="pm-header">
          <h2 className="pm-title">Pull Money from User</h2>
          <p className="pm-sub">Request a cash withdrawal from a customer&rsquo;s wallet.</p>
        </header>

        {suspended && (
          <div className="alert alert-danger">
            <TriangleAlert size={16} /> Your account is suspended. You cannot perform transactions.
          </div>
        )}

        <div className="pm-grid">
          {/* ---------- step 1: who ---------- */}
          <div className="card pm-card">
            <div className="card-header">
              <h3><User size={18} /> Customer</h3>
              <span className="pm-step">Step 1</span>
            </div>
            <div className="card-body">
              <form onSubmit={handleSearchUser} className="search-form pm-search">
                <div className="form-group">
                  <label htmlFor="userPhone">User phone number</label>
                  <input
                    id="userPhone"
                    type="text"
                    inputMode="tel"
                    placeholder="+211 9… or 09…"
                    value={userPhone}
                    onChange={(e) => { setUserPhone(e.target.value); setSearched(false); setUserInfo(null); }}
                    disabled={searching || suspended}
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching || !userPhone.trim() || suspended}
                  className="btn btn-primary btn-search-user pm-search-btn"
                >
                  {searching ? 'Searching…' : <><Search size={15} /> Search</>}
                </button>
              </form>

              {userInfo ? (
                <div className="pm-user">
                  <span className="pm-avatar">
                    {(userInfo.fullName || userInfo.name || '?').trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="pm-user-detail">
                    <span className="pm-user-name">{userInfo.fullName || userInfo.name}</span>
                    <span className="pm-user-phone">{customerPhone}</span>
                  </span>
                  <span className="pm-user-balance">
                    <span>Balance</span>
                    <strong>{money(userInfo.balance)}</strong>
                  </span>
                </div>
              ) : searched && !searching ? (
                <p className="pm-empty">
                  No customer found for <b>{userPhone}</b>. Check the number and try again.
                </p>
              ) : null}
            </div>
          </div>

          {/* ---------- step 2: how much ---------- */}
          {userInfo && (
            <form onSubmit={handleSubmit}>
              <div className="card pm-card">
                <div className="card-header">
                  <h3><Banknote size={18} /> Amount</h3>
                  <span className="pm-step">Step 2</span>
                </div>
                <div className="card-body">
                  <div className="form-group">
                    <label htmlFor="amount">How much are you giving them?</label>
                    <div className={'pm-amount-field' + (overBalance ? ' is-invalid' : '')}>
                      <span className="pm-currency">SSP</span>
                      <input
                        id="amount"
                        type="number"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        step="0.01"
                        min="0"
                        disabled={loading}
                      />
                    </div>

                    <div className="pm-quick">
                      <button type="button" onClick={() => setPortion(0.25)} disabled={loading}>25%</button>
                      <button type="button" onClick={() => setPortion(0.5)} disabled={loading}>50%</button>
                      <button type="button" onClick={() => setPortion(1)} disabled={loading}>All</button>
                    </div>
                  </div>

                  {/* Shown only once the amount has been priced, so it can never
                      present a "total" that is merely the amount repeated. */}
                  {entered > 0 && priced && (
                    <div className="pm-fees">
                      <h4>Commission breakdown</h4>
                      <div className="pm-fee-list">
                        <div className="pm-fee-row">
                          <span>Cash to customer</span><span>{money(entered)}</span>
                        </div>
                        <div className="pm-fee-row is-earning">
                          <span>Your commission ({priced.agentPercent}%)</span>
                          <span>+{money(priced.agentCommission)}</span>
                        </div>
                        <div className="pm-fee-row">
                          <span>Service fee ({priced.companyPercent}%)</span>
                          <span>{money(priced.companyCommission)}</span>
                        </div>
                      </div>
                      <div className="pm-fee-total">
                        <span>Customer pays</span><span>{money(totalCost)}</span>
                      </div>
                      <p className="pm-fee-note">
                        You receive {money(entered + n2(priced.agentCommission))} — the cash you hand
                        over plus your commission.
                      </p>
                    </div>
                  )}

                  {overBalance ? (
                    <small className="pm-error">
                      {money(totalCost)} including fees is more than their balance of {money(customerBalance)}.
                    </small>
                  ) : entered > 0 && priced ? (
                    <small className="pm-hint">
                      Their balance after this withdrawal: {money(customerBalance - totalCost)}
                    </small>
                  ) : null}

                  <button
                    type="submit"
                    disabled={loading || !amount || entered <= 0 || overBalance || suspended}
                    className="btn btn-primary btn-block btn-lg btn-send-pull-request"
                  >
                    {loading ? 'Sending…' : <><Wallet size={16} /> Send pull request</>}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        <div className="pm-steps">
          <h4><ClipboardList size={15} /> How it works</h4>
          <ol>
            <li>Search for the customer by phone number.</li>
            <li>Enter the cash amount you are handing over.</li>
            <li>Send the request — they approve it on their phone.</li>
            <li>Their wallet is debited and your balance is credited.</li>
          </ol>
        </div>

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
