import { useEffect, useMemo, useState } from 'react';
import { Coins, Filter, RotateCcw } from 'lucide-react';
import { adminAPI } from '../utils/api';
import { TYPE_LABELS } from '../data/transactionTypes';
import '../styles/transaction-analytics.css';

/* ==========================================================================
   Transaction analytics.

   Five filters that combine, plus four range presets. Totals are reported per
   currency and never added together: the app holds no cross-rate at report
   time, so one number spanning SSP, USD and UGX would be arithmetic on unlike
   units. A reader gets the transaction count across everything, and the money
   split by the currency it is actually denominated in.

   Every filter narrows the same query, so the headline and each breakdown
   below it always describe the same slice.
   ========================================================================== */

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Weekly' },
  { key: 'month', label: 'Monthly' },
  { key: 'year', label: 'Yearly' },
];

const ROLES = [
  { key: 'all', label: 'All roles' },
  { key: 'user', label: 'User' },
  { key: 'agent', label: 'Agent' },
  { key: 'admin', label: 'Admin' },
  { key: 'sub-admin', label: 'Sub-admin' },
];

const STATUSES = ['all', 'completed', 'pending', 'cancelled', 'failed'];

/* The commission card sorts on its own. "Highest amount" ranks on the largest
   single-currency figure a person holds rather than a sum, because summing
   across currencies to order a list is the same unlike-units mistake the
   totals avoid — someone earning 300 USD does not outrank someone earning
   20,000 SSP by arithmetic anyone can defend. Sorting by transfers is the
   comparison that is always sound, so it is offered beside it. */
const SORTS = [
  { key: 'amount', label: 'Highest amount' },
  { key: 'count', label: 'Most transfers' },
  { key: 'name', label: 'Name A-Z' },
];

/* Several accounts here share a display name. Where that happens the email is
   what tells them apart, so it is shown — and only then, since appending it to
   every row would be noise. */
const staffLabel = (p, all) => {
  const name = p.name || p.email;
  const clashes = (all || []).filter((x) => (x.name || x.email) === name).length > 1;
  return clashes && p.email ? name + ' - ' + p.email : name;
};

const peakAmount = (r) => Math.max(0, ...(r.totals || []).map((t) => Number(t.amount) || 0));

const sortRows = (rows, how) => {
  const list = [...(rows || [])];
  if (how === 'count') return list.sort((a, b) => (b.count || 0) - (a.count || 0));
  if (how === 'name') return list.sort((a, b) => String(a.key).localeCompare(String(b.key)));
  return list.sort((a, b) => peakAmount(b) - peakAmount(a));
};

const money = (n) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const whole = (n) => Number(n || 0).toLocaleString(undefined);

export default function TransactionAnalytics() {
  const [range, setRange] = useState('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [type, setType] = useState('all');
  const [role, setRole] = useState('all');
  const [destination, setDestination] = useState('all');
  const [staffId, setStaffId] = useState('all');
  const [status, setStatus] = useState('all');
  /* Owned by the commission card, not the filter toolbar above it. Commission
     is usually read over a different window from volume — "what did the desk
     earn this month" against "what moved today" — so it asks its own question
     rather than inheriting one. */
  const [sort, setSort] = useState('amount');
  const [cRange, setCRange] = useState('month');
  const [cFrom, setCFrom] = useState('');
  const [cTo, setCTo] = useState('');
  const [cData, setCData] = useState(null);
  const [cLoading, setCLoading] = useState(true);
  const [cStaff, setCStaff] = useState('all');

  const [destinations, setDestinations] = useState([]);
  const [staff, setStaff] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /* The option lists come from what actually exists, so a new destination or a
     newly created sub-admin appears here without a code change. */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, u] = await Promise.all([adminAPI.getStateSettings(), adminAPI.getAllUsers()]);
        if (!alive) return;
        setDestinations(s?.data?.states || []);
        setStaff((u?.data || []).filter((x) => x.role === 'admin' || x.role === 'sub-admin'));
      } catch (e) {
        if (alive) { setDestinations([]); setStaff([]); }
      }
    })();
    return () => { alive = false; };
  }, []);

  const query = useMemo(() => {
    const q = new URLSearchParams();
    /* A typed date wins over the preset — the preset is a shortcut for filling
       these two fields, not a separate mode. */
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    if (!from && !to && range) q.set('range', range);
    if (type !== 'all') q.set('type', type);
    if (role !== 'all') q.set('role', role);
    if (destination !== 'all') q.set('destination', destination);
    if (staffId !== 'all') q.set('staffId', staffId);
    if (status !== 'all') q.set('status', status);
    return q.toString();
  }, [from, to, range, type, role, destination, staffId, status]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await adminAPI.getTransactionAnalytics(query);
        if (alive) setData(res.data);
      } catch (e) {
        if (alive) setError(e?.response?.data?.message || 'Could not load analytics');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [query]);

  const cQuery = useMemo(() => {
    const q = new URLSearchParams();
    if (cFrom) q.set('from', cFrom);
    if (cTo) q.set('to', cTo);
    if (!cFrom && !cTo && cRange) q.set('range', cRange);
    return q.toString();
  }, [cFrom, cTo, cRange]);

  useEffect(() => {
    let alive = true;
    setCLoading(true);
    (async () => {
      try {
        const res = await adminAPI.getTransactionAnalytics(cQuery);
        if (alive) setCData(res.data);
      } catch (e) {
        if (alive) setCData(null);
      } finally {
        if (alive) setCLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [cQuery]);

  const reset = () => {
    setRange('month'); setFrom(''); setTo('');
    setType('all'); setRole('all'); setDestination('all'); setStaffId('all'); setStatus('all');
  };

  const dirty = from || to || type !== 'all' || role !== 'all' ||
    destination !== 'all' || staffId !== 'all' || status !== 'all' || range !== 'month';

  const totals = data?.totals || [];

  return (
    <>
    <div className="card mt-4">
      <div className="card-header">
        <h3><Filter size={18} /> Transactions Analytics</h3>
      </div>
      <div className="card-body">
    <div className="ta">
      {/* Presets first — the control a reader reaches for before any other. */}
      <div className="ta-filters">
        <div className="ta-ranges" role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              className={'ta-range' + (range === r.key && !from && !to ? ' is-on' : '')}
              aria-pressed={range === r.key && !from && !to}
              onClick={() => { setRange(r.key); setFrom(''); setTo(''); }}
            >
              {r.label}
            </button>
          ))}
        </div>

        <label className="ta-field">
          <span>From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} max={to || undefined} />
        </label>
        <label className="ta-field">
          <span>To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} min={from || undefined} />
        </label>

        <span className="ta-sep" aria-hidden="true" />

        <label className="ta-field">
          <span>Type</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">All types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>

        <label className="ta-field">
          <span>Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </label>

        <label className="ta-field">
          <span>Destination</span>
          <select value={destination} onChange={(e) => setDestination(e.target.value)}>
            <option value="all">All destinations</option>
            {destinations.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
        </label>

        <label className="ta-field">
          <span>Individual</span>
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="all">All admins</option>
            {staff.map((p) => (
              <option key={p.id} value={p.id}>
                {(p.name || p.email) + (p.role === 'sub-admin' ? ' (sub-admin)' : '')}
              </option>
            ))}
          </select>
        </label>

        <label className="ta-field">
          <span>Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s === 'all' ? 'Any status' : s[0].toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </label>

        {dirty ? (
          <button type="button" className="ta-reset" onClick={reset}>
            <RotateCcw size={13} /> Reset
          </button>
        ) : null}
      </div>

      {/* While reloading the previous figures stay put at reduced opacity —
          no skeleton, no jump, and the reader keeps their place. */}
      <div className={'ta-body' + (loading ? ' is-loading' : '')}>
        {error ? (
          <p className="ta-error">{error}</p>
        ) : (
          <>
            <div className="ta-headline">
              <div className="ta-count">
                <span className="ta-count-value">{whole(data?.count)}</span>
                <span className="ta-count-label">
                  {data?.count === 1 ? 'transaction' : 'transactions'}
                </span>
              </div>
              <div className="ta-totals">
                {totals.length === 0 ? (
                  <span className="ta-none">No value in this selection</span>
                ) : (
                  totals.map((t) => (
                    <span className="ta-total" key={t.currency}>
                      <b>{money(t.amount)}</b>
                      <i>{t.currency}</i>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Totals are per currency for the same reason the headline is:
                these columns hold unlike units. */}
            <div className="ta-breakdowns">
              <Breakdown title="By type" rows={data?.byType} label={(k) => TYPE_LABELS[k] || k} />
              <Breakdown title="By origin destination" rows={data?.byDestination} label={(k) => (k === '—' ? 'Not a destination transfer' : k)} />
              <Breakdown title="By status" rows={data?.byStatus} label={(k) => k[0].toUpperCase() + k.slice(1)} showMoney={false} />
            </div>
          </>
        )}
      </div>
    </div>
      </div>
    </div>

    {/* Commission gets its own card: it answers a different question from the
        volume figures above, and it ranks people rather than describing the
        slice, so it carries its own sort rather than borrowing the toolbar. */}
    <div className="card mt-4">
      <div className="card-header ta-card-head">
        <h3><Coins size={18} /> Commission</h3>
        <label className="ta-sort">
          <span>Sort by</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </label>
      </div>
      <div className="card-body">
        <div className="ta">
          {/* Its own window: the same four presets and a custom range, asked
              of the commission figures alone. */}
          <div className="ta-filters is-compact">
            <div className="ta-ranges" role="group" aria-label="Commission time range">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  className={'ta-range' + (cRange === r.key && !cFrom && !cTo ? ' is-on' : '')}
                  aria-pressed={cRange === r.key && !cFrom && !cTo}
                  onClick={() => { setCRange(r.key); setCFrom(''); setCTo(''); }}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <label className="ta-field">
              <span>From</span>
              <input type="date" value={cFrom} onChange={(e) => setCFrom(e.target.value)} max={cTo || undefined} />
            </label>
            <label className="ta-field">
              <span>To</span>
              <input type="date" value={cTo} onChange={(e) => setCTo(e.target.value)} min={cFrom || undefined} />
            </label>
            <label className="ta-field">
              <span>User</span>
              <select value={cStaff} onChange={(e) => setCStaff(e.target.value)}>
                <option value="all">All admins</option>
                {/* The email, not the name. Three accounts here are all called
                    "GMF ADMIN", and picking between identical labels is
                    guesswork — an email is unique, which is the whole reason
                    to show it. The role marker stays because the email does
                    not carry it. */}
                {staff.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.email || p.name}{p.role === 'sub-admin' ? ' (sub-admin)' : ''}
                  </option>
                ))}
              </select>
            </label>

            {(cFrom || cTo || cRange !== 'month' || cStaff !== 'all') ? (
              <button
                type="button"
                className="ta-reset"
                onClick={() => { setCRange('month'); setCFrom(''); setCTo(''); setCStaff('all'); }}
              >
                <RotateCcw size={13} /> Reset
              </button>
            ) : null}
          </div>

          <div className={'ta-body' + (cLoading ? ' is-loading' : '')}>
          <div className="ta-breakdowns is-flush">
            {/* Who earned what. The bar is scaled by the number of
                commission-earning transfers, because that is the one figure
                comparable across people holding different currencies. */}
            <Breakdown
              title="Commission by admin"
              /* Narrowed here rather than in the request: the endpoint's
                 staffId matches either side of a transaction, so asking it for
                 one person and then grouping by who earned would also return
                 commission other admins earned on transfers sent TO them. The
                 rows are already grouped by earner, so selecting from them is
                 exact. */
              rows={sortRows(cData?.byStaff, sort).filter(
                (r) => cStaff === 'all' || String(r.id) === String(cStaff)
              )}
              label={(k, r) => staffLabel({ name: k, email: r?.email }, staff)}
              badge={(r) => (r.role === 'sub-admin' ? 'sub-admin' : 'admin')}
              empty="No commission earned in this selection"
              showTotal
            />
            {/* The house's own cut. Separate columns on a transaction, not a
                split of one pot. */}
            <Breakdown
              title="Company's commission"
              rows={sortRows(cData?.byCompany, sort)}
              label={(k) => TYPE_LABELS[k] || k}
              empty="No company commission in this selection"
              showTotal
            />
          </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

function Breakdown({ title, rows, label, showMoney = true, badge, empty, showTotal = false }) {
  const list = rows || [];

  /* The block's own total, summed from the rows on screen rather than fetched
     separately — a second query could drift from the list it is supposed to
     summarise. Per currency, for the same reason nothing else here is added
     across them. */
  const blockTotal = (() => {
    if (!showTotal) return [];
    const acc = {};
    for (const r of list) {
      for (const t of r.totals || []) {
        acc[t.currency] = (acc[t.currency] || 0) + (Number(t.amount) || 0);
      }
    }
    return Object.entries(acc)
      .map(([currency, amount]) => ({ currency, amount }))
      .sort((a, b) => b.amount - a.amount);
  })();
  /* Bars are scaled to the biggest row in this block, not to the grand total.
     Scaling to the total would flatten every bar into a sliver whenever one
     category dominates — which is exactly when the comparison matters. */
  const peak = Math.max(1, ...list.map((r) => Number(r.count) || 0));
  const sum = list.reduce((n, r) => n + (Number(r.count) || 0), 0);

  return (
    <div className="ta-block">
      {/* One currency sits on the title line; more than one drops beneath it.
          Deciding by count rather than letting flex sort it out means the
          layout is the same every time, however many currencies appear — and
          the title never gets squeezed into wrapping. */}
      <div className={'ta-block-head' + (blockTotal.length > 1 ? ' is-stacked' : '')}>
        <h4>{title}</h4>
        {blockTotal.length > 0 ? (
          <span className="ta-block-total">
            {blockTotal.map((t) => (
              <span className="nb" key={t.currency}><b>{money(t.amount)}</b> {t.currency}</span>
            ))}
          </span>
        ) : null}
      </div>
      {list.length === 0 ? (
        <p className="ta-none">{empty || 'Nothing in this selection'}</p>
      ) : (
        <ul className="ta-rows">
          {list.map((r) => {
            const n = Number(r.count) || 0;
            const share = sum > 0 ? Math.round((n / sum) * 100) : 0;
            return (
              <li key={r.key}>
                <div className="ta-row-top">
                  <span className="ta-row-label" title={label(r.key, r)}>
                    {label(r.key, r)}
                    {badge ? <b className={'ta-tag is-' + badge(r)}>{badge(r)}</b> : null}
                  </span>
                  <span className="ta-row-count">
                    {whole(n)}
                    <em>{share}%</em>
                  </span>
                </div>
                {/* One hue, length carries the magnitude — these are ranked
                    amounts of one measure, not separate identities. */}
                <div
                  className="ta-bar"
                  role="img"
                  aria-label={label(r.key, r) + ': ' + whole(n) + ' of ' + whole(sum) + ', ' + share + '%'}
                >
                  <span style={{ width: Math.max(2, (n / peak) * 100) + '%' }} />
                </div>
                {showMoney && (r.totals || []).length > 0 ? (
                  <div className="ta-row-money">
                    {r.totals.map((t) => (
                      <span className="nb" key={t.currency}>{money(t.amount)} {t.currency}</span>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
