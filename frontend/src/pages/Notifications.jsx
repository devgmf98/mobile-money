import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Banknote, Bell, BellOff, Check, CheckCheck, CreditCard, Eye, Gift, Trash2, TriangleAlert, X,
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

/* The full notification, when the row is not enough.

   A row clamps its message to keep the list scannable, so a long one — a reply
   from support quoting the question it answers, say — is cut off exactly where
   it starts to matter. This shows the whole thing, with the time it arrived
   spelled out rather than as "12m ago". */
function NotificationDetail({ notif, onClose, onDelete }) {
  /* Escape closes it, and the page behind stops scrolling while it is open.

     The scroller here is `.layout-body`, not the document, so locking `body`
     alone would leave the list sliding around underneath — and a background
     that moves while a dialog is open is how a modal ends up feeling like it
     is somewhere else on the page. Both are pinned and both are restored to
     whatever they were, rather than being reset to a hardcoded default. */
  useEffect(() => {
    if (!notif) return undefined;

    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);

    const scroller = document.querySelector('.layout-body');
    const previous = {
      body: document.body.style.overflow,
      scroller: scroller ? scroller.style.overflow : null,
    };
    document.body.style.overflow = 'hidden';
    if (scroller) scroller.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous.body;
      if (scroller) scroller.style.overflow = previous.scroller;
    };
  }, [notif, onClose]);

  if (!notif) return null;
  const { Icon, tone, label } = typeOf(notif.type);

  /* Rendered into <body> rather than inline in the list.

     A `position: fixed` box is only fixed to the viewport while no ancestor
     establishes a containing block — any transform, filter or `contain` on a
     wrapper silently re-anchors it to that element, which puts the dialog
     wherever that wrapper happens to sit and leaves you scrolling to find it.
     Out here nothing can do that to it. */
  return createPortal((
    <div
      className="nt-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={notif.title}
      onClick={onClose}
    >
      {/* Stops a click inside the panel from reaching the overlay behind it. */}
      <div className="nt-detail" onClick={(e) => e.stopPropagation()}>
        <div className="nt-detail-head">
          <span className={'nt-icon tone-' + tone}><Icon size={18} /></span>
          <div className="nt-detail-heading">
            <strong>{notif.title}</strong>
            <span className="nt-type">{label}</span>
          </div>
          <button type="button" className="nt-detail-close" onClick={onClose} aria-label="Close">
            <X size={17} />
          </button>
        </div>

        <p className="nt-detail-body">{notif.message}</p>

        <div className="nt-detail-foot">
          <time dateTime={notif.createdAt}>{fullTime(notif.createdAt)}</time>
          <button type="button" className="nt-detail-delete" onClick={() => onDelete(notif.id)}>
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>
    </div>
  ), document.body);
}

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
  const [detailId, setDetailId] = useState(null);
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
      /* Nothing left to show — a panel open on a deleted notification would be
         reading something that no longer exists. */
      setDetailId((open) => (open === id ? null : open));
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
                      className={'nt-row is-openable' + (notif.isRead ? '' : ' is-unread')}
                      onClick={() => {
                        setDetailId(notif.id);
                        /* Opening one is reading it. Leaving it bold after the
                           person has plainly read it is a chore done twice. */
                        if (!notif.isRead) handleMarkAsRead(notif.id);
                      }}
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

                      {/* Inside an openable row, so this stops its own clicks
                          from also opening the detail panel. */}
                      <div className="nt-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setDetailId(notif.id)}
                          title="View details"
                          aria-label={`View details of "${notif.title}"`}
                        >
                          <Eye size={15} />
                        </button>
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

            <NotificationDetail
              notif={notifications.find((n) => n.id === detailId) || null}
              onClose={() => setDetailId(null)}
              onDelete={handleDelete}
            />
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
