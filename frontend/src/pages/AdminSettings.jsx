import { useState } from 'react';
import { adminAPI, authAPI } from '../utils/api';
import { useAuthStore } from '../context/store';
import Toast from '../components/Toast';
import Footer from '../components/Footer';
import '../styles/admin-account.css';
import { MapPin, Monitor, Moon, Settings, Sun, TriangleAlert } from 'lucide-react';

export default function AdminSettings() {
  const setTheme = useAuthStore((state) => state.setTheme);
  const updateUser = useAuthStore((state) => state.updateUser);
  // Read from the store rather than a local copy of user.theme, so the switch
  // can never disagree with the theme actually applied to the document.
  const theme = useAuthStore((state) => state.theme);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('info');
  const [granting, setGranting] = useState(false);

  const handleThemeChange = async (newThemeOverride) => {
    try {
      const newTheme = typeof newThemeOverride !== 'undefined' ? newThemeOverride : theme;

      // Update backend using authAPI.updateProfile
      const { data } = await authAPI.updateProfile({ theme: newTheme });

      // updateUser (not setState) so localStorage is written too - otherwise
      // the change is lost on refresh.
      if (data) {
        updateUser(data);
        setTheme(data.theme || newTheme);
      }

      const themeLabel = newTheme === 'dark' ? 'Dark Mode' : 'Light Mode';
      setToastMessage(`Theme changed to ${themeLabel}`);
      setToastType('success');
    } catch (err) {
      console.error('Failed to change theme:', err);
      setToastMessage('Failed to change theme');
      setToastType('error');
    }
  };

  const handleGrantLocation = async () => {
    if (!window.confirm('Grant location consent to ALL users? This cannot be undone easily.')) return;
    setGranting(true);
    try {
      const { data } = await adminAPI.grantLocationPermissionToAll();
      setToastMessage(`Granted to ${data.modifiedCount || 0} users`);
      setToastType('success');
    } catch (err) {
      console.error('Grant failed', err);
      setToastMessage(err?.response?.data?.message || 'Failed to grant');
      setToastType('error');
    } finally {
      setGranting(false);
    }
  };

  return (
    <>
      <div className="page-container account-page">
        <div className="page-header">
          <h1>Admin Settings</h1>
          <p>Configure appearance and system-wide options.</p>
        </div>

        {/* appearance */}
        <div className="card">
          <div className="card-header">
            <h3><Settings size={18} /> Appearance</h3>
          </div>
          <div className="card-body">
            <div className="setting-row">
              <div className="setting-icon" aria-hidden="true"><Monitor size={20} /></div>
              <div className="setting-copy">
                <span className="setting-title">Display mode</span>
                <span className="setting-hint">Choose between a light or dark interface. Saved to your account.</span>
              </div>
              <div className="setting-control">
                <span className="theme-tag">
                  {theme === 'dark' ? <><Moon size={15} /> Dark</> : <><Sun size={15} /> Light</>}
                </span>
                <label className="switch" title="Toggle dark mode">
                  <input
                    type="checkbox"
                    checked={theme === 'dark'}
                    aria-label="Dark mode"
                    onChange={async (e) => {
                      const newTheme = e.target.checked ? 'dark' : 'light';
                      setTheme(newTheme); // optimistic; reconciled on response
                      await handleThemeChange(newTheme);
                    }}
                  />
                  <span className="slider"></span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* system-wide, destructive */}
        <div className="card danger-card">
          <div className="card-header">
            <h3><TriangleAlert size={18} /> System-wide actions</h3>
          </div>
          <div className="card-body">
            <div className="setting-row">
              <div className="setting-icon is-danger" aria-hidden="true"><MapPin size={20} /></div>
              <div className="setting-copy">
                <span className="setting-title">Grant location consent to all users</span>
                <span className="setting-hint">
                  Sets a server-side flag so the app can fall back to IP-based location for every
                  user. It cannot override browser-level geolocation permissions, and it affects all
                  accounts at once.
                </span>
              </div>
              <div className="setting-control">
                <button className="btn btn-danger" onClick={handleGrantLocation} disabled={granting}>
                  {granting ? 'Granting…' : 'Grant to all'}
                </button>
              </div>
            </div>

            <p className="danger-note">
              <TriangleAlert size={14} /> This applies to every user account and is not easily reversed.
            </p>
          </div>
        </div>
      </div>
      <Footer />
      <Toast
        message={toastMessage}
        type={toastType}
        onClose={() => setToastMessage('')}
      />
    </>
  );
}
