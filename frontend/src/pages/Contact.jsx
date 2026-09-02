import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader, Mail, MessageSquare, Phone, Send } from 'lucide-react';
import { contactAPI } from '../utils/api';
import { useAuthStore } from '../context/store';
import Footer from '../components/Footer';
import mpLogo from '../assets/mp-logo.png';
import '../styles/contact.css';

/* ==========================================================================
   Contact Us.

   Open to anyone, signed in or not — a customer locked out of their account is
   exactly the person who needs to reach support, and a login wall would be a
   closed door with a bell on it.

   The footer link used to be a `mailto:`, which needs a mail client configured
   on the sender's machine, silently does nothing on most phones, and leaves no
   record that anyone tried. This posts a message that is stored and raised to
   admins in the app.
   ========================================================================== */

const SUBJECTS = [
  { key: 'general', label: 'General enquiry' },
  { key: 'transaction', label: 'A transaction' },
  { key: 'account', label: 'My account' },
  { key: 'agent', label: 'Becoming an agent' },
  { key: 'complaint', label: 'A complaint' },
  { key: 'other', label: 'Something else' },
];

const MAX_MESSAGE = 4000;

export default function Contact() {
  const user = useAuthStore((state) => state.user);

  const [form, setForm] = useState({
    name: '', email: '', phone: '', subject: 'general', message: '',
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(null);

  /* Someone already signed in should not retype what the app knows. They can
     still edit it — the message may be about a different address. */
  useEffect(() => {
    if (!user) return;
    setForm((f) => ({
      ...f,
      name: f.name || user.name || '',
      email: f.email || user.email || '',
      phone: f.phone || user.phone || '',
    }));
  }, [user]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const r = await contactAPI.send(form);
      setSent(r.data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not send that just now. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const remaining = MAX_MESSAGE - form.message.length;

  if (sent) {
    return (
      <div className="public-shell">
      <div className="contact-page">
        <div className="contact-card contact-done">
          <CheckCircle2 size={44} />
          <h1>{sent.delivery?.emailed ? 'Message sent' : 'Message received'}</h1>
          <p>{sent.message}</p>
          <p className="contact-ref">
            Your reference is <strong>{sent.reference}</strong> — quote it if you write again.
          </p>
          {/* Says what actually happened. The screen used to read "Message sent"
              whatever the outcome, while no mail transport existed at all — so
              people waited on an email that was never going to arrive. */}
          {sent.delivery?.acknowledged ? (
            <p className="contact-ref">A copy is on its way to your inbox.</p>
          ) : (
            <p className="contact-ref contact-note-soft">
              We have this on file and our team has been alerted.
              {user ? ' Our reply will arrive in your notifications.' : ' We will reply to the address you gave.'}
            </p>
          )}
          <div className="contact-done-actions">
            <button
              type="button"
              className="contact-secondary"
              onClick={() => { setSent(null); setForm((f) => ({ ...f, subject: 'general', message: '' })); }}
            >
              Send another
            </button>
            <Link className="contact-primary" to={user ? `/${user.role}/dashboard` : '/login'}>
              {user ? 'Back to dashboard' : 'Back to sign in'}
            </Link>
          </div>
        </div>
      </div>

      <Footer />
      </div>
    );
  }

  return (
    <div className="public-shell">
    <div className="contact-page">
      <div className="contact-card">
        <div className="contact-head">
          <img src={mpLogo} alt="MoneyPay" className="contact-logo" />
          <div>
            <h1>Contact us</h1>
            <p>Tell us what happened and we will come back to you.</p>
          </div>
        </div>

        <form className="contact-form" onSubmit={submit} noValidate>
          <div className="contact-row">
            <label className="contact-field">
              <span>Your name</span>
              <input
                type="text"
                value={form.name}
                onChange={set('name')}
                placeholder="Full name"
                autoComplete="name"
                required
              />
            </label>

            <label className="contact-field">
              <span>Email address</span>
              <span className="contact-input-icon">
                <Mail size={14} />
                <input
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </span>
            </label>
          </div>

          <div className="contact-row">
            <label className="contact-field">
              <span>Phone <i>optional</i></span>
              <span className="contact-input-icon">
                <Phone size={14} />
                <input
                  type="tel"
                  value={form.phone}
                  onChange={set('phone')}
                  placeholder="+211 900 000 000"
                  autoComplete="tel"
                />
              </span>
            </label>

            <label className="contact-field">
              <span>What is it about?</span>
              <select value={form.subject} onChange={set('subject')}>
                {SUBJECTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </label>
          </div>

          <label className="contact-field">
            <span>
              Message
              {/* Only worth showing once it is close enough to matter. */}
              {remaining < 400 ? <i>{remaining} characters left</i> : null}
            </span>
            <textarea
              value={form.message}
              onChange={set('message')}
              rows={7}
              maxLength={MAX_MESSAGE}
              placeholder="Include a reference number if your message is about a transaction — it is the fastest way for us to find it."
              required
            />
          </label>

          {error ? <p className="contact-error">{error}</p> : null}

          <div className="contact-actions">
            <Link to={user ? `/${user.role}/dashboard` : '/login'} className="contact-back">
              <ArrowLeft size={14} /> Back
            </Link>
            <button type="submit" className="contact-primary" disabled={sending}>
              {sending ? <Loader size={15} className="contact-spin" /> : <Send size={15} />}
              {sending ? 'Sending' : 'Send message'}
            </button>
          </div>
        </form>

        <p className="contact-note">
          <MessageSquare size={13} />
          We read every message. If you are signed in, our reply arrives in your notifications.
        </p>
      </div>
    </div>

    <Footer />
    </div>
  );
}
