import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowUp, LifeBuoy, MessageSquare, ScrollText, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../context/store';
import Footer from '../../components/Footer';
import { COMPANY, DRAFT, UPDATED } from './content';
import '../../styles/legal.css';

/* ==========================================================================
   The shell all three legal documents render in.

   Open to anyone, like Contact and Help: a policy you have to sign in to read
   is not a policy anyone can rely on, and the person deciding whether to open
   an account has no account yet.

   These pages are long by nature, so the structure does the work the length
   would otherwise cost: three plain-English lines at the top for the reader
   who wants the gist, a contents list that tracks where you are, and a way
   back to the top from anywhere in the middle.
   ========================================================================== */

const ICONS = {
  privacy: ShieldCheck,
  terms: ScrollText,
  security: LifeBuoy,
};

/* The other two documents, offered at the foot of whichever one you are on —
   people who read one of these usually want a look at the next. */
const SIBLINGS = [
  { key: 'privacy', to: '/privacy', label: 'Privacy Policy' },
  { key: 'terms', to: '/terms', label: 'Terms of Service' },
  { key: 'security', to: '/security', label: 'Security' },
];

export default function LegalPage({ doc }) {
  const user = useAuthStore((state) => state.user);
  const [active, setActive] = useState(doc.sections[0]?.id);
  const [showTop, setShowTop] = useState(false);

  const Icon = ICONS[doc.key] || ScrollText;
  const backTo = user ? `/${user.role}/dashboard` : '/login';

  /* Which section the reader is actually in, so the contents list says where
     they are rather than only where they can go. Nearest heading above the
     top quarter of the viewport wins — using the exact top would flip the
     highlight one section early on every scroll. */
  useEffect(() => {
    const headings = doc.sections
      .map((s) => document.getElementById(s.id))
      .filter(Boolean);
    if (!headings.length) return undefined;

    const onScroll = () => {
      const line = window.innerHeight * 0.25;
      let current = headings[0].id;
      for (const h of headings) {
        if (h.getBoundingClientRect().top <= line) current = h.id;
      }
      setActive(current);
      setShowTop(window.scrollY > 600);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [doc]);

  /* Arriving on a different document should not keep the last one's scroll
     position — the reader is at a new page, not further down the old one. */
  useEffect(() => { window.scrollTo(0, 0); }, [doc.key]);

  const unfilled = useMemo(
    () => Object.entries(COMPANY)
      .filter(([, v]) => typeof v === 'string' && v.startsWith('['))
      .map(([k]) => k),
    [],
  );

  const jump = (id) => (e) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    /* Offset for the sticky heading, so the target does not land underneath
       it — `scrollIntoView` alone puts it flush against the top edge. */
    const y = el.getBoundingClientRect().top + window.scrollY - 84;
    window.scrollTo({ top: y, behavior: 'smooth' });
  };

  return (
    <div className="public-shell">
    <div className="legal-page">
      <header className="legal-hero">
        <div className="legal-hero-inner">
          <Link to={backTo} className="legal-back">
            <ArrowLeft size={15} /> {user ? 'Back to dashboard' : 'Back to sign in'}
          </Link>

          <span className="legal-badge"><Icon size={15} /> {doc.title}</span>
          <h1>{doc.title}</h1>
          <p className="legal-tagline">{doc.tagline}</p>
          <p className="legal-updated">Last updated {UPDATED}</p>
        </div>
      </header>

      <main className="legal-shell">
        {/* The gist, for the reader who will not read 2,000 words — and who
            is entitled to know the shape of it anyway. */}
        <section className="legal-summary" aria-label="In short">
          <h2>In short</h2>
          <ul>
            {doc.summary.map((line) => <li key={line}>{line}</li>)}
          </ul>
          <p className="legal-summary-foot">
            This is a plain summary, not the agreement. The sections below are what counts.
          </p>
        </section>

        {DRAFT && unfilled.length ? (
          <div className="legal-draft" role="status">
            <span className="legal-draft-icon"><AlertTriangle size={17} /></span>
            <div>
              <strong>Draft — not yet ready to publish</strong>
              <p>
                Still to fill in: {unfilled.join(', ')}. Set them in
                {' '}<code>src/pages/legal/content.js</code>, have the result reviewed,
                then set <code>DRAFT</code> to <code>false</code> to hide this notice.
              </p>
            </div>
          </div>
        ) : null}

        <div className="legal-body">
          {/* ---- contents ---- */}
          <nav className="legal-toc" aria-label="On this page">
            <h2>On this page</h2>
            <ol>
              {doc.sections.map((s, i) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    onClick={jump(s.id)}
                    className={active === s.id ? 'is-active' : undefined}
                    aria-current={active === s.id ? 'true' : undefined}
                  >
                    <i>{String(i + 1).padStart(2, '0')}</i>
                    <span>{s.heading}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {/* ---- the document ---- */}
          <article className="legal-doc">
            {doc.sections.map((s, i) => (
              <section className="legal-section" key={s.id} id={s.id}>
                <h2>
                  <i className="legal-section-num">{String(i + 1).padStart(2, '0')}</i>
                  {s.heading}
                </h2>
                {s.blocks.map((b, bi) => <Block key={bi} block={b} />)}
              </section>
            ))}
          </article>
        </div>

        <footer className="legal-foot">
          <div className="legal-foot-copy">
            <span className="legal-foot-icon"><MessageSquare size={18} /></span>
            <div>
              <strong>Still not clear?</strong>
              <p>Ask us — a person will answer, and a plain answer beats a clause.</p>
            </div>
          </div>
          <div className="legal-foot-actions">
            {SIBLINGS.filter((s) => s.key !== doc.key).map((s) => (
              <Link key={s.key} to={s.to} className="legal-secondary">{s.label}</Link>
            ))}
            <Link to="/contact" className="legal-primary">Contact us</Link>
          </div>
        </footer>
      </main>

      <button
        type="button"
        className={'legal-totop' + (showTop ? ' is-on' : '')}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Back to top"
        tabIndex={showTop ? 0 : -1}
      >
        <ArrowUp size={18} />
      </button>
    </div>

    <Footer />
    </div>
  );
}

/* The handful of shapes the documents are written in. Kept deliberately small:
   a policy needs paragraphs, bullets, numbered steps, term/definition pairs
   and the occasional line that must not be skimmed past — not a rich text
   engine. */
function Block({ block }) {
  switch (block.type) {
    case 'p':
      return <p>{block.text}</p>;

    case 'ul':
      return (
        <ul className="legal-list">
          {block.items.map((it) => <li key={it}>{it}</li>)}
        </ul>
      );

    case 'ol':
      return (
        <ol className="legal-steps">
          {block.items.map((it) => <li key={it}>{it}</li>)}
        </ol>
      );

    case 'dl':
      return (
        <dl className="legal-defs">
          {block.items.map(([term, def]) => (
            <div className="legal-def" key={term}>
              <dt>{term}</dt>
              <dd>{def}</dd>
            </div>
          ))}
        </dl>
      );

    case 'note':
      return <p className="legal-note">{block.text}</p>;

    default:
      return null;
  }
}
