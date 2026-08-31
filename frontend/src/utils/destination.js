/* An admin's destination is stored by name ("JUBA"), so matching it against
   the destination list is a string comparison — done in one place so the
   dashboard and the send page cannot drift apart on casing or stray spaces. */
export function findDestination(states, value) {
  if (!value) return null;
  const wanted = String(value).trim().toLowerCase();
  return (states || []).find(s => String(s.name || '').trim().toLowerCase() === wanted) || null;
}
