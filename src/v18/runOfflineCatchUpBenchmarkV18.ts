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
let cumulativeOutsideActions = 0;
let cumulativeProductiveActions = 0;
let totalSatiety = 0;
let totalMeals = 0;
for (const agent of livingResidents) {
  const livelihood = snapshot.v18?.livelihoodByAgentId[agent.id];
  const rhythm = snapshot.v18?.lifeRhythmByAgentId[agent.id];
  const profession = livelihood?.primary ?? 'missing';
  professionCounts[profession] = (professionCounts[profession] ?? 0) + 1;
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
const deathCauseCounts: Record<string, number> = {};
const deathRaceCounts: Record<string, number> = {};
const deathEncounterReasonCounts: Record<string, number> = {};
const deathMechanismCounts: Record<string, number> = {};
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
    professionStageCounts,
    raceCounts,
    generationCounts,
    sexCounts,
    reproductiveAdultCounts,
    deathCauseCounts,
    deathRaceCounts,
    deathEncounterReasonCounts,
    deathMechanismCounts,
    expeditionStageCounts,
    expeditionEventCounts,
    expeditionReturnReasons,
    expeditionPreparedGroups,
    settlementStatusCounts,
    observerAudibleConversations:
      snapshot.v18?.recentConversations.filter(
        (conversation) => conversation.observerAudible,
      ).length ?? 0,
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
