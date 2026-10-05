/** A copy of `set` with `value` added, or removed if it was there — for a
 * chip or checkbox toggling one item of a signal-held set. */
export function toggled<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (!next.delete(value)) next.add(value);
  return next;
}
