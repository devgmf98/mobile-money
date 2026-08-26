import { useState, useEffect, useMemo } from 'react';
import {
  Banknote, Bell, BellOff, Check, CheckCheck, CreditCard, Gift, Trash2, TriangleAlert,
} from 'lucide-react';
import { notificationAPI } from '../utils/api';
import { useNotificationStore } from '../context/store';
import Footer from '../components/Footer';
import '../styles/notifications.css';
import '../styles/notifications-flow.css';

/* Every value the notifications.type enum can hold. The old map covered four of
   five, so withdrawal_request fell through to the generic bell. */
const TYPES = {
  transaction: { Icon: CreditCard, tone: 'info', label: 'Transaction' },
  system: { Icon: Bell, tone: 'muted', label: 'System' },
  alert: { Icon: TriangleAlert, tone: 'warning', label: 'Alert' },
  offer: { Icon: Gift, tone: 'primary', label: 'Offer' },
  withdrawal_request: { Icon: Banknote, tone: 'success', label: 'Withdrawal request' },
};

const typeOf = (t) => TYPES[t] || { Icon: Bell, tone: 'muted', label: String(t || 'Notice').replace(/_/g, ' ') };

// Notifications are read relative to now, so "2h ago" beats a bare timestamp.
const relativeTime = (value) => {
  if (!value) return '';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.round((Date.now() - then) / 1000);

  if (secs < 60) return 'Just now';
  if (secs < 3600) return Math.floor(secs / 60) + 'm ago';
  if (secs < 86400) return Math.floor(secs / 3600) + 'h ago';
  if (secs < 604800) return Math.floor(secs / 86400) + 'd ago';
  return new Date(value).toLocaleDateString();
};

const fullTime = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
};

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const markAsRead = useNotificationStore((state) => state.markAsRead);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const { data } = await notificationAPI.getNotifications();
        setNotifications(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]);

  const visible = useMemo(
    () => (tab === 'unread' ? notifications.filter((n) => !n.isRead) : notifications),
    [notifications, tab]);

  const handleMarkAsRead = async (id) => {
    setBusyId(id);
    try {
      await notificationAPI.markAsRead({ notificationId: id });
      markAsRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    } finally {
      setBusyId(null);
    }
  };

  // markAllAsRead already existed on the API but was never wired up.
  const handleMarkAll = async () => {
    try {
      await notificationAPI.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      notifications.filter((n) => !n.isRead).forEach((n) => markAsRead(n.id));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleDelete = async (id) => {
    // Deleting is irreversible and was a single unguarded click.
    if (!window.confirm('Delete this notification? This cannot be undone.')) return;
    setBusyId(id);
    try {
      await notificationAPI.delete(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="page-container nt-page">
        <div className="page-header nt-header">
          <div>
            <h1>Notifications</h1>
            <p>
              {unreadCount > 0
                ? `${unreadCount} unread ${unreadCount === 1 ? 'update' : 'updates'}.`
                : 'You are all caught up.'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleMarkAll}>
              <CheckCheck size={15} /> Mark all as read
            </button>
          )}
        </div>

        <div className="card nt-card">
          <div className="card-header nt-tabs">
            <button
              type="button"
              className={tab === 'all' ? 'nt-tab is-active' : 'nt-tab'}
              onClick={() => setTab('all')}
            >
              All <span className="nt-count">{notifications.length}</span>
            </button>
            <button
              type="button"
              className={tab === 'unread' ? 'nt-tab is-active' : 'nt-tab'}
              onClick={() => setTab('unread')}
            >
              Unread <span className="nt-count">{unreadCount}</span>
            </button>
          </div>

          <div className="card-body nt-body">
            {loading ? (
              <div className="nt-empty"><h3>Loading notifications…</h3></div>
            ) : visible.length === 0 ? (
              <div className="nt-empty">
                <span className="nt-empty-icon">
                  {tab === 'unread' ? <BellOff size={22} /> : <Bell size={22} />}
                </span>
                <h3>{tab === 'unread' ? 'Nothing unread' : 'No notifications yet'}</h3>
                <p>
                  {tab === 'unread'
                    ? 'Every notification has been read.'
                    : 'Updates about your account will appear here.'}
                </p>
              </div>
            ) : (
              <ul className="nt-list">
                {visible.map((notif) => {
                  const { Icon, tone, label } = typeOf(notif.type);
                  const busy = busyId === notif.id;

                  return (
                    <li
                      key={notif.id}
                      className={'nt-row' + (notif.isRead ? '' : ' is-unread')}
                    >
                      <span className={'nt-icon tone-' + tone}><Icon size={17} /></span>

                      <div className="nt-main">
                        <div className="nt-title-row">
                          {!notif.isRead && <span className="nt-dot" aria-label="Unread" />}
                          <strong className="nt-title">{notif.title}</strong>
                          <span className="nt-type">{label}</span>
                        </div>
                        <p className="nt-message">{notif.message}</p>
                        <time className="nt-time" dateTime={notif.createdAt} title={fullTime(notif.createdAt)}>
                          {relativeTime(notif.createdAt)}
                        </time>
                      </div>

                      <div className="nt-actions">
                        {!notif.isRead && (
                          <button
                            type="button"
                            onClick={() => handleMarkAsRead(notif.id)}
                            disabled={busy}
                            title="Mark as read"
                            aria-label={`Mark "${notif.title}" as read`}
                          >
                            <Check size={15} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="is-danger"
                          onClick={() => handleDelete(notif.id)}
                          disabled={busy}
                          title="Delete"
                          aria-label={`Delete "${notif.title}"`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
