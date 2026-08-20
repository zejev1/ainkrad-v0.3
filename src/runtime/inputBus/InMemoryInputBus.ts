import type {
  InputBus,
  PublishResult,
} from './InputBus';

import type {
  InputEnvelope,
} from './types';

interface QueueItem {
  event: InputEnvelope;
  acknowledged: boolean;
}

export class InMemoryInputBus
implements InputBus {
  private readonly queues =
    new Map<string, QueueItem[]>();

  private readonly seenKeys =
    new Set<string>();

  async publish(
    event: InputEnvelope,
  ): Promise<PublishResult> {
    const eventKey =
      `${event.worldId}:event:${event.eventId}`;

    const dedupeKey =
      event.deduplicationKey
        ? `${event.worldId}:dedupe:${event.deduplicationKey}`
        : undefined;

    if (
      this.seenKeys.has(eventKey) ||
      (
        dedupeKey !== undefined &&
        this.seenKeys.has(dedupeKey)
      )
    ) {
      return {
        accepted: false,
        duplicate: true,
      };
    }

    this.seenKeys.add(eventKey);

    if (dedupeKey) {
      this.seenKeys.add(dedupeKey);
    }

    const queue =
      this.queues.get(event.worldId) ??
      [];

    queue.push({
      event,
      acknowledged: false,
    });

    this.queues.set(
      event.worldId,
      queue,
    );

    return {
      accepted: true,
      duplicate: false,
    };
  }

  async take(
    worldId: string,
    limit: number,
  ): Promise<InputEnvelope[]> {
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 1000
    ) {
      throw new Error(
        'InputBus take limit must be an integer from 1 to 1000.',
      );
    }

    const queue =
      this.queues.get(worldId) ??
      [];

    return queue
      .filter(
        (item) =>
          !item.acknowledged,
      )
      .slice(0, limit)
      .map(
        (item) =>
          structuredClone(item.event),
      );
  }

  async acknowledge(
    eventId: string,
  ): Promise<void> {
    for (
      const queue of
      this.queues.values()
    ) {
      const item =
        queue.find(
          (candidate) =>
            candidate.event.eventId ===
            eventId,
        );

      if (item) {
        item.acknowledged = true;
        return;
      }
    }
  }

  pruneAcknowledged(
    worldId: string,
    maxItems = 1000,
  ): number {
    const queue =
      this.queues.get(worldId);

    if (!queue) {
      return 0;
    }

    let removed = 0;

    const kept =
      queue.filter(
        (item) => {
          if (
            item.acknowledged &&
            removed < maxItems
          ) {
            removed += 1;
            return false;
          }

          return true;
        },
      );

    this.queues.set(
      worldId,
      kept,
    );

    return removed;
  }
}
