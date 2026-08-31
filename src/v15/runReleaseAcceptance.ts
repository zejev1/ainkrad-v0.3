import { InMemoryWorldStore } from '../world/InMemoryWorldStore';
import { WorldEngine } from '../world/WorldEngine';
import type { WorldEvent } from '../world/events';
import type { AgentState, WorldState } from '../world/types';
import {
  auditPostGenesisSecondGenerationV15,
  auditThirdGenerationTeachingChainV15,
  type GenerationResidentAuditV15,
  type GenerationWorldAuditV15,
} from './GenerationalKnowledgeAuditV15';
import { isGenesisTeacherActive } from './GenesisBootstrap';
import { evaluateTeachingEligibilityV15 } from './LifeStageLearningV15';
import {
  auditV15LongRun,
  type V15LongRunSnapshot,
} from './V15LongRunAudit';
import {
  CANONICAL_WORLD_QUANTUM_MINUTES,
  WORLD_MINUTES_PER_YEAR,
} from './WorldTimeContract';

const RELEASE_SEEDS = [
  'v15-longrun-04',
  'v15-longrun-05',
  'v15-longrun-13',
] as const;
const TARGET_YEARS = new Set([8, 10, 12, 30]);
const QUARTERS_PER_YEAR = 4;
const FINAL_YEAR = 30;
const TEACHER_KNOWLEDGE_FLOOR = 0.22;

interface TargetYearEvidence {
  year: number;
  snapshot: V15LongRunSnapshot;
  livingByGeneration: Record<string, number>;
  postGenesisFindings: ReturnType<
    typeof auditPostGenesisSecondGenerationV15
  >;
}

interface ReleaseSeedEvidence {
  seed: string;
  worldId: string;
  targetYears: TargetYearEvidence[];
  final: {
    livingByGeneration: Record<string, number>;
    livingPopulation: number;
    births: number;
    deaths: number;
    deathCauses: Record<string, number>;
    renewableBase: number;
    storedResources: number;
    genesisActiveCount: number;
    ordinaryWildlifeCount: number;
    ordinaryWildlifeCapacity: number;
    monsterCount: number;
    monsterCapacity: number;
    discoveredRegionCount: number;
    learning: {
      ordinaryLessonEvents: number;
      generationOneToTwoLessonEvents: number;
      genesisLessonEventsAfterYearThree: number;
    };
    familyAgencyProfiles: number;
    agentRecords: number;
  };
  longRunAlerts: ReturnType<typeof auditV15LongRun>;
  thirdGenerationFindings: ReturnType<
    typeof auditThirdGenerationTeachingChainV15
  >;
  acceptance: {
    passed: boolean;
    failures: string[];
  };
}

function countLivingByGeneration(state: WorldState): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const agent of Object.values(state.agents)) {
    if (!agent.life.alive || (agent.race ?? 'human') !== 'human') continue;
    const key = String(agent.life.generation);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([a], [b]) => Number(a) - Number(b)),
  );
}

function brokenLineageLinks(state: WorldState): number {
  let broken = 0;
  for (const agent of Object.values(state.agents)) {
    for (const parentId of agent.life.parentIds) {
      const parent = state.agents[parentId];
      if (!parent || !parent.life.childIds.includes(agent.id)) broken += 1;
    }
    for (const childId of agent.life.childIds) {
      const child = state.agents[childId];
      if (!child || !child.life.parentIds.includes(agent.id)) broken += 1;
    }
  }
  return broken;
}

function isActiveOrdinaryTeacher(
  state: WorldState,
  agent: AgentState,
): boolean {
  if (
    !agent.life.alive ||
    (agent.race ?? 'human') !== 'human' ||
    !state.v15
  ) return false;
  const knowledge = state.v15.knowledgeByAgentId[agent.id];
  if (!knowledge) return false;
  return (
    ['agriculture', 'construction', 'household', 'survival'] as const
  ).some(
    (domain) =>
      evaluateTeachingEligibilityV15(
        {
          id: agent.id,
          ageYears: agent.life.ageYears,
          alive: agent.life.alive,
          knowledge,
        },
        domain,
        TEACHER_KNOWLEDGE_FLOOR,
      ).eligible,
  );
}

function makeLongRunSnapshot(state: WorldState): V15LongRunSnapshot {
  if (!state.v15) throw new Error('v15 state is required for release audit.');
  const agents = Object.values(state.agents);
  const living = agents.filter(
    (agent) =>
      agent.life.alive && (agent.race ?? 'human') === 'human',
  );
  const wildlife = Object.values(state.wildlife);
  const ordinaryWildlife = wildlife.filter((entry) => !entry.isMonster);
  const monsters = wildlife.filter((entry) => entry.isMonster);
  const teacherIds = new Set(state.v15.genesisTeachers.map((entry) => entry.id));

  return {
    worldMinutes: state.calendar.elapsedWorldMinutes,
    ordinaryLivingPopulation: living.length,
    genesisActiveCount: state.v15.genesisTeachers.filter((teacher) =>
      isGenesisTeacherActive(teacher, state.calendar.elapsedWorldMinutes),
    ).length,
    genesisCountedInPopulation:
      state.v15.genesisTeachers.some((teacher) => teacher.countedInPopulation) ||
      agents.some((agent) => teacherIds.has(agent.id)),
    births: state.population.births,
    deaths: state.population.deaths,
    renewableResourceBase: state.v15.renewableResources.renewableBase,
    discoveredRegionCount: state.growth.discoveredRegionIds.length,
    ordinaryWildlifeCount: ordinaryWildlife.reduce(
      (sum, entry) => sum + entry.count,
      0,
    ),
    ordinaryWildlifeCapacity: ordinaryWildlife.reduce(
      (sum, entry) => sum + entry.carryingCapacity,
      0,
    ),
    monsterCount: monsters.reduce((sum, entry) => sum + entry.count, 0),
    monsterCapacity: monsters.reduce(
      (sum, entry) => sum + entry.carryingCapacity,
      0,
    ),
    brokenLineageLinks: brokenLineageLinks(state),
    secondGenerationLiving: living.filter(
      (agent) => agent.life.generation >= 1,
    ).length,
    secondGenerationLearners: living.filter((agent) => {
      if (agent.life.generation < 1) return false;
      const knowledge = state.v15?.knowledgeByAgentId[agent.id];
      return Boolean(
        knowledge &&
          (knowledge.verifiedLearningSessions > 0 ||
            knowledge.verifiedPracticeSessions > 0),
      );
    }).length,
    ordinaryTeachersActive: living.filter((agent) =>
      isActiveOrdinaryTeacher(state, agent),
    ).length,
  };
}

function learningEventWorldMinutes(event: WorldEvent): number | undefined {
  const value = event.payload.worldMinutes;
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : event.occurredWorldMinutes;
}

function ordinaryInstructorIdsByLearner(
  history: readonly WorldEvent[],
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const event of history) {
    if (
      event.kind !== 'agent.learning.progressed' ||
      event.payload.lessonSource !== 'ordinary' ||
      typeof event.payload.agentId !== 'string' ||
      typeof event.payload.instructorId !== 'string'
    ) {
      continue;
    }
    const instructors = result.get(event.payload.agentId) ?? new Set<string>();
    instructors.add(event.payload.instructorId);
    result.set(event.payload.agentId, instructors);
  }
  return result;
}

function makeGenerationWorld(
  state: WorldState,
  history: readonly WorldEvent[],
): GenerationWorldAuditV15 {
  if (!state.v15) throw new Error('v15 state is required for generation audit.');
  const instructors = ordinaryInstructorIdsByLearner(history);
  const residents: GenerationResidentAuditV15[] = Object.values(
    state.agents,
  ).filter(
    (agent) => (agent.race ?? 'human') === 'human',
  ).map((agent) => {
    const knowledge = state.v15!.knowledgeByAgentId[agent.id];
    return {
      id: agent.id,
      generation: agent.life.generation,
      bornWorldMinutes:
        state.calendar.elapsedWorldMinutes -
        agent.life.ageYears * WORLD_MINUTES_PER_YEAR,
      alive: agent.life.alive,
      knowledge: {
        agriculture: knowledge.agriculture,
        construction: knowledge.construction,
        household: knowledge.household,
        survival: knowledge.survival,
      },
      ordinaryInstructorIds: [...(instructors.get(agent.id) ?? [])].sort(),
      verifiedLearningSessionCount: knowledge.verifiedLearningSessions,
      verifiedPracticeSessionCount: knowledge.verifiedPracticeSessions,
    };
  });
  return {
    currentWorldMinutes: state.calendar.elapsedWorldMinutes,
    genesisActiveCount: state.v15.genesisTeachers.filter((teacher) =>
      isGenesisTeacherActive(teacher, state.calendar.elapsedWorldMinutes),
    ).length,
    residents,
  };
}

function learningEvidence(
  state: WorldState,
  history: readonly WorldEvent[],
): ReleaseSeedEvidence['final']['learning'] {
  let ordinaryLessonEvents = 0;
  let generationOneToTwoLessonEvents = 0;
  let genesisLessonEventsAfterYearThree = 0;

  for (const event of history) {
    if (event.kind !== 'agent.learning.progressed') continue;
    const learnerId = event.payload.agentId;
    const instructorId = event.payload.instructorId;
    const source = event.payload.lessonSource;
    if (source === 'ordinary') {
      ordinaryLessonEvents += 1;
      if (
        typeof learnerId === 'string' &&
        typeof instructorId === 'string' &&
        state.agents[learnerId]?.life.generation >= 2 &&
        state.agents[instructorId]?.life.generation === 1 &&
        (state.agents[learnerId]?.race ?? 'human') === 'human' &&
        (state.agents[instructorId]?.race ?? 'human') === 'human'
      ) {
        generationOneToTwoLessonEvents += 1;
      }
    }
    const worldMinutes = learningEventWorldMinutes(event);
    if (
      source === 'genesis' &&
      worldMinutes !== undefined &&
      worldMinutes >= 3 * WORLD_MINUTES_PER_YEAR
    ) {
      genesisLessonEventsAfterYearThree += 1;
    }
  }

  return {
    ordinaryLessonEvents,
    generationOneToTwoLessonEvents,
    genesisLessonEventsAfterYearThree,
  };
}

function deathCauseCounts(state: WorldState): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const death of state.v15?.deathTelemetry ?? []) {
    counts[death.cause] = (counts[death.cause] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) =>
    a.localeCompare(b),
  ));
}

async function runSeed(seed: string): Promise<ReleaseSeedEvidence> {
  const worldId = `v0-3-15-release-${seed}`;
  const store = new InMemoryWorldStore();
  const world = await WorldEngine.create({
    worldId,
    seed,
    store,
    startTime: 0,
  });
  const samples: V15LongRunSnapshot[] = [];
  const targetYears: TargetYearEvidence[] = [];

  for (let quarter = 1; quarter <= FINAL_YEAR * QUARTERS_PER_YEAR; quarter += 1) {
    const targetWorldMinutes =
      (quarter * WORLD_MINUTES_PER_YEAR) / QUARTERS_PER_YEAR;
    await world.advanceCanonicalTimeTo(targetWorldMinutes);
    const state = world.snapshot();
    samples.push(makeLongRunSnapshot(state));

    if (quarter % QUARTERS_PER_YEAR === 0) {
      const year = quarter / QUARTERS_PER_YEAR;
      console.error(
        `[release-audit] ${seed}: year ${year}/${FINAL_YEAR}, living=${
          Object.values(state.agents).filter(
            (agent) =>
              agent.life.alive && (agent.race ?? 'human') === 'human',
          ).length
        }`,
      );
      if (TARGET_YEARS.has(year)) {
        const history = await store.history(worldId);
        targetYears.push({
          year,
          snapshot: makeLongRunSnapshot(state),
          livingByGeneration: countLivingByGeneration(state),
          postGenesisFindings:
            auditPostGenesisSecondGenerationV15(
              makeGenerationWorld(state, history),
            ),
        });
      }
    }
  }

  const state = world.snapshot();
  if (!state.v15) throw new Error('Release audit ended without v15 state.');
  const history = await store.history(worldId);
  const longRunAlerts = auditV15LongRun(samples);
  const thirdGenerationFindings = auditThirdGenerationTeachingChainV15(
    makeGenerationWorld(state, history),
  );
  const learning = learningEvidence(state, history);
  const wildlife = Object.values(state.wildlife);
  const ordinaryWildlife = wildlife.filter((entry) => !entry.isMonster);
  const monsters = wildlife.filter((entry) => entry.isMonster);
  const genesisActiveCount = state.v15.genesisTeachers.filter((teacher) =>
    isGenesisTeacherActive(teacher, state.calendar.elapsedWorldMinutes),
  ).length;
  const failures: string[] = [];

  if (longRunAlerts.some((entry) => entry.severity === 'critical')) {
    failures.push('critical long-run audit alert');
  }
  if (thirdGenerationFindings.some((entry) => entry.severity === 'critical')) {
    failures.push('critical three-generation audit finding');
  }
  if (
    targetYears.some((entry) =>
      entry.postGenesisFindings.some((finding) => finding.severity === 'critical'),
    )
  ) {
    failures.push('critical 8/10/12-year generation finding');
  }
  if (targetYears.some((entry) => entry.snapshot.ordinaryLivingPopulation <= 0)) {
    failures.push('population extinction at a target year');
  }
  if (targetYears.some((entry) => entry.snapshot.genesisActiveCount !== 0)) {
    failures.push('Genesis active after year 3');
  }
  if (learning.genesisLessonEventsAfterYearThree !== 0) {
    failures.push('Genesis lesson recorded after year 3');
  }
  if ((countLivingByGeneration(state)['2'] ?? 0) <= 0) {
    failures.push('no living generation-2 resident at year 30');
  }
  if (brokenLineageLinks(state) !== 0) {
    failures.push('broken reciprocal lineage link');
  }

  return {
    seed,
    worldId,
    targetYears,
    final: {
      livingByGeneration: countLivingByGeneration(state),
      livingPopulation: Object.values(state.agents).filter(
        (agent) =>
          agent.life.alive && (agent.race ?? 'human') === 'human',
      ).length,
      births: state.population.births,
      deaths: state.population.deaths,
      deathCauses: deathCauseCounts(state),
      renewableBase: state.v15.renewableResources.renewableBase,
      storedResources: state.v15.renewableResources.storedResources,
      genesisActiveCount,
      ordinaryWildlifeCount: ordinaryWildlife.reduce(
        (sum, entry) => sum + entry.count,
        0,
      ),
      ordinaryWildlifeCapacity: ordinaryWildlife.reduce(
        (sum, entry) => sum + entry.carryingCapacity,
        0,
      ),
      monsterCount: monsters.reduce((sum, entry) => sum + entry.count, 0),
      monsterCapacity: monsters.reduce(
        (sum, entry) => sum + entry.carryingCapacity,
        0,
      ),
      discoveredRegionCount: state.growth.discoveredRegionIds.length,
      learning,
      familyAgencyProfiles: Object.keys(
        state.v15.familyAgencyByAgentId,
      ).length,
      agentRecords: Object.keys(state.agents).length,
    },
    longRunAlerts,
    thirdGenerationFindings,
    acceptance: {
      passed: failures.length === 0,
      failures,
    },
  };
}

const results: ReleaseSeedEvidence[] = [];
for (const seed of RELEASE_SEEDS) {
  results.push(await runSeed(seed));
}

const failedSeeds = results
  .filter((result) => !result.acceptance.passed)
  .map((result) => result.seed);
const aggregateFailures: string[] = [];
if (failedSeeds.length > 0) {
  aggregateFailures.push('one or more seed audits failed');
}
if (
  results.reduce(
    (sum, result) =>
      sum + result.final.learning.generationOneToTwoLessonEvents,
    0,
  ) <= 0
) {
  aggregateFailures.push(
    'no verified generation-1 to generation-2 lesson across release seeds',
  );
}

console.log(
  JSON.stringify(
    {
      release: 'v0.3.15',
      generatedAtUtc: new Date().toISOString(),
      runner: 'real autonomous WorldEngine; no fixtures or injected cohorts',
      contract: {
        worldMinutesPerYear: WORLD_MINUTES_PER_YEAR,
        semanticQuantumWorldMinutes: CANONICAL_WORLD_QUANTUM_MINUTES,
        sampleIntervalWorldMinutes:
          WORLD_MINUTES_PER_YEAR / QUARTERS_PER_YEAR,
        targetYears: [...TARGET_YEARS],
      },
      seeds: results,
      aggregate: {
        passed: aggregateFailures.length === 0,
        seedCount: results.length,
        thirtyYearSeedCount: results.length,
        failedSeeds,
        failures: aggregateFailures,
      },
    },
    null,
    2,
  ),
);
