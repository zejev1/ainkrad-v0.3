import { describe, expect, it } from 'vitest';
import { InMemoryInputBus } from '../src/runtime/inputBus/InMemoryInputBus';
import { createInputEnvelope } from '../src/runtime/inputBus/createEnvelope';

describe('InputBus', () => {
  it('deduplicates without a shared global sequence counter', async () => {
    const bus = new InMemoryInputBus();
    const event = createInputEnvelope({
      eventId: 'evt_1',
      worldId: 'world_1',
      source: 'agent',
      type: 'agent.intent',
      deduplicationKey: 'intent_1',
    });

    expect((await bus.publish(event)).accepted).toBe(true);
    expect((await bus.publish(event)).duplicate).toBe(true);
  });

  it('leases an event to only one active consumer', async () => {
    const bus = new InMemoryInputBus();
    await bus.publish(
      createInputEnvelope({
        eventId: 'evt_2',
        worldId: 'world_1',
        source: 'agent',
        type: 'agent.intent',
      }),
    );

    const first = await bus.claim('world_1', 'worker-a', 10, 100, 50);
    const second = await bus.claim('world_1', 'worker-b', 10, 100, 50);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);

    await bus.acknowledge(
      'world_1',
      first[0].event.eventId,
      first[0].consumerId,
      first[0].claimToken,
      120,
    );

    expect(await bus.claim('world_1', 'worker-b', 10, 121, 50)).toHaveLength(0);
  });
});

describe('InputBus dedupe cleanup', () => {
  it('never prunes tombstones for an unacknowledged live queue item', async () => {
    const bus = new InMemoryInputBus();
    const event = createInputEnvelope({
      eventId: 'evt_live',
      worldId: 'world_1',
      source: 'agent',
      type: 'agent.intent',
      deduplicationKey: 'live_intent',
    });

    await bus.publish(event);
    bus.pruneDeduplication(Number.MAX_SAFE_INTEGER);

    expect((await bus.publish(event)).duplicate).toBe(true);
    expect(await bus.claim('world_1', 'worker', 10, 100, 50)).toHaveLength(1);
  });
});

describe('InputBus payload guard', () => {
  it('rejects giant serialized input context even if it bypasses the factory', async () => {
    const bus = new InMemoryInputBus();
    const event = {
      eventId: 'evt_giant',
      worldId: 'world_1',
      source: 'agent',
      type: 'agent.intent',
      createdAt: 1,
      payload: { giant: 'x'.repeat(20_000) },
    } as const;

    await expect(bus.publish(event)).rejects.toThrow();
  });
});


describe('InputBus runtime validation', () => {
  it('fails closed for a serialized source outside the runtime allowlist', async () => {
    const bus = new InMemoryInputBus();
    const malformed = {
      eventId: 'evt_bad_source',
      worldId: 'world_1',
      source: 'shell',
      type: 'agent.intent',
      createdAt: 1,
      payload: {},
    } as unknown as Parameters<InMemoryInputBus['publish']>[0];

    await expect(bus.publish(malformed)).rejects.toThrow();
  });

  it('rejects non-finite transport claim time', async () => {
    const bus = new InMemoryInputBus();
    await expect(bus.claim('world_1', 'worker', 1, Number.NaN, 50)).rejects.toThrow();
  });
});

describe('InputBus identity collisions', () => {
  it('rejects reuse of one event ID for different content', async () => {
    const bus = new InMemoryInputBus();
    const first = createInputEnvelope({
      eventId: 'evt_collision',
      worldId: 'world_1',
      source: 'agent',
      type: 'agent.intent',
      createdAt: 1,
      payload: { action: 'left' },
    });
    const changed = createInputEnvelope({
      eventId: 'evt_collision',
      worldId: 'world_1',
      source: 'agent',
      type: 'agent.intent',
      createdAt: 1,
      payload: { action: 'right' },
    });

    await bus.publish(first);
    await expect(bus.publish(changed)).rejects.toThrow();
  });

  it('rejects reuse of a deduplication key for different logical content', async () => {
    const bus = new InMemoryInputBus();
    await bus.publish(
      createInputEnvelope({
        eventId: 'evt_a',
        worldId: 'world_1',
        source: 'agent',
        type: 'agent.intent',
        createdAt: 1,
        deduplicationKey: 'logical_1',
        payload: { action: 'left' },
      }),
    );

    await expect(
      bus.publish(
        createInputEnvelope({
          eventId: 'evt_b',
          worldId: 'world_1',
          source: 'agent',
          type: 'agent.intent',
          createdAt: 2,
          deduplicationKey: 'logical_1',
          payload: { action: 'right' },
        }),
      ),
    ).rejects.toThrow();
  });
});
