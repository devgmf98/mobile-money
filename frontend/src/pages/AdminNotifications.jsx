import { useState } from 'react';
import { notificationAPI } from '../utils/api';
import Footer from '../components/Footer';
import Select from '../components/Select';
import '../styles/admin-notifications.css';
import {
  AlertCircle, Bell, CircleCheck, CircleX, Gift, Megaphone, NotebookPen, Send, User
} from 'lucide-react';

// The Notification model accepts these; both modes now offer the same set.
// Previously "all users" offered offer/system/alert while "individual" offered
// transaction/system/alert, which looked accidental.
const TYPE_OPTIONS = [
  { value: 'system', label: 'System', hint: 'General service message' },
  { value: 'alert', label: 'Alert', hint: 'Something needs attention' },
  { value: 'offer', label: 'Offer', hint: 'Promotion or campaign' },
  { value: 'transaction', label: 'Transaction', hint: 'Related to a payment' },
];

const TYPE_ICON = {
  system: Bell,
  alert: AlertCircle,
  offer: Gift,
  transaction: CircleCheck,
};

// Matched to the database columns: notifications.title is varchar(255) and
// notifications.message is TEXT. Title uses the hard column limit so a value
// can never be silently truncated on insert.
const TITLE_MAX = 255;
const MESSAGE_MAX = 1000;

// A GSM-7 SMS is 160 chars; longer messages are billed as multiple segments.
const SMS_SEGMENT = 160;

export default function AdminNotifications() {
  const [notificationType, setNotificationType] = useState('all'); // 'all' or 'user'
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [userId, setUserId] = useState('');
  const [type, setType] = useState('system');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const toAll = notificationType === 'all';
  const canSend =
    title.trim() && message.trim() && (toAll || userId.trim()) && !loading;

  // One handler: the two forms were near-identical duplicates before.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (toAll) {
        const { data } = await notificationAPI.sendToAll({ title, message, type });
        setSuccess(data.message || 'Notification sent to all users');
      } else {
        await notificationAPI.sendToUser({ userId, title, message, type });
        setSuccess('Notification sent successfully');
        setUserId('');
      }
      setTitle('');
      setMessage('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send notification');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (mode) => {
    setNotificationType(mode);
    setError('');
    setSuccess('');
  };

  // Longer messages are split into multiple billed SMS segments.
  const smsSegments = Math.max(1, Math.ceil(message.length / SMS_SEGMENT));

  const PreviewIcon = TYPE_ICON[type] || Bell;

  return (
    <>
      <div className="page-container notif-page">
        <div className="page-header">
          <h1>Send Notifications</h1>
          <p>Send an in-app notification and SMS to a single user or everyone.</p>
        </div>

        <div className="notif-grid">
          {/* compose */}
          <div className="card">
            <div className="card-header">
              <h3><Send size={18} /> Compose</h3>
            </div>
            <div className="card-body">
              {/* recipient */}
              <div className="form-group">
                <label>Recipient</label>
                <div className="notif-modes" role="group" aria-label="Recipient">
                  <button
                    type="button"
                    className={'notif-mode' + (toAll ? ' active' : '')}
                    aria-pressed={toAll}
                    onClick={() => switchMode('all')}
                  >
                    <Megaphone size={16} />
                    <span>
                      All users
                      <em>Broadcast to everyone</em>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={'notif-mode' + (!toAll ? ' active' : '')}
                    aria-pressed={!toAll}
                    onClick={() => switchMode('user')}
                  >
                    <User size={16} />
                    <span>
                      One user
                      <em>Send to a single account</em>
                    </span>
                  </button>
                </div>
              </div>

              {error && (
                <p className="notif-banner is-error"><CircleX size={15} /> {error}</p>
              )}
              {success && (
                <p className="notif-banner is-success"><CircleCheck size={15} /> {success}</p>
              )}

              <form onSubmit={handleSubmit}>
                {!toAll && (
                  <div className="form-group">
                    <label htmlFor="notif-user">User ID</label>
                    <input
                      id="notif-user"
                      type="text"
                      autoComplete="off"
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                      required
                      placeholder="e.g. 4"
                    />
                    <small>The numeric ID of the account to notify.</small>
                  </div>
                )}

                <div className="form-group">
                  <div className="label-row">
                    <label htmlFor="notif-title">Title</label>
                    <span className={'counter' + (title.length > TITLE_MAX ? ' is-over' : '')}>
                      {title.length}/{TITLE_MAX}
                    </span>
                  </div>
                  <input
                    id="notif-title"
                    type="text"
                    autoComplete="off"
                    maxLength={TITLE_MAX}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="Notification title"
                  />
                </div>

                <div className="form-group">
                  <div className="label-row">
                    <label htmlFor="notif-msg">Message</label>
                    <span className={'counter' + (message.length > MESSAGE_MAX ? ' is-over' : '')}>
                      {message.length}/{MESSAGE_MAX}
                    </span>
                  </div>
                  <textarea
                    id="notif-msg"
                    autoComplete="off"
                    rows={5}
                    maxLength={MESSAGE_MAX}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    placeholder="Your message here…"
                  />
                  <small>
                    Also delivered by SMS ·{` `}
                    {message.length === 0
                      ? 'up to ' + Math.ceil(MESSAGE_MAX / SMS_SEGMENT) + ' SMS segments at this limit'
                      : smsSegments + ' SMS segment' + (smsSegments === 1 ? '' : 's')}
                  </small>
                </div>

                <div className="form-group">
                  <label htmlFor="notif-type">Type</label>
                  <Select
                    id="notif-type"
                    value={type}
                    onChange={setType}
                    ariaLabel="Notification type"
                    options={TYPE_OPTIONS}
                  />
                </div>

                {toAll && (
                  <p className="notif-warning">
                    <AlertCircle size={15} />
                    This goes to <strong>every user</strong> as a notification and an SMS. It cannot be recalled.
                  </p>
                )}

                <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={!canSend}>
                  <Send size={16} />
                  {loading ? 'Sending…' : toAll ? 'Send to all users' : 'Send to user'}
                </button>
              </form>
            </div>
          </div>

          {/* preview + tips */}
          <div className="notif-side">
            <div className="card">
              <div className="card-header">
                <h3><Bell size={18} /> Preview</h3>
              </div>
              <div className="card-body">
                <div className="notif-preview">
                  <span className={'notif-preview-icon tone-' + type}><PreviewIcon size={18} /></span>
                  <div className="notif-preview-body">
                    <span className="notif-preview-title">{title.trim() || 'Notification title'}</span>
                    <span className="notif-preview-msg">{message.trim() || 'Your message will appear here.'}</span>
                    <span className="notif-preview-meta">
                      {toAll ? 'All users' : userId ? `User #${userId}` : 'One user'} · just now
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3><NotebookPen size={18} /> Tips</h3>
              </div>
              <div className="card-body">
                <ul className="notif-tips">
                  <li><strong>Keep it short.</strong> Every notification is also sent as an SMS.</li>
                  <li><strong>Be specific.</strong> Users should understand it at a glance.</li>
                  <li><strong>Say what to do.</strong> Include the action you want taken.</li>
                  <li><strong>Test first.</strong> Send to one user before broadcasting.</li>
                  <li><strong>Mind the time.</strong> Business hours get better engagement.</li>
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
