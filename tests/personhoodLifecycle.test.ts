import { describe, expect, it } from 'vitest';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WorldEngine, WORLD_TICKS_PER_YEAR } from '../src/world/WorldEngine';

async function reopenEditedWorld(
  worldId: string,
  seed: string,
  edit: (state: ReturnType<WorldEngine['snapshot']>) => void,
  agentNames: string[] = ['A', 'B'],
) {
  const source = await WorldEngine.create({
    worldId,
    seed,
    store: new InMemoryWorldStore(),
    startTime: 0,
    agentNames,
  });
  const state = source.snapshot();
  edit(state);
  state.revision = 0;
  const store = new InMemoryWorldStore();
  await store.initializeWorld(state);
  return {
    store,
    world: await WorldEngine.open({ worldId, store }),
  };
}

describe('Fluctlight-inspired persistent personhood', () => {
  it('keeps identity continuity while choices, emotions and values evolve', async () => {
    const store = new InMemoryWorldStore();
    const world = await WorldEngine.create({
      worldId: 'personhood-world',
      seed: 'personhood-seed',
      store,
      startTime: 0,
      agentNames: ['A', 'B', 'C'],
    });
    const before = world.snapshot();
    const identityIds = Object.fromEntries(
      Object.values(before.agents).map((agent) => [
        agent.id,
        agent.mind.identityId,
      ]),
    );

    for (let tick = 1; tick <= 120; tick += 1) await world.step(tick);
    const after = world.snapshot();

    for (const [agentId, identityId] of Object.entries(identityIds)) {
      expect(after.agents[agentId].mind.identityId).toBe(identityId);
      expect(after.agents[agentId].mind.continuity).toBe(1);
      expect(after.agents[agentId].life.ageYears).toBeGreaterThan(
        before.agents[agentId].life.ageYears,
      );
    }
    expect(
      Object.values(after.agents).some(
        (agent) => agent.lastDecision && agent.mind.memoryCoherence !== 0.82,
      ),
    ).toBe(true);
    expect(
      (await store.history('personhood-world')).some(
        (event) => Number(event.payload.consideredActionCount) > 1,
      ),
    ).toBe(true);
  });

  it('allows voluntary families to create a new unique generation', async () => {
    const { store, world } = await reopenEditedWorld(
      'birth-world',
      'birth-world-seed',
      (state) => {
        const a = state.agents.agent_1;
        const b = state.agents.agent_2;
        for (const agent of [a, b]) {
          agent.life.ageYears = 28;
          agent.life.stage = 'adult';
          agent.life.health = 1;
          agent.resources = 1;
          agent.stress = 0;
          agent.mind.values.care = 1;
          agent.mind.emotions.hope = 1;
        }
        state.relationships['agent_1::agent_2'] = {
          agentA: 'agent_1',
          agentB: 'agent_2',
          trust: 1,
          affinity: 1,
          respect: 1,
          conflict: 0,
          updatedAt: 0,
        };
        state.governance.laws.fertility_support.value = 1;
      },
    );

    for (let tick = 1; tick <= 720; tick += 1) {
      await world.step(tick);
      if (world.snapshot().population.births > 0) break;
    }
    const state = world.snapshot();
    expect(state.population.births).toBeGreaterThan(0);
    const child = Object.values(state.agents).find(
      (agent) => agent.life.generation === 1,
    );
    expect(child).toBeDefined();
    expect(child?.life.parentIds.sort()).toEqual(['agent_1', 'agent_2']);
    expect(child?.mind.identityId).toBe(`person:birth-world:${child?.id}`);
    expect(child?.mind.identityId).not.toBe(
      state.agents.agent_1.mind.identityId,
    );
    expect(
      (await store.history('birth-world')).some(
        (event) => event.kind === 'agent.born',
      ),
    ).toBe(true);
  });

  it('ends a biological life without deleting the person or close memories', async () => {
    const { store, world } = await reopenEditedWorld(
      'mortality-world',
      'mortality-world-seed',
      (state) => {
        const dying = state.agents.agent_1;
        dying.life.ageYears = dying.life.lifespanYears - 0.0001;
        dying.life.stage = 'elder';
        dying.life.health = 0.9;
        dying.life.bornAt =
          state.now - dying.life.ageYears * WORLD_TICKS_PER_YEAR;
        state.relationships['agent_1::agent_2'] = {
          agentA: 'agent_1',
          agentB: 'agent_2',
          trust: 0.92,
          affinity: 0.9,
          respect: 0.82,
          conflict: 0.02,
          updatedAt: 0,
        };
      },
    );
    const identityBefore = world.snapshot().agents.agent_1.mind.identityId;

    await world.step(1);
    const after = world.snapshot();
    expect(after.agents.agent_1.life.alive).toBe(false);
    expect(after.agents.agent_1.life.deathCause).toBe('old_age');
    expect(after.agents.agent_1.mind.identityId).toBe(identityBefore);
    expect(after.agents.agent_1.life.diedAt).toBe(1);
    expect(after.population.deaths).toBe(1);
    expect(after.relationships['agent_1::agent_2']).toBeDefined();
    expect(
      (await store.historyForAgent('mortality-world', 'agent_2')).some(
        (memory) =>
          memory.kind === 'death' && memory.relatedAgentIds.includes('agent_1'),
      ),
    ).toBe(true);
  });

  it('lets unexplained phenomena become resident memories instead of commands', async () => {
    const { store, world } = await reopenEditedWorld(
      'mystic-world',
      'mystic-world-seed',
      (state) => {
        state.governance.laws.mystic_resonance.value = 1;
      },
      ['A', 'B', 'C'],
    );
    for (let tick = 1; tick <= 480; tick += 1) {
      await world.step(tick);
      if (world.snapshot().cosmology.omenCount > 0) break;
    }

    const state = world.snapshot();
    expect(state.cosmology.omenCount).toBeGreaterThan(0);
    expect(
      (await store.history('mystic-world')).some((event) =>
        event.kind.startsWith('world.omen.natural.'),
      ),
    ).toBe(true);
    const memories = await Promise.all(
      Object.keys(state.agents).map((agentId) =>
        store.historyForAgent(state.id, agentId),
      ),
    );
    expect(memories.flat().some((memory) => memory.kind === 'omen')).toBe(true);
  });
});
