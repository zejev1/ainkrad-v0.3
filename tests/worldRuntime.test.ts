import { describe, expect, it } from 'vitest';
import { WorldRuntime } from '../src/runtime/WorldRuntime';
import { InMemoryInputBus } from '../src/runtime/inputBus/InMemoryInputBus';
import { createInputEnvelope } from '../src/runtime/inputBus/createEnvelope';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WorldEngine } from '../src/world/WorldEngine';

class FailFirstAckBus extends InMemoryInputBus {
  private fail = true;

  override async acknowledge(
    worldId: string,
    eventId: string,
    consumerId: string,
    claimToken: string,
    acknowledgedAt: number,
  ): Promise<void> {
    if (this.fail) {
      this.fail = false;
      throw new Error('synthetic acknowledgement failure');
    }
    await super.acknowledge(
      worldId,
      eventId,
      consumerId,
      claimToken,
      acknowledgedAt,
    );
  }
}

describe('WorldRuntime retry boundary', () => {
  it('does not duplicate world evidence if acknowledgement fails after commit', async () => {
    const store = new InMemoryWorldStore();
    const world = await WorldEngine.create({
      worldId: 'runtime-world',
      seed: 'runtime-seed',
      store,
      agentNames: [],
      startTime: 0,
    });
    const bus = new FailFirstAckBus();
    await bus.publish(
      createInputEnvelope({
        eventId: 'input_once',
        worldId: 'runtime-world',
        source: 'player',
        type: 'player.intent',
        createdAt: 999_999,
        payload: { action: 'wave' },
      }),
    );

    const runtime = new WorldRuntime(bus, world, { consumerId: 'worker' });
    await expect(runtime.tick(1)).rejects.toThrow('synthetic acknowledgement failure');
    expect((await store.history('runtime-world')).filter((e) => e.kind === 'input.player.intent')).toHaveLength(1);

    await runtime.tick(1);
    const inputEvents = (await store.history('runtime-world')).filter(
      (event) => event.kind === 'input.player.intent',
    );
    expect(inputEvents).toHaveLength(1);
    expect(inputEvents[0].occurredAt).toBe(1);
    expect(world.snapshot().now).toBe(1);
  });
});
