/* Placeholder stat cards, shown while a card group's data is in flight.
   Used where the number of cards is not known ahead of time — the
   per-currency groups — so there is no real label to show yet.

   Deliberately built from .stat-card / .stat-icon / .stat-content, the same
   classes a real card uses. A parallel set of layout classes drifted from
   them immediately: the copy column ended up zero-wide and the lines
   vanished. Borrowing the real structure means the placeholder is the same
   shape as what replaces it. */
export default function SkeletonCards({ count = 2 }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div className="stat-card" key={i} aria-hidden="true">
          <span className="stat-icon skeleton skeleton-icon" />
          <div className="stat-content">
            <span className="skeleton skeleton-line is-sm skeleton-w-label" />
            <span className="skeleton skeleton-line is-lg skeleton-w-value" />
          </div>
        </div>
      ))}
      <span className="sr-only" role="status">Loading</span>
    </>
  );
}
