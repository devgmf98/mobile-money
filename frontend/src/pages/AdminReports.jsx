import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight, BadgePercent, Coins, Download, HandCoins,
  FileText, Loader, RotateCcw, Scale, Search, TrendingUp, Users, Wallet,
} from 'lucide-react';
import { adminAPI } from '../utils/api';
import SkeletonRows from '../components/SkeletonRows';
import { downloadStatementDoc } from '../utils/statementDoc';
import Footer from '../components/Footer';
import { downloadReportSheet } from '../utils/reportSheet';
import '../styles/admin-reports.css';

/* ==========================================================================
   Reports — one row per person, with what they did in the selected window.

   The dashboard's analytics answer "what happened"; this answers "who did it".
   Every role appears together, because the question a report is usually asked
   to settle — who moved what, who is holding what — does not stop at a role
   boundary.

   The page reads top to bottom as three questions: when and who (the toolbar),
   the shape of the answer (the overview), then the answer itself (the table),
   closing with the standard site footer the rest of the admin area carries.

   Money is shown per currency and never summed across them: there is no
   cross-rate at report time, so one figure spanning SSP, USD and UGX would be
   arithmetic on unlike units. Counts do span everything — a transaction is a
   transaction whatever it was denominated in.
   ========================================================================== */

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Weekly' },
  { key: 'month', label: 'Monthly' },
  { key: 'year', label: 'Yearly' },
];

/* Fixed order, never cycled — a role keeps its colour however many roles the
   filters leave on screen. These are categorical slots 1-4 of the validated
   palette; the house green and orange the chips used before failed CVD
   separation at deltaE 5.1 (protan), which no amount of labelling rescues. */
const ROLE_ORDER = ['user', 'agent', 'admin', 'sub-admin'];

const ROLES = [
  { key: 'all', label: 'Everyone' },
  { key: 'user', label: 'Users' },
  { key: 'agent', label: 'Agents' },
  { key: 'admin', label: 'Admins' },
  { key: 'sub-admin', label: 'Sub-admins' },
];

const STATUSES = [
  { key: 'all', label: 'Any standing' },
  { key: 'active', label: 'Active' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'unverified', label: 'Unverified' },
];

const SORTS = [
  { key: 'transactions', label: 'Most transactions' },
  { key: 'balance', label: 'Highest balance' },
  { key: 'commission', label: 'Most commission' },
  { key: 'joined', label: 'Newest' },
  { key: 'name', label: 'Name A-Z' },
];

const ROLE_LABEL = { user: 'User', agent: 'Agent', admin: 'Admin', 'sub-admin': 'Sub-admin' };
const ROLE_PLURAL = { user: 'Users', agent: 'Agents', admin: 'Admins', 'sub-admin': 'Sub-admins' };

const money = (n) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const whole = (n) => Number(n || 0).toLocaleString(undefined);

const when = (v) => {
  const d = new Date(v);
  return isNaN(d) ? '—' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

/* Two letters standing in for a face. Names here are often a single word, so
   this falls back to the first two characters rather than showing one lonely
   initial. */
const initials = (name, email) => {
  const s = String(name || email || '?').trim();
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
};

/* A list of per-currency figures, or a dash. Never a total across them.

   `signed` marks a column whose figures can legitimately go negative — a net
   position rather than a running total — so a minus is worth seeing rather
   than reading past. */
function Amounts({ totals, signed }) {
  if (!totals || !totals.length) return <span className="rp-none">—</span>;
  return (
    <span className="rp-amounts">
      {totals.map((t) => (
        <span
          className={'nb' + (signed && t.amount < 0 ? ' is-negative' : '')}
          key={t.currency}
        >
          {money(t.amount)} <em>{t.currency}</em>
        </span>
      ))}
    </span>
  );
}

/* Who is in the report, and how the roles divide. One panel replaces the six
   near-identical count tiles this page used to open with: the bar carries the
   proportion at a glance and the legend carries the exact numbers, so nothing
   is ever read from colour alone. */
function PeoplePanel({ summary }) {
  const byRole = summary?.byRole || {};
  const total = summary?.total || 0;
  const parts = ROLE_ORDER
    .map((k) => ({ key: k, label: ROLE_PLURAL[k], n: byRole[k] || 0 }))
    .filter((p) => p.n > 0);

  return (
    <section className="rp-panel rp-panel-people">
      <div className="rp-heroes">
        <div className="rp-hero">
          <span className="rp-hero-value">{whole(total)}</span>
          <span className="rp-hero-label"><Users size={12} /> People</span>
        </div>
        <div className="rp-hero">
          <span className="rp-hero-value">{whole(summary?.transactions)}</span>
          <span className="rp-hero-label"><ArrowLeftRight size={12} /> Transactions</span>
        </div>
      </div>

      {parts.length ? (
        <>
          <div className="rp-bar" role="img" aria-label={parts.map((p) => p.n + ' ' + p.label).join(', ')}>
            {parts.map((p) => (
              <span
                key={p.key}
                className={'rp-bar-seg is-' + p.key}
                style={{ flexGrow: p.n }}
                title={p.label + ': ' + whole(p.n)}
              />
            ))}
          </div>
          <ul className="rp-legend">
            {parts.map((p) => (
              <li key={p.key}>
                <i className={'rp-dot is-' + p.key} aria-hidden="true" />
                {p.label}
                <b>{whole(p.n)}</b>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="rp-panel-empty">No one matches these filters.</p>
      )}
    </section>
  );
}

/* A money figure that may span currencies. A panel normally carries one number,
   but a total across SSP, USD and UGX has no single number to carry — so it
   stacks a line each rather than inventing one. */
function MoneyPanel({ icon, label, totals, hint, signed }) {
  const list = totals || [];
  return (
    <section className="rp-panel rp-panel-money">
      <span className="rp-panel-label">{icon} {label}</span>
      {list.length ? (
        <span className="rp-money-list">
          {list.map((t) => (
            <span
              className={'rp-money' + (signed && t.amount < 0 ? ' is-negative' : '')}
              key={t.currency}
            >
              {money(t.amount)}<i>{t.currency}</i>
            </span>
          ))}
        </span>
      ) : (
        /* Zero, not a dash. These figures follow the filters, so a period with
           no commission in it has an answer — it is nought — and a dash read as
           "nothing to show here", which is what made an empty Today look like a
           broken card rather than a quiet day. */
        <span className="rp-money">{money(0)}</span>
      )}
      <span className="rp-panel-hint">{hint}</span>
    </section>
  );
}

export default function AdminReports() {
  const [range, setRange] = useState('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [role, setRole] = useState('all');
  const [destination, setDestination] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('transactions');
  const [search, setSearch] = useState('');
  const [typed, setTyped] = useState('');

  const [person, setPerson] = useState('all');
  const [people_, setPeople_] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [data, setData] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    adminAPI.getStateSettings()
      .then((r) => { if (alive) setDestinations(r?.data?.states || []); })
      .catch(() => { if (alive) setDestinations([]); });
    /* The picker is filled from the full account list, not from the rows on
       screen: a list built from the results would lose every name the moment
       one was chosen, leaving no way back to anyone else. */
    adminAPI.getAllUsers()
      .then((r) => {
        const list = Array.isArray(r?.data) ? r.data : (r?.data?.users || []);
        if (alive) {
          setPeople_(
            [...list].sort((a, b) =>
              String(a.name || a.email || '').localeCompare(String(b.name || b.email || ''))),
          );
        }
      })
      .catch(() => { if (alive) setPeople_([]); });
    return () => { alive = false; };
  }, []);

  /* Typing shouldn't fire a request per keystroke. */
  useEffect(() => {
    const t = setTimeout(() => setSearch(typed), 350);
    return () => clearTimeout(t);
  }, [typed]);

  const query = useMemo(() => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    if (!from && !to && range) q.set('range', range);
    if (role !== 'all') q.set('role', role);
    if (person !== 'all') q.set('personId', person);
    if (destination !== 'all') q.set('destination', destination);
    if (status !== 'all') q.set('status', status);
    if (search.trim()) q.set('search', search.trim());
    q.set('sort', sort);
    return q.toString();
  }, [from, to, range, role, destination, status, search, sort, person]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    adminAPI.getPeopleReport(query)
      .then((r) => { if (alive) setData(r.data); })
      .catch((e) => { if (alive) setError(e?.response?.data?.message || 'Could not load the report'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [query]);

  const reset = () => {
    setRange('month'); setFrom(''); setTo('');
    setRole('all'); setDestination('all'); setStatus('all'); setPerson('all');
    setSort('transactions'); setTyped(''); setSearch('');
  };

  const dirty = from || to || range !== 'month' || role !== 'all' ||
    destination !== 'all' || status !== 'all' || sort !== 'transactions' ||
    search || person !== 'all';

  const people = data?.people || [];
  const summary = data?.summary;

  /* One person's statement, as a Word document.

     It is fetched on click rather than shipped with every row: the statement
     carries that person's entire transaction history, and loading eleven of
     those to render a table nobody has asked to download yet would be waste.

     The window travels with the request, so the document covers the same period
     the page is showing. */
  const downloadStatement = async (p) => {
    setBusyId(p.id);
    try {
      const q = new URLSearchParams();
      if (from) q.set('from', from);
      if (to) q.set('to', to);
      if (!from && !to && range) q.set('range', range);
      const r = await adminAPI.getPersonStatement(p.id, q.toString());
      downloadStatementDoc(r.data);
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not build that statement');
    } finally {
      setBusyId(null);
    }
  };

  /* Exported from the rows on screen, so the file always matches what was
     being looked at when the button was pressed.

     Every column declares its own type, and that type drives three things at
     once: the Excel number format, the alignment, and the width. Nothing is
     inferred from the value, which is how a phone number came to be rendered
     as 2.11912E+11 in the first place.

     A money column cannot be one column, because it holds a figure per
     currency -- "3,000,100.00 SSP | 101.00 USD" in a single cell is text and
     stays text however it is written. So each splits into one column per
     currency, and only currencies actually present get one. */
  const exportSheet = () => {
    const MONEY_COLUMNS = [
      ['Sent', (p) => p.sent.totals],
      ['Received', (p) => p.received.totals],
      ['Commission', (p) => p.commission.totals],
      ['Collected', (p) => p.collected],
    ];

    const currencies = [...new Set(
      people.flatMap((p) => MONEY_COLUMNS.flatMap(([, pick]) => (pick(p) || []).map((t) => t.currency))),
    )].sort();

    /* Blank, not zero: no activity in a currency is not the same as nought of
       it, and Collected prints a real zero where the terms cancel out. */
    const amountIn = (totals, currency) => {
      const hit = (totals || []).find((t) => t.currency === currency);
      return hit ? hit.amount : '';
    };

    const columns = [
      { label: 'Name', type: 'text', value: (p) => p.name },
      { label: 'Email', type: 'text', value: (p) => p.email },
      { label: 'Phone', type: 'id', value: (p) => p.phone },
      { label: 'Role', type: 'text', value: (p) => ROLE_LABEL[p.role] || p.role },
      { label: 'Destination', type: 'text', value: (p) => p.destination || '' },
      { label: 'Reference', type: 'id', value: (p) => p.reference || '' },
      { label: 'Transactions', type: 'count', value: (p) => p.transactions },
      ...MONEY_COLUMNS.flatMap(([label, pick]) =>
        currencies.map((c) => ({
          label: label + ' ' + c,
          type: 'number',
          value: (p) => amountIn(pick(p), c),
        }))),
      { label: 'Balance', type: 'number', value: (p) => p.balance },
      { label: 'Verified', type: 'text', value: (p) => (p.isVerified ? 'Yes' : 'No') },
      { label: 'Suspended', type: 'text', value: (p) => (p.isSuspended ? 'Yes' : 'No') },
      { label: 'Joined', type: 'text', value: (p) => (p.joined ? new Date(p.joined).toISOString().slice(0, 10) : '') },
    ];

    downloadReportSheet(
      {
        columns,
        rows: people,
        title: 'MoneyPay report',
        subtitle: 'Amounts are listed per currency and are never added across them.',
      },
      [
        role !== 'all' ? role : null,
        destination !== 'all' ? destination : null,
        status !== 'all' ? status : null,
        from || to ? 'custom' : range,
      ],
    );
  };

  return (
    <>
    <div className="dashboard-container rp-page">
      <div className="dashboard-header">
        <h1><TrendingUp size={20} /> Reports</h1>
        <p>Every user, agent, admin and sub-admin, with what they moved in the selected period.</p>
      </div>

      {/* --- when, then who. Two rows because they are two questions. --- */}
      <div className="card rp-toolbar">
        <div className="rp-toolbar-row">
          <div className="rp-ranges" role="group" aria-label="Time range">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                className={'rp-range' + (range === r.key && !from && !to ? ' is-on' : '')}
                aria-pressed={range === r.key && !from && !to}
                onClick={() => { setRange(r.key); setFrom(''); setTo(''); }}
              >
                {r.label}
              </button>
            ))}
          </div>

          <label className="rp-field">
            <span>From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} max={to || undefined} />
          </label>
          <label className="rp-field">
            <span>To</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} min={from || undefined} />
          </label>

          <label className="rp-field rp-field-grow">
            <span>Search</span>
            <span className="rp-search-box">
              <Search size={14} />
              <input
                type="search"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Name, email, phone or ID"
              />
            </span>
          </label>
        </div>

        <div className="rp-toolbar-row is-secondary">
          <label className="rp-field rp-field-person">
            <span>Person</span>
            <select value={person} onChange={(e) => setPerson(e.target.value)}>
              <option value="all">Everyone</option>
              {people_.map((u) => (
                <option key={u.id} value={u.id}>
                  {(u.name || u.email) + ' — ' + (ROLE_LABEL[u.role] || u.role)}
                </option>
              ))}
            </select>
          </label>

          <label className="rp-field">
            <span>Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </label>

          <label className="rp-field">
            <span>Destination</span>
            <select value={destination} onChange={(e) => setDestination(e.target.value)}>
              <option value="all">All destinations</option>
              {destinations.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </label>

          <label className="rp-field">
            <span>Standing</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </label>

          <label className="rp-field">
            <span>Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </label>

          {dirty ? (
            <button type="button" className="rp-reset" onClick={reset}>
              <RotateCcw size={13} /> Reset
            </button>
          ) : null}
        </div>
      </div>

      {/* --- the answer to whatever the filters just asked --- */}
      <div className={'rp-body' + (loading ? ' is-loading' : '')}>
        {error ? <div className="card rp-error"><p>{error}</p></div> : (
          <>
            <div className="rp-overview">
              <PeoplePanel summary={summary} />
              <MoneyPanel
                icon={<Wallet size={12} />}
                label="Customer wallets"
                totals={summary ? [{ currency: 'SSP', amount: summary.customerBalance }] : []}
                hint="Held by users and agents"
              />
              <MoneyPanel
                icon={<BadgePercent size={12} />}
                label="Staff commission"
                totals={summary?.staffCommission}
                hint="Earned by admins and sub-admins"
              />
              <MoneyPanel
                icon={<HandCoins size={12} />}
                label="Agent commission"
                totals={summary?.agentCommission}
                hint="Earned by agents on withdrawals"
              />
              {/* The company's position: every Collected figure added across
                  all staff. Same definition as the column, different scale. */}
              <MoneyPanel
                icon={<Scale size={12} />}
                label="Net collected"
                totals={summary?.netCollected}
                hint="In through staff, less paid out — completed only"
                signed
              />
            </div>

            <div className="card rp-results">
              <div className="rp-results-head">
                <h3>
                  <Coins size={15} />
                  {whole(people.length)} {people.length === 1 ? 'person' : 'people'}
                </h3>
                <button type="button" className="rp-export" onClick={exportSheet} disabled={!people.length}>
                  <Download size={14} /> Export Excel
                </button>
              </div>

              <div className="table-wrap rp-table-wrap">
                <table className="table rp-table">
                  <thead>
                    <tr>
                      <th>Person</th>
                      <th>Role</th>
                      <th>Destination</th>
                      <th
                        className="right"
                        title={
                          'Transactions this person took part in, counted once each — as sender, ' +
                          'receiver or settler. Someone who settles a transfer they sent themselves ' +
                          'counts once, not twice. All statuses.'
                        }
                      >
                        Txns
                      </th>
                      <th className="right" title="Money this person sent">Sent</th>
                      <th
                        className="right"
                        title={
                          'For a user or agent, money that arrived in their wallet. ' +
                          'For an admin or sub-admin, transfers they marked as received — ' +
                          'a destination transfer never moves their own balance.'
                        }
                      >
                        Received
                      </th>
                      <th className="right">Commission</th>
                      <th className="right">Balance</th>
                      <th
                        className="right"
                        title={
                          'Cash an admin or sub-admin should be holding, per currency, from completed transactions only.\n\n' +
                          '  + Amount sent (state push)\n' +
                          '  + Commission (state push)\n' +
                          '  + Amount (top-up)\n' +
                          '  − Amount marked as received (state push)\n' +
                          '  − Amount (money exchange)\n' +
                          '  + Converted amount (money exchange)\n' +
                          '  − Amount (agent cash out)\n\n' +
                          'Each currency is netted on its own. One exchange moves two buckets: the ' +
                          'amount comes off the currency given out, the converted amount goes onto ' +
                          'the currency taken back.'
                        }
                      >
                        Collected
                      </th>
                      <th>Standing</th>
                      <th>Joined</th>
                      <th className="right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && !people.length ? (
                      <tr><td colSpan={12}><SkeletonRows count={6} /></td></tr>
                    ) : !people.length ? (
                      <tr>
                        <td colSpan={12}>
                          <div className="rp-empty">
                            <Users size={22} />
                            <h4>Nobody matches these filters</h4>
                            <p>Widen the period, or clear a filter.</p>
                          </div>
                        </td>
                      </tr>
                    ) : people.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div className="rp-person">
                            <span className={'rp-avatar is-' + p.role} aria-hidden="true">
                              {initials(p.name, p.email)}
                            </span>
                            <span className="rp-person-text">
                              <span className="rp-name">{p.name || '—'}</span>
                              <span className="rp-sub">{p.email}</span>
                              {p.phone || p.reference ? (
                                <span className="rp-sub is-dim">
                                  {[p.phone, p.reference].filter(Boolean).join(' · ')}
                                </span>
                              ) : null}
                            </span>
                          </div>
                        </td>
                        <td><span className={'rp-role is-' + p.role}>{ROLE_LABEL[p.role] || p.role}</span></td>
                        <td>
                          {p.destination
                            ? <span className="rp-dest">{p.destination}</span>
                            : <span className="rp-none">—</span>}
                        </td>
                        <td className="right rp-count">{whole(p.transactions)}</td>
                        <td className="right"><Amounts totals={p.sent.totals} /></td>
                        <td className="right"><Amounts totals={p.received.totals} /></td>
                        <td className="right"><Amounts totals={p.commission.totals} /></td>
                        <td className={'right rp-balance' + (p.balance < 0 ? ' is-negative' : '')}>
                          {money(p.balance)}
                          {/* Staff hold no wallet — a transfer never moves their
                              balance. What accumulates here is commission that
                              has actually been credited, which the rest of the
                              app calls Admin Cash. It reads lower than the
                              Commission column, which also counts transfers
                              still pending; commission pays on receipt. */}
                          {p.balanceKind === 'net' ? <span className="rp-kind">admin cash</span> : null}
                        </td>
                        {/* Defined only for staff — the formula is about cash
                            passing through their hands, which is not something
                            a customer's row has. */}
                        <td className="right rp-collected">
                          <Amounts totals={p.collected} signed />
                        </td>
                        <td>
                          <span className="rp-standing">
                            {p.isSuspended ? <b className="is-suspended">Suspended</b> : <b className="is-active">Active</b>}
                            {!p.isVerified ? <b className="is-unverified">Unverified</b> : null}
                          </span>
                        </td>
                        <td className="rp-joined">{when(p.joined)}</td>
                        <td className="right">
                          <button
                            type="button"
                            className="rp-doc"
                            onClick={() => downloadStatement(p)}
                            disabled={busyId === p.id}
                            title={'Download a Word statement for ' + (p.name || p.email)}
                            aria-label={'Download statement for ' + (p.name || p.email)}
                          >
                            {busyId === p.id
                              ? <Loader size={14} className="rp-spin" />
                              : <FileText size={14} />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      </div>
      <Footer />
    </>
  );
}
