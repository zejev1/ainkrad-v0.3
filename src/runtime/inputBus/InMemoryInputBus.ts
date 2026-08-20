import type {
  ClaimedInput,
  InputBus,
  PublishResult,
} from './InputBus';
import { stableJsonStringify } from '../../core/stableJson';
import { assertValidInputEnvelope, type InputEnvelope } from './types';

interface ClaimState {
  consumerId: string;
  claimToken: string;
  leaseUntil: number;
}

interface QueueItem {
  event: InputEnvelope;
  claim?: ClaimState;
}

export class InMemoryInputBus implements InputBus {
  private readonly queues = new Map<string, QueueItem[]>();
  private readonly itemIndex = new Map<string, Map<string, QueueItem>>();
  private readonly seenKeys = new Map<
    string,
    { recordedAt: number; fingerprint: string }
  >();
  private claimSequence = 0;

  async publish(event: InputEnvelope): Promise<PublishResult> {
    assertValidInputEnvelope(event);
    const eventKey = this.eventKey(event.worldId, event.eventId);
    const dedupeKey = event.deduplicationKey
      ? `${event.worldId}:dedupe:${event.deduplicationKey}`
      : undefined;

    const eventFingerprint = stableJsonStringify(event);
    const dedupeFingerprint = stableJsonStringify({
      worldId: event.worldId,
      source: event.source,
      type: event.type,
      payload: event.payload,
      correlationId: event.correlationId,
    });

    const priorEvent = this.seenKeys.get(eventKey);
    if (priorEvent) {
      if (priorEvent.fingerprint !== eventFingerprint) {
        throw new Error(
          `Input event ID ${event.eventId} was reused with different content.`,
        );
      }
      return { accepted: false, duplicate: true };
    }

    if (dedupeKey !== undefined) {
      const priorDedupe = this.seenKeys.get(dedupeKey);
      if (priorDedupe) {
        if (priorDedupe.fingerprint !== dedupeFingerprint) {
          throw new Error(
            `Input deduplication key ${event.deduplicationKey} was reused with different logical content.`,
          );
        }
        return { accepted: false, duplicate: true };
      }
    }

    const recordedAt = Date.now();
    this.seenKeys.set(eventKey, { recordedAt, fingerprint: eventFingerprint });
    if (dedupeKey) {
      this.seenKeys.set(dedupeKey, {
        recordedAt,
        fingerprint: dedupeFingerprint,
      });
    }

    const item: QueueItem = {
      event: structuredClone(event),
    };

    const queue = this.queues.get(event.worldId) ?? [];
    queue.push(item);
    this.queues.set(event.worldId, queue);

    const worldIndex = this.itemIndex.get(event.worldId) ?? new Map<string, QueueItem>();
    worldIndex.set(event.eventId, item);
    this.itemIndex.set(event.worldId, worldIndex);

    return {
      accepted: true,
      duplicate: false,
    };
  }

  async claim(
    worldId: string,
    consumerId: string,
    limit: number,
    now: number,
    leaseMs: number,
  ): Promise<ClaimedInput[]> {
    if (!consumerId.trim()) {
      throw new Error('InputBus consumerId must not be empty.');
    }
    if (!Number.isFinite(now)) {
      throw new Error('InputBus claim time must be finite.');
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      throw new Error('InputBus claim limit must be an integer from 1 to 1000.');
    }
    if (!Number.isFinite(leaseMs) || leaseMs <= 0) {
      throw new Error('InputBus leaseMs must be greater than zero.');
    }

    const queue = this.queues.get(worldId) ?? [];
    const claimed: ClaimedInput[] = [];

    for (const item of queue) {
      if (claimed.length >= limit) {
        break;
      }
      if (item.claim && item.claim.leaseUntil > now) {
        continue;
      }

      this.claimSequence += 1;
      const claimToken = [
        'claim',
        worldId,
        item.event.eventId,
        consumerId,
        now.toString(36),
        this.claimSequence.toString(36),
      ].join(':');

      item.claim = {
        consumerId,
        claimToken,
        leaseUntil: now + leaseMs,
      };

      claimed.push({
        event: structuredClone(item.event),
        claimToken,
        consumerId,
        leaseUntil: now + leaseMs,
      });
    }

    return claimed;
  }

  async acknowledge(
    worldId: string,
    eventId: string,
    consumerId: string,
    claimToken: string,
    _acknowledgedAt: number,
  ): Promise<void> {
    const item = this.findItem(worldId, eventId);

    // A repeated acknowledgement after successful technical cleanup is safe.
    if (!item && this.seenKeys.has(this.eventKey(worldId, eventId))) {
      return;
    }

    if (!item) {
      throw new Error(`Input ${eventId} was not found in world ${worldId}.`);
    }

    this.assertClaim(item, consumerId, claimToken);

    // Queue rows are purely technical. Once acknowledged, remove immediately.
    // Dedupe tombstones remain until their explicit bounded cleanup window.
    const queue = this.queues.get(worldId) ?? [];
    this.queues.set(
      worldId,
      queue.filter((candidate) => candidate !== item),
    );
    const worldIndex = this.itemIndex.get(worldId);
    worldIndex?.delete(eventId);
    if (worldIndex?.size === 0) {
      this.itemIndex.delete(worldId);
    }
    if ((this.queues.get(worldId) ?? []).length === 0) {
      this.queues.delete(worldId);
    }
  }

  async release(
    worldId: string,
    eventId: string,
    consumerId: string,
    claimToken: string,
  ): Promise<void> {
    const item = this.findItem(worldId, eventId);
    if (!item) {
      return;
    }

    this.assertClaim(item, consumerId, claimToken);
    item.claim = undefined;
  }

  // Dedupe tombstones are technical data. A persistent adapter should use an
  // explicit bounded idempotency window rather than growing forever. Tombstones
  // for queue items that are still unacknowledged are never pruned: otherwise a
  // duplicate publish could create a second live row with the same event ID.
  pruneDeduplication(before: number): number {
    if (!Number.isFinite(before)) {
      throw new Error('InputBus deduplication cutoff must be finite.');
    }

    const protectedKeys = new Set<string>();
    for (const [worldId, queue] of this.queues) {
      for (const item of queue) {
        protectedKeys.add(this.eventKey(worldId, item.event.eventId));
        if (item.event.deduplicationKey) {
          protectedKeys.add(`${worldId}:dedupe:${item.event.deduplicationKey}`);
        }
      }
    }

    let removed = 0;
    for (const [key, record] of this.seenKeys) {
      if (record.recordedAt <= before && !protectedKeys.has(key)) {
        this.seenKeys.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  private findItem(worldId: string, eventId: string): QueueItem | undefined {
    return this.itemIndex.get(worldId)?.get(eventId);
  }

  private eventKey(worldId: string, eventId: string): string {
    return `${worldId}:event:${eventId}`;
  }

  private assertClaim(
    item: QueueItem,
    consumerId: string,
    claimToken: string,
  ): void {
    if (
      !item.claim ||
      item.claim.consumerId !== consumerId ||
      item.claim.claimToken !== claimToken
    ) {
      throw new Error(`Input ${item.event.eventId} is not owned by this claim.`);
    }
  }
}
