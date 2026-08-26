import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { authAPI } from '../utils/api';
import '../styles/auth.css';
import mpLogo from '../assets/mp-logo.png';
import Toast from '../components/Toast';
import { Eye, EyeOff } from 'lucide-react';
import { COUNTRIES, DEFAULT_COUNTRY, flagOf } from '../data/countries';

export default function Register() {
  /* Sign-in sends people here when their account was never verified, landing
     straight on step 2 with the number they registered. */
  const location = useLocation();
  const handedPhone = location.state?.verifyPhone || '';
  const [step, setStep] = useState(handedPhone ? 2 : 1);
  const [resendState, setResendState] = useState('');
  /* Seconds until another code may be requested. Every press sends a real SMS,
     so the button is held shut for a while after each one. */
  const [resendIn, setResendIn] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  /* The country is held separately from the number. formData.phone stores only
     the local part, and the dialling code is prepended when the form is
     submitted — so a user never has to type "+211" and cannot accidentally
     enter it twice. */
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY);
  const country = COUNTRIES.find((c) => c.code === countryCode) || COUNTRIES[0];
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'user',
    agentId: ''
  });
  const [verificationCode, setVerificationCode] = useState('');
  const [registeredPhone, setRegisteredPhone] = useState(handedPhone);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Generate unique 6-digit agent ID when role changes to agent
  const handleRoleChange = (e) => {
    const newRole = e.target.value;
    let newFormData = { ...formData, role: newRole };
    
    if (newRole === 'agent' && !formData.agentId) {
      // Generate unique 6-digit agent ID
      const agentId = Math.floor(Math.random() * 900000) + 100000;
      newFormData.agentId = agentId.toString();
    }
    
    setFormData(newFormData);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    // Frontend validation
    if (!formData.name.trim() || !formData.email.trim() || !formData.phone.trim() || !formData.password) {
      setError("All fields are required.");
      return;
    }
    // Basic email format check
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(formData.email)) {
      setError("Please enter a valid email address.");
      return;
    }
    /* Phone check. The previous pattern was /^\+\d{10 }$/ — the space where the
       comma belongs means {10 } is not a quantifier at all, so JS read it as
       four literal characters and the test could only ever pass for the string
       "+5{10 }". Every real number was rejected, which is why registration was
       impossible.

       The dialling code now comes from the country picker, so the field holds
       only the local part. A leading 0 is dropped — people write their number
       as "0912…" locally, and "+2110912…" would be wrong. Spaces, dashes and a
       pasted country code are stripped too, so pasting a full international
       number still works instead of doubling the prefix.

       10-15 digits: existing accounts are +211 plus 9 digits (12), and 15 is
       the E.164 maximum. */
    const local = formData.phone
      .replace(/[\s()-]/g, '')
      .replace(new RegExp('^\\' + country.dial), '')   // pasted full number
      .replace(/^0+/, '');                             // local trunk prefix

    const phone = country.dial + local;
    if (!/^\+\d{10,15}$/.test(phone)) {
      setError(`Please enter a valid phone number (e.g. ${country.dial}912345678)`);
      return;
    }
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      // send the normalised phone, not whatever spacing was typed
      await authAPI.register({ ...formData, phone });
      /* Step 2 has to verify against the number that was actually stored. It
         used to read formData.phone — the raw text — so a local-format entry
         registered as +211912345001 and then failed to verify as 912345001. */
      setRegisteredPhone(phone);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const resend = async (phone) => {
    if (!phone || resendIn > 0) return;
    setResendState('sending');
    setError('');
    try {
      await authAPI.resendVerification({ phone });
      setResendState('sent');
      setResendIn(30);
      /* The old code dies the moment a new one is issued, so clear whatever was
         typed — otherwise stale digits sit there looking valid. */
      setVerificationCode('');
    } catch {
      setResendState('failed');
    }
  };

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    /* Codes expire in ten minutes, so someone arriving from sign-in days later
       would otherwise be asked for a code that can never work. */
    if (location.state?.fromLogin && handedPhone) resend(handedPhone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authAPI.verifyPhone({
        phone: registeredPhone || formData.phone,
        code: verificationCode
      });
      // show toast then navigate
      setToast({ message: 'Phone verified! You can now login.', type: 'success' });
      setTimeout(() => navigate('/login'), 1400);
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const [toast, setToast] = useState({ message: '', type: 'info' });

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <img src={mpLogo} alt="MoneyPay" className="auth-logo" />
          <div className="auth-brand-copy">
            <h2>Open your MoneyPay account</h2>
            <p>Digital Money Transfer Solution</p>
          </div>
        </div>

        <div className="auth-form">
          <h2>{step === 1 ? 'Create Account' : 'Verify Phone'}</h2>
          <p className="auth-subtitle">
            {step === 1 ? 'Join MoneyPay today' : 'Enter the code sent to your phone'}
          </p>

          {error && <div className="alert alert-danger">{error}</div>}

          {step === 1 ? (
            <form onSubmit={handleRegister} className="auth-form-grid">
              <div className="form-group">
                <label htmlFor="reg-name">Full Name</label>
                <input
                  id="reg-name"
                    type="text"
                    autoComplete="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="John Doe"
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg-email">Email Address</label>
                <input
                  id="reg-email"
                    type="email"
                    autoComplete="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  placeholder="your@email.com"
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg-phone">Phone Number</label>
                <div className="phone-field">
                  {/* The flag sits outside the select: a native <select> only
                      renders plain text for its closed value on most platforms,
                      so showing it here is what makes the choice visible at a
                      glance rather than only when the list is open. */}
                  <span className="phone-flag" aria-hidden="true">{flagOf(country.code)}</span>

                  <select
                    className="phone-country"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    aria-label="Country dialling code"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {flagOf(c.code)} {c.name} ({c.dial})
                      </option>
                    ))}
                  </select>

                  <span className="phone-dial">{country.dial}</span>

                  <input
                    id="reg-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                    placeholder="912 345 678"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="reg-role">Account Type</label>
                <select id="reg-role" name="role" value={formData.role} onChange={handleRoleChange}>
                  <option value="user">User</option>
                  <option value="agent">Agent</option>
                </select>
              </div>

              {formData.role === 'agent' && (
                <div className="form-group span-2">
                  <label htmlFor="reg-agent-id">Agent ID (Auto-generated)</label>
                  <input
                    id="reg-agent-id"
                    type="text"
                    name="agentId"
                    autoComplete="off"
                    value={formData.agentId}
                    disabled
                    readOnly
                    style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                  />
                  <small className="text-muted">Your unique agent ID has been generated automatically</small>
                </div>
              )}

              <div className="form-group span-2">
                <label htmlFor="reg-password">Password</label>
                <div className="password-input-group">
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
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
              </div>

              <button type="submit" className="btn btn-primary btn-block btn-lg span-2" disabled={loading}>
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify}>
              <div className="form-group">
                <label htmlFor="verify-code">Verification Code</label>
                <p className="text-small text-muted mb-2">
                  {resendState === 'sending'
                    ? 'Sending a new code…'
                    : resendState === 'failed'
                    ? 'We could not send a new code. Try again shortly.'
                    : resendState === 'sent'
                    ? <>A new code is on its way to {registeredPhone || formData.phone}</>
                    : <>We sent a 6-digit code to {registeredPhone || formData.phone}</>}
                </p>
                <input
                  id="verify-code"
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  required
                  placeholder="000000"
                  maxLength="6"
                />
              </div>

              <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>

              <p className="resend-line">
                Didn&rsquo;t get the code?{' '}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => resend(registeredPhone || formData.phone)}
                  disabled={resendState === 'sending' || resendIn > 0}
                >
                  {resendState === 'sending'
                    ? 'Sending…'
                    : resendIn > 0
                    ? `Resend in ${resendIn}s`
                    : 'Resend verification code'}
                </button>
              </p>
            </form>
          )}

          <div className="auth-footer">
            <p>Already have an account? <Link to="/login">Sign in</Link></p>
          </div>
          </div>
          {toast.message && (
            <Toast
              message={toast.message}
              type={toast.type}
              duration={3000}
              onClose={() => setToast({ message: '', type: 'info' })}
            />
          )}
      </div>
    </div>
  );
}
