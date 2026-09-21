import type { WorldState } from './types';

const nativeRequired = Symbol('native snapshot required');
/** Clone plain persisted data without the transport serializer. Preserve
 * undefined, sparse arrays, NaN/-0, aliases and cycles. Unexpected native
 * values use structuredClone for the entire graph to retain its semantics. */
export function clonePersistedData<T>(world: T): T {
  const seen = new Map<object, unknown>();
  function copy(value: any): any {
    if (value === null || typeof value !== 'object') {
      if (typeof value === 'function' || typeof value === 'symbol') throw nativeRequired;
      return value;
    }
    const prior = seen.get(value); if (prior !== undefined) return prior;
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    if (!array && prototype !== Object.prototype && prototype !== null) throw nativeRequired;
    const result: any = array ? new Array(value.length) : {};
    seen.set(value, result);
    for (const key of Object.keys(value)) {
      // Most saved fields are primitive numbers/strings. Avoid recursive calls
      // for those leaves while retaining native rejection of functions/symbols.
      const raw = value[key], kind = typeof raw;
      if (kind === 'function' || kind === 'symbol') throw nativeRequired;
      const child = raw !== null && kind === 'object' ? copy(raw) : raw;
      if (key === '__proto__') Object.defineProperty(result, key, { value: child, enumerable: true, writable: true, configurable: true });
      else result[key] = child;
    }
    return result;
  }
  try { return copy(world); }
  catch (error) { if (error !== nativeRequired) throw error; return structuredClone(world); }
}

export function cloneWorldState(world: Readonly<WorldState>): WorldState {
  return clonePersistedData(world);
}
