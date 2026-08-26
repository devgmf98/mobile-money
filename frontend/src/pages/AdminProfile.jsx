import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Footer from '../components/Footer';
import Toast from '../components/Toast';
import { useAuthStore } from '../context/store';
import { authAPI } from '../utils/api';
import '../styles/admin-account.css';
import {
  BadgeCheck, Check, Copy, KeyRound, Lock, LogOut, Mail, Phone,
  ShieldCheck, TriangleAlert, User, UserCog
} from 'lucide-react';

export default function AdminProfile() {
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'info' });
  const [name, setName] = useState(user?.name || '');

  const initials = (user?.name || 'A')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');

  // The profile endpoint accepts name (plus image/theme) — not email or phone,
  // so those are shown read-only rather than as inputs that silently discard.
  const handleSave = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setToast({ message: 'Name cannot be empty', type: 'error' });
      return;
    }
    setSaving(true);
    try {
      const { data } = await authAPI.updateProfile({ name: trimmed });
      if (data) updateUser(data);
      setToast({ message: 'Profile updated', type: 'success' });
      setEditing(false);
    } catch (err) {
      console.error('Profile update failed:', err);
      setToast({ message: err?.response?.data?.message || 'Failed to update profile', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const copyAdminId = async () => {
    if (!user?.adminId) return;
    try {
      await navigator.clipboard.writeText(String(user.adminId));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      setToast({ message: 'Could not copy to clipboard', type: 'error' });
    }
  };

  return (
    <>
      <div className="page-container account-page">
        <div className="page-header">
          <h1>Admin Profile</h1>
          <p>Your account details and administrative credentials.</p>
        </div>

        {/* identity */}
        <div className="card identity-card">
          <div className="identity-avatar" aria-hidden="true">{initials}</div>
          <div className="identity-meta">
            <h2>{user?.name || 'Admin'}</h2>
            <p>{user?.email || 'No email on file'}</p>
            <div className="identity-badges">
              <span className="badge badge-primary"><UserCog size={13} /> Administrator</span>
              <span className="badge badge-success"><BadgeCheck size={13} /> Active</span>
            </div>
          </div>

          <button type="button" className="identity-logout" onClick={handleLogout}>
            <LogOut size={16} /> <span>Log out</span>
          </button>
        </div>

        <div className="account-grid">
          {/* account details */}
          <div className="card">
            <div className="card-header account-card-header">
              <h3><User size={18} /> Account details</h3>
              {!editing && (
                <button className="btn btn-sm btn-secondary" onClick={() => { setName(user?.name || ''); setEditing(true); }}>
                  Edit
                </button>
              )}
            </div>
            <div className="card-body">
              {editing ? (
                <form onSubmit={handleSave}>
                  <div className="form-group">
                    <label htmlFor="profile-name">Full name</label>
                    <input
                      id="profile-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      autoFocus
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="profile-email">Email address</label>
                    <input id="profile-email" type="email" value={user?.email || ''} disabled readOnly />
                    <small>Email cannot be changed here — contact a system administrator.</small>
                  </div>

                  <div className="account-form-actions">
                    <button type="button" className="btn btn-outline" onClick={() => setEditing(false)} disabled={saving}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
                      {saving ? 'Saving…' : 'Save changes'}
                    </button>
                  </div>
                </form>
              ) : (
                <dl className="detail-list">
                  <div className="detail-row">
                    <dt><User size={15} /> Name</dt>
                    <dd>{user?.name || '—'}</dd>
                  </div>
                  <div className="detail-row">
                    <dt><Mail size={15} /> Email</dt>
                    <dd>{user?.email || '—'}</dd>
                  </div>
                  <div className="detail-row">
                    <dt><Phone size={15} /> Phone</dt>
                    <dd>{user?.phone || '—'}</dd>
                  </div>
                  <div className="detail-row">
                    <dt><UserCog size={15} /> Role</dt>
                    <dd><span className="badge badge-primary">Administrator</span></dd>
                  </div>
                </dl>
              )}
            </div>
          </div>

          {/* credentials */}
          <div className="card">
            <div className="card-header">
              <h3><KeyRound size={18} /> Admin credentials</h3>
            </div>
            <div className="card-body">
              <div className="admin-id-block">
                <span className="admin-id-label">Admin ID</span>
                <div className="admin-id-value">
                  <code>{user?.adminId || 'N/A'}</code>
                  {user?.adminId && (
                    <button
                      type="button"
                      className="admin-id-copy"
                      onClick={copyAdminId}
                      aria-label="Copy admin ID"
                      title="Copy admin ID"
                    >
                      {copied ? <Check size={15} /> : <Copy size={15} />}
                    </button>
                  )}
                </div>
                <small>Identifies your account across the system. Keep it private.</small>
              </div>

              <dl className="detail-list">
                <div className="detail-row">
                  <dt><ShieldCheck size={15} /> Status</dt>
                  <dd><span className="badge badge-success"><Check size={13} /> Active</span></dd>
                </div>
                <div className="detail-row">
                  <dt><Lock size={15} /> Permissions</dt>
                  <dd>Full administrative access</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        {/* security guidance */}
        <div className="card">
          <div className="card-header">
            <h3><TriangleAlert size={18} /> Security guidance</h3>
          </div>
          <div className="card-body">
            <ul className="guidance-list">
              <li><ShieldCheck size={16} /> Never share your password with anyone.</li>
              <li><ShieldCheck size={16} /> Log out when you finish using the admin panel.</li>
              <li><ShieldCheck size={16} /> Report suspicious activity immediately.</li>
              <li><ShieldCheck size={16} /> Change your password regularly.</li>
            </ul>
          </div>
        </div>
      </div>
      <Footer />
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: '', type: 'info' })}
      />
    </>
  );
}
