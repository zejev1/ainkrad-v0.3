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
