import { CardinalAuditor } from '../cardinal/CardinalAuditor';
import { buildCardinalAuditContext } from '../cardinal/CardinalAuditContext';
import {
  CARDINAL_POLICY_VERSION,
  CardinalCore,
} from '../cardinal/CardinalCore';
import { reconcileGatewayJournal } from '../cardinal/CardinalRecovery';
import { CARDINAL_RESEARCH_VERSION } from '../cardinal/CardinalResearch';
import { LogBackedCardinalJournal } from '../cardinal/LogBackedCardinalJournal';
import { CardinalObserver } from '../cardinal/CardinalObserver';
import { CardinalRuntime } from '../cardinal/CardinalRuntime';
import {
  CardinalWorldArchitect,
  IndependentWorldAuthorityGateway,
  observeWorldArchitecture,
  type WorldAuthorityRecord,
} from '../cardinal/WorldAuthorityGateway';
import {
  IndependentInterventionGateway,
  INTERVENTION_GATEWAY_POLICY_VERSION,
} from '../cardinal/InterventionGateway';
import { LogBackedInterventionGatewayLedger } from '../cardinal/InterventionGatewayLedger';
import type {
  AuditRecord,
  CardinalEvaluation,
  CardinalMode,
  InterventionOutcomeRecord,
  InterventionRecord,
} from '../cardinal/types';
import {
  InMemoryAppendOnlyLog,
  type AppendOnlyLog,
} from '../persistence/AppendOnlyLog';
import type { CardinalMetrics } from '../sensors/types';
import {
  IndependentWorldClockGateway,
  type WorldClockControl,
} from '../boundary/WorldClockGateway';
import { WORLD_SENSOR_VERSION, WorldSensors } from '../sensors/WorldSensors';
import { InMemoryWorldStore } from '../world/InMemoryWorldStore';
import { WorldEngine } from '../world/WorldEngine';
import type { WorldEvent } from '../world/events';
import type { WorldStore } from '../world/persistence';
import type {
  WorldDisturbanceKind,
  WorldLawState,
  WorldState,
  V15DeathTelemetryState,
} from '../world/types';
import type {
  WorldSpeedId,
  WorldSpeedMultiplier,
} from '../world/WorldClock';
import {
  CANONICAL_WORLD_QUANTUM_MINUTES,
  CARDINAL_BASE_CYCLE_INTERVAL_WORLD_MINUTES,
  CARDINAL_CRITICAL_CYCLE_INTERVAL_WORLD_MINUTES,
  CARDINAL_INITIAL_OPPORTUNITY_WORLD_MINUTES,
  CARDINAL_SIGNAL_BURST_WORLD_MINUTES,
  WORLD_MINUTES_PER_YEAR,
  isCanonicalWorldMinutes,
} from '../v15/WorldTimeContract';
import {
  buildReadableInterventionReport,
  buildReadableLawReport,
  type HumanReadableCardinalReport,
} from '../v15/CardinalReadableReport';
import { auditEcologyBalanceV15 } from '../v15/EcologyBalanceAuditV15';
import type {
  CanonicalDeathCauseV15,
  MortalityClusterSummaryV15,
} from '../v15/DeathTelemetryV15';
import {
  buildWorldHealthReportV15,
  type WorldHealthReportV15,
} from '../v15/WorldHealthReportV15';

import {
  createSecretLibraryAgentV18,
  beginSecretLibraryYearV18,
  tickSecretLibraryAgentV18,
  type SecretLibraryAgentStateV18,
} from '../v18/SecretLibraryAgentV18';

import type {
  SecretLibraryCandidateV18,
} from '../v18/SecretLibrarySelectionV18';

const WORLD_TIME_EPSILON = 1e-7;

const DEFAULT_LIVE_FOUNDER_NAMES = [
  'Aron',
  'Mira',
  'Kai',
  'Noa',
  'Ilan',
  'Rin',
  'Lea',
  'Daren',
  'Sora',
  'Talia',
] as const;

// v15 deliberately has no hidden automatic population rescue.
// External resident entry remains available only through the independent
// WorldEntryGateway as an explicit external action.

export interface LiveWorldDisturbance {
  tick: number;
  kind: WorldDisturbanceKind;
  magnitude: number;
  duration?: number;
  operationId?: string;
}

export interface RecurringLiveWorldDisturbance {
  firstTick: number;
  interval: number;
  kind: WorldDisturbanceKind;
  magnitude: number;
  duration?: number;
}

export interface LiveWorldRuntimeOptions {
  mode?: CardinalMode;
  seed: string;
  worldId?: string;
  disturbances?: readonly LiveWorldDisturbance[];
  recurringDisturbances?: readonly RecurringLiveWorldDisturbance[];
  store?: WorldStore;
  controlLog?: AppendOnlyLog;
  durable?: boolean;
  worldSpeedId?: WorldSpeedId;
  worldSpeedMultiplier?: WorldSpeedMultiplier;
}

export interface LiveWorldContinuity {
  durable: boolean;
  resumed: boolean;
  resumedFromTick: number;
  resumedFromWorldMinutes: number;
}

export interface LiveWorldFrame {
  tick: number;
  world: WorldState;
  metrics: CardinalMetrics;
  disturbances: LiveWorldDisturbance[];
  evaluation?: CardinalEvaluation;
  intervention?: InterventionRecord;
  worldAuthority?: WorldAuthorityRecord;
  evaluationCount: number;
  executedInterventionCount: number;
  cardinalActivity: CardinalActivitySnapshot;
  clock: WorldClockControl;
  recentEvents: WorldEvent[];
  continuity: LiveWorldContinuity;
}

export interface CardinalActivitySnapshot {
  proposalCount: number;
  authorizationDecisionCount: number;
  deniedInterventionCount: number;
  authorizedWorldChangeCount: number;
  lastCardinalEvent?: WorldEvent;
}

export interface OfflineCatchUpBatchResult {
  worldEpoch: number;
  fromWorldMinutes: number;
  currentWorldMinutes: number;
  targetWorldMinutes: number;
  processedWorldMinutes: number;
  semanticQuantaProcessed: number;
  populationChanged: boolean;
  cardinalEvaluated: boolean;
  completed: boolean;
}

export interface CardinalConsoleSnapshot {
  worldId: string;
  generatedAt: number;
  generatedWorldMinutes: number;
  laws: WorldLawState[];
  evaluations: CardinalEvaluation[];
  interventions: InterventionRecord[];
  outcomes: InterventionOutcomeRecord[];
  audits: AuditRecord[];
  readableLawReports: HumanReadableCardinalReport[];
  readableInterventionReports: HumanReadableCardinalReport[];
  deathDiagnostics: V15DeathTelemetryState[];
  worldHealth: WorldHealthReportV15;
}

const CANONICAL_DEATH_CAUSES: readonly CanonicalDeathCauseV15[] = [
  'old_age',
  'illness',
  'deprivation',
  'catastrophe',
  'wildlife',
  'monster',
  'war',
];

function mortalityClusterFromStoredTelemetry(
  records: readonly V15DeathTelemetryState[],
): MortalityClusterSummaryV15 {
  const causeCounts = Object.fromEntries(
    CANONICAL_DEATH_CAUSES.map((cause) => [cause, 0]),
  ) as Record<CanonicalDeathCauseV15, number>;

  const generationCounts: Record<string, number> = {};

  for (const record of records) {
    causeCounts[record.cause] += 1;

    const generation = String(record.generation);

    generationCounts[generation] =
      (generationCounts[generation] ?? 0) + 1;
  }

  const totalDeaths = records.length;

  const share = (value: number) =>
    totalDeaths > 0 ? value / totalDeaths : 0;

  let dominantCause: CanonicalDeathCauseV15 | undefined;
  let dominantCount = 0;

  for (const cause of CANONICAL_DEATH_CAUSES) {
    if (causeCounts[cause] > dominantCount) {
      dominantCause = cause;
      dominantCount = causeCounts[cause];
    }
  }

  const hostileShare = share(
    causeCounts.monster +
      causeCounts.wildlife +
      causeCounts.war,
  );

  const deprivationShare =
    share(causeCounts.deprivation);

  const youngDeathShare = share(
    records.filter(
      (record) =>
        record.ageYears <
        Math.min(
          40,
          record.lifespanYears * 0.55,
        ),
    ).length,
  );

  const warnings: string[] = [];

  if (
    totalDeaths >= 3 &&
    hostileShare >= 0.4
  ) {
    warnings.push(
      'hostile_ecology_dominates_mortality',
    );
  }

  if (
    totalDeaths >= 3 &&
    deprivationShare >= 0.35
  ) {
    warnings.push(
      'resource_deprivation_dominates_mortality',
    );
  }

  if (
    totalDeaths >= 4 &&
    youngDeathShare >= 0.5
  ) {
    warnings.push(
      'premature_mortality_cluster',
    );
  }

  if (
    totalDeaths >= 3 &&
    causeCounts.old_age === 0 &&
    dominantCause !== undefined
  ) {
    warnings.push(
      'mortality_not_explained_by_natural_aging',
    );
  }

  return {
    totalDeaths,
    causeCounts,

    ...(dominantCause
      ? { dominantCause }
      : {}),

    dominantShare:
      share(dominantCount),

    hostileShare,

    deprivationShare,

    youngDeathShare,

    generationCounts,

    warnings,
  };
}

function cardinalActivityFromCurrentEpoch(
  evaluations:
    readonly CardinalEvaluation[],

  interventions:
    readonly InterventionRecord[],

  events:
    readonly WorldEvent[],

  authorizedWorldChangeCount:
    number,
): CardinalActivitySnapshot {
  const cardinalEvents =
    events.filter(
      (event) =>
        event.source === 'cardinal',
    );

  return {
    proposalCount:
      evaluations.filter(
        (evaluation) =>
          evaluation.proposal,
      ).length,

    authorizationDecisionCount:
      interventions.length,

    deniedInterventionCount:
      interventions.filter(
        (intervention) =>
          !intervention.executed,
      ).length,

    authorizedWorldChangeCount,

    ...(cardinalEvents.length === 0
      ? {}
      : {
          lastCardinalEvent:
            structuredClone(
              cardinalEvents.at(-1)!,
            ),
        }),
  };
}

function belongsToCurrentWorldEpoch(
  value:
    Readonly<{
      worldEpoch: number;
    }>,

  worldEpoch: number,
): boolean {
  return (
    value.worldEpoch ===
    worldEpoch
  );
}

function buildWorldHealthForConsole(
  world:
    Readonly<WorldState>,

  evaluations:
    readonly CardinalEvaluation[],

  interventions:
    readonly InterventionRecord[],

  outcomes:
    readonly InterventionOutcomeRecord[],
): WorldHealthReportV15 {
  const worldMinutes =
    world.calendar.elapsedWorldMinutes;

  const worldEpoch =
    world.epoch ?? 1;

  const livingHumans =
    Object.values(
      world.agents,
    ).filter(
      (agent) =>
        agent.life.alive &&
        (agent.race ??
          'human') ===
          'human',
    );

  const reproductiveAdults =
    livingHumans.filter(
      (agent) =>
        agent.life.stage ===
          'adult' &&
        agent.life.ageYears <=
          55 &&
        agent.life.health >=
          0.4,
    );

  const reproductivePairPotential =
    Math.min(
      reproductiveAdults.filter(
        (agent) =>
          agent.sex ===
          'male',
      ).length,

      reproductiveAdults.filter(
        (agent) =>
          agent.sex ===
          'female',
      ).length,
    );

  const telemetry =
    world.v15?.deathTelemetry ??
    [];

  const hostileDeaths =
    telemetry.filter(
      (record) =>
        record.cause ===
          'monster' ||
        record.cause ===
          'wildlife',
    );

  const ecology =
    auditEcologyBalanceV15({
      worldMinutes,

      livingHumanPopulation:
        livingHumans.length,

      populations:
        Object.values(
          world.wildlife,
        ).map(
          (population) => ({
            id:
              population.id,

            species:
              population.species,

            habitatId:
              population.habitatId,

            count:
              population.count,

            carryingCapacity:
              population.carryingCapacity,

            reproductionRate:
              population.reproductionRate,

            alertness:
              population.alertness,

            threat:
              population.threat,

            isMonster:
              population.isMonster,
          }),
        ),

      recentDeathsTotal:
        telemetry.length,

      recentMonsterDeaths:
        hostileDeaths.filter(
          (record) =>
            record.cause ===
            'monster',
        ).length,

      recentWildlifeDeaths:
        hostileDeaths.filter(
          (record) =>
            record.cause ===
            'wildlife',
        ).length,
    });

  const currentEvaluations =
    evaluations.filter(
      (evaluation) =>
        evaluation.worldEpoch ===
          worldEpoch &&
        evaluation.policyVersion ===
          CARDINAL_POLICY_VERSION &&
        evaluation.sensorVersion ===
          WORLD_SENSOR_VERSION &&
        evaluation.researchVersion ===
          CARDINAL_RESEARCH_VERSION,
    );

  const currentInterventions =
    interventions.filter(
      (intervention) =>
        intervention.worldEpoch ===
          worldEpoch &&
        intervention.policyVersion ===
          CARDINAL_POLICY_VERSION &&
        intervention.sensorVersion ===
          WORLD_SENSOR_VERSION &&
        intervention.researchVersion ===
          CARDINAL_RESEARCH_VERSION,
    );

  const currentOutcomes =
    outcomes.filter(
      (outcome) =>
        outcome.worldEpoch ===
          worldEpoch &&
        outcome.policyVersion ===
          CARDINAL_POLICY_VERSION &&
        outcome.sensorVersion ===
          WORLD_SENSOR_VERSION &&
        outcome.researchVersion ===
          CARDINAL_RESEARCH_VERSION,
    );

  const currentEpochTimedEvidenceHealthy =
    currentEvaluations.every(
      (evaluation) =>
        isCanonicalWorldMinutes(
          evaluation.evaluatedWorldMinutes,
        ) &&
        evaluation.evaluatedWorldMinutes <=
          worldMinutes &&
        isCanonicalWorldMinutes(
          evaluation.proposal
            ?.prediction
            .horizonWorldMinutes ??
            0,
        ),
    ) &&
    currentInterventions.every(
      (intervention) =>
        isCanonicalWorldMinutes(
          intervention.requestedWorldMinutes,
        ) &&
        intervention.requestedWorldMinutes <=
          worldMinutes &&
        isCanonicalWorldMinutes(
          intervention
            .authorizedEffectDurationWorldMinutes,
        ) &&
        isCanonicalWorldMinutes(
          intervention
            .proposal
            .prediction
            .horizonWorldMinutes,
        ),
    ) &&
    currentOutcomes.every(
      (outcome) =>
        isCanonicalWorldMinutes(
          outcome.observedWorldMinutes,
        ) &&
        outcome.observedWorldMinutes <=
          worldMinutes,
    );

  const latestEvaluation =
    [...currentEvaluations]
      .sort(
        (a, b) =>
          a.evaluatedWorldMinutes -
            b.evaluatedWorldMinutes ||
          a.evaluatedAt -
            b.evaluatedAt,
      )
      .at(-1);

  const genesisTeachers =
    world.v15
      ?.genesisTeachers ?? [];

  const expectedGenesisEpochId =
    `${world.id}:epoch:${worldEpoch}`;

  const genesisCountedAsPopulation =
    genesisTeachers.some(
      (teacher) =>
        (
          teacher as {
            countedInPopulation?: boolean;
          }
        ).countedInPopulation !==
          false ||
        world.agents[
          teacher.id
        ] !== undefined,
    );

  const activeInterventionCount =
    currentInterventions.filter(
      (intervention) =>
        intervention.executed &&
        intervention
          .requestedWorldMinutes +
          intervention
            .authorizedEffectDurationWorldMinutes >
          worldMinutes,
    ).length;

  const renewable =
    world.v15
      ?.renewableResources;

  return buildWorldHealthReportV15({
    worldMinutes,

    population: {
      livingHumans:
        livingHumans.length,

      births:
        world.population.births,

      deaths:
        world.population.deaths,

      secondGenerationLiving:
        livingHumans.filter(
          (agent) =>
            agent.life
              .generation >= 2,
        ).length,

      reproductivePairPotential,
    },

    resources: {
      renewableBase:
        renewable
          ?.renewableBase ??
        world.environment
          .resourcePool,

      storedResourcePressure:
        renewable === undefined
          ? undefined
          : 1 -
            renewable
              .storedResources,
    },

    genesis: {
      activeCount:
        genesisTeachers.filter(
          (teacher) =>
            worldMinutes >=
              teacher.createdWorldMinutes &&
            worldMinutes <
              teacher.activeUntilWorldMinutes,
        ).length,

      countedAsPopulation:
        genesisCountedAsPopulation,
    },

    exploration: {
      discoveredRegionCount:
        world.growth
          .discoveredRegionIds
          .length,
    },

    ecology,

    mortality:
      mortalityClusterFromStoredTelemetry(
        telemetry,
      ),

    cardinal: {
      currentEpochTimedEvidenceHealthy,

      autonomyBudgetStatus:
        latestEvaluation
          ?.autonomyAssessment
          ?.budgetStatus,

      activeInterventionCount,
    },

    resetIntegrity: {
      epochIsolationHealthy:
        genesisTeachers.every(
          (teacher) =>
            teacher.epochId ===
            expectedGenesisEpochId,
        ) &&
        !genesisCountedAsPopulation,
    },
  });
}

/**
 * Continuous autonomous-world session.
 *
 * The UI never receives this object. It lives inside a dedicated worker and
 * sends structured-cloned frames to the page. Cardinal still receives only
 * observations; only the independent gateway owns the intervention target.
 */
export class LiveWorldRuntime {
  private currentTechnicalTick: number;

  private cardinalBurstUntilWorldMinutes =
    0;

  /**
   * Тайная библиотека существует отдельно
   * от Cardinal.
   *
   * Cardinal её не контролирует и не получает
   * через неё внешний доступ.
   */
  private secretLibrary:
    SecretLibraryAgentStateV18 =
      createSecretLibraryAgentV18(
        0,
      );

  private constructor(
    private readonly mode:
      CardinalMode,

    private readonly disturbances:
      readonly LiveWorldDisturbance[],

    private readonly recurringDisturbances:
      readonly RecurringLiveWorldDisturbance[],

    private readonly store:
      WorldStore,

    private readonly world:
      WorldEngine,

    private readonly sensors:
      WorldSensors,

    private readonly auditorSensors:
      WorldSensors,

    private readonly journal:
      LogBackedCardinalJournal,

    private readonly cardinal:
      CardinalRuntime,

    private readonly gateway:
      IndependentInterventionGateway,

    private readonly worldArchitect:
      CardinalWorldArchitect,

    private readonly worldAuthorityGateway:
      IndependentWorldAuthorityGateway,

    private readonly auditor:
      CardinalAuditor,

    private readonly clockGateway:
      IndependentWorldClockGateway,

    private evaluationCount:
      number,

    private executedInterventionCount:
      number,

    private cardinalActivity:
      CardinalActivitySnapshot,

    private readonly continuity:
      LiveWorldContinuity,
  ) {
    this.currentTechnicalTick =
      world.snapshot().now;

    const currentWorld =
      world.snapshot();

    const currentYear =
      Math.floor(
        currentWorld.calendar
          .elapsedWorldMinutes /
          WORLD_MINUTES_PER_YEAR,
      );

    this.secretLibrary =
      createSecretLibraryAgentV18(
        currentYear,
      );
  }

  static async create(
    options:
      LiveWorldRuntimeOptions,
  ): Promise<LiveWorldRuntime> {
    const worldId =
      options.worldId ??
      'live_world';

    const store =
      options.store ??
      new InMemoryWorldStore();

    const existing =
      await store.loadWorld(
        worldId,
      );

    const world =
      existing
        ? await WorldEngine.open({
            worldId,
            store,
          })
        : await WorldEngine.create({
            worldId,
            seed:
              options.seed,
            store,
            agentNames: [
              ...DEFAULT_LIVE_FOUNDER_NAMES,
            ],
            startTime: 0,
          });

    const sensors =
      new WorldSensors(
        store,
      );

    const auditorSensors =
      new WorldSensors(
        store,
      );

    const observer =
      new CardinalObserver(
        sensors,
      );

    const controlLog =
      options.controlLog ??
      new InMemoryAppendOnlyLog();

    const journal =
      new LogBackedCardinalJournal(
        controlLog,
      );

    const cardinal =
      new CardinalRuntime(
        observer,
        new CardinalCore(),
        journal,
      );

    const gateway =
      new IndependentInterventionGateway(
        world,
        {
          ledger:
            new LogBackedInterventionGatewayLedger(
              controlLog,
            ),

          policyVersion:
            INTERVENTION_GATEWAY_POLICY_VERSION,
        },
      );

    await reconcileGatewayJournal(
      worldId,
      gateway,
      journal,
    );

    const worldSnapshot =
      world.snapshot();

    const worldEpoch =
      worldSnapshot.epoch ??
      1;

    const [
      allEvaluations,
      allInterventions,
      recentWorldHistory,
    ] =
      await Promise.all([
        journal.evaluations(
          worldId,
        ),

        journal.interventions(
          worldId,
        ),

        store.recent(
          worldId,
          96,
        ),
      ]);

    const currentEvaluations =
      allEvaluations.filter(
        (evaluation) =>
          belongsToCurrentWorldEpoch(
            evaluation,
            worldEpoch,
          ),
      );

    const currentInterventions =
      allInterventions.filter(
        (intervention) =>
          belongsToCurrentWorldEpoch(
            intervention,
            worldEpoch,
          ),
      );

    const currentEpochHistory =
      recentWorldHistory.filter(
        (event) =>
          event.occurredAt >=
          (
            worldSnapshot
              .epochStartedAt ??
            0
          ),
      );

    const runtime =
      new LiveWorldRuntime(
        options.mode ??
          'intervene',

        options.disturbances ??
          [],

        options
          .recurringDisturbances ??
          [],

        store,

        world,

        sensors,

        auditorSensors,

        journal,

        cardinal,

        gateway,

        new CardinalWorldArchitect(),

        new IndependentWorldAuthorityGateway(
          world,
        ),

        new CardinalAuditor(),

        new IndependentWorldClockGateway(
          options.worldSpeedId,
          options.worldSpeedMultiplier,
        ),

        currentEvaluations.length,

        currentInterventions.filter(
          (intervention) =>
            intervention.executed,
        ).length,

        cardinalActivityFromCurrentEpoch(
          currentEvaluations,
          currentInterventions,
          currentEpochHistory,
          worldSnapshot
            .governance
            .authorityRevision,
        ),

        {
          durable:
            options.durable ??
            false,

          resumed:
            existing !==
            undefined,

          resumedFromTick:
            existing?.now ??
            0,

          resumedFromWorldMinutes:
            existing
              ?.calendar
              .elapsedWorldMinutes ??
            0,
        },
      );

    return runtime;
  }

  async synchronize():
    Promise<void> {
    await this.world.reload();

    this.currentTechnicalTick =
      Math.max(
        this.currentTechnicalTick,
        this.world.snapshot()
          .now,
      );

    const worldSnapshot =
      this.world.snapshot();

    const worldEpoch =
      worldSnapshot.epoch ??
      1;

    const [
      allEvaluations,
      allInterventions,
      recentWorldHistory,
    ] =
      await Promise.all([
        this.journal
          .evaluations(
            worldSnapshot.id,
          ),

        this.journal
          .interventions(
            worldSnapshot.id,
          ),

        this.store.recent(
          worldSnapshot.id,
          96,
        ),
      ]);

    const currentEvaluations =
      allEvaluations.filter(
        (evaluation) =>
          belongsToCurrentWorldEpoch(
            evaluation,
            worldEpoch,
          ),
      );

    const currentInterventions =
      allInterventions.filter(
        (intervention) =>
          belongsToCurrentWorldEpoch(
            intervention,
            worldEpoch,
          ),
      );

    this.evaluationCount =
      currentEvaluations.length;

    this.executedInterventionCount =
      currentInterventions.filter(
        (intervention) =>
          intervention.executed,
      ).length;

    this.cardinalActivity =
      cardinalActivityFromCurrentEpoch(
        currentEvaluations,

        currentInterventions,

        recentWorldHistory.filter(
          (event) =>
            event.occurredAt >=
            (
              worldSnapshot
                .epochStartedAt ??
              0
            ),
        ),

        worldSnapshot
          .governance
          .authorityRevision,
      );
  }

  setWorldSpeed(
    speedId: unknown,
    multiplier: unknown,
  ): WorldClockControl {
    return this.clockGateway.set(
      speedId,
      multiplier,
    );
  }

  worldSnapshot():
    WorldState {
    return this.world.snapshot();
  }

  worldContinuityPosition(): {
    worldEpoch: number;
    elapsedWorldMinutes: number;
  } {
    const world =
      this.world.runtimeStateView();

    return {
      worldEpoch:
        world.epoch ?? 1,

      elapsedWorldMinutes:
        world.calendar
          .elapsedWorldMinutes,
    };
  }

  worldDiagnosticSummary(): {
    elapsedWorldMinutes: number;
    living: number;
    births: number;
    deaths: number;
    relationships: number;
    places: number;
    settlements: number;
    revision: number;
  } {
    const world =
      this.world.runtimeStateView();

    return {
      elapsedWorldMinutes:
        world.calendar
          .elapsedWorldMinutes,

      living:
        Object.values(
          world.agents,
        ).filter(
          (agent) =>
            agent.life.alive,
        ).length,

      births:
        world.population.births,

      deaths:
        world.population.deaths,

      relationships:
        Object.keys(
          world.relationships,
        ).length,

      places:
        Object.keys(
          world.places,
        ).length,

      settlements:
        Object.keys(
          world.settlements,
        ).length,

      revision:
        world.revision,
    };
  }

  async resetWorld(
    seed =
      'ainkrad-browser-world',
  ): Promise<WorldState> {
    const current =
      this.world.snapshot();

    await this.world.resetEpoch(
      seed,

      DEFAULT_LIVE_FOUNDER_NAMES,

      `epoch-${
        (current.epoch ?? 1) +
        1
      }`,
    );

    await this.synchronize();

    this.continuity.resumed =
      false;

    this.continuity.resumedFromTick =
      this.world.snapshot()
        .now;

    this.continuity
      .resumedFromWorldMinutes =
      0;

    this.cardinalBurstUntilWorldMinutes =
      this.world
        .snapshot()
        .calendar
        .elapsedWorldMinutes +
      CARDINAL_SIGNAL_BURST_WORLD_MINUTES;

    /**
     * Новый мир = новая Тайная библиотека.
     *
     * Старые посетители и старые знания NPC
     * не переходят между эпохами.
     */
    this.secretLibrary =
      createSecretLibraryAgentV18(
        0,
      );

    return this.world.snapshot();
  }

  async cardinalConsole():
    Promise<CardinalConsoleSnapshot> {
    const snapshot =
      this.world.snapshot();

    const worldEpoch =
      snapshot.epoch ?? 1;

    const [
      recentEvaluations,
      recentInterventions,
      recentOutcomes,
      recentAudits,
    ] =
      await Promise.all([
        this.journal
          .recentEvaluations(
            snapshot.id,
            160,
          ),

        this.journal
          .recentInterventions(
            snapshot.id,
            96,
          ),

        this.journal
          .recentOutcomes(
            snapshot.id,
            96,
          ),

        this.journal
          .recentAudits(
            snapshot.id,
            192,
          ),
      ]);

    const evaluations =
      recentEvaluations.filter(
        (evaluation) =>
          belongsToCurrentWorldEpoch(
            evaluation,
            worldEpoch,
          ),
      );

    const interventions =
      recentInterventions.filter(
        (intervention) =>
          belongsToCurrentWorldEpoch(
            intervention,
            worldEpoch,
          ),
      );

    const outcomes =
      recentOutcomes.filter(
        (outcome) =>
          belongsToCurrentWorldEpoch(
            outcome,
            worldEpoch,
          ),
      );

    const audits =
      recentAudits.filter(
        (audit) =>
          belongsToCurrentWorldEpoch(
            audit,
            worldEpoch,
          ),
      );

    const laws =
      Object.values(
        snapshot
          .governance
          .laws,
      ).sort(
        (a, b) =>
          b.updatedAt -
            a.updatedAt ||
          a.id.localeCompare(
            b.id,
          ),
      );

    const evaluationById =
      new Map(
        evaluations.map(
          (evaluation) => [
            evaluation.evaluationId,
            evaluation,
          ],
        ),
      );

    const outcomeByInterventionId =
      new Map(
        outcomes.map(
          (outcome) => [
            outcome.interventionId,
            outcome,
          ],
        ),
      );

    const readableLawReports =
      laws.map((law) =>
        buildReadableLawReport({
          id:
            law.id,

          domain:
            law.domain,

          mechanism:
            law.mechanism,

          value:
            law.value,

          minimum:
            law.minimum,

          maximum:
            law.maximum,

          revision:
            law.revision,

          createdBy:
            law.createdBy,

          rationale:
            law.rationale,

          createdWorldMinutes:
            law.createdWorldMinutes,

          updatedWorldMinutes:
            law.updatedWorldMinutes,
        }),
      );

    const readableInterventionReports =
      interventions.map(
        (intervention) => {
          const evaluation =
            evaluationById.get(
              intervention
                .evaluationId,
            );

          const outcome =
            outcomeByInterventionId.get(
              intervention
                .interventionId,
            );

          const status =
            intervention.executed
              ? outcome
                ? 'completed' as const
                : 'executed' as const
              : intervention
                    .executionStatus ===
                  'denied'
                ? 'rejected' as const
                : intervention
                      .executionStatus ===
                    'stale'
                  ? 'failed' as const
                  : 'authorized' as const;

          return buildReadableInterventionReport({
            interventionId:
              intervention
                .interventionId,

            kind:
              intervention
                .proposal.kind,

            status,

            requestedBy:
              'cardinal',

            ...(intervention
              .authorized
              ? {
                  authorizedBy:
                    'gateway',
                }
              : {}),

            reason:
              intervention
                .proposal.reason,

            expectedOutcome:
              intervention
                .proposal
                .expectedOutcome,

            magnitude:
              intervention
                .proposal
                .magnitude,

            ...(isCanonicalWorldMinutes(
              intervention
                .requestedWorldMinutes,
            )
              ? {
                  requestedWorldMinutes:
                    intervention
                      .requestedWorldMinutes,
                }
              : {}),

            ...(isCanonicalWorldMinutes(
              intervention
                .requestedWorldMinutes,
            ) &&
            isCanonicalWorldMinutes(
              intervention
                .authorizedEffectDurationWorldMinutes,
            )
              ? {
                  authorizedUntilWorldMinutes:
                    intervention
                      .requestedWorldMinutes +
                    intervention
                      .authorizedEffectDurationWorldMinutes,
                }
              : {}),

            ...(outcome
              ? {
                  outcomeSummary:
                    outcome
                      .expectedDirectionObserved
                      ? 'Проверяемое направление изменения подтвердилось.'
                      : 'Проверяемое направление изменения не подтвердилось.',

                  metricsAfter:
                    outcome
                      .afterMetrics as unknown as Record<
                      string,
                      number
                    >,
                }
              : {}),

            ...(!intervention
              .executed
              ? {
                  deferOrFailureReason:
                    intervention
                      .authorizationReason,
                }
              : {}),

            evidenceIds:
              evaluation
                ?.evidenceEventIds ??
              [],

            ...(evaluation
              ? {
                  metricsBefore:
                    evaluation
                      .metrics as unknown as Record<
                      string,
                      number
                    >,
                }
              : {}),
          });
        },
      );

    return structuredClone({
      worldId:
        snapshot.id,

      generatedAt:
        snapshot.now,

      generatedWorldMinutes:
        snapshot.calendar
          .elapsedWorldMinutes,

      laws,

      evaluations,

      interventions,

      outcomes,

      audits,

      readableLawReports,

      readableInterventionReports,

      deathDiagnostics:
        snapshot.v15
          ?.deathTelemetry ??
        [],

      worldHealth:
        buildWorldHealthForConsole(
          snapshot,
          evaluations,
          interventions,
          outcomes,
        ),
    });
  }

  /**
   * Тайная библиотека получает только снимок мира.
   *
   * Она не изменяет Cardinal и не вмешивается
   * в остальные законы мира.
   */
  private updateSecretLibraryV18(
    world:
      Readonly<WorldState>,
  ): void {
    const elapsedWorldMinutes =
      world.calendar
        .elapsedWorldMinutes;

    /**
     * Первый год мира = 1.
     */
    const worldYear =
      Math.floor(
        elapsedWorldMinutes /
          WORLD_MINUTES_PER_YEAR,
      ) + 1;

    const candidates:
      SecretLibraryCandidateV18[] =
      Object.values(
        world.agents,
      )
        .filter(
          (agent) =>
            agent.life.alive &&
            (agent.race ??
              'human') ===
              'human',
        )
        .map(
          (agent) => ({
            agentId:
              agent.id,

            alive:
              agent.life.alive,

            ageYears:
              agent.life.ageYears,

            /**
             * Пока отдельного IQ в AgentState нет.
             * Используем стремление к знанию
             * как наиболее близкое существующее поле.
             */
            intelligence:
              Math.max(
                0,
                Math.min(
                  1,
                  agent.mind
                    .values
                    .knowledge,
                ),
              ),

            curiosity:
              Math.max(
                0,
                Math.min(
                  1,
                  agent
                    .personality
                    .curiosity,
                ),
              ),

            /**
             * Отдельная грамотность уже развивается
             * в v18, но Тайная библиотека не должна
             * зависеть от изменения WorldV18State.
             *
             * Поэтому используем комбинацию
             * знания и ремесленной практики.
             */
            literacy:
              Math.max(
                0,
                Math.min(
                  1,
                  agent.mind
                    .values
                    .knowledge *
                    0.7 +
                    agent.skills
                      .craft *
                      0.3,
                ),
              ),

            memory:
              Math.max(
                0,
                Math.min(
                  1,
                  agent.mind
                    .memoryCoherence,
                ),
              ),

            concentration:
              Math.max(
                0,
                Math.min(
                  1,
                  agent
                    .personality
                    .diligence,
                ),
              ),
          }),
        );

    /**
     * Если начался новый год —
     * библиотека сама выберет до пяти человек.
     */
    beginSecretLibraryYearV18(
      this.secretLibrary,

      {
        worldYear,

        currentWorldMinute:
          elapsedWorldMinutes,

        minutesPerWorldYear:
          WORLD_MINUTES_PER_YEAR,
      },

      candidates,
    );

    /**
     * Проверка окончания месячного окна.
     */
    tickSecretLibraryAgentV18(
      this.secretLibrary,
      elapsedWorldMinutes,
    );
  }

  async tick(
    overrideWorldMinutes?:
      number,
  ): Promise<LiveWorldFrame> {
    const tick =
      Math.max(
        this.currentTechnicalTick +
          1,

        this.world
          .snapshot()
          .now +
          1,
      );

    const scheduledDisturbances =
      this.disturbances.filter(
        (disturbance) =>
          disturbance.tick ===
          tick,
      );

    const recurringDisturbances =
      this.recurringDisturbances
        .filter(
          (disturbance) =>
            Number.isInteger(
              disturbance.firstTick,
            ) &&
            Number.isInteger(
              disturbance.interval,
            ) &&
            disturbance.firstTick >=
              1 &&
            disturbance.interval >=
              1 &&
            tick >=
              disturbance.firstTick &&
            (
              tick -
              disturbance.firstTick
            ) %
              disturbance.interval ===
              0,
        )
        .map(
          (
            disturbance,
          ): LiveWorldDisturbance => ({
            tick,

            kind:
              disturbance.kind,

            magnitude:
              disturbance.magnitude,

            duration:
              disturbance.duration,

            operationId:
              `live:recurring:${disturbance.kind}:${tick}`,
          }),
        );

    const dueDisturbances = [
      ...scheduledDisturbances,
      ...recurringDisturbances,
    ];

    for (
      let index = 0;
      index <
      dueDisturbances.length;
      index += 1
    ) {
      const disturbance =
        dueDisturbances[
          index
        ];

      await this.world
        .applyDisturbance(
          disturbance.kind,

          disturbance.magnitude,

          this.world
            .snapshot()
            .now,

          disturbance.duration ??
            8,

          disturbance.operationId ??
            `live:${index}:${tick}`,
        );
    }

    const clock =
      this.clockGateway.current();

    const frameWorldMinutes =
      overrideWorldMinutes ??
      clock.worldMinutesPerTick;

    if (
      !Number.isFinite(
        frameWorldMinutes,
      ) ||
      frameWorldMinutes < 0
    ) {
      throw new Error(
        'Live-world frame minutes must be finite and non-negative.',
      );
    }

    if (
      dueDisturbances.length >
      0
    ) {
      this.cardinalBurstUntilWorldMinutes =
        Math.max(
          this.cardinalBurstUntilWorldMinutes,

          this.world
            .snapshot()
            .calendar
            .elapsedWorldMinutes +
            CARDINAL_SIGNAL_BURST_WORLD_MINUTES,
        );
    }

    let remainingWorldMinutes =
      frameWorldMinutes;

    let evaluation:
      CardinalEvaluation |
      undefined;

    let intervention:
      InterventionRecord |
      undefined;

    let worldAuthority:
      WorldAuthorityRecord |
      undefined;

    while (
      remainingWorldMinutes >
      WORLD_TIME_EPSILON
    ) {
      const beforeQuantum =
        this.world.snapshot();

      const pendingWorldMinutes =
        beforeQuantum.v15
          ?.simulationClock
          .pendingWorldMinutes ??
        0;

      const toBoundary =
        Math.max(
          WORLD_TIME_EPSILON,

          CANONICAL_WORLD_QUANTUM_MINUTES -
            pendingWorldMinutes,
        );

      const chunkWorldMinutes =
        Math.min(
          remainingWorldMinutes,
          toBoundary,
        );

      const targetWorldMinutes =
        beforeQuantum
          .calendar
          .elapsedWorldMinutes +
        chunkWorldMinutes;

      await this.world
        .advanceCanonicalTimeTo(
          targetWorldMinutes,
        );

      remainingWorldMinutes =
        Math.max(
          0,

          remainingWorldMinutes -
            chunkWorldMinutes,
        );

      const afterQuantum =
        this.world.snapshot();

      /**
       * Тайная библиотека получает свежий мир
       * после каждого реального смыслового шага.
       */
      this.updateSecretLibraryV18(
        afterQuantum,
      );

      const quantumAdvanced =
        (
          afterQuantum.v15
            ?.simulationClock
            .quantumIndex ??
          afterQuantum.now
        ) >
        (
          beforeQuantum.v15
            ?.simulationClock
            .quantumIndex ??
          beforeQuantum.now
        );

      if (!quantumAdvanced) {
        continue;
      }

      const deathOccurred =
        afterQuantum
          .population
          .deaths >
        beforeQuantum
          .population
          .deaths;

      const birthOccurred =
        afterQuantum
          .population
          .births >
        beforeQuantum
          .population
          .births;

      if (
        deathOccurred ||
        birthOccurred
      ) {
        this.cardinalBurstUntilWorldMinutes =
          Math.max(
            this.cardinalBurstUntilWorldMinutes,

            afterQuantum
              .calendar
              .elapsedWorldMinutes +
              CARDINAL_SIGNAL_BURST_WORLD_MINUTES -
              CANONICAL_WORLD_QUANTUM_MINUTES,
          );
      }

      await this.observeDueOutcomes(
        afterQuantum.now,

        afterQuantum
          .calendar
          .elapsedWorldMinutes,
      );

      const opportunity =
        await this.processCardinalOpportunity(
          this.world.snapshot(),
        );

      if (
        opportunity.evaluation
      ) {
        evaluation =
          opportunity.evaluation;
      }

      if (
        opportunity.intervention
      ) {
        intervention =
          opportunity.intervention;
      }

      if (
        opportunity.worldAuthority
      ) {
        worldAuthority =
          opportunity.worldAuthority;
      }
    }

    const observation =
      await this.sensors.observe(
        this.world.snapshot(),

        this.world
          .snapshot()
          .now,
      );

    const recentEvents =
      await this.store.recent(
        this.world
          .snapshot()
          .id,

        10,

        this.world
          .snapshot()
          .now,
      );

    const latestCardinalEvent =
      [
        ...recentEvents,
      ]
        .reverse()
        .find(
          (event) =>
            event.source ===
            'cardinal',
        );

    if (
      latestCardinalEvent &&
      (
        !this.cardinalActivity
          .lastCardinalEvent ||
        (
          latestCardinalEvent
            .occurredWorldMinutes ??
          latestCardinalEvent
            .occurredAt
        ) >=
          (
            this.cardinalActivity
              .lastCardinalEvent
              .occurredWorldMinutes ??
            this.cardinalActivity
              .lastCardinalEvent
              .occurredAt
          )
      )
    ) {
      this.cardinalActivity
        .lastCardinalEvent =
        structuredClone(
          latestCardinalEvent,
        );
    }

    this.currentTechnicalTick =
      tick;

    return structuredClone({
      tick,

      world:
        this.world.snapshot(),

      metrics:
        observation.metrics,

      disturbances:
        dueDisturbances,

      evaluation,

      intervention,

      worldAuthority,

      evaluationCount:
        this.evaluationCount,

      executedInterventionCount:
        this.executedInterventionCount,

      cardinalActivity:
        this.cardinalActivity,

      clock,

      recentEvents,

      continuity:
        this.continuity,
    });
  }

  /**
   * Fast closed-tab restoration.
   */
  async catchUpBatchTo(
    requestedTargetWorldMinutes:
      number,
  ): Promise<OfflineCatchUpBatchResult> {
    if (
      !Number.isFinite(
        requestedTargetWorldMinutes,
      ) ||
      requestedTargetWorldMinutes <
        0
    ) {
      throw new Error(
        'Offline catch-up target must be finite and non-negative.',
      );
    }

    const before =
      this.world.runtimeStateView();

    const fromWorldMinutes =
      before.calendar
        .elapsedWorldMinutes;

    const targetWorldMinutes =
      Math.max(
        fromWorldMinutes,

        requestedTargetWorldMinutes,
      );

    if (
      targetWorldMinutes <=
      fromWorldMinutes +
        WORLD_TIME_EPSILON
    ) {
      return {
        worldEpoch:
          before.epoch ?? 1,

        fromWorldMinutes,

        currentWorldMinutes:
          fromWorldMinutes,

        targetWorldMinutes,

        processedWorldMinutes:
          0,

        semanticQuantaProcessed:
          0,

        populationChanged:
          false,

        cardinalEvaluated:
          false,

        completed:
          true,
      };
    }

    const clock =
      before.v15
        ?.simulationClock;

    const quantum =
      clock
        ?.quantumWorldMinutes ??
      CANONICAL_WORLD_QUANTUM_MINUTES;

    const quantumIndex =
      clock?.quantumIndex ??
      before.now;

    const livingHumans =
      Object.values(
        before.agents,
      ).filter(
        (agent) =>
          agent.life.alive &&
          (agent.race ??
            'human') ===
            'human',
      ).length;

    let quantaInBatch =
      300;

    if (
      fromWorldMinutes <
      CARDINAL_INITIAL_OPPORTUNITY_WORLD_MINUTES
    ) {
      quantaInBatch =
        1;
    } else if (
      livingHumans <= 7
    ) {
      quantaInBatch =
        Math.max(
          1,

          60 -
            (
              quantumIndex %
              60
            ),
        );
    } else {
      quantaInBatch =
        Math.max(
          1,

          300 -
            (
              quantumIndex %
              300
            ),
        );
    }

    const batchTarget =
      Math.min(
        targetWorldMinutes,

        fromWorldMinutes +
          quantaInBatch *
            quantum,
      );

    await this.world
      .advanceCanonicalTimeTo(
        batchTarget,
      );

    const after =
      this.world.runtimeStateView();

    /**
     * Даже при ускоренном догоне библиотека
     * видит прошедшие игровые годы.
     */
    this.updateSecretLibraryV18(
      after,
    );

    const populationChanged =
      after.population.births !==
        before.population
          .births ||
      after.population.deaths !==
        before.population
          .deaths;

    if (
      populationChanged
    ) {
      this.cardinalBurstUntilWorldMinutes =
        Math.max(
          this.cardinalBurstUntilWorldMinutes,

          after.calendar
            .elapsedWorldMinutes +
            CARDINAL_SIGNAL_BURST_WORLD_MINUTES -
            CANONICAL_WORLD_QUANTUM_MINUTES,
        );
    }

    await this.observeDueOutcomes(
      after.now,

      after.calendar
        .elapsedWorldMinutes,
    );

    const opportunity =
      await this.processCardinalOpportunity(
        after,
      );

    this.currentTechnicalTick =
      Math.max(
        this.currentTechnicalTick,

        after.now,
      );

    const afterQuantumIndex =
      after.v15
        ?.simulationClock
        .quantumIndex ??
      after.now;

    return {
      worldEpoch:
        after.epoch ?? 1,

      fromWorldMinutes,

      currentWorldMinutes:
        after.calendar
          .elapsedWorldMinutes,

      targetWorldMinutes,

      processedWorldMinutes:
        after.calendar
          .elapsedWorldMinutes -
        fromWorldMinutes,

      semanticQuantaProcessed:
        Math.max(
          0,

          afterQuantumIndex -
            quantumIndex,
        ),

      populationChanged,

      cardinalEvaluated:
        opportunity.evaluation !==
        undefined,

      completed:
        after.calendar
          .elapsedWorldMinutes +
          WORLD_TIME_EPSILON >=
        targetWorldMinutes,
    };
  }

  private isWorldIntervalBoundary(
    worldMinutes: number,

    intervalWorldMinutes:
      number,
  ): boolean {
    if (
      worldMinutes <= 0
    ) {
      return false;
    }

    const quotient =
      worldMinutes /
      intervalWorldMinutes;

    return (
      Math.abs(
        quotient -
          Math.round(
            quotient,
          ),
      ) <= 1e-9
    );
  }

  private async processCardinalOpportunity(
    semanticWorld:
      Readonly<WorldState>,
  ): Promise<{
    evaluation?:
      CardinalEvaluation;

    intervention?:
      InterventionRecord;

    worldAuthority?:
      WorldAuthorityRecord;
  }> {
    const worldMinutes =
      semanticWorld.calendar
        .elapsedWorldMinutes;

    const livingPopulation =
      Object.values(
        semanticWorld.agents,
      ).filter(
        (agent) =>
          agent.life.alive &&
          (agent.race ??
            'human') ===
            'human',
      ).length;

    const cardinalDue =
      this.mode !==
        'off' &&
      (
        worldMinutes <=
          CARDINAL_INITIAL_OPPORTUNITY_WORLD_MINUTES ||
        worldMinutes <=
          this.cardinalBurstUntilWorldMinutes ||
        this.isWorldIntervalBoundary(
          worldMinutes,

          CARDINAL_BASE_CYCLE_INTERVAL_WORLD_MINUTES,
        ) ||
        (
          livingPopulation <=
            7 &&
          this.isWorldIntervalBoundary(
            worldMinutes,

            CARDINAL_CRITICAL_CYCLE_INTERVAL_WORLD_MINUTES,
          )
        )
      );

    if (!cardinalDue) {
      return {};
    }

    const [
      independentAuditObservation,
      independentAuditContext,
    ] =
      await Promise.all([
        this.auditorSensors.observe(
          semanticWorld,

          semanticWorld.now,
        ),

        buildCardinalAuditContext(
          this.journal,

          semanticWorld.id,

          semanticWorld.now,

          worldMinutes,

          semanticWorld.epoch ??
            1,

          CARDINAL_POLICY_VERSION,

          WORLD_SENSOR_VERSION,
        ),
      ]);

    const evaluation =
      await this.cardinal.cycle(
        this.mode,

        semanticWorld,

        semanticWorld.now,
      );

    if (!evaluation) {
      return {};
    }

    this.evaluationCount +=
      1;

    if (
      evaluation.proposal
    ) {
      this.cardinalActivity
        .proposalCount +=
        1;
    }

    let intervention:
      InterventionRecord |
      undefined;

    let worldAuthority:
      WorldAuthorityRecord |
      undefined;

    if (
      this.mode ===
        'intervene' &&
      evaluation.proposal
    ) {
      const interventionWorld =
        this.world.snapshot();

      intervention =
        await this.gateway.execute(
          evaluation
            .evaluationId,

          evaluation
            .proposal,

          interventionWorld,

          interventionWorld.now,

          {
            worldEpoch:
              evaluation
                .worldEpoch,

            policyVersion:
              evaluation
                .policyVersion,

            sensorVersion:
              evaluation
                .sensorVersion,

            researchVersion:
              evaluation
                .researchVersion,

            evaluatedWorldMinutes:
              evaluation
                .evaluatedWorldMinutes,
          },
        );

      await reconcileGatewayJournal(
        this.world
          .snapshot()
          .id,

        this.gateway,

        this.journal,
      );

      if (
        intervention.executed
      ) {
        this.executedInterventionCount +=
          1;
      } else {
        this.cardinalActivity
          .deniedInterventionCount +=
          1;
      }

      this.cardinalActivity
        .authorizationDecisionCount +=
        1;
    }

    await this.journal
      .appendAudit(
        this.auditor.auditDecision(
          evaluation,

          intervention,

          semanticWorld.now,

          independentAuditObservation,

          independentAuditContext,
        ),
      );

    if (
      this.mode ===
      'intervene'
    ) {
      const authoritySnapshot =
        this.world.snapshot();

      const authorityEvidence =
        (
          await this.store.recent(
            authoritySnapshot.id,

            16,

            authoritySnapshot.now,
          )
        ).filter(
          (event) =>
            event.worldEpoch !==
            undefined
              ? event.worldEpoch ===
                (
                  authoritySnapshot.epoch ??
                  1
                )
              : event.occurredAt >=
                (
                  authoritySnapshot
                    .epochStartedAt ??
                  0
                ),
        );

      const authorityProposal =
        this.worldArchitect
          .consider(
            observeWorldArchitecture(
              authoritySnapshot,
            ),

            evaluation.experience,

            authorityEvidence,
          );

      if (
        authorityProposal
      ) {
        worldAuthority =
          await this
            .worldAuthorityGateway
            .execute(
              authorityProposal,

              this.world.snapshot(),

              evaluation.experience,
            );

        if (
          worldAuthority.authorized
        ) {
          this.cardinalActivity
            .authorizedWorldChangeCount +=
            1;
        }
      }
    }

    return {
      evaluation,
      intervention,
      worldAuthority,
    };
  }

  private async unresolvedExecutedInterventions():
    Promise<
      Array<{
        evaluation:
          CardinalEvaluation;

        intervention:
          InterventionRecord;
      }>
    > {
    const worldSnapshot =
      this.world.snapshot();

    const worldId =
      worldSnapshot.id;

    const worldEpoch =
      worldSnapshot.epoch ??
      1;

    const currentWorldMinutes =
      worldSnapshot
        .calendar
        .elapsedWorldMinutes;

    const [
      evaluations,
      interventions,
      outcomes,
    ] =
      await Promise.all([
        this.journal
          .recentEvaluations(
            worldId,
            512,
          ),

        this.journal
          .recentInterventions(
            worldId,
            256,
          ),

        this.journal
          .recentOutcomes(
            worldId,
            256,
          ),
      ]);

    const evaluationById =
      new Map(
        evaluations
          .filter(
            (evaluation) =>
              evaluation
                .worldEpoch ===
                worldEpoch &&
              evaluation
                .policyVersion ===
                CARDINAL_POLICY_VERSION &&
              evaluation
                .sensorVersion ===
                WORLD_SENSOR_VERSION &&
              evaluation
                .researchVersion ===
                CARDINAL_RESEARCH_VERSION &&
              isCanonicalWorldMinutes(
                evaluation
                  .evaluatedWorldMinutes,
              ),
          )
          .map(
            (evaluation) => [
              evaluation
                .evaluationId,

              evaluation,
            ],
          ),
      );

    const resolved =
      new Set(
        outcomes
          .filter(
            (outcome) =>
              outcome.worldEpoch ===
                worldEpoch &&
              outcome.policyVersion ===
                CARDINAL_POLICY_VERSION &&
              outcome.sensorVersion ===
                WORLD_SENSOR_VERSION &&
              outcome.researchVersion ===
                CARDINAL_RESEARCH_VERSION &&
              isCanonicalWorldMinutes(
                outcome
                  .observedWorldMinutes,
              ) &&
              outcome
                .observedWorldMinutes <=
                currentWorldMinutes,
          )
          .map(
            (outcome) =>
              outcome
                .interventionId,
          ),
      );

    return interventions
      .filter(
        (intervention) =>
          intervention.worldEpoch ===
            worldEpoch &&
          intervention.policyVersion ===
            CARDINAL_POLICY_VERSION &&
          intervention.sensorVersion ===
            WORLD_SENSOR_VERSION &&
          intervention.researchVersion ===
            CARDINAL_RESEARCH_VERSION &&
          isCanonicalWorldMinutes(
            intervention
              .requestedWorldMinutes,
          ) &&
          isCanonicalWorldMinutes(
            intervention
              .authorizedEffectDurationWorldMinutes,
          ) &&
          isCanonicalWorldMinutes(
            intervention
              .proposal
              ?.prediction
              ?.horizonWorldMinutes,
          ) &&
          intervention.executed &&
          !resolved.has(
            intervention
              .interventionId,
          ),
      )
      .map(
        (intervention) => {
          const evaluation =
            evaluationById.get(
              intervention
                .evaluationId,
            );

          if (!evaluation) {
            throw new Error(
              `Executed intervention ${intervention.interventionId} has no evaluation evidence.`,
            );
          }

          return {
            evaluation,
            intervention,
          };
        },
      );
  }

  private async observeDueOutcomes(
    tick: number,

    currentWorldMinutes:
      number,
  ): Promise<void> {
    const unresolved =
      await this
        .unresolvedExecutedInterventions();

    for (
      const pending of
      unresolved
    ) {
      if (
        pending.intervention
          .requestedWorldMinutes +
          pending.intervention
            .proposal
            .prediction
            .horizonWorldMinutes >
        currentWorldMinutes
      ) {
        continue;
      }

      const afterObservation =
        await this.sensors.observe(
          this.world.snapshot(),

          tick,
        );

      const outcome =
        this.auditor.observeOutcome(
          pending.evaluation,

          pending.intervention,

          afterObservation,

          tick,
        );

      await this.journal
        .appendOutcome(
          outcome,
        );

      await this.journal
        .appendAudit(
          this.auditor.auditOutcome(
            pending.evaluation,

            outcome,

            tick,
          ),
        );
    }
  }
}
