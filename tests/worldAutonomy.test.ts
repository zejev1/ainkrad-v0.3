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
  it('migrates a 0.3.8 save without restarting its people, time or relationships', async () => {
    const sourceStore = new InMemoryWorldStore();
    const source = await WorldEngine.create({
      worldId: 'legacy-continuity',
      seed: 'legacy-continuity-seed',
      store: sourceStore,
      startTime: 0,
    });
    for (let tick = 1; tick <= 12; tick += 1) await source.step(tick);

    const legacy = source.snapshot() as any;
    const preservedTime = legacy.now;
    legacy.rulesVersion = 'ainkrad-world-rules-0.3.8';
    legacy.revision = 0;
    delete legacy.growth;
    delete legacy.wildlife;
    delete legacy.population;
    delete legacy.cosmology;
    delete legacy.governance;
    delete legacy.environment.habitatSupport;
    for (const regionId of ['meadow', 'forest', 'shore']) {
      delete legacy.places[regionId];
    }
    for (const agent of Object.values(legacy.agents) as any[]) {
      if (['meadow', 'forest', 'shore'].includes(agent.locationId)) {
        agent.locationId = 'outskirts';
      }
      delete agent.skills.hunting;
      delete agent.origin;
      delete agent.life;
      delete agent.mind;
    }
    for (const place of Object.values(legacy.places) as any[]) {
      delete place.biome;
      delete place.mapX;
      delete place.mapY;
      delete place.connectedPlaceIds;
      delete place.fertility;
      delete place.danger;
    }
    const preservedAgents = structuredClone(legacy.agents);
    const preservedRelationships = structuredClone(legacy.relationships);

    const targetStore = new InMemoryWorldStore();
    await targetStore.initializeWorld(legacy);
    const migrated = await WorldEngine.open({
      worldId: 'legacy-continuity',
      store: targetStore,
    });
    const state = migrated.snapshot();

    expect(state.now).toBe(preservedTime);
    expect(state.rulesVersion).toBe('ainkrad-world-rules-0.3.10');
    expect(state.growth.stage).toBe(0);
    expect(state.wildlife).toEqual({});
    expect(state.relationships).toEqual(preservedRelationships);
    for (const [agentId, agent] of Object.entries(state.agents)) {
      const previous = preservedAgents[agentId];
      expect(agent.name).toBe(previous.name);
      expect(agent.goal).toEqual(previous.goal);
      expect(agent.locationId).toBe(previous.locationId);
      expect(agent.skills.hunting).toBeGreaterThanOrEqual(0);
      expect(agent.life.alive).toBe(true);
      expect(agent.mind.identityId).toBe(
        `person:legacy-continuity:${agentId}`,
      );
      expect(agent.mind.continuity).toBe(1);
    }
    expect(state.governance.protectedPersonhoodDomains).toEqual([
      'identity',
      'memory',
      'agency',
      'values',
      'relationships',
    ]);
    expect(
      (await targetStore.history('legacy-continuity')).some(
        (event) => event.kind === 'world.migrated',
      ),
    ).toBe(true);
  });

  it('migrates the live 0.3.9 ecology without resetting its frontier or RNG future', async () => {
    const sourceStore = new InMemoryWorldStore();
    const source = await WorldEngine.create({
      worldId: 'legacy-039-continuity',
      seed: 'legacy-039-seed',
      store: sourceStore,
      startTime: 0,
    });
    for (let tick = 1; tick <= 96; tick += 1) await source.step(tick);

    const legacy = source.snapshot() as any;
    legacy.rulesVersion = 'ainkrad-world-rules-0.3.9';
    legacy.revision = 0;
    delete legacy.population;
    delete legacy.cosmology;
    delete legacy.governance;
    delete legacy.growth.frontierSequence;
    for (const place of Object.values(legacy.places) as any[]) {
      delete place.biome;
      delete place.mapX;
      delete place.mapY;
      delete place.connectedPlaceIds;
      delete place.fertility;
      delete place.danger;
    }
    for (const agent of Object.values(legacy.agents) as any[]) {
      delete agent.origin;
      delete agent.life;
      delete agent.mind;
      delete agent.plan;
    }
    const preserved = {
      now: legacy.now,
      rngState: legacy.determinism.rngState,
      growth: structuredClone(legacy.growth),
      wildlife: structuredClone(legacy.wildlife),
      hunting: Object.fromEntries(
        Object.values(legacy.agents).map((agent: any) => [
          agent.id,
          agent.skills.hunting,
        ]),
      ),
      relationships: structuredClone(legacy.relationships),
    };

    const targetStore = new InMemoryWorldStore();
    await targetStore.initializeWorld(legacy);
    const migrated = await WorldEngine.open({
      worldId: legacy.id,
      store: targetStore,
    });
    const state = migrated.snapshot();

    expect(state.now).toBe(preserved.now);
    expect(state.determinism.rngState).toBe(preserved.rngState);
    expect(state.growth.stage).toBe(preserved.growth.stage);
    expect(state.growth.discoveredRegionIds).toEqual(
      preserved.growth.discoveredRegionIds,
    );
    expect(state.wildlife).toEqual(preserved.wildlife);
    expect(state.relationships).toEqual(preserved.relationships);
    for (const agent of Object.values(state.agents)) {
      expect(agent.skills.hunting).toBe(preserved.hunting[agent.id]);
      expect(agent.life.alive).toBe(true);
      expect(agent.mind.identityId).toBe(
        `person:legacy-039-continuity:${agent.id}`,
      );
    }
  });

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

describe('Autonomous society depth', () => {
  it('creates persistent identities with personality, needs, skills, goals and places', async () => {
    const world = await makeWorld(['A', 'B', 'C']);
    const state = world.snapshot();

    expect(Object.keys(state.places).length).toBeGreaterThan(3);
    for (const agent of Object.values(state.agents)) {
      expect(state.places[agent.homeId]?.kind).toBe('home');
      expect(state.places[agent.locationId]).toBeDefined();
      expect(agent.personality.curiosity).toBeGreaterThanOrEqual(0);
      expect(agent.needs.belonging).toBeGreaterThanOrEqual(0);
      expect(agent.skills.craft).toBeGreaterThanOrEqual(0);
      expect(agent.goal.kind).toBeTruthy();
    }
  });

  it('produces several autonomous action families instead of one fixed routine', async () => {
    const store = new InMemoryWorldStore();
    const world = await WorldEngine.create({
      worldId: 'diverse',
      seed: 'diverse-actions',
      store,
      startTime: 0,
    });

    for (let tick = 1; tick <= 180; tick += 1) {
      await world.step(tick);
    }

    const kinds = new Set((await store.history('diverse')).map((event) => event.kind));
    expect(kinds.has('agent.worked')).toBe(true);
    expect(kinds.has('agent.gathered')).toBe(true);
    expect(kinds.has('agent.explored')).toBe(true);
    expect(kinds.has('relationship.changed')).toBe(true);
    expect(
      kinds.has('agent.help.accepted') ||
        kinds.has('agent.help.rejected') ||
        kinds.has('agent.bond.accepted') ||
        kinds.has('agent.bond.declined') ||
        kinds.has('agent.prayed'),
    ).toBe(true);
  });

  it('lets resident exploration grow the world in stages and supports nature activity', async () => {
    const store = new InMemoryWorldStore();
    const world = await WorldEngine.create({
      worldId: 'growing-world',
      seed: 'growing-world-seed',
      store,
      startTime: 0,
    });

    for (let tick = 1; tick <= 240; tick += 1) {
      await world.step(tick);
    }

    const state = world.snapshot();
    const history = await store.history('growing-world');
    const discoveries = history.filter(
      (event) => event.kind === 'world.region.discovered',
    );
    const kinds = new Set(history.map((event) => event.kind));

    expect(state.growth.stage).toBeGreaterThan(3);
    expect(state.growth.stage).toBe(state.growth.discoveredRegionIds.length);
    expect(state.growth.discoveredRegionIds.slice(0, 3)).toEqual([
      'meadow',
      'forest',
      'shore',
    ]);
    expect(state.growth.discoveredRegionIds[3]).toBe('region_4');
    expect(Object.keys(state.places)).toEqual(
      expect.arrayContaining(['meadow', 'forest', 'shore']),
    );
    expect(
      Object.values(state.wildlife).map((population) => population.species),
    ).toEqual(expect.arrayContaining(['rabbit', 'deer', 'fish']));
    expect(discoveries.length).toBe(state.growth.stage);
    expect(discoveries.slice(0, 3).map((event) => event.payload.stage)).toEqual([
      1,
      2,
      3,
    ]);
    expect(
      discoveries.map((event) => event.payload.stage),
    ).toEqual(Array.from({ length: state.growth.stage }, (_, index) => index + 1));
    expect(discoveries.every((event) => event.source === 'agent')).toBe(true);
    expect(discoveries[0].occurredAt).toBeLessThan(discoveries[1].occurredAt);
    expect(discoveries[1].occurredAt).toBeLessThan(discoveries[2].occurredAt);
    expect(kinds.has('agent.walked')).toBe(true);
    expect(kinds.has('agent.relaxed')).toBe(true);
    expect(kinds.has('agent.hunted')).toBe(true);
    expect(kinds.has('world.wildlife.recovered')).toBe(true);
  });

  it('can choose a reasonable alternative instead of always obeying the top score', async () => {
    const store = new InMemoryWorldStore();
    const world = await WorldEngine.create({
      worldId: 'choice-space',
      seed: 'choice-space-seed',
      store,
      startTime: 0,
    });

    for (let tick = 1; tick <= 100; tick += 1) {
      await world.step(tick);
    }

    const decisions = (await store.history('choice-space')).filter(
      (event) => typeof event.payload.chosenAction === 'string',
    );
    expect(decisions.length).toBeGreaterThan(100);
    expect(
      decisions.some(
        (event) =>
          Number(event.payload.consideredActionCount) > 1 &&
          Number(event.payload.choiceOpenness) > 0,
      ),
    ).toBe(true);
    expect(
      decisions.some(
        (event) =>
          event.payload.chosenAction !== event.payload.dominantAction,
      ),
    ).toBe(true);
  });

  it('does not give one array position permanent first-mover priority', async () => {
    const store = new InMemoryWorldStore();
    const world = await WorldEngine.create({
      worldId: 'order',
      seed: 'order-seed',
      store,
      agentNames: ['A', 'B', 'C', 'D'],
      startTime: 0,
    });

    for (let tick = 1; tick <= 60; tick += 1) await world.step(tick);
    const firstActors = new Set<string>();
    const history = await store.history('order');
    for (let tick = 1; tick <= 60; tick += 1) {
      const first = history.find(
        (event) => event.occurredAt === tick && event.source === 'agent',
      );
      const agentId = first?.payload.agentId;
      if (typeof agentId === 'string') firstActors.add(agentId);
    }

    expect(firstActors.size).toBeGreaterThan(2);
  });

  it('is deterministic for the same seed while different seeds can diverge', async () => {
    async function run(seed: string) {
      const store = new InMemoryWorldStore();
      const world = await WorldEngine.create({
        worldId: 'seeded',
        seed,
        store,
        startTime: 0,
      });
      for (let tick = 1; tick <= 120; tick += 1) await world.step(tick);
      return {
        state: world.snapshot(),
        history: await store.history('seeded'),
      };
    }

    const a = await run('same');
    const b = await run('same');
    const c = await run('different');

    expect(a).toEqual(b);
    expect(c.state.agents).not.toEqual(a.state.agents);
  });

  it('preserves the exact autonomous future across an engine restart', async () => {
    async function makeStoreAndWorld() {
      const store = new InMemoryWorldStore();
      const world = await WorldEngine.create({
        worldId: 'restart_future',
        seed: 'restart-future-seed',
        store,
        startTime: 0,
      });
      return { store, world };
    }

    const continuous = await makeStoreAndWorld();
    for (let tick = 1; tick <= 160; tick += 1) await continuous.world.step(tick);

    const restartedRun = await makeStoreAndWorld();
    for (let tick = 1; tick <= 80; tick += 1) await restartedRun.world.step(tick);
    const reopened = await WorldEngine.open({
      worldId: 'restart_future',
      store: restartedRun.store,
    });
    for (let tick = 81; tick <= 160; tick += 1) await reopened.step(tick);

    expect(reopened.snapshot()).toEqual(continuous.world.snapshot());
    expect(await restartedRun.store.history('restart_future')).toEqual(
      await continuous.store.history('restart_future'),
    );
  });

  it('does not guarantee control-world collapse merely because agents keep living', async () => {
    const means: number[] = [];
    for (const seed of ['viable-a', 'viable-b', 'viable-c']) {
      const store = new InMemoryWorldStore();
      const world = await WorldEngine.create({
        worldId: 'viable',
        seed,
        store,
        startTime: 0,
      });
      for (let tick = 1; tick <= 350; tick += 1) await world.step(tick);
      const agents = Object.values(world.snapshot().agents);
      means.push(
        agents.reduce((sum, agent) => sum + agent.resources, 0) / agents.length,
      );
    }

    expect(means.reduce((sum, value) => sum + value, 0) / means.length).toBeGreaterThan(0.3);
  });

  it('rejects a same-version persisted world whose required agent structures are corrupted', async () => {
    const sourceStore = new InMemoryWorldStore();
    const source = await WorldEngine.create({
      worldId: 'corrupt',
      seed: 'corrupt-seed',
      store: sourceStore,
      startTime: 0,
    });
    const corrupted = source.snapshot() as any;
    delete corrupted.agents.agent_1.personality;

    const targetStore = new InMemoryWorldStore();
    await targetStore.initializeWorld(corrupted);

    await expect(
      WorldEngine.open({ worldId: 'corrupt', store: targetStore }),
    ).rejects.toThrow('personality');
  });
});
