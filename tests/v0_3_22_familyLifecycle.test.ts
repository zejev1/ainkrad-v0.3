import { describe, expect, it } from 'vitest';
import { WorldEngine } from '../src/world/WorldEngine';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WORLD_MINUTES_PER_YEAR } from '../src/world/WorldClock';
import type { AgentState, WorldState } from '../src/world/types';

function freezeUnrelatedRuntime(engine: WorldEngine): void {
  const runtime = engine as any;
  runtime.stepAgent = () => undefined;
  runtime.beginSecretLibraryYearV18 = () => undefined;
  runtime.advanceSecretLibraryVisitorsV18 = () => new Set<string>();
  runtime.advanceSapientRaces = () => undefined;
  runtime.advanceSettlementsV18 = () => undefined;
  runtime.advanceVoluntaryResettlement = () => undefined;
  runtime.advanceSettlementMaterialProjects = () => undefined;
  runtime.advanceSettlementRelationsAndConflict = () => undefined;
  runtime.advanceBurialAftercare = () => undefined;
  runtime.advanceMysticism = () => undefined;
  runtime.advanceCollectiveMyth = () => undefined;
  runtime.rng.next = () => 0.001;
  runtime.rng.between = (minimum: number, maximum: number) =>
    minimum + (maximum - minimum) * 0.001;
}

function prepareWillingPair(engine: WorldEngine): {
  a: AgentState;
  b: AgentState;
  pairId: string;
} {
  const world = (engine as any).committedState as WorldState;
  const [a, b] = Object.values(world.agents);
  for (const resident of [a, b]) {
    resident.life.ageYears = 30;
    resident.life.stage = 'adult';
    resident.life.health = 0.95;
    resident.stress = 0.05;
    resident.resources = 0.9;
    world.v15!.familyAgencyByAgentId[resident.id] = {
      physicalIntimacyInclination: 1,
      childDesire: 1,
      autonomy: 1,
    };
    resident.locationId = 'commons';
    resident.position = {
      x: world.places.commons.mapX,
      y: world.places.commons.mapY,
      layerId: 'surface',
    };
    resident.movement = undefined;
  }
  a.sex = 'male';
  b.sex = 'female';
  const pairId = [a.id, b.id].sort().join('::');
  world.relationships[pairId] = {
    agentA: a.id,
    agentB: b.id,
    trust: 0.99,
    affinity: 0.99,
    respect: 0.99,
    conflict: 0,
    updatedAt: 0,
  };
  world.v16!.familyLifecycleByPairId = {};
  return { a, b, pairId };
}

describe('causal family lifecycle', () => {
  it('keeps child choice, intimacy, conception, pregnancy and birth physically causal', async () => {
    const store = new InMemoryWorldStore();
    const engine = await WorldEngine.create({
      worldId: 'family-causal-test',
      seed: 'family-causal-test',
      store,
      agentNames: ['А', 'Б'],
    });
    const { a, b, pairId } = prepareWillingPair(engine);
    freezeUnrelatedRuntime(engine);
    const quantum = WORLD_MINUTES_PER_YEAR / 60;

    // Both voluntary choices may line up in one real encounter, so conception
    // may occur then. The child is still never born instantly.
    await engine.step(12, quantum);
    let world = engine.snapshot();
    const pregnancy = world.v16!.familyLifecycleByPairId[pairId];
    expect(world.population.births).toBe(0);
    expect(pregnancy.stage).toBe('pregnant');
    expect(pregnancy.pregnantAgentId).toBe(b.id);
    expect(pregnancy.dueWorldMinute).toBeGreaterThan(world.calendar.elapsedWorldMinutes);
    const expectedChildCount = pregnancy.expectedChildCount ?? 1;
    expect(expectedChildCount).toBeGreaterThanOrEqual(1);
    expect(expectedChildCount).toBeLessThanOrEqual(4);

    // Pregnancy does not depend on keeping the parents physically together.
    const mutable = (engine as any).committedState as WorldState;
    mutable.agents[a.id].locationId = 'commons';
    mutable.agents[b.id].locationId = mutable.agents[b.id].homeId;
    mutable.agents[a.id].movement = undefined;
    mutable.agents[b.id].movement = undefined;
    await engine.step(24, quantum);
    world = engine.snapshot();
    expect(world.population.births).toBe(0);
    expect(world.v16!.familyLifecycleByPairId[pairId]?.stage).toBe('pregnant');

    // Birth occurs only after canonical gestation time and at the mother's
    // real physical place, while family home remains a separate property.
    const due = world.v16!.familyLifecycleByPairId[pairId]!.dueWorldMinute!;
    const toDue = due - world.calendar.elapsedWorldMinutes + 1;
    await engine.step(48, toDue);
    world = engine.snapshot();
    expect(world.population.births).toBe(expectedChildCount);
    expect(world.v16!.familyLifecycleByPairId[pairId]).toBeUndefined();
    const children = Object.values(world.agents).filter(
      (resident) =>
        resident.life.parentIds.includes(a.id) &&
        resident.life.parentIds.includes(b.id),
    );
    expect(children).toHaveLength(expectedChildCount);
    for (const child of children) {
      expect(child.locationId).toBe(world.agents[b.id].locationId);
    }
  });

  it('does not conceive an existing child intention while the parents are apart', async () => {
    const store = new InMemoryWorldStore();
    const engine = await WorldEngine.create({
      worldId: 'family-no-remote-conception-test',
      seed: 'family-no-remote-conception-test',
      store,
      agentNames: ['А', 'Б'],
    });
    const { a, b, pairId } = prepareWillingPair(engine);
    freezeUnrelatedRuntime(engine);
    const quantum = WORLD_MINUTES_PER_YEAR / 60;
    const mutable = (engine as any).committedState as WorldState;
    mutable.v16!.familyLifecycleByPairId[pairId] = {
      id: pairId,
      pairId,
      agentAId: a.id,
      agentBId: b.id,
      race: 'human',
      settlementId: 'settlement_ainkrad',
      meetingPlaceId: 'commons',
      stage: 'intending',
      createdWorldMinute: 0,
      lastAffirmedWorldMinute: 0,
      lastPhysicalMeetingWorldMinute: 0,
    };
    mutable.agents[a.id].locationId = 'commons';
    mutable.agents[b.id].locationId = mutable.agents[b.id].homeId;
    mutable.agents[a.id].movement = undefined;
    mutable.agents[b.id].movement = undefined;

    await engine.step(12, quantum);
    let world = engine.snapshot();
    expect(world.population.births).toBe(0);
    expect(world.v16!.familyLifecycleByPairId[pairId]?.stage).toBe('intending');

    for (const id of [a.id, b.id]) {
      const resident = ((engine as any).committedState as WorldState).agents[id];
      resident.locationId = 'commons';
      resident.position = {
        x: mutable.places.commons.mapX,
        y: mutable.places.commons.mapY,
        layerId: 'surface',
      };
      resident.movement = undefined;
    }
    await engine.step(24, quantum);
    world = engine.snapshot();
    expect(world.population.births).toBe(0);
    expect(world.v16!.familyLifecycleByPairId[pairId]?.stage).toBe('pregnant');
  });

  it('repairs older saves additively instead of resetting world data', async () => {
    const sourceStore = new InMemoryWorldStore();
    const source = await WorldEngine.create({
      worldId: 'family-schema-repair-test',
      seed: 'family-schema-repair-test',
      store: sourceStore,
      agentNames: ['А', 'Б'],
    });
    const legacy = source.snapshot() as WorldState & {
      v16: NonNullable<WorldState['v16']> & {
        familyLifecycleByPairId?: NonNullable<WorldState['v16']>['familyLifecycleByPairId'];
      };
    };
    const peopleBefore = Object.keys(legacy.agents);
    const rngBefore = legacy.determinism.rngState;
    delete (legacy.v16 as any).familyLifecycleByPairId;

    const store = new InMemoryWorldStore();
    await store.initializeWorld(legacy as WorldState);
    const reopened = await WorldEngine.open({ worldId: legacy.id, store });
    const repaired = reopened.snapshot();
    expect(repaired.v16!.familyLifecycleByPairId).toEqual({});
    expect(Object.keys(repaired.agents)).toEqual(peopleBefore);
    expect(repaired.determinism.rngState).toBe(rngBefore);
  });
});
