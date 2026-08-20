import { describe, expect, it } from 'vitest';
import { InMemoryEventStore } from '../src/world/InMemoryEventStore';
import { InMemoryMemoryStore } from '../src/world/InMemoryMemoryStore';
import { WorldEngine } from '../src/world/WorldEngine';

function makeWorld(agentNames: string[] = []) {
  return new WorldEngine({
    worldId: 'control',
    seed: 'control-seed',
    eventStore: new InMemoryEventStore(),
    memoryStore: new InMemoryMemoryStore(),
    agentNames,
    startTime: 0,
  });
}

describe('World autonomy', () => {
  it('has endogenous resource recovery without Cardinal', async () => {
    const world = makeWorld();

    await world.applyDisturbance('resource_shock', 0.7, 1, 8, 'shock_1');
    const afterShock = world.snapshot().environment.resourcePool;
    await world.step(2);
    const afterRecovery = world.snapshot().environment.resourcePool;

    expect(afterRecovery).toBeGreaterThan(afterShock);
  });

  it('does not run the same completed logical tick twice', async () => {
    const world = makeWorld(['A', 'B']);
    await world.step(1);
    const first = world.snapshot();
    await world.step(1);
    expect(world.snapshot()).toEqual(first);
  });

  it('makes a scheduled disturbance idempotent by operation ID', async () => {
    const world = makeWorld();
    const before = world.snapshot().environment.resourcePool;
    expect(await world.applyDisturbance('resource_shock', 0.2, 1, 8, 'same_shock')).toBe(true);
    const afterFirst = world.snapshot().environment.resourcePool;
    expect(await world.applyDisturbance('resource_shock', 0.2, 1, 8, 'same_shock')).toBe(false);
    expect(world.snapshot().environment.resourcePool).toBe(afterFirst);
    expect(afterFirst).toBeLessThan(before);
  });
});
