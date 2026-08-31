/* Placeholder rows shown while a list is loading. One component so every list
   in the app shimmers the same way, instead of each page inventing its own
   "Loading…" line. */
export default function SkeletonRows({ count = 4 }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div className="skeleton-row" key={i}>
          <span className="skeleton skeleton-circle skeleton-avatar" />
          <span>
            <span className="skeleton skeleton-line w-60" />
            <span className="skeleton skeleton-line is-sm w-40" />
          </span>
          <span className="skeleton skeleton-line skeleton-amount" />
        </div>
      ))}
      {/* The shimmer is decorative; screen readers get the state in words. */}
      <span className="sr-only" role="status">Loading…</span>
    </div>
  );
}
