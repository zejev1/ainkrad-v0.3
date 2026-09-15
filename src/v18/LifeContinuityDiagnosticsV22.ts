import type { AgentState, WorldState } from '../world/types';
import { WORLD_MINUTES_PER_YEAR } from '../world/WorldClock';
import {
  HUMAN_MINIMUM_REPRODUCTIVE_AGE_V16,
  SAPIENT_RACE_LIFE_PROFILES_V16,
} from '../v16/SocietyFoundationV16';

/** Reporting only. Passing these gates is not consent, a partner, or a birth. */
export function passesReproductiveAgeHealthV22(agent: Readonly<AgentState>): boolean {
  const race = agent.race ?? 'human';
  const profile = SAPIENT_RACE_LIFE_PROFILES_V16[race];
  const minimumAge = race === 'human' ? HUMAN_MINIMUM_REPRODUCTIVE_AGE_V16 : profile.adultAtAge;
  return agent.life.alive && agent.life.ageYears >= minimumAge &&
    agent.life.ageYears <= profile.maximumReproductiveAge &&
    agent.life.health >= profile.minimumReproductiveHealth;
}

/** Zero practice means no demonstrated specialty, not alphabetical adventurer. */
export function strongestPracticedKindV22(practice: Readonly<Record<string, number>>): string {
  return Object.entries(practice).filter(([, amount]) => Number.isFinite(amount) && amount > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? 'none';
}

const round = (value: number) => Number(value.toFixed(6));

/** Read-only snapshot diagnostics, grouped by actual race and generation.
 * Totals include deceased residents. Skill means explicitly cover living
 * adults, not infants. Absent new receipts are reported as null, never as zero.
 */
export function lifeContinuityDiagnosticsV22(world: Readonly<WorldState>) {
  const all = Object.values(world.agents);
  const byRaceGeneration: Record<string, {
    everBornOrFounded: number; living: number; livingAdults: number;
    adultExplorationSkillSum: number; explorationActionReceipts: number;
    allActionReceipts: number; reproductiveAgeHealth: number;
    maleAgeHealth: number; femaleAgeHealth: number;
    parentIdsKnown: number; trackedResidents: number;
    exploration: Record<string, number>;
  }> = {};
  const receiptFields = ['choices', 'journeyAttempts', 'journeysStarted', 'failedRoutes',
    'arrivals', 'surveys', 'newlyMapped', 'campRests', 'practicalLessons', 'provisionsTaken'] as const;
  const newReceipts: Record<string, number> = Object.fromEntries(receiptFields.map(k => [k, 0]));
  let trackedResidents = 0;
  const professions: Record<string, number> = {};
  const strongestPractice: Record<string, number> = {};
  for (const a of all) {
    const key = `${a.race ?? 'human'}:generation-${a.life.generation}`;
    const g = byRaceGeneration[key] ??= {
      everBornOrFounded: 0, living: 0, livingAdults: 0, adultExplorationSkillSum: 0,
      explorationActionReceipts: 0, allActionReceipts: 0, reproductiveAgeHealth: 0,
      maleAgeHealth: 0, femaleAgeHealth: 0, parentIdsKnown: 0,
      trackedResidents: 0, exploration: Object.fromEntries(receiptFields.map(k => [k, 0])),
    };
    g.everBornOrFounded++;
    if (a.life.parentIds.length) g.parentIdsKnown++;
    const oldEvidence = world.v16?.residentEvidenceByAgentId[a.id];
    g.explorationActionReceipts += oldEvidence?.actionCounts.explore ?? 0;
    g.allActionReceipts += Object.values(oldEvidence?.actionCounts ?? {}).reduce((sum, n) => sum + (n ?? 0), 0);
    const livelihood = world.v18?.livelihoodByAgentId[a.id];
    const receipt = livelihood?.explorationEvidence;
    if (receipt) {
      trackedResidents++; g.trackedResidents++;
      for (const field of receiptFields) {
        g.exploration[field] += receipt[field]; newReceipts[field] += receipt[field];
      }
    }
    if (!a.life.alive) continue;
    g.living++;
    if (a.life.stage === 'adult') {
      g.livingAdults++; g.adultExplorationSkillSum += a.skills.exploration;
    }
    if (passesReproductiveAgeHealthV22(a)) {
      g.reproductiveAgeHealth++;
      if (a.sex === 'male') g.maleAgeHealth++;
      if (a.sex === 'female') g.femaleAgeHealth++;
    }
    const profession = livelihood?.primary ?? 'missing';
    professions[profession] = (professions[profession] ?? 0) + 1;
    const strongest = livelihood ? strongestPracticedKindV22(livelihood.practiceByKind) : 'missing';
    strongestPractice[strongest] = (strongestPractice[strongest] ?? 0) + 1;
  }
  const living = all.filter(a => a.life.alive);
  const raceCounts: Record<string, number> = {};
  const raceBirthCounts: Record<string, number> = {};
  const raceDeaths: Record<string, number> = {};
  for (const a of all) {
    const race = a.race ?? 'human';
    if (a.life.alive) raceCounts[race] = (raceCounts[race] ?? 0) + 1;
    else raceDeaths[race] = (raceDeaths[race] ?? 0) + 1;
    if (a.life.generation > 0) raceBirthCounts[race] = (raceBirthCounts[race] ?? 0) + 1;
  }
  const family = Object.fromEntries(Object.entries(world.v16?.raceFamilyOpportunityByRace ?? {}).map(([race, r]) => [race, {
    // The old counter is a pre-window pool sum, not actual personal decisions.
    candidatePoolSum: r.eligiblePairChecks,
    scheduledPairChecks: r.scheduledPairChecks ?? null,
    evaluatedPairChecks: r.evaluatedPairChecks ?? null,
    voluntaryIntimacyChoices: r.voluntaryIntimacyChoices,
    voluntaryChildChoices: r.voluntaryChildChoices,
    birthsSinceTracking: r.birthsSinceTracking,
  }]));
  const adventure = world.v19?.adventureEconomy;
  return {
    worldYear: round(world.calendar.elapsedWorldMinutes / WORLD_MINUTES_PER_YEAR),
    worldId: world.id, living: living.length, raceCounts, raceBirthCounts, raceDeaths,
    moving: living.filter(a => a.movement).length,
    places: Object.keys(world.places).length, settlements: Object.keys(world.settlements).length,
    family, professions, strongestPractice,
    explorationTracking: trackedResidents ? { trackedResidents, ...Object.fromEntries(Object.entries(newReceipts).map(([k, n]) => [k, round(n)])) } : null,
    byRaceGeneration: Object.fromEntries(Object.entries(byRaceGeneration).sort(([a], [b]) => a.localeCompare(b)).map(([key, g]) => [key, {
      ...g,
      adultExplorationSkillMean: g.livingAdults ? round(g.adultExplorationSkillSum / g.livingAdults) : null,
      adultExplorationSkillSum: undefined,
      exploration: g.trackedResidents ? Object.fromEntries(Object.entries(g.exploration).map(([k, n]) => [k, round(n)])) : null,
    }])),
    adventure: adventure ? {
      runs: adventure.totalRuns, successfulRuns: adventure.totalSuccessfulRuns,
      totalTradeVolume: round(adventure.totalTradeVolume),
    } : null,
  };
}
