import { InMemoryAppendOnlyLog } from '../persistence/AppendOnlyLog';
import { LiveWorldRuntime } from '../runtime/LiveWorldRuntime';
import { InMemoryWorldStore } from '../world/InMemoryWorldStore';
import { WORLD_MINUTES_PER_YEAR } from '../world/WorldClock';

declare const process: { argv: string[] };

const requestedYears = Number(process.argv[2] ?? 50);
const mode = process.argv[3] === 'off' ? 'off' : 'intervene';
const requestedSeed =
  process.argv[4] ?? `v18-offline-benchmark-${requestedYears}-${mode}`;

if (!Number.isFinite(requestedYears) || requestedYears <= 0) {
  throw new Error('Benchmark years must be a positive finite number.');
}

const worldStore = new InMemoryWorldStore();
const controlLog = new InMemoryAppendOnlyLog();
const runtime = await LiveWorldRuntime.create({
  mode,
  seed: requestedSeed,
  worldId: `v18-offline-benchmark-${requestedSeed}`,
  store: worldStore,
  controlLog,
  durable: false,
});
const start = performance.now();
const target = requestedYears * WORLD_MINUTES_PER_YEAR;
let batches = 0;
let quanta = 0;
let nextReportYear = Math.min(10, requestedYears);
let currentWorldMinutes = 0;

while (currentWorldMinutes < target - 1e-7) {
  const batch = await runtime.catchUpBatchTo(target);
  currentWorldMinutes = batch.currentWorldMinutes;
  batches += 1;
  quanta += batch.semanticQuantaProcessed;
  const currentYear =
    batch.currentWorldMinutes / WORLD_MINUTES_PER_YEAR;
  if (currentYear + 1e-7 >= nextReportYear || batch.completed) {
    const summary = runtime.worldDiagnosticSummary();
    console.log(
      JSON.stringify({
        currentYear: Number(currentYear.toFixed(2)),
        elapsedSeconds: Number(((performance.now() - start) / 1_000).toFixed(3)),
        living: summary.living,
        batches,
        quanta,
      }),
    );
    nextReportYear += 10;
  }
}

const world = runtime.worldDiagnosticSummary();
const snapshot = runtime.worldSnapshot();
const livingResidents = Object.values(snapshot.agents).filter(
  (agent) => agent.life.alive,
);
const actionCounts: Record<string, number> = {};
for (const evidence of Object.values(
  snapshot.v16?.residentEvidenceByAgentId ?? {},
)) {
  for (const [action, count] of Object.entries(evidence.actionCounts)) {
    actionCounts[action] = (actionCounts[action] ?? 0) + (count ?? 0);
  }
}
const totalActions = Object.values(actionCounts).reduce(
  (sum, count) => sum + count,
  0,
);
const meanSkill = (skill: keyof (typeof livingResidents)[number]['skills']) =>
  livingResidents.length === 0
    ? 0
    : livingResidents.reduce((sum, agent) => sum + agent.skills[skill], 0) /
      livingResidents.length;
const outsideHomeSettlement = livingResidents.filter((agent) => {
  const homeSettlementId = snapshot.places[agent.homeId]?.settlementId;
  const currentSettlementId = snapshot.places[agent.locationId]?.settlementId;
  const targetSettlementId = agent.movement
    ? snapshot.places[agent.movement.targetPlaceId]?.settlementId
    : currentSettlementId;
  return (
    homeSettlementId === undefined ||
    currentSettlementId !== homeSettlementId ||
    targetSettlementId !== homeSettlementId
  );
}).length;
const professionCounts: Record<string, number> = {};
const professionStageCounts: Record<string, number> = {};
const strongestPracticeCounts: Record<string, number> = {};
const totalPracticeByKind: Record<string, number> = {};
let cumulativeOutsideActions = 0;
let cumulativeProductiveActions = 0;
let totalSatiety = 0;
let totalMeals = 0;
for (const agent of livingResidents) {
  const livelihood = snapshot.v18?.livelihoodByAgentId[agent.id];
  const rhythm = snapshot.v18?.lifeRhythmByAgentId[agent.id];
  const profession = livelihood?.primary ?? 'missing';
  professionCounts[profession] = (professionCounts[profession] ?? 0) + 1;
  if (livelihood) {
    for (const [kind, practice] of Object.entries(livelihood.practiceByKind)) {
      totalPracticeByKind[kind] = (totalPracticeByKind[kind] ?? 0) + practice;
    }
    const strongest = Object.entries(livelihood.practiceByKind).sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    )[0]?.[0] ?? 'none';
    strongestPracticeCounts[strongest] =
      (strongestPracticeCounts[strongest] ?? 0) + 1;
  }
  const stage = livelihood?.stage ?? 'missing';
  professionStageCounts[stage] = (professionStageCounts[stage] ?? 0) + 1;
  if (rhythm) {
    cumulativeOutsideActions += rhythm.outsideSettlementActionCount;
    cumulativeProductiveActions += rhythm.productiveActionCount;
    totalSatiety += rhythm.satiety;
    totalMeals += rhythm.mealsConsumed;
  }
}
const settlementStocks = Object.fromEntries(
  Object.entries(snapshot.v16?.settlementEconomyById ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([settlementId, economy]) => [
      settlementId,
      Object.fromEntries(
        Object.entries(economy.stocks).map(([kind, amount]) => [
          kind,
          Number(amount.toFixed(3)),
        ]),
      ),
    ]),
);
const raceCounts: Record<string, number> = {};
const raceBirthCounts: Record<string, number> = {};
const generationCounts: Record<string, number> = {};
const sexCounts: Record<string, number> = {};
const reproductiveAdultCounts: Record<string, number> = {};
for (const agent of livingResidents) {
  const race = agent.race ?? 'human';
  const sex = agent.sex ?? 'unknown';
  raceCounts[race] = (raceCounts[race] ?? 0) + 1;
  const generation = String(agent.life.generation);
  generationCounts[generation] = (generationCounts[generation] ?? 0) + 1;
  sexCounts[sex] = (sexCounts[sex] ?? 0) + 1;
  if (
    agent.life.stage === 'adult' &&
    agent.life.ageYears <= 55 &&
    agent.life.health >= 0.4
  ) {
    const key = `${race}:${sex}`;
    reproductiveAdultCounts[key] = (reproductiveAdultCounts[key] ?? 0) + 1;
  }
}
for (const agent of Object.values(snapshot.agents)) {
  if (agent.life.generation < 1) continue;
  const race = agent.race ?? 'human';
  raceBirthCounts[race] = (raceBirthCounts[race] ?? 0) + 1;
}
const nativeChildren = Object.values(snapshot.agents).filter(
  (agent) => agent.origin === 'native' && agent.life.generation > 0,
);
const technicalNumberedChildNames = nativeChildren.filter((agent) =>
  /\s\d+$/.test(agent.name),
);
const distinctChildNames = new Set(
  nativeChildren.map((agent) => agent.name.toLocaleLowerCase('ru-RU')),
);
const recentConversations = snapshot.v18?.recentConversations ?? [];
const uniqueRecentUtterances = new Set(
  recentConversations.map((conversation) => conversation.utterance),
);
const libraryKnowledge = Object.values(
  snapshot.v18?.secretLibrary.knowledgeByAgentId ?? {},
).flat();
const deathCauseCounts: Record<string, number> = {};
const deathRaceCounts: Record<string, number> = {};
const deathEncounterReasonCounts: Record<string, number> = {};
const deathMechanismCounts: Record<string, number> = {};
const deprivationLocationCounts: Record<string, number> = {};
const deprivationContexts: Array<Record<string, unknown>> = [];
for (const death of snapshot.v15?.deathTelemetry ?? []) {
  deathCauseCounts[death.cause] = (deathCauseCounts[death.cause] ?? 0) + 1;
  const race = snapshot.agents[death.agentId]?.race ?? 'unknown';
  deathRaceCounts[race] = (deathRaceCounts[race] ?? 0) + 1;
  const encounterReason = death.encounterReason ?? 'none';
  deathEncounterReasonCounts[encounterReason] =
    (deathEncounterReasonCounts[encounterReason] ?? 0) + 1;
  const mechanism = death.primaryMechanism ?? 'unknown';
  deathMechanismCounts[mechanism] =
    (deathMechanismCounts[mechanism] ?? 0) + 1;
  if (death.cause === 'deprivation') {
    deprivationLocationCounts[death.locationId] =
      (deprivationLocationCounts[death.locationId] ?? 0) + 1;
    if (deprivationContexts.length < 20) {
      const deceased = snapshot.agents[death.agentId];
      deprivationContexts.push({
        agentId: death.agentId,
        race: deceased?.race ?? 'human',
        ageYears: Number(death.ageYears.toFixed(2)),
        lastAction: death.lastAction,
        homeId: deceased?.homeId,
        homeSettlementId: deceased
          ? snapshot.places[deceased.homeId]?.settlementId
          : undefined,
        locationId: death.locationId,
        locationSettlementId: snapshot.places[death.locationId]?.settlementId,
        resources: Number(death.resourcesBeforeDeath.toFixed(3)),
        energy: Number(death.energyBeforeDeath.toFixed(3)),
        health: Number(death.healthBeforeDeath.toFixed(3)),
      });
    }
  }
}
const expeditionStageCounts: Record<string, number> = {};
for (const expedition of Object.values(snapshot.v18?.expeditionsById ?? {})) {
  expeditionStageCounts[expedition.stage] =
    (expeditionStageCounts[expedition.stage] ?? 0) + 1;
}
const settlementStatusCounts: Record<string, number> = {};
for (const lifecycle of Object.values(
  snapshot.v18?.settlementLifecycleById ?? {},
)) {
  settlementStatusCounts[lifecycle.status] =
    (settlementStatusCounts[lifecycle.status] ?? 0) + 1;
}
const adventure = snapshot.v19?.adventureEconomy;
const adventureRankCounts: Record<string, number> = {};
for (const profile of Object.values(adventure?.adventurersByAgentId ?? {})) {
  adventureRankCounts[profile.rank] =
    (adventureRankCounts[profile.rank] ?? 0) + 1;
}
const history = await worldStore.history(snapshot.id);
const recentCutoff = Math.max(
  0,
  snapshot.calendar.elapsedWorldMinutes - WORLD_MINUTES_PER_YEAR * 10,
);
const recentTenYearEventCounts: Record<string, number> = {};
const expeditionEventCounts: Record<string, number> = {};
const expeditionReturnReasons: Record<string, number> = {};
const expeditionPreparedGroups: Array<{
  expeditionId: string;
  memberGenerations: number[];
}> = [];
for (const event of history) {
  if (event.kind.startsWith('world.expedition.')) {
    expeditionEventCounts[event.kind] =
      (expeditionEventCounts[event.kind] ?? 0) + 1;
    if (event.kind === 'world.expedition.returned') {
      const reason = String(event.payload.reason ?? 'unknown');
      expeditionReturnReasons[reason] =
        (expeditionReturnReasons[reason] ?? 0) + 1;
    }
    if (event.kind === 'world.expedition.prepared') {
      const memberIds = String(event.payload.memberIds ?? '')
        .split(',')
        .filter(Boolean);
      expeditionPreparedGroups.push({
        expeditionId: String(event.payload.expeditionId ?? event.eventId),
        memberGenerations: memberIds.map(
          (agentId) => snapshot.agents[agentId]?.life.generation ?? -1,
        ),
      });
    }
  }
  if ((event.occurredWorldMinutes ?? 0) < recentCutoff) continue;
  if (
    event.kind.startsWith('agent.') ||
    event.kind.startsWith('world.expedition.') ||
    event.kind.startsWith('world.settlement.') ||
    event.kind.startsWith('world.monster.')
  ) {
    recentTenYearEventCounts[event.kind] =
      (recentTenYearEventCounts[event.kind] ?? 0) + 1;
  }
}
console.log(
  JSON.stringify({
    completed: true,
    requestedYears,
    mode,
    elapsedSeconds: Number(((performance.now() - start) / 1_000).toFixed(3)),
    living: world.living,
    births: world.births,
    deaths: world.deaths,
    relationships: world.relationships,
    places: world.places,
    settlements: world.settlements,
    seed: requestedSeed,
    currentOutsideHomeSettlement: outsideHomeSettlement,
    currentOutsideHomeSettlementShare:
      livingResidents.length === 0
        ? 0
        : Number((outsideHomeSettlement / livingResidents.length).toFixed(4)),
    residentsInPhysicalMovement: livingResidents.filter(
      (agent) => agent.movement !== undefined,
    ).length,
    cumulativeOutsideActions,
    cumulativeProductiveActions,
    averageSatiety:
      livingResidents.length === 0
        ? 0
        : Number((totalSatiety / livingResidents.length).toFixed(4)),
    averageMealsConsumed:
      livingResidents.length === 0
        ? 0
        : Number((totalMeals / livingResidents.length).toFixed(2)),
    professionCounts,
    strongestPracticeCounts,
    totalPracticeByKind: Object.fromEntries(
      Object.entries(totalPracticeByKind).map(([kind, practice]) => [
        kind,
        Number(practice.toFixed(2)),
      ]),
    ),
    professionStageCounts,
    raceCounts,
    raceBirthCounts,
    culturalNaming: {
      nativeChildren: nativeChildren.length,
      technicalNumberedNames: technicalNumberedChildNames.length,
      distinctNames: distinctChildNames.size,
    },
    raceFamilyOpportunities: snapshot.v16?.raceFamilyOpportunityByRace,
    generationCounts,
    sexCounts,
    reproductiveAdultCounts,
    deathCauseCounts,
    deathRaceCounts,
    deathEncounterReasonCounts,
    deathMechanismCounts,
    deprivationLocationCounts,
    deprivationContexts,
    expeditionStageCounts,
    expeditionEventCounts,
    expeditionReturnReasons,
    expeditionPreparedGroups,
    settlementStatusCounts,
    observerAudibleConversations:
      recentConversations.filter(
        (conversation) => conversation.observerAudible,
      ).length,
    conversationAgency: {
      recentWindow: recentConversations.length,
      distinctUtterances: uniqueRecentUtterances.size,
      knowledgeGrounded: recentConversations.filter(
        (conversation) => conversation.evidence.knowledgeId !== undefined,
      ).length,
      knowledgeTransferred: recentConversations.filter(
        (conversation) => conversation.evidence.knowledgeShared === true,
      ).length,
    },
    appliedLibraryKnowledge: {
      records: libraryKnowledge.length,
      practicedRecords: libraryKnowledge.filter(
        (record) => record.practiceCount > 0,
      ).length,
      sharedRecords: libraryKnowledge.filter(
        (record) => record.sharedCount > 0,
      ).length,
      oralRecords: libraryKnowledge.filter(
        (record) => record.learnedFromAgentId !== undefined,
      ).length,
    },
    divineAgency: {
      totalPrayers: snapshot.v19?.divineAgency.totalPrayerCount ?? 0,
      recentPrayers: snapshot.v19?.divineAgency.recentPrayers.length ?? 0,
      prayerTopics: snapshot.v19?.divineAgency.prayerCountByTopic ?? {},
    },
    adventureEconomy: {
      dungeons: Object.keys(adventure?.dungeonsById ?? {}).length,
      activeDungeons: Object.values(adventure?.dungeonsById ?? {}).filter(
        (dungeon) => dungeon.active,
      ).length,
      adventurers: Object.keys(adventure?.adventurersByAgentId ?? {}).length,
      rankCounts: adventureRankCounts,
      totalRuns: adventure?.totalRuns ?? 0,
      successfulRuns: adventure?.totalSuccessfulRuns ?? 0,
      artifacts: Object.keys(adventure?.artifactsById ?? {}).length,
      totalCoinRecovered: Number((adventure?.totalCoinRecovered ?? 0).toFixed(2)),
      totalTradeVolume: Number((adventure?.totalTradeVolume ?? 0).toFixed(2)),
      carriedTradeRelations: Object.keys(adventure?.tradeRelationsById ?? {}).length,
      recentRunWindow: adventure?.recentRuns.length ?? 0,
      recentTransactionWindow: adventure?.recentTransactions.length ?? 0,
    },
    recentTenYearEventCounts,
    settlementStocks,
    actionShares: Object.fromEntries(
      Object.entries(actionCounts)
        .sort((left, right) => right[1] - left[1])
        .map(([action, count]) => [
          action,
          totalActions === 0 ? 0 : Number((count / totalActions).toFixed(4)),
        ]),
    ),
    averageSkills: {
      gathering: Number(meanSkill('gathering').toFixed(4)),
      hunting: Number(meanSkill('hunting').toFixed(4)),
      craft: Number(meanSkill('craft').toFixed(4)),
      social: Number(meanSkill('social').toFixed(4)),
      exploration: Number(meanSkill('exploration').toFixed(4)),
    },
    batches,
    quanta,
    revision: world.revision,
  }),
);
