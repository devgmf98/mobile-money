import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, KeyRound } from 'lucide-react';
import { authAPI } from '../utils/api';
import '../styles/auth.css';
import mpLogo from '../assets/mp-logo.png';

/* ==========================================================================
   Forgot password — request a code, then redeem it with a new password.

   The request step always reports success, matching the API: telling the user
   "no such account" would let anyone confirm which emails are registered.
   ========================================================================== */

export default function ForgotPassword() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const mismatch = confirm !== '' && password !== confirm;
  const tooShort = password !== '' && password.length < 6;

  const handleRequest = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const { data } = await authAPI.forgotPassword({ email: email.trim() });
      setNotice(data?.message || 'If that email is registered, a reset code has been sent.');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send a reset code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await authAPI.resetPassword({ email: email.trim(), code: code.trim(), password });
      navigate('/login', {
        state: { notice: 'Password updated. Sign in with your new password.' } });
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reset the password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <img src={mpLogo} alt="MoneyPay" className="auth-logo" />
          <div className="auth-brand-copy">
            <h2>Reset your password</h2>
            <p>Digital Money Transfer Solution</p>
          </div>
        </div>

        <div className="auth-form">
          <h2>{step === 1 ? 'Forgot password' : 'Enter your code'}</h2>
          <p className="auth-subtitle">
            {step === 1
              ? 'Enter your email and we will text a reset code to the phone on your account.'
              : 'Enter the code we sent, then choose a new password.'}
          </p>

          {error && <div className="alert alert-danger">{error}</div>}
          {notice && step === 2 && <div className="alert alert-warning">{notice}</div>}

          {step === 1 ? (
            <form onSubmit={handleRequest}>
              <div className="form-group">
                <label htmlFor="fp-email">Email address</label>
                <input
                  id="fp-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="your@email.com"
                />
              </div>

              <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading || !email.trim()}>
                {loading ? 'Sending…' : 'Send reset code'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleReset}>
              <div className="form-group">
                <label htmlFor="fp-code"><KeyRound size={14} /> Reset code</label>
                <input
                  id="fp-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  placeholder="000000"
                  maxLength={6}
                />
              </div>

              <div className="form-group">
                <label htmlFor="fp-password">New password</label>
                <div className="password-input-group">
                  <input
                    id="fp-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {tooShort && <small className="auth-field-error">At least 6 characters.</small>}
              </div>

              <div className="form-group">
                <label htmlFor="fp-confirm">Confirm new password</label>
                <input
                  id="fp-confirm"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  placeholder="••••••••"
                />
                {mismatch && <small className="auth-field-error">The two passwords do not match.</small>}
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block btn-lg"
                disabled={loading || mismatch || tooShort || !code.trim()}
              >
                {loading ? 'Updating…' : 'Update password'}
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-block"
                style={{ marginTop: 10 }}
                onClick={() => { setStep(1); setError(''); setNotice(''); }}
              >
                Use a different email
              </button>
            </form>
          )}

          <div className="auth-footer">
            <p><Link to="/login"><ArrowLeft size={13} /> Back to sign in</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
}
