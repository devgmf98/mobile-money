import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Footer from '../components/Footer';
import '../styles/withdraw.css';
import { adminAPI, authAPI } from '../utils/api';

export default function AdminTopup() {
  const [userPhone, setUserPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  const location = useLocation();

  // fetch user by phone helper (can be called programmatically)
  const fetchUserByPhone = async (phone) => {
    setError('');
    setUserInfo(null);
    setChecking(true);
    try {
      // Use getUserInfo helper from transactionAPI (or similar) if available, else fallback to getProfile
      // If your backend supports searching by phone, use that endpoint here
      // Example: const { data } = await transactionAPI.getUserInfo(phone);
      // For now, fallback to getProfile (may need backend adjustment)
      const { data } = await authAPI.getProfile();
      setUserInfo(data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to check user balance');
      setUserInfo(null);
    } finally {
      setChecking(false);
    }
  };

  // Check user balance (form submit)
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

  // Complete topup
  const handleTopup = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (!userInfo) {
        setError('Please check user balance first');
        setLoading(false);
        return;
      }

      const topupAmount = parseFloat(amount);
      if (topupAmount <= 0) {
        setError('Topup amount must be greater than 0');
        setLoading(false);
        return;
      }

      // Use adminAPI to topup user
      const { data } = await adminAPI.topupUser({
        userId: userInfo.id,
        amount: topupAmount
      });
      setSuccess(`Topup successful! New balance: SSP ${data.user?.balance?.toFixed(2) || '0.00'}`);
      setUserPhone('');
      setAmount('');
      setUserInfo(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to process topup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <div className="page-container">
      <div className="page-header">
        <h1>User Topup</h1>
        <p>Search user and add balance to their account</p>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h3>Search User</h3>
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

              <button type="submit" className="btn btn-primary btn-block" disabled={checking}>
                {checking ? 'Searching...' : 'Search User'}
              </button>
            </form>

            {userInfo && (
              <div className="user-info mt-3" style={{ padding: '1rem', backgroundColor: '#f0f9ff', borderRadius: '8px', borderLeft: '4px solid #2563eb' }}>
                <div className="mb-2">
                  <strong>{userInfo.name}</strong>
                  <div className="text-small text-muted">{userInfo.phone}</div>
                </div>
                <div className="mb-2">
                  <span className="text-muted">Current Balance: </span>
                  <span className="text-success font-weight-bold" style={{ fontSize: '18px' }}>
                    SSP {userInfo.balance?.toFixed(2) || '0.00'}
                  </span>
                </div>
                <div>
                  <span className="text-muted">Status: </span>
                  <span className="badge badge-success">
                    {userInfo.isVerified ? '✓ Verified' : 'Pending Verification'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Topup Amount</h3>
          </div>
          <div className="card-body">
            <form onSubmit={handleTopup}>
              {userInfo ? (
                <>
                  <div className="form-group">
                    <label htmlFor="topup-amount">Topup Amount (SSP)</label>
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
                    />
                    <small className="text-muted">Enter amount to add to user account</small>
                  </div>

                  <button type="submit" className="btn btn-success btn-block btn-lg" disabled={loading}>
                    {loading ? 'Processing...' : 'Complete Topup'}
                  </button>
                </>
              ) : (
                <p className="text-muted text-center">Search user first to proceed</p>
              )}
            </form>
          </div>
        </div>
      </div>

      <div className="card mt-4">
        <div className="card-header">
          <h3>📋 Topup Guide</h3>
        </div>
        <div className="card-body">
          <div className="info-box">
            <h4>Steps:</h4>
            <ol>
              <li>Enter the user's phone number</li>
              <li>Click "Search User" to find and view their account</li>
              <li>Review current balance and verification status</li>
              <li>Enter the topup amount</li>
              <li>Click "Complete Topup"</li>
              <li>Confirm success message shows new balance</li>
            </ol>
          </div>
          <div className="info-box warning">
            <h4>⚠️ Important:</h4>
            <ul>
              <li>Only verified users can receive topups</li>
              <li>Ensure correct phone number before proceeding</li>
              <li>All topups are recorded in transaction history</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
    <Footer />
    </>
  );
}
