import { InMemoryWorldStore } from '../world/InMemoryWorldStore';
import type { WorldEvent } from '../world/events';
import { WorldEngine } from '../world/WorldEngine';
import type { AgentRace, WorldState } from '../world/types';
import { WORLD_MINUTES_PER_YEAR } from '../world/WorldClock';
import { isGenesisTeacherActive } from '../v15/GenesisBootstrap';
import {
  SAPIENT_RACES_V16,
  worldPopulationCapacityV16,
} from './SocietyFoundationV16';

const DEFAULT_SEEDS = [
  'v16-demography-01',
  'v16-demography-02',
  'v16-demography-03',
] as const;
const TARGET_YEARS = [8, 10, 12, 30, 60] as const;

declare const process: { argv: string[] };

function livingByRace(state: Readonly<WorldState>): Record<AgentRace, number> {
  return Object.fromEntries(
    SAPIENT_RACES_V16.map((race) => [
      race,
      Object.values(state.agents).filter(
        (agent) => agent.life.alive && (agent.race ?? 'human') === race,
      ).length,
    ]),
  ) as Record<AgentRace, number>;
}

function humanGenerations(state: Readonly<WorldState>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const agent of Object.values(state.agents)) {
    if (!agent.life.alive || (agent.race ?? 'human') !== 'human') continue;
    const generation = String(agent.life.generation);
    counts[generation] = (counts[generation] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => Number(left) - Number(right)),
  );
}

function deathCauseCounts(state: Readonly<WorldState>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const death of state.v15?.deathTelemetry ?? []) {
    counts[death.cause] = (counts[death.cause] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function monsterEcologyEvidence(history: readonly WorldEvent[]) {
  const wildlifeFeedingEvents = history.filter(
    (event) => event.kind === 'world.monster.hunted_prey',
  );
  const residentFeedingEvents = history.filter(
    (event) => event.kind === 'world.monster.fed',
  );
  const hungerEvents = history.filter(
    (event) => event.kind === 'world.monster.hunger',
  );
  return {
    wildlifeFeedingEvents: wildlifeFeedingEvents.length,
    residentFeedingEvents: residentFeedingEvents.length,
    hungerEvents: hungerEvents.length,
    wildlifePreyConsumed: wildlifeFeedingEvents.reduce(
      (sum, event) => sum + Number(event.payload.consumed ?? 0),
      0,
    ),
    starvationLosses: hungerEvents.reduce(
      (sum, event) => sum + Number(event.payload.lost ?? 0),
      0,
    ),
    residentKillsKeptRemains: residentFeedingEvents.every(
      (event) => event.payload.remainsPersisted === true,
    ),
  };
}

function materialEconomies(state: Readonly<WorldState>) {
  return Object.values(state.v16?.settlementEconomyById ?? {})
    .map((economy) => ({
      settlementId: economy.settlementId,
      stocks: economy.stocks,
      storageCapacity: economy.storageCapacity,
      farmingTools: economy.farmingTools,
      constructionTools: economy.constructionTools,
      harvestEvents: economy.harvestEvents,
      harvestEventsByMaterial: economy.harvestEventsByMaterial,
      constructionEvents: economy.constructionEvents,
      toolsCreated: economy.toolsCreated,
      withinCapacity: (Object.keys(economy.stocks) as Array<keyof typeof economy.stocks>)
        .every(
          (material) =>
            economy.stocks[material] >= 0 &&
            economy.stocks[material] <= economy.storageCapacity[material] + 1e-9,
        ),
    }))
    .sort((left, right) => left.settlementId.localeCompare(right.settlementId));
}

function learningEvidence(
  state: Readonly<WorldState>,
  history: readonly WorldEvent[],
) {
  let ordinaryLessons = 0;
  let generationOneToTwoLessons = 0;
  let genesisLessonsAfterYearThree = 0;
  for (const event of history) {
    if (event.kind !== 'agent.learning.progressed') continue;
    const learnerId = event.payload.agentId;
    const instructorId = event.payload.instructorId;
    const source = event.payload.lessonSource;
    if (source === 'ordinary') {
      ordinaryLessons += 1;
      if (
        typeof learnerId === 'string' &&
        typeof instructorId === 'string' &&
        state.agents[learnerId]?.life.generation >= 2 &&
        state.agents[instructorId]?.life.generation === 1 &&
        (state.agents[learnerId]?.race ?? 'human') === 'human' &&
        (state.agents[instructorId]?.race ?? 'human') === 'human'
      ) {
        generationOneToTwoLessons += 1;
      }
    }
    const worldMinutes =
      typeof event.payload.worldMinutes === 'number'
        ? event.payload.worldMinutes
        : event.occurredWorldMinutes;
    if (
      source === 'genesis' &&
      worldMinutes !== undefined &&
      worldMinutes >= 3 * WORLD_MINUTES_PER_YEAR
    ) {
      genesisLessonsAfterYearThree += 1;
    }
  }
  return {
    ordinaryLessons,
    generationOneToTwoLessons,
    genesisLessonsAfterYearThree,
  };
}

function inhabitedSettlements(state: Readonly<WorldState>) {
  return Object.values(state.settlements)
    .map((settlement) => {
      const residents = Object.values(state.agents).filter(
        (agent) =>
          agent.life.alive &&
          state.places[agent.homeId]?.settlementId === settlement.id,
      );
      const byRace = Object.fromEntries(
        SAPIENT_RACES_V16.map((race) => [
          race,
          residents.filter((agent) => (agent.race ?? 'human') === race).length,
        ]),
      ) as Record<AgentRace, number>;
      return {
        id: settlement.id,
        name: settlement.name,
        kind: settlement.kind,
        residentCount: residents.length,
        homeCount: settlement.memberPlaceIds.filter(
          (placeId) => state.places[placeId]?.kind === 'home',
        ).length,
        housingCapacity: settlement.memberPlaceIds
          .map((placeId) => state.places[placeId])
          .filter((place) => place?.kind === 'home')
          .reduce((sum, place) => sum + place.capacity, 0),
        byRace,
      };
    })
    .filter((settlement) => settlement.residentCount > 0)
    .sort((left, right) => left.id.localeCompare(right.id));
}

async function runSeed(seed: string) {
  const worldId = `v16-demographic-acceptance-${seed}`;
  const store = new InMemoryWorldStore();
  const world = await WorldEngine.create({
    worldId,
    seed,
    store,
    startTime: 0,
  });
  const initialState = world.snapshot();
  const initialOrdinaryResidents = Object.values(initialState.agents).length;
  const initialGenesisTeachers = initialState.v15?.genesisTeachers.length ?? 0;
  const samples: Array<{
    year: number;
    livingByRace: Record<AgentRace, number>;
    humanGenerations: Record<string, number>;
    settlements: ReturnType<typeof inhabitedSettlements>;
    births: number;
    deaths: number;
  }> = [];

  for (const year of selectedTargetYears) {
    await world.advanceCanonicalTimeTo(year * WORLD_MINUTES_PER_YEAR);
    const state = world.snapshot();
    const sample = {
      year,
      livingByRace: livingByRace(state),
      humanGenerations: humanGenerations(state),
      settlements: inhabitedSettlements(state),
      births: state.population.births,
      deaths: state.population.deaths,
    };
    samples.push(sample);
    console.error(
      `[v16-demography] ${seed}: year=${year} humans=${sample.livingByRace.human} settlements=${sample.settlements.length}`,
    );
  }

  const state = world.snapshot();
  const history = await store.history(worldId);
  const economies = materialEconomies(state);
  const harvestCounts = economies.reduce(
    (totals, economy) => {
      for (const material of ['food', 'wood', 'stone', 'metal', 'fuel'] as const) {
        totals[material] += economy.harvestEventsByMaterial[material];
      }
      return totals;
    },
    { food: 0, wood: 0, stone: 0, metal: 0, fuel: 0 },
  );
  const learning = learningEvidence(state, history);
  const remains = Object.values(state.v16?.remainsById ?? {});
  const relations = Object.values(state.v16?.settlementRelations ?? {});
  const humanSettlements = inhabitedSettlements(state).filter(
    (settlement) => settlement.byRace.human > 0,
  );
  const year30 = samples.find((sample) => sample.year === 30);
  const year60 = samples.find((sample) => sample.year === 60);
  const failures: string[] = [];
  if (initialOrdinaryResidents !== 10 || initialGenesisTeachers !== 4) {
    failures.push('initial population is not exactly 10 ordinary + 4 Genesis');
  }
  if (
    year30 &&
    (year30.livingByRace.human < 20 || year30.livingByRace.human > 50)
  ) {
    failures.push('year-30 human population left continuity envelope 20..50');
  }
  if (year30 && (year30.humanGenerations['2'] ?? 0) <= 0) {
    failures.push('no living generation 2 at year 30');
  }
  if (year60 && year60.livingByRace.human <= 0) {
    failures.push('human extinction by year 60');
  }
  if (year60 && humanSettlements.length < 2) {
    failures.push('humans did not found a second inhabited settlement by year 60');
  }
  if (economies.length === 0 || economies.some((economy) => !economy.withinCapacity)) {
    failures.push('material storage is missing or exceeds physical capacity');
  }
  if (economies.reduce((sum, economy) => sum + economy.harvestEvents, 0) <= 0) {
    failures.push('no recorded settlement harvest/material work');
  }
  if (harvestCounts.food <= 0) {
    failures.push('agriculture/gathering produced no recorded food');
  }
  if (
    economies.reduce(
      (sum, economy) => sum + economy.toolsCreated + economy.constructionEvents,
      0,
    ) <= 0
  ) {
    failures.push('no real material tool or construction project completed');
  }
  if (learning.genesisLessonsAfterYearThree > 0) {
    failures.push('Genesis lesson recorded after year 3');
  }
  if (state.population.deaths > 0) {
    if (remains.length === 0) failures.push('deaths exist without physical remains');
    if (!remains.some((entry) => entry.status === 'buried')) {
      failures.push('no death received a recorded burial');
    }
    if (Object.keys(state.v16?.burialSitesBySettlementId ?? {}).length === 0) {
      failures.push('deaths exist but no cemetery was established');
    }
  }
  if (
    Object.values(state.wildlife).some(
      (population) =>
        population.count < 0 || population.count > population.carryingCapacity,
    )
  ) {
    failures.push('wildlife/monster population exceeded carrying capacity');
  }
  if (
    state.v15?.genesisTeachers.some((teacher) =>
      isGenesisTeacherActive(teacher, state.calendar.elapsedWorldMinutes),
    )
  ) {
    failures.push('Genesis remained active after year 3');
  }
  if (
    SAPIENT_RACES_V16.some(
      (race) =>
        state.v16!.raceFamilyOpportunityByRace[race].opportunityChecks < 0,
    )
  ) {
    failures.push('invalid race opportunity counter');
  }
  for (const race of SAPIENT_RACES_V16.filter((candidate) => candidate !== 'human')) {
    const raceResidents = Object.values(state.agents).filter(
      (agent) => (agent.race ?? 'human') === race,
    );
    if (
      raceResidents.length > 0 &&
      !raceResidents.some((agent) => agent.life.generation > 0)
    ) {
      failures.push(`${race} exists but has no continued lineage`);
    }
  }
  const totalLiving = Object.values(state.agents).filter(
    (agent) => agent.life.alive,
  ).length;
  const physicalPopulationCapacity = worldPopulationCapacityV16(state);
  if (totalLiving > physicalPopulationCapacity) {
    failures.push('living population exceeds built-housing demographic capacity');
  }
  if (!Object.values(state.wildlife).some((population) => population.isMonster)) {
    failures.push('no monster population emerged from the physical frontier');
  }

  return {
    seed,
    samples,
    final: {
      livingByRace: livingByRace(state),
      humanGenerations: humanGenerations(state),
      settlements: inhabitedSettlements(state),
      settlementFoundingEvents: history.filter(
        (event) => event.kind === 'world.settlement.founded',
      ).length,
      voluntaryResettlementEvents: history.filter(
        (event) => event.kind === 'agent.resettled',
      ).length,
      births: state.population.births,
      deaths: state.population.deaths,
      deathCauses: deathCauseCounts(state),
      monsterEcology: monsterEcologyEvidence(history),
      learning,
      renewableBase: state.v15?.renewableResources.renewableBase,
      storedResources: state.v15?.renewableResources.storedResources,
      localResources: state.v16?.settlementResourcesById,
      materialEconomies: economies,
      materialHarvestCounts: harvestCounts,
      demographicCapacity: {
        totalLiving,
        physicalPopulationCapacity,
        headroom: physicalPopulationCapacity - totalLiving,
        discoveredRegions: state.growth.discoveredRegionIds.length,
      },
      deathAftermath: {
        remains: remains.length,
        buried: remains.filter((entry) => entry.status === 'buried').length,
        unburied: remains.filter((entry) => entry.status === 'unburied').length,
        historicalUnknown: remains.filter(
          (entry) => entry.status === 'historical_unknown',
        ).length,
        cemeteries: Object.keys(state.v16?.burialSitesBySettlementId ?? {}).length,
        maximumContaminationRisk: Math.max(
          0,
          ...remains.map((entry) => entry.contaminationRisk),
        ),
      },
      settlementConflict: {
        knownRelations: relations.length,
        activeWars: relations.filter((relation) => relation.activeWar).length,
        conflictRounds: relations.reduce(
          (sum, relation) => sum + relation.conflictRounds,
          0,
        ),
        resourceRaids: relations.reduce(
          (sum, relation) => sum + relation.resourceRaids,
          0,
        ),
        landDisputes: relations.reduce(
          (sum, relation) => sum + relation.landDisputes,
          0,
        ),
        casualties: relations.reduce(
          (sum, relation) => sum + relation.casualties,
          0,
        ),
      },
      activeGenesisTeachers: state.v15?.genesisTeachers.filter((teacher) =>
        isGenesisTeacherActive(teacher, state.calendar.elapsedWorldMinutes),
      ).length,
      monsters: Object.values(state.wildlife)
        .filter((population) => population.isMonster)
        .reduce((sum, population) => sum + population.count, 0),
      raceFamilyOpportunities: state.v16?.raceFamilyOpportunityByRace,
      initialOrdinaryResidents,
      initialGenesisTeachers,
    },
    acceptance: { passed: failures.length === 0, failures },
  };
}

const results = [];
const throughArgument = process.argv
  .slice(2)
  .find((value: string) => value.startsWith('--through='));
const throughYear = throughArgument
  ? Number(throughArgument.slice('--through='.length))
  : 60;
if (!Number.isInteger(throughYear) || !TARGET_YEARS.includes(throughYear as never)) {
  throw new Error(`--through must be one of: ${TARGET_YEARS.join(', ')}`);
}
const selectedTargetYears = TARGET_YEARS.filter((year) => year <= throughYear);
const requestedSeeds = process.argv
  .slice(2)
  .filter((value: string) => value.trim() && !value.startsWith('--'));
const seeds = requestedSeeds.length > 0 ? requestedSeeds : [...DEFAULT_SEEDS];
for (const seed of seeds) results.push(await runSeed(seed));

console.log(
  JSON.stringify(
    {
      release: 'v0.3.17',
      generatedAtUtc: new Date().toISOString(),
      runner: 'real autonomous WorldEngine; no injected residents or couples',
      targetYears: selectedTargetYears,
      seeds: results,
      aggregate: {
        passed: results.every((result) => result.acceptance.passed),
        seedCount: results.length,
        failures: results.flatMap((result) =>
          result.acceptance.failures.map((failure) => `${result.seed}: ${failure}`),
        ),
      },
    },
    null,
    2,
  ),
);
