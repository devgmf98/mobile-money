import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../utils/api';
import { useAuthStore } from '../context/store';
import '../styles/auth.css';
import mpLogo from '../assets/mp-logo.png';
import { Eye, EyeOff, ShieldCheck, Store, Zap } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  // Proactively request geolocation permission on mount and save location if allowed
  useEffect(() => {
    let mounted = true;
    const saveLocation = (position) => {
      if (!mounted) return;
      sessionStorage.setItem('userLocation', JSON.stringify({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      }));
    };

    const fetchIpLocation = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        if (!res.ok) return;
        const data = await res.json();
        if (!mounted) return;
        if (data && data.latitude && data.longitude) {
          sessionStorage.setItem('userLocation', JSON.stringify({ latitude: data.latitude, longitude: data.longitude }));
        } else if (data && data.lat && data.lon) {
          sessionStorage.setItem('userLocation', JSON.stringify({ latitude: data.lat, longitude: data.lon }));
        } else if (data && data.city && data.country_name) {
          // best-effort: ipapi returns latitude/longitude usually, but if not, store city/country
          sessionStorage.setItem('userLocation', JSON.stringify({ city: data.city, country: data.country_name }));
        }
      } catch (e) {
        console.warn('IP geolocation failed', e);
      }
    };

    const handleGeoError = (err) => {
      // Location is a nice-to-have, not a requirement - log and move on.
      console.warn('Geolocation error:', err);
    };

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((perm) => {
        if (!mounted) return;
        if (perm.state === 'granted' || perm.state === 'prompt') {
          // Trigger prompt if needed and save location when available
          navigator.geolocation.getCurrentPosition(saveLocation, handleGeoError, { enableHighAccuracy: true, timeout: 7000 });
        } else if (perm.state === 'denied') {
          // fallback to IP-based location when permission is denied
          fetchIpLocation();
        }

        // React to permission changes (user may enable later)
        try {
          perm.onchange = () => {
            if (!mounted) return;
            if (perm.state === 'granted') {
              navigator.geolocation.getCurrentPosition(saveLocation, handleGeoError, { enableHighAccuracy: true, timeout: 7000 });
            }
          };
        } catch (e) {
          // some browsers don't allow setting onchange
        }
      }).catch(() => {
        // Permissions API not available — fall back to asking
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(saveLocation, handleGeoError, { enableHighAccuracy: true, timeout: 7000 });
        } else {
          // no geolocation at all — use IP fallback
          fetchIpLocation();
        }
      });
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(saveLocation, handleGeoError, { enableHighAccuracy: true, timeout: 7000 });
    } else {
      // no geolocation support — fallback to IP
      fetchIpLocation();
    }

    return () => { mounted = false; };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Get stored location
      const locationStr = sessionStorage.getItem('userLocation');
      const location = locationStr ? JSON.parse(locationStr) : {};

      const { data } = await authAPI.login({ email, password, ...location });
      // store user and token, then navigate to the correct role dashboard
      login(data.user, data.token);

      const role = (data.user?.role || 'user').toLowerCase();
      console.debug('Login successful, role=', role);

      // ensure store updates propagate before navigation
      await Promise.resolve();
      
      // Navigate to role-specific dashboard
      if (role === 'agent') {
        navigate('/agent/dashboard');
      } else if (role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/user/dashboard');
      }
    } catch (err) {
      /* An unverified account is not a failed sign-in — it is an unfinished
         sign-up, so send them to the step they never completed rather than
         showing an error they cannot act on. */
      if (err.response?.data?.needsVerification) {
        navigate('/register', {
          state: { verifyPhone: err.response.data.phone, fromLogin: true },
        });
        return;
      }
      setError(err.response?.data?.message || 'Login failed');
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
            <h2>Send money across South Sudan</h2>
            <p>Digital Money Transfer Solution</p>
          </div>
          <ul className="auth-points">
            <li><ShieldCheck size={15} /> Every transfer secured end to end</li>
            <li><Zap size={15} /> Instant delivery, day or night</li>
            <li><Store size={15} /> Cash in and out at agents nationwide</li>
          </ul>
        </div>

        <div className="auth-form">
          <h2>Welcome Back</h2>
          <p className="auth-subtitle">Sign in to your account</p>

          {error && <div className="alert alert-danger">{error}</div>}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="login-email">Email Address</label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
              />
            </div>

            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <div className="password-input-group">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
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
              <Link to="/forgot-password" className="forgot-link">Forgot password?</Link>
            </div>

            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="auth-footer">
            <p>Don't have an account? <Link to="/register">Create one</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
}
