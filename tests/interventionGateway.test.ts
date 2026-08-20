import { describe, expect, it } from 'vitest';
import { IndependentInterventionGateway } from '../src/cardinal/InterventionGateway';
import { InMemoryEventStore } from '../src/world/InMemoryEventStore';
import { InMemoryMemoryStore } from '../src/world/InMemoryMemoryStore';
import { WorldEngine } from '../src/world/WorldEngine';

describe('Independent intervention gateway', () => {
  it('executes allowed proposals and blocks rapid repeated intervention', async () => {
    const world = new WorldEngine({
      worldId: 'world_1',
      seed: 'gateway',
      eventStore: new InMemoryEventStore(),
      memoryStore: new InMemoryMemoryStore(),
      agentNames: [],
      startTime: 0,
    });
    const gateway = new IndependentInterventionGateway(world, { minInterval: 5 });
    const proposal = {
      proposalId: 'proposal_1',
      worldId: 'world_1',
      kind: 'resource_relief' as const,
      magnitude: 0.1,
      reason: 'test',
      expectedOutcome: 'test',
    };

    const first = await gateway.execute('evaluation_1', proposal, world.snapshot(), 10);
    const second = await gateway.execute('evaluation_2', proposal, world.snapshot(), 11);

    expect(first.executed).toBe(true);
    expect(second.executed).toBe(false);
    expect(second.authorized).toBe(false);
  });
});
