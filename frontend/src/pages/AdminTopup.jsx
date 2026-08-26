import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  BadgeCheck,
  CircleCheck,
  ClipboardList,
  Info,
  Plus,
  Search,
  ShieldAlert,
  TriangleAlert,
  User,
  Wallet,
  X,
} from 'lucide-react';
import Footer from '../components/Footer';
import '../styles/admin-topup.css';
import { adminAPI, transactionAPI } from '../utils/api';

// Sequelize returns DECIMAL columns as strings, so coerce before arithmetic.
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

const PRESETS = [1000, 5000, 10000];

export default function AdminTopup() {
  const [userPhone, setUserPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  const location = useLocation();

  const balance = n2(userInfo?.balance);
  const entered = n2(amount);
  const newBalance = balance + entered;
  const canTopup = !!userInfo && entered > 0 && !loading;

  // fetch user by phone helper (can be called programmatically)
  const fetchUserByPhone = async (phone) => {
    setError('');
    setUserInfo(null);
    setChecking(true);
    try {
      const { data } = await transactionAPI.getUserInfo(phone);
      setUserInfo(data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to find that user.');
      setUserInfo(null);
    } finally {
      setChecking(false);
    }
  };

  const handleCheckUserBalance = async (e) => {
    e.preventDefault();
    await fetchUserByPhone(userPhone);
  };

  // If navigated here with a phone in location.state (from Manage Users), prefill and auto-search
  useEffect(() => {
    const phoneFromState = location?.state?.phone;
    if (phoneFromState) {
      setUserPhone(phoneFromState);
      fetchUserByPhone(phoneFromState);
    }
    // Also support ?phone=... query param
    const params = new URLSearchParams(location.search);
    const qphone = params.get('phone');
    if (!phoneFromState && qphone) {
      setUserPhone(qphone);
      fetchUserByPhone(qphone);
    }
  }, [location]);

  const clearUser = () => {
    setUserInfo(null);
    setUserPhone('');
    setAmount('');
    setError('');
    setSuccess('');
  };

  const handleTopup = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!userInfo) {
      setError('Search for a user first.');
      return;
    }
    if (entered <= 0) {
      setError('Topup amount must be greater than 0.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await adminAPI.topupUser({
        userId: userInfo.id,
        amount: entered,
      });
      setSuccess('Topup successful. New balance is ' + money(data.user?.balance) + '.');
      // Keep the user on screen with their updated balance so a second topup
      // does not require searching again.
      setUserInfo((prev) => ({ ...(prev || {}), ...(data.user || {}) }));
      setAmount('');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to process topup.');
    } finally {
      setLoading(false);
    }
  };

  const verified = !!userInfo?.isVerified;

  return (
    <>
      <div className="page-container topup-page">
        <div className="page-header tp-header">
          <div>
            <h1>User Topup</h1>
            <p>Search for a user and add balance to their account.</p>
          </div>
          {userInfo && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={clearUser}>
              <X size={15} /> Start over
            </button>
          )}
        </div>

        {/* page-level alerts, so they stay visible whichever card is in play */}
        {error && (
          <div className="tp-alert is-error" role="alert">
            <TriangleAlert size={17} /> <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="tp-alert is-success" role="status">
            <CircleCheck size={17} /> <span>{success}</span>
          </div>
        )}

        <div className="tp-grid">
          {/* ---------- step 1: find the user ---------- */}
          <div className="card tp-card">
            <div className="card-header">
              <h3><Search size={18} /> Find user</h3>
              <span className="tp-step">Step 1</span>
            </div>
            <div className="card-body">
              <form onSubmit={handleCheckUserBalance}>
                <div className="form-group">
                  <label htmlFor="user-phone"><User size={14} /> Phone number</label>
                  <div className="tp-search-field">
                    <input
                      id="user-phone"
                      name="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={userPhone}
                      onChange={(e) => setUserPhone(e.target.value)}
                      required
                      placeholder="+211 9XX XXX XXX"
                    />
                    <button type="submit" className="btn btn-primary" disabled={checking || !userPhone.trim()}>
                      <Search size={15} /> {checking ? 'Searching…' : 'Search'}
                    </button>
                  </div>
                  <small className="tp-hint">The phone number registered to the account.</small>
                </div>
              </form>

              {userInfo && (
                <div className="tp-user">
                  <div className="tp-user-top">
                    <span className="tp-avatar">{initials(userInfo.name)}</span>
                    <div className="tp-user-id">
                      <strong>{userInfo.name}</strong>
                      <span>{userInfo.phone}</span>
                    </div>
                    <span className={'badge ' + (verified ? 'badge-success' : 'badge-warning')}>
                      {verified ? 'Verified' : 'Pending'}
                    </span>
                  </div>

                  <div className="tp-balance">
                    <span className="tp-balance-label"><Wallet size={14} /> Current balance</span>
                    <strong className="tp-balance-value">{money(userInfo.balance)}</strong>
                  </div>

                  <div className={'tp-verify ' + (verified ? 'is-ok' : 'is-warn')}>
                    {verified
                      ? <><BadgeCheck size={15} /> Account verified.</>
                      : <><ShieldAlert size={15} /> Not verified &mdash; topups may be rejected.</>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ---------- step 2: top up ---------- */}
          <div className={'card tp-card' + (userInfo ? '' : ' is-locked')}>
            <div className="card-header">
              <h3><Plus size={18} /> Add balance</h3>
              <span className="tp-step">Step 2</span>
            </div>
            <div className="card-body">
              {userInfo ? (
                <form onSubmit={handleTopup}>
                  <div className="form-group">
                    <label htmlFor="topup-amount"><Plus size={14} /> Amount</label>
                    <div className="tp-amount-field">
                      <span className="tp-currency">SSP</span>
                      <input
                        id="topup-amount"
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

                    <div className="tp-quick">
                      {PRESETS.map(p => (
                        <button key={p} type="button" onClick={() => setAmount(String(p))}>
                          +{p.toLocaleString('en-US')}
                        </button>
                      ))}
                    </div>

                    <small className="tp-hint">Credited to the user&rsquo;s account.</small>
                  </div>

                  <div className="tp-summary">
                    <div className="tp-summary-row">
                      <span>Current balance</span>
                      <strong>{money(balance)}</strong>
                    </div>
                    <div className="tp-summary-row">
                      <span>Adding</span>
                      <strong className="is-in">+ {money(entered)}</strong>
                    </div>
                    <div className="tp-summary-row is-total">
                      <span>Balance after</span>
                      <strong>{money(newBalance)}</strong>
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary btn-block" disabled={!canTopup}>
                    <Plus size={16} /> {loading ? 'Processing…' : 'Complete topup'}
                  </button>

                  {!verified && (
                    <p className="tp-verify-note">
                      <Info size={13} /> This account is not verified yet.
                    </p>
                  )}
                </form>
              ) : (
                <div className="empty-state tp-empty">
                  <span className="empty-icon"><Search size={22} /></span>
                  <h3>No user selected</h3>
                  <p>Search for a user to unlock the topup form.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ---------- guide ---------- */}
        <div className="card tp-guide">
          <div className="card-header">
            <h3><ClipboardList size={18} /> Topup guide</h3>
          </div>
          <div className="card-body">
            <div className="tp-guide-grid">
              <div className="tp-guide-col">
                <h4>How it works</h4>
                <ol className="tp-steps">
                  <li>Enter the user&rsquo;s phone number.</li>
                  <li>Search to load their account and balance.</li>
                  <li>Review the balance and verification status.</li>
                  <li>Enter the amount to add.</li>
                  <li>Complete the topup.</li>
                  <li>Check the confirmation for the new balance.</li>
                </ol>
              </div>

              <div className="tp-guide-col is-warn">
                <h4><TriangleAlert size={15} /> Before you confirm</h4>
                <ul className="tp-notes">
                  <li>Only verified users can receive topups.</li>
                  <li>Check the phone number matches the right account.</li>
                  <li>Topups take effect immediately.</li>
                  <li>Every topup is recorded in transaction history.</li>
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
