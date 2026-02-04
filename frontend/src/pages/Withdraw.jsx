import { useState } from 'react';
import { useAuthStore } from '../context/store';
import { transactionAPI } from '../utils/api';
import { authAPI } from '../utils/api';
import Toast from '../components/Toast';
import Footer from '../components/Footer';
import '../styles/withdraw.css';

export default function Withdraw() {
  const user = useAuthStore((state) => state.user);
  const suspended = !!user?.isSuspended;
  const updateUser = useAuthStore((state) => state.updateUser);
  const [agentId, setAgentId] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [amount, setAmount] = useState('');
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
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { data } = await transactionAPI.withdraw({
        agentId,
        amount: parseFloat(amount)
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
      // This would call a backend endpoint to check user by phone
      // For now, we'll use a mock - you'll need to create this endpoint
      const response = await fetch(`http://localhost:8080/api/users/check-balance?phone=${encodeURIComponent(userPhone)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(response.status === 404 ? 'User not found' : 'Failed to check balance');
      }

      const data = await response.json();
      setUserInfo(data);
    } catch (err) {
      setError(err.message || 'Failed to check user balance');
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

      const { data } = await transactionAPI.withdraw({
        agentId: userInfo.agentId,
        amount: withdrawAmount
      });

      const successMsg = `Withdrawal processed! Transaction ID: ${data.transaction.transactionId}`;
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
      <div className="page-container">
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
                <div className="user-info mt-3" style={{ padding: '1rem', backgroundColor: '#f0f9ff', borderRadius: '8px', borderLeft: '4px solid #2563eb' }}>
                  <div className="mb-2">
                    <strong>{userInfo.name}</strong>
                    <div className="text-small text-muted">{userInfo.phone}</div>
                  </div>
                  <div className="mb-2">
                    <span className="text-muted">Available Balance: </span>
                    <span className="text-success font-weight-bold" style={{ fontSize: '18px' }}>
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
            <h3>📋 Process Guide</h3>
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
  return (
    <>
    <div className="page-container">
      <div className="page-header">
        <h1>Withdraw Money</h1>
        <p>Request a withdrawal through an agent</p>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h3>Withdrawal Request</h3>
          </div>
          <div className="card-body">
              <form onSubmit={handleUserWithdraw}>
              {error && <div className="alert alert-danger">{error}</div>}
              {success && <div className="alert alert-success">{success}</div>}

              <div className="form-group">
                <label htmlFor="withdraw-agent">Agent ID</label>
                <input
                  id="withdraw-agent"
                  name="agentId"
                  type="text"
                  autoComplete="off"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  required
                  placeholder="Enter 6-digit agent ID"
                  maxLength="6"
                />
                <small className="text-muted">Ask the agent for their 6-digit ID</small>
              </div>

              <div className="form-group">
                <label htmlFor="withdraw-amount">Withdrawal Amount (SSP)</label>
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
              </div>

              <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading || suspended}>
                {loading ? 'Processing...' : suspended ? 'Account Suspended' : 'Request Withdrawal'}
              </button>
            </form>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>⚠️ Important</h3>
          </div>
          <div className="card-body">
            <div className="info-box">
              <h4>Withdrawal Process:</h4>
              <ol>
                <li>Ask your agent for their 6-digit Agent ID</li>
                <li>Enter the Agent ID in the form</li>
                <li>Enter the amount you want to withdraw</li>
                <li>Submit your request</li>
                <li>Agent will receive notification</li>
                <li>Meet the agent to complete the withdrawal</li>
                <li>Agent will verify and hand over cash</li>
              </ol>
            </div>
            <div className="info-box warning">
              <h4>⏱️ Processing Time:</h4>
              <p>Withdrawals are typically processed within 30 minutes after agent confirmation.</p>
            </div>
          </div>
        </div>
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
