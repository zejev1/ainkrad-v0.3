import { describe, expect, it } from 'vitest';
import { InMemoryEventStore } from '../src/world/InMemoryEventStore';
import { InMemoryMemoryStore } from '../src/world/InMemoryMemoryStore';
import { WorldEngine } from '../src/world/WorldEngine';

describe('World autonomy', () => {
  it('has endogenous resource recovery without Cardinal', async () => {
    const world = new WorldEngine({
      worldId: 'control',
      seed: 'control-seed',
      eventStore: new InMemoryEventStore(),
      memoryStore: new InMemoryMemoryStore(),
      agentNames: [],
      startTime: 0,
    });

    await world.applyDisturbance('resource_shock', 0.7, 1);
    const afterShock = world.snapshot().environment.resourcePool;
    await world.step(2);
    const afterRecovery = world.snapshot().environment.resourcePool;

    expect(afterRecovery).toBeGreaterThan(afterShock);
  });
});
