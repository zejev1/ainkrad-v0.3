import { describe, expect, it } from 'vitest';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WorldEngine } from '../src/world/WorldEngine';

async function makeWorld(agentNames: string[] = []) {
  return await WorldEngine.create({
    worldId: 'control',
    seed: 'control-seed',
    store: new InMemoryWorldStore(),
    agentNames,
    startTime: 0,
  });
}

describe('World autonomy', () => {
  it('has endogenous resource recovery without Cardinal', async () => {
    const world = await makeWorld();

    await world.applyDisturbance('resource_shock', 0.7, 1, 8, 'shock_1');
    const afterShock = world.snapshot().environment.resourcePool;
    await world.step(2);
    const afterRecovery = world.snapshot().environment.resourcePool;

    expect(afterRecovery).toBeGreaterThan(afterShock);
  });

  it('does not run the same completed logical tick twice', async () => {
    const world = await makeWorld(['A', 'B']);
    await world.step(1);
    const first = world.snapshot();
    await world.step(1);
    expect(world.snapshot()).toEqual(first);
  });

  it('makes a scheduled disturbance idempotent by operation ID', async () => {
    const world = await makeWorld();
    const before = world.snapshot().environment.resourcePool;
    expect(
      await world.applyDisturbance('resource_shock', 0.2, 1, 8, 'same_shock'),
    ).toBe(true);
    const afterFirst = world.snapshot().environment.resourcePool;
    expect(
      await world.applyDisturbance('resource_shock', 0.2, 1, 8, 'same_shock'),
    ).toBe(false);
    expect(world.snapshot().environment.resourcePool).toBe(afterFirst);
    expect(afterFirst).toBeLessThan(before);
  });

  it('can reopen from the committed world state without changing RNG history', async () => {
    const store = new InMemoryWorldStore();
    const original = await WorldEngine.create({
      worldId: 'resume',
      seed: 'resume-seed',
      store,
      agentNames: ['A', 'B', 'C'],
      startTime: 0,
    });

    await original.step(1);
    const saved = original.snapshot();
    const reopened = await WorldEngine.open({ worldId: 'resume', store });
    expect(reopened.snapshot()).toEqual(saved);

    await original.step(2);
    await reopened.reload();
    expect(reopened.snapshot()).toEqual(original.snapshot());
  });
});

describe('World rules version', () => {
  it('refuses to silently resume a snapshot produced by incompatible world rules', async () => {
    const sourceStore = new InMemoryWorldStore();
    const world = await WorldEngine.create({
      worldId: 'versioned',
      seed: 'versioned-seed',
      store: sourceStore,
      agentNames: [],
      startTime: 0,
    });
    const incompatible = world.snapshot();
    incompatible.rulesVersion = 'old-rules';

    const targetStore = new InMemoryWorldStore();
    await targetStore.initializeWorld(incompatible);
    await expect(
      WorldEngine.open({ worldId: 'versioned', store: targetStore }),
    ).rejects.toThrow('Explicit migration is required');
  });
});
