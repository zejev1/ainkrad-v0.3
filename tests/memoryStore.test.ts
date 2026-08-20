import { describe, expect, it } from 'vitest';
import { InMemoryEventStore } from '../src/world/InMemoryEventStore';
import { InMemoryMemoryStore } from '../src/world/InMemoryMemoryStore';
import { WorldEngine } from '../src/world/WorldEngine';

describe('Long-term memory storage', () => {
  it('keeps memory history outside the hot world snapshot', async () => {
    const memoryStore = new InMemoryMemoryStore();
    const world = new WorldEngine({
      worldId: 'memory-world',
      seed: 'memory-seed',
      eventStore: new InMemoryEventStore(),
      memoryStore,
      startTime: 0,
    });

    for (let tick = 1; tick <= 20; tick += 1) {
      await world.step(tick);
    }

    expect('memories' in world.snapshot()).toBe(false);
    const histories = await Promise.all(
      Object.keys(world.snapshot().agents).map((agentId) =>
        memoryStore.historyForAgent('memory-world', agentId),
      ),
    );
    expect(histories.some((history) => history.length > 0)).toBe(true);
  });
});
