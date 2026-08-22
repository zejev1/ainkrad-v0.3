import { CardinalAuditor } from '../cardinal/CardinalAuditor';
import { buildCardinalAuditContext } from '../cardinal/CardinalAuditContext';
import { CardinalCore } from '../cardinal/CardinalCore';
import { reconcileGatewayJournal } from '../cardinal/CardinalRecovery';
import { LogBackedCardinalJournal } from '../cardinal/LogBackedCardinalJournal';
import type { CardinalJournalSummary } from '../cardinal/CardinalJournal';
import { CardinalObserver } from '../cardinal/CardinalObserver';
import { CardinalRuntime } from '../cardinal/CardinalRuntime';
import {
  CardinalWorldArchitect,
  IndependentWorldAuthorityGateway,
  observeWorldArchitecture,
  type WorldAuthorityRecord,
} from '../cardinal/WorldAuthorityGateway';
import { IndependentWorldEntryGateway } from '../boundary/WorldEntryGateway';
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
} from '../world/types';
import type {
  WorldSpeedId,
  WorldSpeedMultiplier,
} from '../world/WorldClock';

const CARDINAL_BASE_CYCLE_INTERVAL = 300;
const CARDINAL_CRITICAL_CYCLE_INTERVAL = 10;
const CARDINAL_SIGNAL_BURST_TICKS = 4;

const DEFAULT_LIVE_FOUNDER_NAMES = [
  'Aron', 'Mira', 'Kai', 'Noa', 'Ilan', 'Rin', 'Lea', 'Daren', 'Sora', 'Talia',
] as const;
const RECOVERY_COHORT = [
  ['recovery_0314_01', 'Aren'], ['recovery_0314_02', 'Selene'],
  ['recovery_0314_03', 'Leon'], ['recovery_0314_04', 'Aria'],
  ['recovery_0314_05', 'Dain'], ['recovery_0314_06', 'Liora'],
  ['recovery_0314_07', 'Niko'], ['recovery_0314_08', 'Elin'],
  ['recovery_0314_09', 'Rian'], ['recovery_0314_10', 'Maya'],
] as const;

async function ensureRecoveryCohort(world: WorldEngine): Promise<number> {
  const snapshot = world.snapshot();
  const livingHumans = Object.values(snapshot.agents).filter(
    (agent) => agent.life.alive && (agent.race ?? 'human') === 'human',
  ).length;
  const present = RECOVERY_COHORT.filter(([entryId]) =>
    snapshot.agents[`visitor_${entryId}`],
  ).length;
  if (livingHumans > 7 && present === 0) return 0;
  if (present === RECOVERY_COHORT.length) return 0;

  let added = 0;
  const gateway = new IndependentWorldEntryGateway(world);
  for (const [entryId, name] of RECOVERY_COHORT) {
    if (world.snapshot().agents[`visitor_${entryId}`]) continue;
    const expected = world.snapshot();
    const record = await gateway.enter(
      {
        requestId: `v0.3.14-recovery:${entryId}`,
        worldId: expected.id,
        externalIdentityId: entryId,
        displayName: name,
        role: 'resident',
        requestedAt: expected.now,
      },
      expected,
    );
    if (!record.authorized) {
      throw new Error(`Recovery cohort entry ${entryId} was denied: ${record.reason}`);
    }
    added += 1;
  }
  return added;
}

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

export interface CardinalConsoleSnapshot {
  worldId: string;
  generatedAt: number;
  laws: WorldLawState[];
  evaluations: CardinalEvaluation[];
  interventions: InterventionRecord[];
  outcomes: InterventionOutcomeRecord[];
  audits: AuditRecord[];
}

function cardinalActivityFromHistory(
  summary: Readonly<CardinalJournalSummary>,
  events: readonly WorldEvent[],
  authorizedWorldChangeCount: number,
): CardinalActivitySnapshot {
  const cardinalEvents = events.filter((event) => event.source === 'cardinal');
  return {
    proposalCount: summary.proposalCount,
    authorizationDecisionCount: summary.interventionCount,
    deniedInterventionCount: summary.deniedInterventionCount,
    authorizedWorldChangeCount,
    ...(cardinalEvents.length === 0
      ? {}
      : { lastCardinalEvent: structuredClone(cardinalEvents.at(-1)!) }),
  };
}

/**
 * Continuous autonomous-world session.
 *
 * The UI never receives this object. It lives inside a dedicated worker and
 * sends structured-cloned frames to the page. Cardinal still receives only
 * observations; only the independent gateway owns the intervention target.
 */
export class LiveWorldRuntime {
  private currentTick: number;
  private cardinalBurstUntil = 0;

  private constructor(
    private readonly mode: CardinalMode,
    private readonly disturbances: readonly LiveWorldDisturbance[],
    private readonly recurringDisturbances: readonly RecurringLiveWorldDisturbance[],
    private readonly store: WorldStore,
    private readonly world: WorldEngine,
    private readonly sensors: WorldSensors,
    private readonly auditorSensors: WorldSensors,
    private readonly journal: LogBackedCardinalJournal,
    private readonly cardinal: CardinalRuntime,
    private readonly gateway: IndependentInterventionGateway,
    private readonly worldArchitect: CardinalWorldArchitect,
    private readonly worldAuthorityGateway: IndependentWorldAuthorityGateway,
    private readonly auditor: CardinalAuditor,
    private readonly clockGateway: IndependentWorldClockGateway,
    private evaluationCount: number,
    private executedInterventionCount: number,
    private cardinalActivity: CardinalActivitySnapshot,
    private readonly continuity: LiveWorldContinuity,
  ) {
    this.currentTick = world.snapshot().now;
  }

  static async create(
    options: LiveWorldRuntimeOptions,
  ): Promise<LiveWorldRuntime> {
    const worldId = options.worldId ?? 'live_world';
    const store = options.store ?? new InMemoryWorldStore();
    const existing = await store.loadWorld(worldId);
    const world = existing
      ? await WorldEngine.open({ worldId, store })
      : await WorldEngine.create({
          worldId,
          seed: options.seed,
          store,
          agentNames: [...DEFAULT_LIVE_FOUNDER_NAMES],
          startTime: 0,
        });
    const recoveryEntriesAdded = existing
      ? await ensureRecoveryCohort(world)
      : 0;
    const sensors = new WorldSensors(store);
    const auditorSensors = new WorldSensors(store);
    const observer = new CardinalObserver(sensors);
    const controlLog = options.controlLog ?? new InMemoryAppendOnlyLog();
    const journal = new LogBackedCardinalJournal(controlLog);
    const cardinal = new CardinalRuntime(
      observer,
      new CardinalCore(),
      journal,
    );
    const gateway = new IndependentInterventionGateway(world, {
      ledger: new LogBackedInterventionGatewayLedger(controlLog),
      policyVersion: INTERVENTION_GATEWAY_POLICY_VERSION,
    });

    await reconcileGatewayJournal(worldId, gateway, journal);

    const [summary, recentWorldHistory] = await Promise.all([
      journal.summary(worldId),
      store.recent(worldId, 96),
    ]);

    const runtime = new LiveWorldRuntime(
      options.mode ?? 'intervene',
      options.disturbances ?? [],
      options.recurringDisturbances ?? [],
      store,
      world,
      sensors,
      auditorSensors,
      journal,
      cardinal,
      gateway,
      new CardinalWorldArchitect(),
      new IndependentWorldAuthorityGateway(world),
      new CardinalAuditor(),
      new IndependentWorldClockGateway(
        options.worldSpeedId,
        options.worldSpeedMultiplier,
      ),
      summary.evaluationCount,
      summary.executedInterventionCount,
      cardinalActivityFromHistory(
        summary,
        recentWorldHistory,
        world.snapshot().governance.authorityRevision,
      ),
      {
        durable: options.durable ?? false,
        resumed: existing !== undefined,
        resumedFromTick: existing?.now ?? 0,
      },
    );
    if (recoveryEntriesAdded > 0) {
      runtime.cardinalBurstUntil = world.snapshot().now + CARDINAL_SIGNAL_BURST_TICKS;
    }
    return runtime;
  }

  async synchronize(): Promise<void> {
    await this.world.reload();
    this.currentTick = this.world.snapshot().now;

    const [summary, recentWorldHistory] = await Promise.all([
      this.journal.summary(this.world.snapshot().id),
      this.store.recent(this.world.snapshot().id, 96),
    ]);
    this.evaluationCount = summary.evaluationCount;
    this.executedInterventionCount = summary.executedInterventionCount;
    this.cardinalActivity = cardinalActivityFromHistory(
      summary,
      recentWorldHistory,
      this.world.snapshot().governance.authorityRevision,
    );
  }

  setWorldSpeed(speedId: unknown, multiplier: unknown): WorldClockControl {
    return this.clockGateway.set(speedId, multiplier);
  }

  async resetWorld(seed = 'ainkrad-browser-world'): Promise<WorldState> {
    const current = this.world.snapshot();
    await this.world.resetEpoch(
      seed,
      DEFAULT_LIVE_FOUNDER_NAMES,
      `epoch-${(current.epoch ?? 1) + 1}`,
    );
    await this.synchronize();
    this.cardinalBurstUntil = this.currentTick + CARDINAL_SIGNAL_BURST_TICKS;
    return this.world.snapshot();
  }

  async cardinalConsole(): Promise<CardinalConsoleSnapshot> {
    const snapshot = this.world.snapshot();
    const [evaluations, interventions, outcomes, audits] = await Promise.all([
      this.journal.recentEvaluations(snapshot.id, 160),
      this.journal.recentInterventions(snapshot.id, 96),
      this.journal.recentOutcomes(snapshot.id, 96),
      this.journal.recentAudits(snapshot.id, 192),
    ]);
    return structuredClone({
      worldId: snapshot.id,
      generatedAt: snapshot.now,
      laws: Object.values(snapshot.governance.laws).sort(
        (a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id),
      ),
      evaluations,
      interventions,
      outcomes,
      audits,
    });
  }

  async tick(): Promise<LiveWorldFrame> {
    const tick = this.currentTick + 1;
    const scheduledDisturbances = this.disturbances.filter(
      (disturbance) => disturbance.tick === tick,
    );
    const recurringDisturbances = this.recurringDisturbances
      .filter(
        (disturbance) =>
          Number.isInteger(disturbance.firstTick) &&
          Number.isInteger(disturbance.interval) &&
          disturbance.firstTick >= 1 &&
          disturbance.interval >= 1 &&
          tick >= disturbance.firstTick &&
          (tick - disturbance.firstTick) % disturbance.interval === 0,
      )
      .map(
        (disturbance): LiveWorldDisturbance => ({
          tick,
          kind: disturbance.kind,
          magnitude: disturbance.magnitude,
          duration: disturbance.duration,
          operationId: `live:recurring:${disturbance.kind}:${tick}`,
        }),
      );
    const dueDisturbances = [
      ...scheduledDisturbances,
      ...recurringDisturbances,
    ];

    for (let index = 0; index < dueDisturbances.length; index += 1) {
      const disturbance = dueDisturbances[index];
      await this.world.applyDisturbance(
        disturbance.kind,
        disturbance.magnitude,
        tick,
        disturbance.duration ?? 8,
        disturbance.operationId ?? `live:${index}:${tick}`,
      );
    }

    const beforeStep = this.world.snapshot();
    const clock = this.clockGateway.current();
    await this.world.step(tick, clock.worldMinutesPerTick);
    await this.observeDueOutcomes(tick);

    const afterStep = this.world.snapshot();
    const livingPopulation = Object.values(afterStep.agents).filter(
      (agent) =>
        agent.life.alive && (agent.race ?? 'human') === 'human',
    ).length;
    const deathOccurred =
      afterStep.population.deaths > beforeStep.population.deaths;
    const birthOccurred =
      afterStep.population.births > beforeStep.population.births;
    const criticalPopulation = livingPopulation <= 7;
    if (dueDisturbances.length > 0 || deathOccurred || birthOccurred) {
      this.cardinalBurstUntil = Math.max(
        this.cardinalBurstUntil,
        tick + CARDINAL_SIGNAL_BURST_TICKS - 1,
      );
    }
    const cardinalDue =
      this.mode !== 'off' &&
      (tick <= 3 ||
        tick <= this.cardinalBurstUntil ||
        tick % CARDINAL_BASE_CYCLE_INTERVAL === 0 ||
        (criticalPopulation && tick % CARDINAL_CRITICAL_CYCLE_INTERVAL === 0));

    const independentAuditObservation = cardinalDue
      ? await this.auditorSensors.observe(afterStep, tick)
      : undefined;

    const independentAuditContext = cardinalDue
      ? await buildCardinalAuditContext(
          this.journal,
          afterStep.id,
          tick,
          WORLD_SENSOR_VERSION,
          afterStep.epochStartedAt ?? 0,
        )
      : undefined;

    const evaluation = cardinalDue
      ? await this.cardinal.cycle(this.mode, afterStep, tick)
      : undefined;

    let intervention: InterventionRecord | undefined;
    let worldAuthority: WorldAuthorityRecord | undefined;

    if (evaluation) {
      this.evaluationCount += 1;
      if (evaluation.proposal) {
        this.cardinalActivity.proposalCount += 1;
      }

      if (this.mode === 'intervene' && evaluation.proposal) {
        intervention = await this.gateway.execute(
          evaluation.evaluationId,
          evaluation.proposal,
          this.world.snapshot(),
          tick,
        );

        await reconcileGatewayJournal(
          this.world.snapshot().id,
          this.gateway,
          this.journal,
        );

        if (intervention.executed) {
          this.executedInterventionCount += 1;
        } else {
          this.cardinalActivity.deniedInterventionCount += 1;
        }
        this.cardinalActivity.authorizationDecisionCount += 1;
      }

      await this.journal.appendAudit(
        this.auditor.auditDecision(
          evaluation,
          intervention,
          tick,
          independentAuditObservation,
          independentAuditContext,
        ),
      );

      if (this.mode === 'intervene') {
        const authoritySnapshot = this.world.snapshot();
        const authorityEvidence = (await this.store.recent(
          authoritySnapshot.id,
          16,
          tick,
        )).filter(
          (event) => event.occurredAt >= (authoritySnapshot.epochStartedAt ?? 0),
        );
        const authorityProposal = this.worldArchitect.consider(
          observeWorldArchitecture(authoritySnapshot),
          evaluation.experience,
          authorityEvidence,
        );
        if (authorityProposal) {
          worldAuthority = await this.worldAuthorityGateway.execute(
            authorityProposal,
            this.world.snapshot(),
            evaluation.experience,
          );
          if (worldAuthority.authorized) {
            this.cardinalActivity.authorizedWorldChangeCount += 1;
          }
        }
      }
    }

    const observation = await this.sensors.observe(
      this.world.snapshot(),
      tick,
    );

    const recentEvents = await this.store.recent(
      this.world.snapshot().id,
      10,
      tick,
    );
    const latestCardinalEvent = [...recentEvents]
      .reverse()
      .find((event) => event.source === 'cardinal');
    if (
      latestCardinalEvent &&
      (!this.cardinalActivity.lastCardinalEvent ||
        latestCardinalEvent.occurredAt >=
          this.cardinalActivity.lastCardinalEvent.occurredAt)
    ) {
      this.cardinalActivity.lastCardinalEvent = structuredClone(
        latestCardinalEvent,
      );
    }

    this.currentTick = tick;

    return structuredClone({
      tick,
      world: this.world.snapshot(),
      metrics: observation.metrics,
      disturbances: dueDisturbances,
      evaluation,
      intervention,
      worldAuthority,
      evaluationCount: this.evaluationCount,
      executedInterventionCount: this.executedInterventionCount,
      cardinalActivity: this.cardinalActivity,
      clock,
      recentEvents,
      continuity: this.continuity,
    });
  }

  private async unresolvedExecutedInterventions(): Promise<
    Array<{
      evaluation: CardinalEvaluation;
      intervention: InterventionRecord;
    }>
  > {
    const worldSnapshot = this.world.snapshot();
    const worldId = worldSnapshot.id;
    const epochFloor = worldSnapshot.epochStartedAt ?? 0;

    const [evaluations, interventions, outcomes] = await Promise.all([
      this.journal.recentEvaluations(worldId, 512),
      this.journal.recentInterventions(worldId, 256),
      this.journal.recentOutcomes(worldId, 256),
    ]);

    const evaluationById = new Map(
      evaluations.map((evaluation) => [
        evaluation.evaluationId,
        evaluation,
      ]),
    );

    const resolved = new Set(
      outcomes
        .filter((outcome) => outcome.observedAt >= epochFloor)
        .map((outcome) => outcome.interventionId),
    );

    return interventions
      .filter(
        (intervention) =>
          intervention.requestedAt >= epochFloor &&
          intervention.executed &&
          !resolved.has(intervention.interventionId),
      )
      .map((intervention) => {
        const evaluation = evaluationById.get(
          intervention.evaluationId,
        );

        if (!evaluation) {
          throw new Error(
            `Executed intervention ${intervention.interventionId} has no evaluation evidence.`,
          );
        }

        return { evaluation, intervention };
      });
  }

  private async observeDueOutcomes(tick: number): Promise<void> {
    const unresolved = await this.unresolvedExecutedInterventions();

    for (const pending of unresolved) {
      if (
        pending.intervention.requestedAt +
          pending.intervention.proposal.prediction.horizon >
        tick
      ) {
        continue;
      }

      const afterObservation = await this.sensors.observe(
        this.world.snapshot(),
        tick,
      );

      const outcome = this.auditor.observeOutcome(
        pending.evaluation,
        pending.intervention,
        afterObservation,
        tick,
      );

      await this.journal.appendOutcome(outcome);

      await this.journal.appendAudit(
        this.auditor.auditOutcome(
          pending.evaluation,
          outcome,
          tick,
        ),
      );
    }
  }
}
