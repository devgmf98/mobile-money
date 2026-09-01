import { useMemo, useState } from 'react';
import { typeLabel } from '../data/transactionTypes';
import '../styles/type-trend-chart.css';

/* ==========================================================================
   Transactions over time, one line per type.

   The job is change-over-time split by category, which is what a multi-series
   line is for. Counts, not amounts: the types are denominated differently — an
   exchange in USD, a destination push in SSP — so summing across them would
   produce a number that means nothing.

   Colour is keyed to the TYPE, never to the series' rank, so a quiet week that
   drops one type does not repaint the others. The slots are the validated
   categorical order from the dataviz palette, reordered to lead with the aqua
   nearest this app's green; all six pass CVD separation against both the light
   and the dark surface. A seventh type folds into "Other" rather than inventing
   a hue.
   ========================================================================== */

const SLOTS = ['s1', 's2', 's3', 's4', 's5', 's6'];
const MAX_SERIES = 6;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/* Each range carries its own bucket size. They cannot all be days: "Today" as
   daily buckets is a single point, which is not a line, and a year as daily
   buckets is 365 of them crushed into the same width. */
const RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Weekly' },
  { key: 'month', label: 'Monthly' },
  { key: 'year', label: 'Yearly' },
];

const startOfHour = (d) => {
  const x = new Date(d);
  x.setMinutes(0, 0, 0);
  return x.getTime();
};

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

const startOfMonth = (d) => {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

/* The buckets for a range, plus the function that decides which bucket a
   timestamp belongs to. Keeping them together is what stops the two drifting —
   a bucket list built by day and a key computed by hour silently plots
   nothing. */
function rangeModel(range) {
  const now = new Date();

  if (range === 'today') {
    const base = startOfDay(now);
    return {
      starts: Array.from({ length: 24 }, (_, h) => base + h * HOUR),
      keyOf: startOfHour,
      /* "09:00" rather than a bare "9" — an axis of loose numbers under a
         count axis of loose numbers is ambiguous. */
      tick: (t) => new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
      full: (t) => new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    };
  }

  if (range === 'year') {
    const base = startOfMonth(now);
    const starts = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(base);
      d.setMonth(d.getMonth() - (11 - i));
      return d.getTime();
    });
    return {
      starts,
      keyOf: startOfMonth,
      tick: (t) => new Date(t).toLocaleDateString(undefined, { month: 'short' }),
      full: (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
    };
  }

  const days = range === 'week' ? 7 : 30;
  const base = startOfDay(now);
  return {
    starts: Array.from({ length: days }, (_, i) => base - (days - 1 - i) * DAY),
    keyOf: startOfDay,
    tick: (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    full: (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  };
}

/* A smooth cubic through the points, like the reference. The control points
   are clamped to each segment so the curve cannot dip below zero between two
   low counts the way a plain cardinal spline does. */
function smoothPath(pts) {
  if (!pts.length) return '';
  if (pts.length < 2) return 'M ' + pts[0].x + ' ' + pts[0].y;
  const d = ['M ' + pts[0].x + ' ' + pts[0].y];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const lo = Math.min(p1.y, p2.y);
    const hi = Math.max(p1.y, p2.y);
    const clamp = (v) => Math.max(lo, Math.min(hi, v));
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = clamp(p1.y + (p2.y - p0.y) / 6);
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = clamp(p2.y - (p3.y - p1.y) / 6);
    d.push('C ' + c1x + ' ' + c1y + ', ' + c2x + ' ' + c2y + ', ' + p2.x + ' ' + p2.y);
  }
  return d.join(' ');
}

export default function TypeTrendChart({ transactions = [], defaultRange = 'today' }) {
  const [range, setRange] = useState(defaultRange);
  const [hover, setHover] = useState(null);

  const model = useMemo(() => {
    const { starts, keyOf, tick, full } = rangeModel(range);
    const index = new Map(starts.map((t, i) => [t, i]));
    const n = starts.length;

    const totals = {};
    const byType = {};
    for (const tx of transactions) {
      const stamp = tx.createdAt || tx.date;
      if (!stamp) continue;
      const slot = index.get(keyOf(stamp));
      if (slot === undefined) continue; // outside the window
      const type = tx.type || 'unknown';
      if (!byType[type]) byType[type] = new Array(n).fill(0);
      byType[type][slot] += 1;
      totals[type] = (totals[type] || 0) + 1;
    }

    /* The busiest types keep their own line; the tail is summed into Other, so
       the palette is never cycled past its validated length. */
    const ranked = Object.keys(totals).sort((a, b) => totals[b] - totals[a]);
    const kept = ranked.slice(0, MAX_SERIES);
    const rest = ranked.slice(MAX_SERIES);

    const series = kept.map((type, i) => ({
      key: type,
      label: typeLabel(type),
      slot: SLOTS[i],
      total: totals[type],
      values: byType[type],
    }));

    if (rest.length) {
      const merged = new Array(n).fill(0);
      rest.forEach((t) => byType[t].forEach((v, i) => { merged[i] += v; }));
      series.push({
        key: '__other',
        label: 'Other (' + rest.length + ')',
        slot: SLOTS[MAX_SERIES - 1],
        total: rest.reduce((acc, t) => acc + totals[t], 0),
        values: merged,
      });
    }

    const peak = Math.max(1, ...series.flatMap((s) => s.values));
    const counted = series.reduce((acc, s) => acc + s.total, 0);
    return { buckets: starts, series, peak, tick, full, counted };
  }, [transactions, range]);

  const { buckets, series, peak, tick, full, counted } = model;

  const picker = (
    <div className="ttc-ranges" role="group" aria-label="Time range">
      {RANGES.map((r) => (
        <button
          key={r.key}
          type="button"
          className={'ttc-range' + (range === r.key ? ' is-on' : '')}
          aria-pressed={range === r.key}
          onClick={() => { setRange(r.key); setHover(null); }}
        >
          {r.label}
        </button>
      ))}
    </div>
  );

  const W = 720;
  const H = 240;
  const pad = { l: 34, r: 12, t: 14, b: 26 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const x = (i) => pad.l + (buckets.length === 1 ? iw / 2 : (i / (buckets.length - 1)) * iw);
  const y = (v) => pad.t + ih - (v / peak) * ih;

  /* Whole-number gridlines only — a count axis reading 2.5 is nonsense. */
  const step = Math.max(1, Math.ceil(peak / 4));
  const ticks = [];
  for (let v = 0; v <= peak; v += step) ticks.push(v);

  const midpoint = Math.floor((buckets.length - 1) / 2);

  return (
    <div className="ttc">
      {/* One row of presets above the plot — the control every reader reaches
          for first, and the only filter this chart has. */}
      <div className="ttc-head">
        {picker}
        <span className="ttc-count">
          {counted === 0 ? 'No activity' : counted + (counted === 1 ? ' transaction' : ' transactions')}
        </span>
      </div>

      {!series.length ? (
        <div className="ttc-empty">
          Nothing recorded for this range. Activity will chart here as it happens.
        </div>
      ) : (
        <>
          <div className="ttc-plot">
            <svg
              viewBox={'0 0 ' + W + ' ' + H}
              className="ttc-svg"
              role="img"
              aria-label={'Transactions by type, ' + range}
            >
              <defs>
                {series.map((s) => (
                  <linearGradient key={s.key} id={'ttc-fill-' + s.slot} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" className={'ttc-stop-a ttc-' + s.slot} />
                    <stop offset="100%" className={'ttc-stop-b ttc-' + s.slot} />
                  </linearGradient>
                ))}
              </defs>

              {ticks.map((v) => (
                <g key={v}>
                  <line className="ttc-grid" x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} />
                  <text className="ttc-axis" x={pad.l - 8} y={y(v)} dy="0.32em" textAnchor="end">{v}</text>
                </g>
              ))}

              {buckets.map((t, i) =>
                (i === 0 || i === buckets.length - 1 || i === midpoint) ? (
                  <text key={t} className="ttc-axis" x={x(i)} y={H - 8} textAnchor="middle">
                    {tick(t)}
                  </text>
                ) : null
              )}

              {series.map((s, si) => {
                const pts = s.values.map((v, i) => ({ x: x(i), y: y(v) }));
                const line = smoothPath(pts);
                const dim = hover && hover.series && hover.series !== s.key;
                /* Only the busiest series is filled. Filling all of them
                   stacked five translucent gradients on top of each other and
                   the overlap turned to mud; one filled area anchors the eye
                   and the rest read cleanly as lines over it. */
                const filled = si === 0;
                const area = line +
                  ' L ' + pts[pts.length - 1].x + ' ' + y(0) +
                  ' L ' + pts[0].x + ' ' + y(0) + ' Z';
                return (
                  <g key={s.key} className={'ttc-series ttc-' + s.slot + (dim ? ' is-dim' : '')}>
                    {filled ? (
                      <path className="ttc-area" d={area} fill={'url(#ttc-fill-' + s.slot + ')'} />
                    ) : null}
                    <path className="ttc-line" d={line} />
                  </g>
                );
              })}

              {hover ? (
                <g className="ttc-cursor">
                  <line className="ttc-crosshair" x1={x(hover.i)} x2={x(hover.i)} y1={pad.t} y2={pad.t + ih} />
                  {series.map((s) => (
                    <circle key={s.key} className={'ttc-dot ttc-' + s.slot}
                            cx={x(hover.i)} cy={y(s.values[hover.i])} r="4.5" />
                  ))}
                </g>
              ) : null}

              {/* Full-height hit areas: a 2px line is far too small a target. */}
              {buckets.map((t, i) => (
                <rect
                  key={t}
                  className="ttc-hit"
                  x={x(i) - iw / (buckets.length * 2)}
                  y={pad.t}
                  width={iw / buckets.length}
                  height={ih}
                  onMouseEnter={() => setHover({ i })}
                  onMouseLeave={() => setHover(null)}
                />
              ))}
            </svg>

            {hover ? (
              <div
                className={'ttc-tip' + (hover.i > buckets.length / 2 ? ' is-left' : '')}
                style={{ left: (x(hover.i) / W) * 100 + '%' }}
              >
                <span className="ttc-tip-day">{full(buckets[hover.i])}</span>
                {series.filter((s) => s.values[hover.i] > 0).map((s) => (
                  <span className="ttc-tip-row" key={s.key}>
                    <i className={'ttc-swatch ttc-' + s.slot} />
                    <span className="ttc-tip-label">{s.label}</span>
                    <b>{s.values[hover.i]}</b>
                  </span>
                ))}
                {series.every((s) => s.values[hover.i] === 0) ? (
                  <span className="ttc-tip-row ttc-tip-none">No transactions</span>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Identity never rests on hue alone: every series is named, with its
              total beside it. This is also the relief the palette's contrast
              warning requires against a light surface. */}
          <ul className="ttc-legend">
            {series.map((s) => (
              <li
                key={s.key}
                className={'ttc-legend-item' + (hover && hover.series === s.key ? ' is-on' : '')}
                onMouseEnter={() => setHover({ i: (hover && hover.i) != null ? hover.i : buckets.length - 1, series: s.key })}
                onMouseLeave={() => setHover(null)}
              >
                <i className={'ttc-swatch ttc-' + s.slot} />
                <span className="ttc-legend-label">{s.label}</span>
                <b>{s.total}</b>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
