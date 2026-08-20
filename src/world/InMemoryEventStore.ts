import type {
  EventStore,
  WorldEvent,
} from './events';

export class InMemoryEventStore
implements EventStore {
  private readonly events:
    WorldEvent[] = [];

  async append(
    event: WorldEvent,
  ): Promise<void> {
    if (
      this.events.some(
        (existing) =>
          existing.eventId ===
          event.eventId,
      )
    ) {
      throw new Error(
        `Duplicate world event ID: ${event.eventId}`,
      );
    }

    this.events.push(
      structuredClone(event),
    );
  }

  async history(
    worldId: string,
  ): Promise<WorldEvent[]> {
    return this.events
      .filter(
        (event) =>
          event.worldId ===
          worldId,
      )
      .map(
        (event) =>
          structuredClone(event),
      );
  }

  async recent(
    worldId: string,
    limit: number,
  ): Promise<WorldEvent[]> {
    const matching =
      this.events.filter(
        (event) =>
          event.worldId ===
          worldId,
      );

    return matching
      .slice(
        Math.max(
          0,
          matching.length -
            limit,
        ),
      )
      .map(
        (event) =>
          structuredClone(event),
      );
  }

  async active(
    worldId: string,
    now: number,
  ): Promise<WorldEvent[]> {
    return this.events
      .filter(
        (event) =>
          event.worldId ===
            worldId &&
          (
            event.activeUntil ===
              undefined ||
            event.activeUntil >
              now
          ),
      )
      .map(
        (event) =>
          structuredClone(event),
      );
  }
}
