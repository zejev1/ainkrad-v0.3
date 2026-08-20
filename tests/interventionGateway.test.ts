import { describe, expect, it } from 'vitest';
import {
  ABSOLUTE_MAX_INTERVENTION_MAGNITUDE,
  IndependentInterventionGateway,
} from '../src/cardinal/InterventionGateway';
import { InMemoryEventStore } from '../src/world/InMemoryEventStore';
import { InMemoryMemoryStore } from '../src/world/InMemoryMemoryStore';
import { WorldEngine } from '../src/world/WorldEngine';

function makeWorld() {
  return new WorldEngine({
    worldId: 'world_1',
    seed: 'gateway',
    eventStore: new InMemoryEventStore(),
    memoryStore: new InMemoryMemoryStore(),
    agentNames: [],
    startTime: 0,
  });
}

describe('Independent intervention gateway', () => {
  it('executes allowed proposals and blocks a different rapid proposal', async () => {
    const world = makeWorld();
    await world.step(10);
    const gateway = new IndependentInterventionGateway(world, { minInterval: 5 });
    const firstProposal = {
      proposalId: 'proposal_1',
      worldId: 'world_1',
      kind: 'resource_relief' as const,
      magnitude: 0.1,
      reason: 'test',
      expectedOutcome: 'test',
    };

    const first = await gateway.execute('evaluation_1', firstProposal, world.snapshot(), 10);
    const secondProposal = { ...firstProposal, proposalId: 'proposal_2' };
    const second = await gateway.execute('evaluation_2', secondProposal, world.snapshot(), 10);

    expect(first.executed).toBe(true);
    expect(second.executed).toBe(false);
    expect(second.authorized).toBe(false);
  });

  it('makes an exact proposal retry idempotent', async () => {
    const world = makeWorld();
    await world.step(10);
    const gateway = new IndependentInterventionGateway(world);
    const proposal = {
      proposalId: 'proposal_retry',
      worldId: 'world_1',
      kind: 'resource_relief' as const,
      magnitude: 0.1,
      reason: 'test',
      expectedOutcome: 'test',
    };

    const before = world.snapshot().environment.resourcePool;
    const first = await gateway.execute('evaluation_retry', proposal, world.snapshot(), 10);
    const afterFirst = world.snapshot().environment.resourcePool;
    const retry = await gateway.execute('evaluation_retry', proposal, world.snapshot(), 10);
    const afterRetry = world.snapshot().environment.resourcePool;

    expect(first.interventionId).toBe(retry.interventionId);
    expect(afterFirst).toBeGreaterThanOrEqual(before);
    expect(afterRetry).toBe(afterFirst);
  });

  it('fails closed for a runtime kind outside the allowlist', async () => {
    const world = makeWorld();
    await world.step(10);
    const gateway = new IndependentInterventionGateway(world);
    const proposal = {
      proposalId: 'proposal_bad',
      worldId: 'world_1',
      kind: 'rewrite_agent' as 'resource_relief',
      magnitude: 0.1,
      reason: 'bad',
      expectedOutcome: 'bad',
    };

    const result = await gateway.execute('evaluation_bad', proposal, world.snapshot(), 10);
    expect(result.authorized).toBe(false);
    expect(result.executed).toBe(false);
  });

  it('cannot be configured above the absolute intervention cap', () => {
    const world = makeWorld();
    expect(
      () =>
        new IndependentInterventionGateway(world, {
          maxMagnitude: ABSOLUTE_MAX_INTERVENTION_MAGNITUDE + 0.01,
        }),
    ).toThrow();
  });
});
