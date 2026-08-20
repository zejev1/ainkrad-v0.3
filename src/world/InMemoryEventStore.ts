import type {
  AppendEventResult,
  EventStore,
  WorldEvent,
} from './events';

function sameEvent(a: WorldEvent, b: WorldEvent): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export class InMemoryEventStore implements EventStore {
  private readonly byId = new Map<string, WorldEvent>();
  private readonly byWorld = new Map<string, WorldEvent[]>();

  // This is a current-state projection, not experiment history. Expired rows
  // may be removed from this projection while remaining in byWorld forever.
  private readonly activeByWorld = new Map<string, WorldEvent[]>();

  async append(event: WorldEvent): Promise<AppendEventResult> {
    const existing = this.byId.get(event.eventId);

    if (existing) {
      if (!sameEvent(existing, event)) {
        throw new Error(
          `Event ID collision with different content: ${event.eventId}`,
        );
      }

      return {
        appended: false,
        duplicate: true,
      };
    }

    const stored = structuredClone(event);
    this.byId.set(stored.eventId, stored);

    const history = this.byWorld.get(stored.worldId) ?? [];
    history.push(stored);
    this.byWorld.set(stored.worldId, history);

    if (stored.activeUntil !== undefined) {
      const active = this.activeByWorld.get(stored.worldId) ?? [];
      active.push(stored);
      this.activeByWorld.set(stored.worldId, active);
    }

    return {
      appended: true,
      duplicate: false,
    };
  }

  async history(worldId: string): Promise<WorldEvent[]> {
    return (this.byWorld.get(worldId) ?? []).map((event) => structuredClone(event));
  }

  async recent(worldId: string, limit: number): Promise<WorldEvent[]> {
    if (!Number.isInteger(limit) || limit < 0) {
      throw new Error('EventStore recent limit must be a non-negative integer.');
    }

    const history = this.byWorld.get(worldId) ?? [];
    return history
      .slice(Math.max(0, history.length - limit))
      .map((event) => structuredClone(event));
  }

  async activeSignals(worldId: string, now: number): Promise<WorldEvent[]> {
    const candidates = this.activeByWorld.get(worldId) ?? [];
    const active = candidates.filter(
      (event) => event.activeUntil !== undefined && event.activeUntil > now,
    );

    // Compact only the active projection. Historical evidence in byWorld is
    // untouched, which is the key retention invariant.
    this.activeByWorld.set(worldId, active);
    return active.map((event) => structuredClone(event));
  }
}
