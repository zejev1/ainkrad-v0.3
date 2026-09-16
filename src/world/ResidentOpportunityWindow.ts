/** A persisted round-robin cursor schedules opportunities, never consent.
 * Unlike tick % count, it visits every stable candidate even when the check
 * interval and population share a divisor. Stable keys survive insertions,
 * removals and save/reload; no RNG or protected personality state is touched.
 */
export function residentOpportunityWindow<T>(
  candidates: readonly T[],
  keyOf: (candidate: T) => string,
  limit: number,
  afterKey?: string,
): { candidates: T[]; afterKey?: string } {
  if (!Number.isFinite(limit) || limit < 0) {
    throw new Error('Opportunity limit must be finite and non-negative.');
  }
  const ordered = candidates.map(candidate => ({ candidate, key: keyOf(candidate) }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const count = Math.min(ordered.length, Math.floor(limit));
  if (count === 0) return { candidates: [], afterKey };
  const next = afterKey === undefined ? 0 : ordered.findIndex(item => item.key.localeCompare(afterKey) > 0);
  const start = next < 0 ? 0 : next;
  const selected = Array.from({ length: count }, (_, index) => ordered[(start + index) % ordered.length]);
  return { candidates: selected.map(item => item.candidate), afterKey: selected.at(-1)!.key };
}
