import { stableJsonStringify } from '../core/stableJson';
import type {
  AppendEventResult,
  EventStore,
  WorldEvent,
} from './events';

function eventIndexKey(worldId: string, eventId: string): string {
  return `${worldId}::${eventId}`;
}

function sameEvent(a: WorldEvent, b: WorldEvent): boolean {
  return stableJsonStringify(a) === stableJsonStringify(b);
}

/** Standalone event-store reference for focused tests/tools. WorldEngine uses WorldStore so state and evidence share one commit boundary. */
export class InMemoryEventStore implements EventStore {
  private readonly byId = new Map<string, WorldEvent>();
  private readonly byWorld = new Map<string, WorldEvent[]>();

  // This is a current-state projection, not experiment history. Entries are
  // never removed as a side effect of a read. A future persistent adapter may
  // maintain/compact this projection in an explicit maintenance transaction.
  private readonly signalsByWorld = new Map<string, WorldEvent[]>();

  async append(event: WorldEvent): Promise<AppendEventResult> {
    const indexKey = eventIndexKey(event.worldId, event.eventId);
    const existing = this.byId.get(indexKey);

    if (existing) {
      if (!sameEvent(existing, event)) {
        throw new Error(
          `Event ID collision with different content in world ${event.worldId}: ${event.eventId}`,
        );
      }

      return {
        appended: false,
        duplicate: true,
      };
    }

    const stored = structuredClone(event);
    this.byId.set(indexKey, stored);

    const history = this.byWorld.get(stored.worldId) ?? [];
    history.push(stored);
    this.byWorld.set(stored.worldId, history);

    if (
      stored.activeUntil !== undefined ||
      stored.activeUntilWorldMinutes !== undefined
    ) {
      const signals = this.signalsByWorld.get(stored.worldId) ?? [];
      signals.push(stored);
      this.signalsByWorld.set(stored.worldId, signals);
    }

    return {
      appended: true,
      duplicate: false,
    };
  }

  async get(worldId: string, eventId: string): Promise<WorldEvent | undefined> {
    const event = this.byId.get(eventIndexKey(worldId, eventId));
    return event ? structuredClone(event) : undefined;
  }

  async history(worldId: string): Promise<WorldEvent[]> {
    return (this.byWorld.get(worldId) ?? []).map((event) => structuredClone(event));
  }

  async recent(
    worldId: string,
    limit: number,
    atOrBefore?: number,
  ): Promise<WorldEvent[]> {
    if (!Number.isInteger(limit) || limit < 0) {
      throw new Error('EventStore recent limit must be a non-negative integer.');
    }
    if (atOrBefore !== undefined && !Number.isFinite(atOrBefore)) {
      throw new Error('EventStore recent time bound must be finite.');
    }

    const history = (this.byWorld.get(worldId) ?? []).filter(
      (event) => atOrBefore === undefined || event.occurredAt <= atOrBefore,
    );
    return history
      .slice(Math.max(0, history.length - limit))
      .map((event) => structuredClone(event));
  }

  async activeSignals(
    worldId: string,
    now: number,
    worldMinutes?: number,
  ): Promise<WorldEvent[]> {
    if (!Number.isFinite(now)) {
      throw new Error('EventStore activeSignals time must be finite.');
    }
    if (
      worldMinutes !== undefined &&
      (!Number.isFinite(worldMinutes) || worldMinutes < 0)
    ) {
      throw new Error(
        'EventStore activeSignals worldMinutes must be finite and non-negative.',
      );
    }

    // Pure read: observing a future time must not destroy the ability to inspect
    // what was active at an earlier time. This matters for replay and auditing.
    return (this.signalsByWorld.get(worldId) ?? [])
      .filter(
        (event) => {
          if (
            worldMinutes !== undefined &&
            event.occurredWorldMinutes !== undefined &&
            event.activeUntilWorldMinutes !== undefined
          ) {
            return (
              event.occurredWorldMinutes <= worldMinutes &&
              event.activeUntilWorldMinutes > worldMinutes
            );
          }
          return (
            event.occurredAt <= now &&
            event.activeUntil !== undefined &&
            event.activeUntil > now
          );
        },
      )
      .map((event) => structuredClone(event));
  }
}
