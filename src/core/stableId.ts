import { stableJsonStringify } from './stableJson';

function fnv1a32(value: string, seed: number): number {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Deterministic logical ID. This is for replay/idempotency, not security.
 * Infrastructure randomness must not decide whether a logical operation is the
 * same operation after a retry or process restart.
 */
export function createStableId(prefix: string, value: unknown): string {
  if (!prefix.trim()) {
    throw new Error('Stable ID prefix must not be empty.');
  }
  const text = stableJsonStringify(value);
  const a = fnv1a32(text, 2166136261).toString(16).padStart(8, '0');
  const b = fnv1a32(text, 0x9e3779b9).toString(16).padStart(8, '0');
  return `${prefix}_${a}${b}`;
}
