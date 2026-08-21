import { describe, expect, it } from 'vitest';
import {
  ABSOLUTE_MAX_INTERVENTION_MAGNITUDE,
  IndependentInterventionGateway,
} from '../src/cardinal/InterventionGateway';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WorldEngine } from '../src/world/WorldEngine';

async function makeWorld() {
  return await WorldEngine.create({
    worldId: 'world_1',
    seed: 'gateway',
    store: new InMemoryWorldStore(),
    agentNames: [],
    startTime: 0,
  });
}

describe('Independent intervention gateway', () => {
  it('executes allowed proposals and blocks a different rapid proposal', async () => {
    const world = await makeWorld();
    await world.step(10);
    const gateway = new IndependentInterventionGateway(world, { minInterval: 5 });
    const firstProposal = {
      proposalId: 'proposal_1',
      worldId: 'world_1',
      hypothesisId: 'hypothesis_test',
      kind: 'resource_relief' as const,
      magnitude: 0.1,
      reason: 'test',
      expectedOutcome: 'test',
      prediction: {
        metric: 'resourcePressure' as const,
        direction: 'decrease' as const,
        minimumImprovement: 0.01,
        horizon: 4,
        statement: 'resource pressure should decrease',
      },
    };

    const first = await gateway.execute('evaluation_1', firstProposal, world.snapshot(), 10);
    const secondProposal = { ...firstProposal, proposalId: 'proposal_2' };
    const second = await gateway.execute('evaluation_2', secondProposal, world.snapshot(), 10);

    expect(first.executed).toBe(true);
    expect(first.authorizedEffectDuration).toBe(8);
    expect(second.executed).toBe(false);
    expect(second.authorized).toBe(false);
  });

  it('makes an exact proposal retry idempotent', async () => {
    const world = await makeWorld();
    await world.step(10);
    const gateway = new IndependentInterventionGateway(world);
    const proposal = {
      proposalId: 'proposal_retry',
      worldId: 'world_1',
      hypothesisId: 'hypothesis_test',
      kind: 'resource_relief' as const,
      magnitude: 0.1,
      reason: 'test',
      expectedOutcome: 'test',
      prediction: {
        metric: 'resourcePressure' as const,
        direction: 'decrease' as const,
        minimumImprovement: 0.01,
        horizon: 4,
        statement: 'resource pressure should decrease',
      },
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
    const world = await makeWorld();
    await world.step(10);
    const gateway = new IndependentInterventionGateway(world);
    const proposal = {
      proposalId: 'proposal_bad',
      worldId: 'world_1',
      hypothesisId: 'hypothesis_test',
      kind: 'rewrite_agent' as 'resource_relief',
      magnitude: 0.1,
      reason: 'bad',
      expectedOutcome: 'bad',
      prediction: {
        metric: 'resourcePressure' as const,
        direction: 'decrease' as const,
        minimumImprovement: 0.01,
        horizon: 4,
        statement: 'resource pressure should decrease',
      },
    };

    const result = await gateway.execute('evaluation_bad', proposal, world.snapshot(), 10);
    expect(result.authorized).toBe(false);
    expect(result.executed).toBe(false);
  });

  it('can authorize bounded habitat support without rewriting a resident', async () => {
    const store = new InMemoryWorldStore();
    const world = await WorldEngine.create({
      worldId: 'habitat_world',
      seed: 'habitat-gateway',
      store,
      agentNames: ['A'],
      startTime: 0,
    });
    await world.step(10);
    const before = world.snapshot();
    const gateway = new IndependentInterventionGateway(world);
    const proposal = {
      proposalId: 'proposal_habitat',
      worldId: 'habitat_world',
      hypothesisId: 'hypothesis_ecology',
      kind: 'habitat_support' as const,
      magnitude: 0.1,
      reason: 'measured wildlife pressure',
      expectedOutcome: 'temporary habitat recovery support',
      prediction: {
        metric: 'wildlifePressure' as const,
        direction: 'decrease' as const,
        minimumImprovement: 0.01,
        horizon: 4,
        statement: 'wildlife pressure should decrease',
      },
    };

    const result = await gateway.execute(
      'evaluation_habitat',
      proposal,
      before,
      10,
    );
    const after = world.snapshot();

    expect(result.executed).toBe(true);
    expect(after.agents).toEqual(before.agents);
    expect(after.environment).toEqual(before.environment);
    expect(
      (await store.history('habitat_world')).some(
        (event) => event.kind === 'cardinal.effect.habitat_support',
      ),
    ).toBe(true);
  });

  it('cannot be configured above the absolute intervention cap', async () => {
    const world = await makeWorld();
    expect(
      () =>
        new IndependentInterventionGateway(world, {
          maxMagnitude: ABSOLUTE_MAX_INTERVENTION_MAGNITUDE + 0.01,
        }),
    ).toThrow();
  });
});
