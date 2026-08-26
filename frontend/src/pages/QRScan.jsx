import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../context/store';
import { transactionAPI, authAPI } from '../utils/api';
import QRScanner from '../components/QRScanner';
import Footer from '../components/Footer';
import '../styles/qr-scan.css';
import { ArrowLeft, Camera, Check } from 'lucide-react';

export default function QRScan() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const suspended = !!user?.isSuspended;
  const [showScanner, setShowScanner] = useState(true);
  const [recipientPhone, setRecipientPhone] = useState('');
  const [scannedData, setScannedData] = useState(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleQRScan = async (data) => {
    const phoneNumber = data.phoneNumber;
    setRecipientPhone(phoneNumber);
    setScannedData(data);
    setShowScanner(false);
    setError('');
    
    // Validate recipient exists (optional - will fail at send time if invalid)
    try {
      const response = await transactionAPI.getUserInfo(phoneNumber);
      if (!response.data?.user) {
        // User not found, but still show form - error will occur at send time
        setError(`Recipient phone: ${phoneNumber}`);
      }
    } catch (err) {
      // Validation error, but still show form - error will occur at send time
      setError(`Verifying recipient...`);
    }
  };

  const handleSendMoney = async (e) => {
    e.preventDefault();
    if (suspended) {
      setError('Your account is suspended. You cannot perform transactions.');
      return;
    }

    if (!recipientPhone || !amount) {
      setError('Please enter both phone number and amount');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { data } = await transactionAPI.sendMoney({
        recipientPhone,
        amount: parseFloat(amount),
        description
      });
      setSuccess(`Money sent successfully! Transaction ID: ${data.transaction.transactionId}`);
      // Refresh user balance
      try {
        const { data: userData } = await authAPI.getProfile();
        updateUser(userData);
      } catch (err) {
        console.error('Failed to refresh balance:', err);
      }
      setTimeout(() => {
        const redirectPath = user?.role === 'agent' ? '/agent/dashboard' : '/user/dashboard';
        navigate(redirectPath);
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send money');
    } finally {
      setLoading(false);
    }
  };

  const handleStartScanning = () => {
    if (suspended) {
      setError('Your account is suspended. You cannot perform transactions.');
      return;
    }
    setShowScanner(true);
    setRecipientPhone('');
    setScannedData(null);
    setAmount('');
    setDescription('');
    setError('');
  };

  const handleCancel = () => {
    navigate(-1);
  };

  return (
    <>
      <div className="page-container">
        <div className="page-header">
          <h1>Scan & Pay</h1>
          <p>Scan a QR code to send money instantly</p>
        </div>

        <div className="qr-scan-card">
          {showScanner ? (
            <>
              <QRScanner 
                onScan={handleQRScan} 
                onClose={() => setShowScanner(false)} 
              />
              <div className="scanner-actions">
                <button 
                  className="btn btn-secondary" 
                  onClick={handleCancel}
                >
                  <ArrowLeft size={18} /> Back
                </button>
              </div>
            </>
          ) : recipientPhone ? (
            <div className="payment-form-section">
              <div className="ready-to-pay-banner">
                <span className="ready-badge"><Check size={18} /></span>
                <div className="ready-text">Ready to pay</div>
              </div>

              <div className="scanned-info">
                <div className="success-badge"><Check size={18} /></div>
                <p className="scanned-phone">Recipient: <strong>{recipientPhone}</strong></p>
                <button
                  type="button"
                  className="btn btn-link"
                  onClick={handleStartScanning}
                >
                  Scan Different Code
                </button>
              </div>

              {error && <div className="alert alert-danger">{error}</div>}
              {success && <div className="alert alert-success">{success}</div>}

              {suspended && (
                <div className="alert alert-danger">
                  Your account is suspended and cannot perform transactions.
                </div>
              )}

              <form onSubmit={handleSendMoney} className="payment-form">
                <div className="form-group">
                  <label htmlFor="amount">Amount (SSP) <span className="required">*</span></label>
                  <input
                    id="amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    required
                    disabled={suspended}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="description">Description (optional)</label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What is this transfer for?"
                    disabled={suspended}
                    rows="3"
                  />
                </div>

                <div className="form-actions">
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={handleCancel}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary btn-lg"
                    disabled={loading || suspended}
                  >
                    {loading ? 'Sending...' : 'Send Money'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon"><Camera size={28} /></div>
              <h2>Ready to Pay?</h2>
              <p>Point your camera at the recipient's QR code to get started</p>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={handleStartScanning}
                disabled={suspended}
              >
                Start Scanning
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCancel}
              >
                Go Back
              </button>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}
