import { describe, expect, it } from 'vitest';
import { CardinalCore } from '../src/cardinal/CardinalCore';
import { buildCardinalResearchContext } from '../src/cardinal/CardinalResearch';
import { LogBackedCardinalJournal } from '../src/cardinal/LogBackedCardinalJournal';
import { IndependentInterventionGateway } from '../src/cardinal/InterventionGateway';
import { InMemoryAppendOnlyLog } from '../src/persistence/AppendOnlyLog';
import { WorldSensors } from '../src/sensors/WorldSensors';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WorldEngine } from '../src/world/WorldEngine';

describe('v0.3.13 release audit', () => {
  it('starts the default human line as 3 male + 3 female with progression', async () => {
    const store = new InMemoryWorldStore();
    const world = await WorldEngine.create({
      worldId: 'audit-founders',
      seed: 'audit-founders-seed',
      store,
      startTime: 0,
    });
    const living = Object.values(world.snapshot().agents).filter((agent) => agent.life.alive);
    expect(living).toHaveLength(6);
    expect(living.filter((agent) => agent.race === 'human')).toHaveLength(6);
    expect(living.filter((agent) => agent.sex === 'male')).toHaveLength(3);
    expect(living.filter((agent) => agent.sex === 'female')).toHaveLength(3);
    expect(living.every((agent) => (agent.progression?.level ?? 0) >= 1)).toBe(true);
  });

  it('migrates a stopped v0.3.12 world with only three survivors without replacing their minds', async () => {
    const sourceStore = new InMemoryWorldStore();
    const source = await WorldEngine.create({
      worldId: 'audit-three-survivors',
      seed: 'audit-three-survivors-seed',
      store: sourceStore,
      startTime: 0,
    });
    const legacy = source.snapshot() as any;
    legacy.rulesVersion = 'ainkrad-world-rules-0.3.12';
    legacy.revision = 0;
    const agents = Object.values(legacy.agents) as any[];
    const survivingIds = agents.slice(0, 3).map((agent) => agent.id);
    const survivingMinds = Object.fromEntries(
      agents.slice(0, 3).map((agent) => [agent.id, structuredClone(agent.mind)]),
    );
    for (const [index, agent] of agents.entries()) {
      delete agent.sex;
      delete agent.race;
      delete agent.progression;
      if (index >= 3) {
        agent.life.alive = false;
        agent.life.health = 0;
        agent.life.diedAt = 1;
        agent.life.deathCause = 'monster';
      }
    }
    legacy.population.deaths = 3;
    legacy.population.lastDeathAt = 1;

    const store = new InMemoryWorldStore();
    await store.initializeWorld(legacy);
    const opened = await WorldEngine.open({ worldId: legacy.id, store });
    const migrated = opened.snapshot();
    const living = Object.values(migrated.agents).filter((agent) => agent.life.alive);
    expect(living.map((agent) => agent.id).sort()).toEqual([...survivingIds].sort());
    expect(living.some((agent) => agent.sex === 'male')).toBe(true);
    expect(living.some((agent) => agent.sex === 'female')).toBe(true);
    for (const id of survivingIds) {
      expect(migrated.agents[id].mind).toEqual(survivingMinds[id]);
      expect(migrated.agents[id].race).toBe('human');
      expect((migrated.agents[id].progression?.level ?? 0)).toBeGreaterThanOrEqual(1);
    }
  });

  it('keeps Cardinal accumulated experience across policy/sensor advancement', async () => {
    const log = new InMemoryAppendOnlyLog();
    const journal = new LogBackedCardinalJournal(log);
    const oldCore = new CardinalCore('ainkrad-cardinal-policy-0.3.11');
    for (let tick = 1; tick <= 12; tick += 1) {
      await journal.appendEvaluation(
        oldCore.evaluate('observer', {
          sensorVersion: 'ainkrad-world-sensors-0.3.11',
          worldId: 'audit-cardinal-memory',
          worldRevision: tick,
          observedAt: tick,
          metrics: {
            populationActivity: 0.5,
            averageStress: 0.2,
            socialIsolation: 0.2,
            conflictPressure: 0.1,
            safetyPressure: 0.2,
            resourcePressure: 0.2,
            relationshipDiversity: 0.6,
            recoveryCapacity: 0.8,
            exploredWorldRatio: 0.4,
            wildlifePressure: 0.2,
            ecologicalDiversity: 0.5,
            activeSignalCount: 0,
          },
          evidenceEventIds: [],
          limitations: [],
        }),
      );
    }
    const core = new CardinalCore();
    const context = await buildCardinalResearchContext(
      journal,
      'audit-cardinal-memory',
      13,
      core.policyVersion,
      'ainkrad-world-sensors-0.3.13',
    );
    expect(context.experience.observationCycles).toBe(12);
    expect(context.priorEvaluations).toHaveLength(0);
  });

  it('lets Cardinal safety proposal pass the Gateway and measurably reduce danger without mind writes', async () => {
    const store = new InMemoryWorldStore();
    const world = await WorldEngine.create({
      worldId: 'audit-safety-chain',
      seed: 'audit-safety-chain-seed',
      store,
      startTime: 0,
    });
    await world.applyDisturbance('safety_shock', 0.45, 1, 12, 'audit-safety-shock');
    const sensors = new WorldSensors(store);
    const beforeWorld = world.snapshot();
    const before = await sensors.observe(beforeWorld, beforeWorld.now);
    const mindsBefore = Object.fromEntries(
      Object.values(beforeWorld.agents).map((agent) => [agent.id, structuredClone(agent.mind)]),
    );
    const evaluation = new CardinalCore().evaluate('intervene', before);
    expect(evaluation.proposal?.kind).toBe('safety_support');
    expect(evaluation.proposal?.prediction.metric).toBe('safetyPressure');
    const gateway = new IndependentInterventionGateway(world, {
      minInterval: 0,
      effectDuration: 8,
    });
    const record = await gateway.execute(
      evaluation.evaluationId,
      evaluation.proposal!,
      beforeWorld,
      beforeWorld.now,
    );
    expect(record.authorized).toBe(true);
    expect(record.executed).toBe(true);
    const afterWorld = world.snapshot();
    const after = await sensors.observe(afterWorld, afterWorld.now);
    expect(after.metrics.safetyPressure).toBeLessThan(before.metrics.safetyPressure);
    expect(
      Object.fromEntries(Object.values(afterWorld.agents).map((agent) => [agent.id, agent.mind])),
    ).toEqual(mindsBefore);
  });

  it('does not count other intelligent races as humans and allows lived progression', async () => {
    const store = new InMemoryWorldStore();
    const world = await WorldEngine.create({
      worldId: 'audit-races-levels',
      seed: 'audit-races-levels-seed',
      store,
      startTime: 0,
    });
    for (let tick = 1; tick <= 600; tick += 1) {
      await world.step(tick);
    }
    const snapshot = world.snapshot();
    const living = Object.values(snapshot.agents).filter((agent) => agent.life.alive);
    const humans = living.filter((agent) => (agent.race ?? 'human') === 'human');
    const otherSapients = living.filter((agent) => (agent.race ?? 'human') !== 'human');
    const observation = await new WorldSensors(store).observe(snapshot, snapshot.now);
    expect(observation.metrics.livingPopulation).toBe(humans.length);
    expect(observation.metrics.sapientPopulation).toBe(living.length);
    expect(otherSapients.length).toBeGreaterThan(0);
    expect(observation.metrics.raceDiversity).toBeGreaterThan(1);
    expect(
      Object.values(snapshot.agents).some(
        (agent) => (agent.progression?.experience ?? 0) > 0 && (agent.progression?.level ?? 1) > 1,
      ),
    ).toBe(true);
  });
});
