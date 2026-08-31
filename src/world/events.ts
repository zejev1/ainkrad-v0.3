import type { JsonObject } from '../core/json';

export type WorldEventSource =
  | 'agent'
  | 'world'
  | 'player'
  | 'system'
  | 'cardinal'
  | 'auditor';

export interface WorldEvent {
  eventId: string;
  worldId: string;
  kind: string;
  source: WorldEventSource;
  /** Technical ordering/idempotency coordinate only. */
  occurredAt: number;
  /** Canonical semantic time for modern v0.3.15 evidence. */
  occurredWorldMinutes?: number;
  /** Epoch identity is optional only for historical pre-v0.3.15 events. */
  worldEpoch?: number;
  payload: JsonObject;

  // If present, this event is also an active signal until this time.
  // Expiration only ends current influence. The historical event remains.
  activeUntil?: number;
  /** Canonical expiration; authoritative when present. */
  activeUntilWorldMinutes?: number;

  correlationId?: string;
}

export interface AppendEventResult {
  appended: boolean;
  duplicate: boolean;
}

// Cardinal sensors receive this read-only capability, never EventStore itself.
// Every method in this interface must be observational: reads may not compact,
// delete or otherwise mutate experiment history or current projections.
export interface EventReader {
  get(worldId: string, eventId: string): Promise<WorldEvent | undefined>;
  history(worldId: string): Promise<WorldEvent[]>;
  recent(
    worldId: string,
    limit: number,
    atOrBefore?: number,
  ): Promise<WorldEvent[]>;
  activeSignals(
    worldId: string,
    now: number,
    worldMinutes?: number,
  ): Promise<WorldEvent[]>;
}

export interface EventWriter {
  append(event: WorldEvent): Promise<AppendEventResult>;
}

export interface EventStore extends EventReader, EventWriter {}
