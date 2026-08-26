import { useState } from 'react';
import '../styles/composition-chart.css';

/* ==========================================================================
   Composition chart — part-to-whole as a single horizontal stacked bar.

   Chosen over a pie/one-bar chart because these breakdowns are usually tiny
   (one role, one status) and grow later. A pie of one slice reads as broken;
   this reads as "100% of N", and segments appear as the data diversifies.

   Colour is assigned per ENTITY (role/status name), never by rank, so
   filtering or a count change never repaints the survivors. Identity is
   carried by the legend + values, never by hue alone.
   ========================================================================== */

const pct = (v, total) => (total > 0 ? (v / total) * 100 : 0);

const fmt = (n) => Number(n || 0).toLocaleString('en-US');

export default function CompositionChart({ rows = [], scheme = 'role', caption }) {
  const [hover, setHover] = useState(null);

  const clean = rows.filter((r) => Number(r.value) > 0);
  const total = clean.reduce((n, r) => n + Number(r.value), 0);

  if (!clean.length || total <= 0) return null;

  return (
    <div className="comp-chart">
      <div className="comp-total">
        <strong>{fmt(total)}</strong>
        <span>{caption}</span>
      </div>

      {/* the bar. 2px gaps in the surface colour separate segments — no borders,
          which would add ink that isn't data. */}
      <div
        className="comp-track"
        role="img"
        aria-label={clean.map((r) => `${r.name}: ${fmt(r.value)}`).join(', ')}
        onMouseLeave={() => setHover(null)}
      >
        {clean.map((r) => (
          <div
            key={r.key}
            className={'comp-seg' + (hover && hover.key !== r.key ? ' is-dim' : '')}
            data-scheme={scheme}
            data-key={r.key}
            style={{ flexGrow: Number(r.value) }}
            onMouseEnter={() => setHover(r)}
          />
        ))}
      </div>

      {/* No hover tooltip: it repeated the legend row verbatim (dot, name,
          value, percent) and reserved 30px even when hidden. Every value is
          directly labelled below, so hovering only dims the other segments to
          tie a segment to its row. */}

      {/* Legend doubles as the value table: every figure is visible, so nothing
          depends on colour or on hovering. */}
      <ul className="comp-legend">
        {clean.map((r) => (
          <li
            key={r.key}
            className={hover && hover.key !== r.key ? 'is-dim' : ''}
            onMouseEnter={() => setHover(r)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="comp-dot" data-scheme={scheme} data-key={r.key} />
            <span className="comp-name">{r.name}</span>
            <span className="comp-val">{fmt(r.value)}</span>
            <span className="comp-pct">{pct(r.value, total).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
