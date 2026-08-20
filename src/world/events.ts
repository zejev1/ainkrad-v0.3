import type {
  JsonObject,
} from '../core/json';

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
  occurredAt: number;
  payload: JsonObject;

  // Active influence lifetime.
  // This is NOT a delete-after timestamp.
  activeUntil?: number;

  correlationId?: string;
}

export interface EventStore {
  append(
    event: WorldEvent,
  ): Promise<void>;

  history(
    worldId: string,
  ): Promise<WorldEvent[]>;

  recent(
    worldId: string,
    limit: number,
  ): Promise<WorldEvent[]>;

  active(
    worldId: string,
    now: number,
  ): Promise<WorldEvent[]>;
}
