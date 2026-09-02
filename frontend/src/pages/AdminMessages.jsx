import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, Inbox, Loader, Mail, MailOpen, Phone, RotateCcw, Search, Send, User,
} from 'lucide-react';
import { contactAPI } from '../utils/api';
import Footer from '../components/Footer';
import '../styles/admin-messages.css';

/* ==========================================================================
   Messages sent through Contact Us.

   A list beside a reading pane, because triage and reading are two different
   motions: you scan a list to choose, then you read one thing properly. A
   table of truncated messages would serve neither.

   There is no outbound mail in this project, so a reply reaches the customer
   as an in-app notification — which only works when they were signed in when
   they wrote. The pane says so plainly for the ones where it does not, rather
   than letting an admin type into a void.
   ========================================================================== */

const FILTERS = [
  { key: 'new', label: 'Unanswered' },
  { key: 'read', label: 'In progress' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'all', label: 'Everything' },
];

const when = (v) => {
  const d = v ? new Date(v) : null;
  if (!d || isNaN(d)) return '—';
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  if (mins < 60 * 24) return Math.round(mins / 60) + 'h ago';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const stamp = (v) => {
  const d = v ? new Date(v) : null;
  return !d || isNaN(d) ? '—' : d.toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

export default function AdminMessages() {
  const [filter, setFilter] = useState('new');
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [openId, setOpenId] = useState(null);
  const [reply, setReply] = useState('');
  const [saving, setSaving] = useState(false);
  const [delivery, setDelivery] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(typed), 350);
    return () => clearTimeout(t);
  }, [typed]);

  const query = useMemo(() => {
    const q = new URLSearchParams();
    if (filter !== 'all') q.set('status', filter);
    if (search.trim()) q.set('search', search.trim());
    return q.toString();
  }, [filter, search]);

  /* Returns the fresh data so callers can tell whether the message they were
     reading survived the filter they are looking at. */
  const load = () => {
    setLoading(true);
    setError(null);
    return contactAPI.list(query)
      .then((r) => { setData(r.data); return r.data; })
      .catch((e) => { setError(e?.response?.data?.message || 'Could not load messages'); return null; })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [query]);

  const messages = data?.messages || [];
  const counts = data?.counts || {};
  const open = messages.find((m) => m.id === openId) || null;

  /* Opening an unanswered message marks it in progress, so a second admin can
     see someone already picked it up.

     The status is changed in place rather than by reloading. Reloading would
     re-run the query, and under the default "Unanswered" filter the message
     would no longer match it — so the row would vanish and take the reader,
     the reply box and the buttons with it, a click after being opened. It
     stays put until the list is next fetched for some other reason.

     Silent on failure: the reading is what matters, and a failed status write
     should not interrupt it. */
  const openMessage = (m) => {
    setOpenId(m.id);
    setReply(m.reply || '');
    setDelivery(null);
    if (m.status !== 'new') return;
    setData((d) => (d ? {
      ...d,
      counts: { ...d.counts, new: Math.max(0, (d.counts.new || 1) - 1), read: (d.counts.read || 0) + 1 },
      messages: d.messages.map((x) => (x.id === m.id ? { ...x, status: 'read' } : x)),
    } : d));
    contactAPI.update(m.id, { status: 'read' }).catch(() => {});
  };

  const save = async (status) => {
    if (!open || saving) return;
    setSaving(true);
    try {
      const r = await contactAPI.update(open.id, { status, reply });
      setDelivery(r.data?.delivery || null);
      /* Resolving under "Unanswered" legitimately removes the message from the
         view — that is the whole point of triage. Close the reader when that
         happens, rather than leaving a pane open on something no longer in the
         list beside it. */
      const fresh = await load();
      if (fresh && !fresh.messages.some((m) => m.id === open.id)) setOpenId(null);
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not save that');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <div className="dashboard-container ms-page">
      <div className="dashboard-header">
        <h1><Inbox size={20} /> Messages</h1>
        <p>Everything sent through Contact Us, oldest concerns first.</p>
      </div>

      <div className="card ms-toolbar">
        <div className="ms-filters" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={'ms-filter' + (filter === f.key ? ' is-on' : '')}
              aria-pressed={filter === f.key}
              onClick={() => { setFilter(f.key); setOpenId(null); }}
            >
              {f.label}
              {counts[f.key] ? <b>{counts[f.key]}</b> : null}
            </button>
          ))}
        </div>

        <label className="ms-search">
          <Search size={14} />
          <input
            type="search"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Name, email, phone or words in the message"
          />
        </label>

        <button type="button" className="ms-refresh" onClick={load} title="Refresh">
          <RotateCcw size={14} />
        </button>
      </div>

      {error ? <div className="card ms-error">{error}</div> : null}

      <div className={'ms-split' + (loading ? ' is-loading' : '')}>
        <div className="card ms-list">
          {loading && !messages.length ? (
            <p className="ms-empty">Loading…</p>
          ) : !messages.length ? (
            <div className="ms-empty">
              <Inbox size={22} />
              <h4>Nothing here</h4>
              <p>{filter === 'new' ? 'Every message has been picked up.' : 'No messages match.'}</p>
            </div>
          ) : messages.map((m) => (
            <button
              key={m.id}
              type="button"
              className={'ms-item' + (m.id === openId ? ' is-open' : '') + (m.status === 'new' ? ' is-new' : '')}
              onClick={() => openMessage(m)}
            >
              <span className="ms-item-top">
                <span className="ms-who">{m.name}</span>
                <span className="ms-when">{when(m.createdAt)}</span>
              </span>
              <span className="ms-subject">{m.subjectLabel}</span>
              <span className="ms-preview">{m.message}</span>
              <span className="ms-tags">
                <i className={'ms-status is-' + m.status}>{m.status}</i>
                {m.account ? <i className="ms-account">{m.account.role}</i> : <i className="ms-guest">guest</i>}
              </span>
            </button>
          ))}
        </div>

        <div className="card ms-reader">
          {!open ? (
            <div className="ms-empty">
              <MailOpen size={22} />
              <h4>Pick a message</h4>
              <p>Choose one on the left to read it in full and reply.</p>
            </div>
          ) : (
            <>
              <div className="ms-reader-head">
                <div>
                  <h3>{open.subjectLabel}</h3>
                  <p className="ms-ref">{open.reference} · {stamp(open.createdAt)}</p>
                </div>
                <span className={'ms-status is-' + open.status}>{open.status}</span>
              </div>

              <div className="ms-sender">
                <span><User size={13} /> {open.name}</span>
                <a href={'mailto:' + open.email}><Mail size={13} /> {open.email}</a>
                {open.phone ? <a href={'tel:' + open.phone}><Phone size={13} /> {open.phone}</a> : null}
              </div>

              {open.account ? (
                <p className="ms-linked">
                  Sent while signed in as <strong>{open.account.email}</strong> ({open.account.role}).
                </p>
              ) : (
                <p className="ms-linked is-guest">
                  Sent by a visitor who was not signed in — a reply here is kept on the record
                  but cannot reach them in the app. Use their email address above.
                </p>
              )}

              <div className="ms-body">{open.message}</div>

              <label className="ms-reply">
                <span>Reply</span>
                <textarea
                  rows={5}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={open.account
                    ? 'This reaches them in their notifications.'
                    : 'Kept on the record here. Email them directly to actually reply.'}
                />
              </label>

              {/* Where the reply actually went. Without this an admin types,
                  clicks, and has no way of knowing whether anything reached the
                  customer — which is exactly how four copies of one reply went
                  out unnoticed. */}
              {delivery ? (
                <p className={'ms-delivery' + (delivery.replySent ? '' : ' is-quiet')}>
                  {!delivery.replySent
                    ? 'Saved. The reply had not changed, so nothing was sent again.'
                    : [
                        delivery.notified ? 'sent to their notifications' : null,
                        delivery.emailed ? 'emailed to them' : null,
                      ].filter(Boolean).join(' and ') || (
                        delivery.mailConfigured
                          ? 'could not be delivered — check the address'
                          : 'saved, but they have no account and email is not configured, so it has not reached them'
                      )}
                </p>
              ) : null}

              {open.handledBy ? (
                <p className="ms-handled">
                  Last handled by <strong>{open.handledBy}</strong> · {stamp(open.handledAt)}
                </p>
              ) : null}

              <div className="ms-reader-actions">
                <button type="button" className="ms-ghost" onClick={() => save('new')} disabled={saving}>
                  Put back
                </button>
                <button type="button" className="ms-secondary" onClick={() => save('read')} disabled={saving}>
                  {saving ? <Loader size={14} className="ms-spin" /> : <Send size={14} />} Save reply
                </button>
                <button type="button" className="ms-primary" onClick={() => save('resolved')} disabled={saving}>
                  <CheckCircle2 size={14} /> Mark resolved
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
    <Footer />
    </>
  );
}
