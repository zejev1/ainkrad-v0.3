import { describe, expect, it } from 'vitest';
import { CardinalCore } from '../src/cardinal/CardinalCore';
import { deriveCardinalExperienceFromCounters } from '../src/cardinal/CardinalExperience';
import { CardinalWorldArchitect, IndependentWorldAuthorityGateway, observeWorldArchitecture } from '../src/cardinal/WorldAuthorityGateway';
import { InMemoryAppendOnlyLog } from '../src/persistence/AppendOnlyLog';
import { LiveWorldRuntime } from '../src/runtime/LiveWorldRuntime';
import { WorldSensors } from '../src/sensors/WorldSensors';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WorldEngine } from '../src/world/WorldEngine';

const humanCount = (world: ReturnType<WorldEngine['snapshot']>) =>
  Object.values(world.agents).filter(
    (agent) => agent.life.alive && (agent.race ?? 'human') === 'human',
  ).length;

describe('v0.3.14 Underworld-style substrate audit', () => {
  it('starts the live world with ten balanced human founders in one coherent settlement', async () => {
    const runtime = await LiveWorldRuntime.create({
      mode: 'observer', seed: 'v14-founders', worldId: 'v14-founders',
      store: new InMemoryWorldStore(), controlLog: new InMemoryAppendOnlyLog(),
    });
    const frame = await runtime.tick();
    const humans = Object.values(frame.world.agents).filter(
      (agent) => agent.life.alive && (agent.race ?? 'human') === 'human',
    );
    expect(humans).toHaveLength(10);
    expect(humans.filter((agent) => agent.sex === 'male')).toHaveLength(5);
    expect(humans.filter((agent) => agent.sex === 'female')).toHaveLength(5);
    expect(humans.every((agent) => agent.life.generation === 0)).toBe(true);
    expect(humans.every((agent) => frame.world.places[agent.homeId]?.settlementId === 'settlement_ainkrad')).toBe(true);

    const c = frame.world.places.commons;
    const workshop = frame.world.places.workshop;
    const field = frame.world.places.resource_field;
    const outskirts = frame.world.places.outskirts;
    const d = (p: typeof c) => Math.hypot(p.mapX - c.mapX, p.mapY - c.mapY);
    expect(d(workshop)).toBeLessThan(4);
    expect(d(field)).toBeGreaterThan(d(workshop));
    expect(d(field)).toBeLessThan(8);
    expect(d(outskirts)).toBeGreaterThan(d(field));
  });

  it('upgrades a critically small existing world with one idempotent ten-person recovery cohort', async () => {
    const sourceStore = new InMemoryWorldStore();
    const source = await WorldEngine.create({ worldId: 'v14-recovery', seed: 'v14-recovery', store: sourceStore });
    const damaged = source.snapshot();
    const agents = Object.values(damaged.agents);
    const survivorIds = agents.slice(0, 2).map((agent) => agent.id);
    const survivorMinds = Object.fromEntries(
      survivorIds.map((id) => [id, structuredClone(damaged.agents[id].mind)]),
    );
    agents.slice(2).forEach((agent) => { agent.life.alive = false; agent.life.health = 0; agent.life.diedAt = 1; agent.life.deathCause = 'deprivation'; });
    damaged.population.deaths = agents.length - 2;
    damaged.population.lastDeathAt = 1;
    damaged.rulesVersion = 'ainkrad-world-rules-0.3.13';
    damaged.governance.constitutionVersion = 'ainkrad-constitution-0.3.10';
    delete damaged.governance.laws.settlement_cohesion;
    delete damaged.governance.laws.habitat_integrity;
    delete damaged.governance.laws.civilization_continuity;
    delete damaged.epoch;
    delete damaged.epochStartedAt;

    const store = new InMemoryWorldStore();
    await store.initializeWorld(damaged);
    const controlLog = new InMemoryAppendOnlyLog();
    
        const first = await LiveWorldRuntime.create({
      mode: 'observer',
      seed: 'v14-recovery',
      worldId: damaged.id,
      store,
      controlLog,
    });

    const recoveredBeforeTick = await store.loadWorld(damaged.id);
    expect(recoveredBeforeTick).toBeDefined();
    if (!recoveredBeforeTick) {
      throw new Error('Recovered world was not persisted.');
    }

    expect(recoveredBeforeTick.rulesVersion).toBe(
      'ainkrad-world-rules-0.3.14',
    );
    expect(humanCount(recoveredBeforeTick)).toBe(12);

    for (const id of survivorIds) {
      expect(recoveredBeforeTick.agents[id].life.alive).toBe(true);
      expect(recoveredBeforeTick.agents[id].mind).toEqual(
        survivorMinds[id],
      );
    }

    const firstFrame = await first.tick();
    expect(humanCount(firstFrame.world)).toBe(12);
    const reopened = await LiveWorldRuntime.create({ mode: 'observer', seed: 'v14-recovery', worldId: damaged.id, store, controlLog });
    expect(humanCount((await reopened.tick()).world)).toBe(12);
  });

  it('promotes Ainkrad from village to city by local population without requiring frontier stage', async () => {
    const store = new InMemoryWorldStore();
    const world = await WorldEngine.create({
      worldId: 'v14-city', seed: 'v14-city', store, startTime: 0,
      agentNames: Array.from({ length: 18 }, (_, i) => `Resident ${i + 1}`),
    });
    await world.step(24, 0);
    const snapshot = world.snapshot();
    expect(snapshot.growth.stage).toBe(0);
    expect(snapshot.settlements.settlement_ainkrad.kind).toBe('city');
  });

  it('keeps generation-zero founders rooted while allowing travel and later-generation resettlement logic', async () => {
    const store = new InMemoryWorldStore();
    const world = await WorldEngine.create({
      worldId: 'v14-rooted', seed: 'v14-rooted', store,
      agentNames: Array.from({ length: 20 }, (_, i) => `Founder ${i + 1}`),
    });
    const founderIds = Object.values(world.snapshot().agents).map((agent) => agent.id);
    for (let tick = 1; tick <= 360; tick += 1) await world.step(tick);
    const snapshot = world.snapshot();
    for (const id of founderIds) {
      const founder = snapshot.agents[id];
      if (!founder.life.alive) continue;
      expect(founder.life.generation).toBe(0);
      expect(snapshot.places[founder.homeId]?.settlementId).toBe('settlement_ainkrad');
    }
  });

  it('never recovers wildlife or monsters in incompatible city/water habitats', async () => {
    const store = new InMemoryWorldStore();
    const world = await WorldEngine.create({
      worldId: 'v14-habitat', seed: 'v14-habitat', store,
      agentNames: Array.from({ length: 24 }, (_, i) => `Explorer ${i + 1}`),
    });
    for (let tick = 1; tick <= 900; tick += 1) await world.step(tick);
    const snapshot = world.snapshot();
    const allowed: Record<string, string[]> = {
      rabbit: ['plains', 'forest'], deer: ['plains', 'forest'], fish: ['coast', 'lake', 'river'],
      boar: ['forest', 'plains', 'swamp'], wolf: ['forest', 'mountains', 'plains'], bird: ['plains', 'forest', 'coast', 'ancient_ruins'],
      dire_wolf: ['forest', 'mountains', 'ancient_ruins'], ogre: ['swamp', 'mountains', 'ancient_ruins'], wraith: ['ancient_ruins', 'swamp'],
    };
    for (const population of Object.values(snapshot.wildlife)) {
      if (population.count <= 0) continue;
      const habitat = snapshot.places[population.habitatId];
      expect(allowed[population.species]).toContain(habitat.biome);
      expect(habitat.biome).not.toBe('settlement');
      if (population.species === 'fish') expect(['shore', 'water']).toContain(habitat.surface);
      else expect(habitat.surface).toBe('land');
    }
  });

  it('treats two humans as a critical civilization even without monster pressure', async () => {
    const sourceStore = new InMemoryWorldStore();
    const source = await WorldEngine.create({ worldId: 'v14-cardinal-lowpop', seed: 'v14-cardinal-lowpop', store: sourceStore });
    const damaged = source.snapshot();
    Object.values(damaged.agents).slice(2).forEach((agent) => { agent.life.alive = false; agent.life.health = 0; });
    const store = new InMemoryWorldStore();
    await store.initializeWorld(damaged);
    const observation = await new WorldSensors(store).observe(damaged, damaged.now);
    expect(observation.metrics.livingPopulation).toBe(2);
    expect(observation.metrics.monsterPressure).toBe(0);
    const evaluation = new CardinalCore().evaluate('intervene', observation);
    expect(evaluation.detectedProblem?.kind).toBe('civilization_collapse');
    expect(evaluation.decision).toBe('propose');
  });

  it('prioritizes emergency fertility and does not make critical survival wait for Cardinal level/cooldown', async () => {
    const store = new InMemoryWorldStore();
    const world = await WorldEngine.create({ worldId: 'v14-architect', seed: 'v14-architect', store });
    const raw = world.snapshot();
    Object.values(raw.agents).slice(2).forEach((agent) => { agent.life.alive = false; agent.life.health = 0; agent.life.diedAt = raw.now; agent.life.deathCause = 'deprivation'; });
    raw.population.deaths = 4;
    raw.population.lastDeathAt = raw.now;
    raw.now = 240;
    raw.growth.lastExpansionAt = 0;
    const experience = deriveCardinalExperienceFromCounters({ observationCycles: 1, ecologyObservationCycles: 0, evaluatedOutcomes: 0, successfulPredictions: 0 });
    expect(experience.capabilities).not.toContain('world_rule_design');
    const proposal = new CardinalWorldArchitect().consider(
      observeWorldArchitecture(raw),
      experience,
      [],
    );
    expect(proposal?.lawId).toBe('fertility_support');
    expect(proposal?.mechanism).toBe('fertility_support');
    expect(proposal?.necessity).toBeGreaterThanOrEqual(0.95);

    // The independent gateway still checks the actual world, original law bounds
    // and proposal shape, but critical demography bypasses normal learning/cooldown wait.
    const damaged = world.snapshot();
    Object.values(damaged.agents).slice(2).forEach((agent) => { agent.life.alive = false; agent.life.health = 0; agent.life.diedAt = damaged.now; agent.life.deathCause = 'deprivation'; });
    damaged.population.deaths = 4;
    damaged.population.lastDeathAt = damaged.now;
    damaged.governance.lastCardinalAuthorityAt = damaged.now;
    const damagedStore = new InMemoryWorldStore();
    await damagedStore.initializeWorld(damaged);
    const damagedWorld = await WorldEngine.open({ worldId: damaged.id, store: damagedStore });
    const expected = damagedWorld.snapshot();
    const gateway = new IndependentWorldAuthorityGateway(damagedWorld, 48);
    const record = await gateway.execute(
      { ...proposal!, worldId: expected.id, proposedAt: expected.now, evidenceEventIds: [] },
      expected,
      experience,
    );
    expect(record.authorized).toBe(true);
    expect(damagedWorld.snapshot().governance.laws.fertility_support.value).toBeGreaterThan(0.55);
  });

  it('starts a new epoch with ten founders while Cardinal retains all-time experience', async () => {
    const store = new InMemoryWorldStore();
    const controlLog = new InMemoryAppendOnlyLog();
    const runtime = await LiveWorldRuntime.create({ mode: 'observer', seed: 'v14-reset', worldId: 'v14-reset', store, controlLog });
    let before = await runtime.tick();
    before = await runtime.tick();
    before = await runtime.tick();
    const beforeConsole = await runtime.cardinalConsole();
    const beforeExperience = beforeConsole.evaluations.at(-1)?.experience.observationCycles ?? 0;
    const oldIds = new Set(Object.keys(before.world.agents));

    const reset = await runtime.resetWorld('v14-reset-new');
    expect(reset.epoch).toBe(2);
    expect(reset.calendar.elapsedWorldMinutes).toBe(0);
    expect(humanCount(reset)).toBe(10);
    expect(Object.keys(reset.wildlife)).toHaveLength(0);
    expect(Object.keys(reset.relationships)).toHaveLength(0);
    expect(Object.keys(reset.agents).some((id) => oldIds.has(id))).toBe(false);

    await runtime.tick();
    const afterConsole = await runtime.cardinalConsole();
    const afterExperience = afterConsole.evaluations.at(-1)?.experience.observationCycles ?? 0;
    expect(afterExperience).toBeGreaterThan(beforeExperience);
  });
});
