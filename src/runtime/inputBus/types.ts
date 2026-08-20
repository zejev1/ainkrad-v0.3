import type { JsonObject, JsonValue } from '../../core/json';

export type InputSource =
  | 'agent'
  | 'world'
  | 'player'
  | 'system'
  | 'cardinal';

export type InputPayload = JsonObject;

export interface InputEnvelope {
  eventId: string;
  worldId: string;
  source: InputSource;
  type: string;
  createdAt: number;
  payload: InputPayload;
  deduplicationKey?: string;
  correlationId?: string;
}

// Transport messages should carry identifiers and small command/event data, not
// serialized worlds, memory histories or NPC arrays.
export const MAX_INPUT_ENVELOPE_BYTES = 16 * 1024;
const MAX_JSON_DEPTH = 32;
const ALLOWED_INPUT_SOURCES = new Set<string>([
  'agent',
  'world',
  'player',
  'system',
  'cardinal',
]);

function assertJsonValue(
  value: unknown,
  path: string,
  depth: number,
  ancestors: Set<object>,
): asserts value is JsonValue {
  if (depth > MAX_JSON_DEPTH) {
    throw new Error(`Input JSON exceeds maximum nesting depth at ${path}.`);
  }

  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`Input JSON number must be finite at ${path}.`);
    }
    return;
  }

  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      throw new Error(`Input JSON must not contain cycles at ${path}.`);
    }
    ancestors.add(value);
    value.forEach((item, index) =>
      assertJsonValue(item, `${path}[${index}]`, depth + 1, ancestors),
    );
    ancestors.delete(value);
    return;
  }

  if (typeof value === 'object' && value !== null) {
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      throw new Error(`Input JSON object must be a plain object at ${path}.`);
    }
    if (ancestors.has(value)) {
      throw new Error(`Input JSON must not contain cycles at ${path}.`);
    }
    ancestors.add(value);
    for (const [key, item] of Object.entries(value)) {
      assertJsonValue(item, `${path}.${key}`, depth + 1, ancestors);
    }
    ancestors.delete(value);
    return;
  }

  throw new Error(`Input payload contains a non-JSON value at ${path}.`);
}

export function assertValidInputEnvelope(event: InputEnvelope): void {
  if (!event || typeof event !== 'object') {
    throw new Error('Input envelope must be an object.');
  }
  if (typeof event.eventId !== 'string' || !event.eventId.trim()) {
    throw new Error('Input eventId must not be empty.');
  }
  if (typeof event.worldId !== 'string' || !event.worldId.trim()) {
    throw new Error('Input worldId must not be empty.');
  }
  if (typeof event.type !== 'string' || !event.type.trim()) {
    throw new Error('Input type must not be empty.');
  }
  if (typeof event.source !== 'string' || !ALLOWED_INPUT_SOURCES.has(event.source)) {
    throw new Error('Input source is not in the runtime allowlist.');
  }
  if (!Number.isFinite(event.createdAt)) {
    throw new Error('Input createdAt must be finite.');
  }
  if (
    event.deduplicationKey !== undefined &&
    (typeof event.deduplicationKey !== 'string' || !event.deduplicationKey.trim())
  ) {
    throw new Error('Input deduplicationKey must not be empty when provided.');
  }
  if (
    event.correlationId !== undefined &&
    (typeof event.correlationId !== 'string' || !event.correlationId.trim())
  ) {
    throw new Error('Input correlationId must not be empty when provided.');
  }
  if (
    !event.payload ||
    typeof event.payload !== 'object' ||
    Array.isArray(event.payload) ||
    Object.getPrototypeOf(event.payload) !== Object.prototype
  ) {
    throw new Error('Input payload must be a plain JSON object.');
  }

  assertJsonValue(event.payload, 'payload', 0, new Set<object>());
  assertSmallInputEnvelope(event);
}

export function assertSmallInputEnvelope(event: InputEnvelope): void {
  const serialized = JSON.stringify(event);
  const bytes = new TextEncoder().encode(serialized).byteLength;
  if (bytes > MAX_INPUT_ENVELOPE_BYTES) {
    throw new Error(
      `Input envelope is ${bytes} bytes; Ainkrad limit is ${MAX_INPUT_ENVELOPE_BYTES} bytes.`,
    );
  }
}
