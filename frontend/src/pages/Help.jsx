import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Banknote, ChevronDown, CircleHelp, Flame, Handshake, LifeBuoy,
  MessageSquare, Receipt, Rocket, Search, Send, ShieldCheck, UserRound,
} from 'lucide-react';
import { helpAPI } from '../utils/api';
import { useAuthStore } from '../context/store';
import Footer from '../components/Footer';
import '../styles/help.css';

/* ==========================================================================
   Help Center.

   Open to anyone, like Contact Us and for the same reason: the person who most
   needs to read "why is my account suspended" is the one who cannot sign in.

   The page is search-first, because someone arriving here has a question in
   mind rather than a wish to browse. Topics come second for the people who do
   not know what to call the thing they are looking for, and the answers
   themselves last. Everything is served from the database, so support can add
   an answer without a deploy.
   ========================================================================== */

/* An icon per topic, so the tiles are told apart at a glance rather than read
   one by one. Keyed on the category the server sends. */
const TOPIC_ICONS = {
  'getting-started': Rocket,
  sending: Send,
  withdrawing: Banknote,
  agents: Handshake,
  fees: Receipt,
  security: ShieldCheck,
  account: UserRound,
};

export default function Help() {
  const user = useAuthStore((state) => state.user);

  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openSlug, setOpenSlug] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(typed), 300);
    return () => clearTimeout(t);
  }, [typed]);

  const query = useMemo(() => {
    const q = new URLSearchParams();
    if (search.trim()) q.set('search', search.trim());
    if (category !== 'all') q.set('category', category);
    return q.toString();
  }, [search, category]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    helpAPI.list(query)
      .then((r) => { if (alive) setData(r.data); })
      .catch((e) => { if (alive) setError(e?.response?.data?.message || 'Could not load the help centre'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [query]);

  /* The full set of topics, kept from the unfiltered load so the tiles do not
     vanish the moment one of them is chosen — a filter you cannot see is a
     filter you cannot undo. */
  const [topics, setTopics] = useState([]);
  useEffect(() => {
    if (!data || search.trim() || category !== 'all') return;
    setTopics(data.categories.map((c) => ({ key: c.key, label: c.label, count: c.articles.length })));
  }, [data, search, category]);

  const categories = data?.categories || [];
  const total = data?.total || 0;
  const browsing = !search.trim() && category === 'all';

  /* The handful people actually open. Only worth showing once the counts mean
     something — before anyone has read anything it is just the seed order
     wearing a "popular" label. */
  const popular = useMemo(() => {
    if (!browsing || !data) return [];
    return data.categories
      .flatMap((c) => c.articles.map((a) => ({ ...a, topic: c.label })))
      .filter((a) => a.views > 0)
      .sort((a, b) => b.views - a.views)
      .slice(0, 4);
  }, [data, browsing]);

  const toggle = (slug) => {
    setOpenSlug((current) => {
      if (current === slug) return null;
      /* Opening one counts a read. Fire and forget — a failed count is not
         worth interrupting someone looking for an answer. */
      helpAPI.markRead(slug).catch(() => {});
      return slug;
    });
  };

  const activeTopic = topics.find((t) => t.key === category);
  const backTo = user ? `/${user.role}/dashboard` : '/login';

  return (
    <div className="public-shell">
    <div className="help-page">
      {/* ---- search first: people arrive with a question, not a wish to browse */}
      <header className="help-hero">
        <div className="help-hero-inner">
          <span className="help-hero-badge"><LifeBuoy size={15} /> Help Center</span>
          <h1>How can we help?</h1>
          <p>Search the answers, or pick a topic below.</p>

          <div className="help-search">
            <Search size={18} />
            <input
              type="search"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Try “withdraw”, “fee” or “agent”"
              aria-label="Search the help centre"
            />
            {typed ? (
              <button type="button" className="help-search-clear" onClick={() => setTyped('')}>
                Clear
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="help-shell">
        {/* ---- topics: for people who do not know what to call the thing ---- */}
        {topics.length > 1 ? (
          <nav className="help-topics" aria-label="Topics">
            {topics.map((t) => {
              const Icon = TOPIC_ICONS[t.key] || CircleHelp;
              const on = category === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  className={'help-topic' + (on ? ' is-on' : '')}
                  aria-pressed={on}
                  onClick={() => { setCategory(on ? 'all' : t.key); setOpenSlug(null); }}
                >
                  <span className="help-topic-icon"><Icon size={19} /></span>
                  <span className="help-topic-label">{t.label}</span>
                  <span className="help-topic-count">{t.count}</span>
                </button>
              );
            })}
          </nav>
        ) : null}

        {/* One line saying what is on screen, and the way back out of it. */}
        {!browsing ? (
          <div className="help-filterbar">
            <span>
              {loading ? 'Searching…'
                : total === 0 ? 'No answers found'
                  : `${total} ${total === 1 ? 'answer' : 'answers'}`}
              {search.trim() ? <> for <strong>“{search.trim()}”</strong></> : null}
              {activeTopic ? <> in <strong>{activeTopic.label}</strong></> : null}
            </span>
            <button
              type="button"
              className="help-clear"
              onClick={() => { setTyped(''); setSearch(''); setCategory('all'); setOpenSlug(null); }}
            >
              Show everything
            </button>
          </div>
        ) : null}

        <div className={'help-body' + (loading ? ' is-loading' : '')}>
          {error ? <p className="help-error">{error}</p> : null}

          {popular.length ? (
            <section className="help-popular">
              <h2><Flame size={14} /> Most read</h2>
              <div className="help-popular-grid">
                {popular.map((a) => (
                  <button
                    key={a.slug}
                    type="button"
                    className="help-popular-item"
                    onClick={() => {
                      setCategory(a.category);
                      setOpenSlug(a.slug);
                      helpAPI.markRead(a.slug).catch(() => {});
                    }}
                  >
                    <span className="help-popular-topic">{a.topic}</span>
                    <span className="help-popular-q">{a.question}</span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {!error && !loading && total === 0 ? (
            <div className="help-empty">
              <Search size={24} />
              <h3>Nothing matches that</h3>
              <p>Try a different word — or just ask us and a person will answer.</p>
              <Link className="help-cta" to="/contact">Ask us instead</Link>
            </div>
          ) : null}

          {categories.map((c) => {
            const Icon = TOPIC_ICONS[c.key] || CircleHelp;
            return (
              <section className="help-group" key={c.key}>
                <h2 className="help-group-head">
                  <span className="help-group-icon"><Icon size={16} /></span>
                  {c.label}
                  <i>{c.articles.length}</i>
                </h2>

                <ul className="help-list">
                  {c.articles.map((a) => {
                    const open = openSlug === a.slug;
                    return (
                      <li key={a.slug} className={'help-item' + (open ? ' is-open' : '')}>
                        <button
                          type="button"
                          className="help-question"
                          aria-expanded={open}
                          onClick={() => toggle(a.slug)}
                        >
                          <span className="help-q-text">{a.question}</span>
                          {/* Staff see their own drafts here; customers never do. */}
                          {data.canEdit && !a.isPublished ? <i className="help-draft">Draft</i> : null}
                          <ChevronDown size={18} className="help-chevron" />
                        </button>
                        {open ? (
                          <div className="help-answer">
                            <p>{a.answer}</p>
                            <span className="help-answer-foot">
                              Was this not it? <Link to="/contact">Ask us directly</Link>
                            </span>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        <footer className="help-foot">
          <div className="help-foot-copy">
            <span className="help-foot-icon"><MessageSquare size={18} /></span>
            <div>
              <strong>Still stuck?</strong>
              <p>Send us the details and a person will come back to you.</p>
            </div>
          </div>
          <div className="help-foot-actions">
            <Link to={backTo} className="help-back"><ArrowLeft size={14} /> Back</Link>
            <Link to="/contact" className="help-cta">Contact us</Link>
          </div>
        </footer>
      </main>
    </div>

    <Footer />
    </div>
  );
}
