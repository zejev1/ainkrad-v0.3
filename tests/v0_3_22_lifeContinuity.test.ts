import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorldEngine } from '../src/world/WorldEngine';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WORLD_MINUTES_PER_YEAR as YEAR } from '../src/world/WorldClock';
import { CANONICAL_WORLD_QUANTUM_MINUTES as QUANTUM } from '../src/v15/WorldTimeContract';
import { residentOpportunityWindow } from '../src/world/ResidentOpportunityWindow';
import { residentChoiceCandidates } from '../src/world/ResidentChoice';
import { residentExplorationTarget } from '../src/world/ResidentExploration';
import { explorationEvidence, recordExplorationArrival } from '../src/world/ResidentExplorationEvidence';
import { ensureLifeRhythmV18, ensureLivelihoodV18 } from '../src/v18/LivelihoodAndRhythmV18';
import type { AgentState, WorldState } from '../src/world/types';

// These tests exercise the real engine methods in isolated worlds. No fixture
// is persisted to a user's world, and no production personality rule is changed.
async function fixture(count = 10) {
  const engine = await WorldEngine.create({
    worldId: 'life-continuity-test', seed: 'life-continuity-test',
    store: new InMemoryWorldStore(),
    agentNames: Array.from({ length: count }, (_, i) => `Resident ${i}`),
  });
  const inner = engine as any;
  // Open only a disposable test workspace, with no persistence or public
  // authority path. The production mutable-state guard stays unchanged.
  inner.workingState = engine.snapshot();
  inner.stagedEvents = [];
  inner.stagedMemories = [];
  const world: WorldState = inner.state;
  const agents = Object.values(world.agents);
  for (const a of agents) {
    a.energy = 0.9; a.resources = 0.6; a.stress = 0.1;
    a.life.ageYears = 25; a.life.stage = 'adult'; a.life.health = 0.9;
    ensureLifeRhythmV18(world, a).satiety = 0.8;
  }
  return { engine, inner, world, agents };
}

async function travelFixture() {
  const f = await fixture();
  const a = f.agents[0];
  const frontier = Object.values(f.world.places).find(p => p.kind === 'outskirts')!;
  expect(frontier).toBeDefined();
  frontier.settlementId = undefined;
  a.locationId = a.homeId;
  a.position = { x: f.world.places[a.homeId].mapX, y: f.world.places[a.homeId].mapY, layerId: 'surface' };
  a.knownPlaceIds = [...new Set([...(a.knownPlaceIds ?? []), frontier.id])];
  a.plan = { kind: 'explore_frontier', targetPlaceId: frontier.id, startedAt: 1, expiresAt: 49 };
  a.resources = 0.16;
  vi.spyOn(f.inner.rng, 'next').mockReturnValue(0.999);
  return { ...f, a, frontier };
}

afterEach(() => vi.restoreAllMocks());

describe('world-time opportunities do not shrink with unrelated population', () => {
  it.each([10, 97, 241])('gives all %i awake residents one ordinary decision in a quantum', async count => {
    const { inner, agents } = await fixture(count);
    const seen = new Set<string>();
    vi.spyOn(inner, 'stepAgent').mockImplementation((agent: unknown) => {
      seen.add((agent as AgentState).id);
    });
    vi.spyOn(inner, 'beginSecretLibraryYearV18').mockImplementation(() => {});
    vi.spyOn(inner, 'advanceSecretLibraryVisitorsV18').mockReturnValue(new Set());
    await inner.advanceSimulationDynamics(1, QUANTUM);
    expect(seen).toEqual(new Set(agents.map(a => a.id)));
  });
});

describe('persisted family opportunity cursor, not tick modulo pair count', () => {
  it.each([12, 24, 37])('visits all %i stable pairs fairly with a window of eight', size => {
    const pairs = Array.from({ length: size }, (_, i) => `pair-${String(i).padStart(3, '0')}`);
    const counts = new Map(pairs.map(p => [p, 0]));
    let cursor: string | undefined;
    for (let windowIndex = 0; windowIndex < 500; windowIndex++) {
      const window = residentOpportunityWindow(pairs, p => p, 8, cursor);
      cursor = window.afterKey;
      for (const key of window.candidates) counts.set(key, counts.get(key)! + 1);
    }
    expect(Math.min(...counts.values())).toBeGreaterThan(0);
    expect(Math.max(...counts.values()) - Math.min(...counts.values())).toBeLessThanOrEqual(1);
  });

  it('survives list reordering, removal of the cursor pair, and serialization', () => {
    const original = ['a', 'b', 'c', 'd'];
    const first = residentOpportunityWindow(original, p => p, 2);
    const saved = JSON.parse(JSON.stringify({ cursor: first.afterKey }));
    expect(residentOpportunityWindow(['d', 'a', 'c', 'e'], p => p, 2, saved.cursor).candidates)
      .toEqual(['c', 'd']);
    expect(residentOpportunityWindow(['d', 'a', 'c', 'e'], p => p, 2, 'e').candidates)
      .toEqual(['a', 'c']);
    expect(residentOpportunityWindow([], p => p, 2, saved.cursor).afterKey).toBe('b');
  });

  it('does not select anyone for a zero budget or accept an invalid budget', () => {
    expect(residentOpportunityWindow(['a'], p => p, 0, 'a')).toEqual({ candidates: [], afterKey: 'a' });
    expect(() => residentOpportunityWindow(['a'], p => p, NaN)).toThrow();
    expect(() => residentOpportunityWindow(['a'], p => p, -1)).toThrow();
  });

  it('the actual engine persists and advances its cursor without forcing a birth', async () => {
    const { inner, world, agents } = await fixture(13);
    world.relationships = {};
    const father = agents[0]; father.sex = 'male';
    for (const mother of agents.slice(1)) {
      mother.sex = 'female';
      world.relationships[[father.id, mother.id].sort().join('::')] = inner.relationshipFor(father, mother, 0);
    }
    vi.spyOn(inner.rng, 'next').mockReturnValue(0.999);
    const initialDesires = JSON.stringify(world.v15?.familyAgencyByAgentId);
    inner.buildResidentDecisionIndexes(agents);
    world.calendar.elapsedWorldMinutes = 2 * YEAR;
    inner.advanceBirths(12, QUANTUM);
    const local = Object.values(world.v16!.localFamilyOpportunityByKey)[0];
    expect(local.scheduledPairChecks).toBe(8);
    const firstCursor = local.lastConsideredPairId;
    inner.advanceBirths(24, QUANTUM);
    expect(local.scheduledPairChecks).toBe(16);
    expect(local.lastConsideredPairId).not.toBe(firstCursor);
    expect(local.evaluatedPairChecks).toBe(16);
    expect(Object.values(world.agents)).toHaveLength(13);
    expect(JSON.stringify(world.v15?.familyAgencyByAgentId)).toBe(initialDesires);
  });
});

describe('preference is distinct from physical action availability', () => {
  it('keeps a lower positive exploration preference in the resident ballot', () => {
    const candidates = residentChoiceCandidates([
      { action: 'work', score: 1.4 }, { action: 'rest', score: 1 },
      { action: 'explore', score: 0.8 }, { action: 'hunt', score: -Infinity },
    ], new Set(['work', 'rest', 'explore', 'hunt']), 0.49);
    expect(candidates.map(c => c.action)).toEqual(['work', 'rest', 'explore']);
  });
  it('retains age/physical exclusions and the last viable negative-score choice', () => {
    expect(residentChoiceCandidates([
      { action: 'rest', score: -0.6 }, { action: 'explore', score: 9 },
    ], new Set(['rest']), 0.4)).toEqual([{ action: 'rest', score: -0.6 }]);
  });
});

describe('exploration is a prepared physical journey, not a map label', () => {
  it('draws a carried ration from the origin, maps only after arrival and a survey', async () => {
    const { inner, world, a, frontier } = await travelFixture();
    const livelihood = ensureLivelihoodV18(world, a);
    const origin = a.locationId;
    const homeSettlementId = world.places[a.homeId].settlementId!;
    const stockBefore = world.v16!.settlementEconomyById[homeSettlementId].stocks.food;
    inner.performExplore(a, 1);
    expect(a.movement?.targetPlaceId).toBe(frontier.id);
    expect(a.locationId).toBe(origin);
    expect(a.resources).toBeGreaterThan(0.4);
    expect(world.v16!.settlementEconomyById[homeSettlementId].stocks.food).toBeLessThan(stockBefore);
    expect(livelihood.mappedPlaceIds).not.toContain(frontier.id);
    expect(explorationEvidence(world, a).journeysStarted).toBe(1);
    inner.advanceAgentMovement(a, 1_000_000);
    expect(a.locationId).toBe(frontier.id);
    expect(a.movement).toBeUndefined();
    expect(explorationEvidence(world, a).arrivals).toBe(1);
    expect(livelihood.mappedPlaceIds).not.toContain(frontier.id);
    inner.performExplore(a, 2);
    expect(livelihood.mappedPlaceIds).toContain(frontier.id);
    expect(explorationEvidence(world, a).surveys).toBe(1);
    recordExplorationArrival(world, a);
    expect(explorationEvidence(world, a).arrivals).toBe(1);
  });

  it('does not force an already mapped location for the 55% local-survey draw', async () => {
    const { world, a, frontier } = await travelFixture();
    a.plan = undefined;
    const target = residentExplorationTarget(world, a, () => true, [a.locationId], 0.01);
    expect(target).toBe(frontier.id);
  });

  it('permits provisioned local recovery without withdrawing home stores remotely', async () => {
    const { inner, world, a, frontier } = await travelFixture();
    a.locationId = frontier.id;
    a.position = { x: frontier.mapX, y: frontier.mapY, layerId: 'surface' };
    a.energy = 0.15; a.resources = 0.25;
    const oldPlan = structuredClone(a.plan);
    const stocks = JSON.stringify(world.v16!.settlementEconomyById);
    inner.performRest(a, 2);
    expect(a.movement).toBeUndefined();
    expect(a.locationId).toBe(frontier.id);
    expect(a.energy).toBeGreaterThan(0.24);
    expect(a.resources).toBe(0.25);
    expect(a.plan).toEqual(oldPlan);
    expect(JSON.stringify(world.v16!.settlementEconomyById)).toBe(stocks);
    expect(explorationEvidence(world, a).campRests).toBe(1);
  });

  it('still returns physically toward home when the carried food is insufficient', async () => {
    const { inner, world, a, frontier } = await travelFixture();
    a.locationId = frontier.id;
    a.position = { x: frontier.mapX, y: frontier.mapY, layerId: 'surface' };
    a.energy = 0.4; a.resources = 0.04;
    const stocks = JSON.stringify(world.v16!.settlementEconomyById);
    inner.performRest(a, 2);
    expect(a.movement?.targetPlaceId).toBe(a.homeId);
    expect(a.locationId).toBe(frontier.id);
    expect(a.resources).toBe(0.04);
    expect(JSON.stringify(world.v16!.settlementEconomyById)).toBe(stocks);
  });

  it('does not charge travel effort or record a successful journey when routing fails', async () => {
    const { inner, world, a, frontier } = await travelFixture();
    a.resources = 0.6;
    // Exercise a real disconnected graph rather than mock the old global planner.
    world.routes = {};
    const priorEnergy = a.energy;
    const priorSkill = a.skills.exploration;
    expect(inner.beginExplorationJourney(a, frontier.id, 1)).toBe(false);
    expect(a.movement).toBeUndefined();
    expect(a.energy).toBe(priorEnergy);
    expect(a.skills.exploration).toBe(priorSkill);
    expect(ensureLivelihoodV18(world, a).mappedPlaceIds).not.toContain(frontier.id);
    expect(explorationEvidence(world, a).journeysStarted).toBe(0);
    expect(explorationEvidence(world, a).failedRoutes).toBe(1);
  });
});

describe('ordinary teachers can pass practical exploration after Genesis', () => {
  it.each([true, false])('requires physical co-presence: %s', async nearby => {
    const { inner, world, agents } = await fixture(2);
    const [learner, teacher] = agents;
    world.calendar.elapsedWorldMinutes = 20 * YEAR;
    learner.life.generation = 2;
    learner.lastAction = 'explore'; learner.skills.exploration = 0.1;
    teacher.skills.exploration = 0.8;
    teacher.locationId = nearby ? learner.locationId : teacher.homeId;
    const v15 = inner.v15World();
    v15.knowledgeByAgentId[learner.id].survival = 0.1;
    v15.knowledgeByAgentId[teacher.id].survival = 0.9;
    vi.spyOn(inner.rng, 'next').mockReturnValue(0);
    inner.advanceV15LearningFromLivedAction(learner, agents, 1200);
    if (nearby) {
      expect(learner.skills.exploration).toBeGreaterThan(0.1);
      expect(learner.skills.exploration).toBeLessThanOrEqual(0.106);
      expect(explorationEvidence(world, learner).practicalLessons).toBe(1);
      expect(ensureLivelihoodV18(world, learner).mentorIds).toContain(teacher.id);
    } else {
      expect(learner.skills.exploration).toBe(0.1);
      expect(explorationEvidence(world, learner).practicalLessons).toBe(0);
    }
  });
});


describe('exploration does not resurrect an extinct predator when it reveals food', () => {
  it('requires living parents even with reachable prey and a successful recovery roll', async () => {
    const { inner, world } = await fixture();
    const home = world.places.outskirts;
    const habitatId = 'extinct-predator-regression';
    world.places[habitatId] = { ...home, id: habitatId, kind: 'forest', biome: 'forest', connectedPlaceIds: [] };
    world.wildlife.extinct = {
      id: 'extinct', species: 'dire_wolf', habitatId, count: 0,
      carryingCapacity: 10, reproductionRate: 1, alertness: 0.5,
      threat: 0.7, isMonster: true, lastChangedAt: 0,
    };
    world.wildlife.prey = {
      id: 'prey', species: 'deer', habitatId, count: 10,
      carryingCapacity: 10, reproductionRate: 0, alertness: 0.2,
      threat: 0.03, isMonster: false, lastChangedAt: 0,
    };
    vi.spyOn(inner.rng, 'next').mockReturnValue(0);
    inner.advanceWildlife(world.environment, 60);
    expect(world.wildlife.extinct.count).toBe(0);
  });
});
