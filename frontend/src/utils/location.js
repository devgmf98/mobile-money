/* Transactions store senderLocation / receiverLocation as a JSON string, and on
   some rows it is double-encoded. Reading `.city` straight off the field gives
   undefined, which is why receipts printed "Unknown, Unknown" for journeys that
   did carry a location. Everything that displays a location goes through here. */

export function parseLocation(raw) {
  if (!raw) return null;
  let v = raw;
  for (let i = 0; i < 2 && typeof v === 'string'; i++) {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  return v && typeof v === 'object' ? v : null;
}

/* A readable place, or null when the row genuinely has no location — callers
   should omit the line rather than print a placeholder. */
export function placeLabel(raw) {
  const loc = parseLocation(raw);
  if (!loc) return null;

  const named = [loc.city, loc.country].filter(Boolean).join(', ');
  if (named) return named;

  const lat = parseFloat(loc.latitude);
  const lon = parseFloat(loc.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return lat.toFixed(5) + ', ' + lon.toFixed(5);
  }
  return null;
}
