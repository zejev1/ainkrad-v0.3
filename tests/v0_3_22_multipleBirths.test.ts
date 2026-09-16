import { describe, expect, it } from 'vitest';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WorldEngine } from '../src/world/WorldEngine';
import {
  choosePregnancyMultiplicityV22,
  humanMultipleBirthProbabilitiesV22,
  maternalChildbirthMortalityRiskV22,
  newbornMultipleHealthPenaltyV22,
} from '../src/v22/MultipleBirthsV22';
import type { AgentState, WorldState } from '../src/world/types';

function freezeUnrelatedRuntime(engine: WorldEngine, roll: number): void {
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
  runtime.rng.next = () => roll;
  runtime.rng.between = (minimum: number, maximum: number) =>
    minimum + (maximum - minimum) * roll;
}

function prepareDuePregnancy(
  engine: WorldEngine,
  expectedChildCount?: 1 | 2 | 3 | 4,
): { world: WorldState; mother: AgentState; father: AgentState; pairId: string } {
  const world = (engine as any).committedState as WorldState;
  const [father, mother] = Object.values(world.agents);
  father.sex = 'male';
  mother.sex = 'female';
  for (const parent of [father, mother]) {
    parent.race = 'human';
    parent.life.alive = true;
    parent.life.ageYears = 30;
    parent.life.stage = 'adult';
    parent.life.health = 0.95;
    parent.locationId = 'commons';
    parent.position = {
      x: world.places.commons.mapX,
      y: world.places.commons.mapY,
      layerId: 'surface',
    };
    parent.movement = undefined;
  }
  const pairId = [father.id, mother.id].sort().join('::');
  world.relationships[pairId] = {
    agentA: father.id,
    agentB: mother.id,
    trust: 0.99,
    affinity: 0.99,
    respect: 0.99,
    conflict: 0,
    updatedAt: 0,
  };
  world.v16!.familyLifecycleByPairId = {
    [pairId]: {
      id: pairId,
      pairId,
      agentAId: father.id,
      agentBId: mother.id,
      race: 'human',
      settlementId: 'settlement_ainkrad',
      meetingPlaceId: 'commons',
      stage: 'pregnant',
      createdWorldMinute: 0,
      lastAffirmedWorldMinute: 0,
      lastPhysicalMeetingWorldMinute: 0,
      pregnantAgentId: mother.id,
      conceptionWorldMinute: 0,
      dueWorldMinute: 0,
      ...(expectedChildCount === undefined ? {} : { expectedChildCount }),
    },
  };
  return { world, mother, father, pairId };
}

describe('human multiple births', () => {
  it('keeps natural multiples rare and fertility bounded instead of turning birth into a litter mechanic', () => {
    const natural = humanMultipleBirthProbabilitiesV22(0);
    const gifted = humanMultipleBirthProbabilitiesV22(1);

    expect(natural.singleton + natural.twins + natural.triplets + natural.quadruplets).toBeCloseTo(1, 12);
    expect(gifted.singleton + gifted.twins + gifted.triplets + gifted.quadruplets).toBeCloseTo(1, 12);
    expect(natural.twins).toBeGreaterThan(0);
    expect(natural.triplets).toBeGreaterThan(0);
    expect(natural.quadruplets).toBeGreaterThan(0);
    expect(gifted.twins).toBeGreaterThan(natural.twins);
    expect(gifted.triplets).toBeGreaterThan(natural.triplets);
    expect(gifted.quadruplets).toBeGreaterThan(natural.quadruplets);
    expect(gifted.twins).toBeLessThan(0.06);
    expect(gifted.triplets).toBeLessThan(0.005);
    expect(gifted.quadruplets).toBeLessThan(0.001);
  });

  it('chooses multiplicity once from the conception roll and leaves other races singleton', () => {
    const p = humanMultipleBirthProbabilitiesV22(0);
    expect(choosePregnancyMultiplicityV22('human', 0, p.quadruplets / 2)).toBe(4);
    expect(choosePregnancyMultiplicityV22('human', 0, p.quadruplets + p.triplets / 2)).toBe(3);
    expect(
      choosePregnancyMultiplicityV22(
        'human',
        0,
        p.quadruplets + p.triplets + p.twins / 2,
      ),
    ).toBe(2);
    expect(choosePregnancyMultiplicityV22('human', 0, 0.9)).toBe(1);
    expect(choosePregnancyMultiplicityV22('elf', 1, 0)).toBe(1);
  });

  it('uses an exact 50 percent base maternal mortality risk for quadruplet delivery', () => {
    expect(maternalChildbirthMortalityRiskV22(1)).toBe(0);
    expect(maternalChildbirthMortalityRiskV22(2)).toBe(0.005);
    expect(maternalChildbirthMortalityRiskV22(3)).toBe(0.06);
    expect(maternalChildbirthMortalityRiskV22(4)).toBe(0.5);
    expect(newbornMultipleHealthPenaltyV22(4)).toBeGreaterThan(newbornMultipleHealthPenaltyV22(3));
  });

  it('creates four distinct Sparks from one quadruplet pregnancy and can kill the mother from childbirth', async () => {
    const store = new InMemoryWorldStore();
    const engine = await WorldEngine.create({
      worldId: 'quadruplet-birth-test',
      seed: 'quadruplet-birth-test',
      store,
      agentNames: ['Отец', 'Мать'],
    });
    const { world, mother, father, pairId } = prepareDuePregnancy(engine, 4);
    const birthsBefore = world.population.births;
    const agentsBefore = Object.keys(world.agents).length;

    // A stable low roll also guarantees the 50% mortality branch triggers.
    freezeUnrelatedRuntime(engine, 0.1);
    await engine.step(12, 1);

    const after = engine.snapshot();
    const children = Object.values(after.agents).filter(
      (agent) =>
        agent.life.parentIds.includes(father.id) &&
        agent.life.parentIds.includes(mother.id),
    );
    expect(after.population.births - birthsBefore).toBe(4);
    expect(Object.keys(after.agents).length - agentsBefore).toBe(4);
    expect(children).toHaveLength(4);
    expect(new Set(children.map((child) => child.id)).size).toBe(4);
    expect(new Set(children.map((child) => child.name)).size).toBe(4);
    expect(children.every((child) => child.locationId === 'commons')).toBe(true);
    expect(after.agents[mother.id].life.alive).toBe(false);
    expect(after.agents[mother.id].life.deathCause).toBe('childbirth');
    expect(after.v16!.familyLifecycleByPairId[pairId]).toBeUndefined();
  });

  it('keeps older pregnancies without expectedChildCount singleton and migration-safe', async () => {
    const store = new InMemoryWorldStore();
    const engine = await WorldEngine.create({
      worldId: 'legacy-singleton-pregnancy-test',
      seed: 'legacy-singleton-pregnancy-test',
      store,
      agentNames: ['Отец', 'Мать'],
    });
    const { world, mother, father } = prepareDuePregnancy(engine, undefined);
    const birthsBefore = world.population.births;

    freezeUnrelatedRuntime(engine, 0.9);
    await engine.step(12, 1);

    const after = engine.snapshot();
    const children = Object.values(after.agents).filter(
      (agent) =>
        agent.life.parentIds.includes(father.id) &&
        agent.life.parentIds.includes(mother.id),
    );
    expect(after.population.births - birthsBefore).toBe(1);
    expect(children).toHaveLength(1);
    expect(after.agents[mother.id].life.alive).toBe(true);
  });
});
