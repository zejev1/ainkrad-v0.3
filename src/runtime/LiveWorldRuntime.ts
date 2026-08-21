import { CardinalAuditor } from '../cardinal/CardinalAuditor';
import { buildCardinalAuditContext } from '../cardinal/CardinalAuditContext';
import { CardinalCore } from '../cardinal/CardinalCore';
import { reconcileGatewayJournal } from '../cardinal/CardinalRecovery';
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
  CardinalEvaluation,
  CardinalMode,
  InterventionRecord,
} from '../cardinal/types';
import {
  InMemoryAppendOnlyLog,
  type AppendOnlyLog,
} from '../persistence/AppendOnlyLog';
import type { CardinalMetrics } from '../sensors/types';
import { WORLD_SENSOR_VERSION, WorldSensors } from '../sensors/WorldSensors';
import { InMemoryWorldStore } from '../world/InMemoryWorldStore';
import { WorldEngine } from '../world/WorldEngine';
import type { WorldEvent } from '../world/events';
import type { WorldStore } from '../world/persistence';
import type { WorldDisturbanceKind, WorldState } from '../world/types';

export interface LiveWorldDisturbance {
  tick: number;
  kind: WorldDisturbanceKind;
  magnitude: number;
  duration?: number;
  operationId?: string;
}

export interface LiveWorldRuntimeOptions {
  mode?: CardinalMode;
  seed: string;
  worldId?: string;
  disturbances?: readonly LiveWorldDisturbance[];
  store?: WorldStore;
  controlLog?: AppendOnlyLog;
  durable?: boolean;
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
  recentEvents: WorldEvent[];
  continuity: LiveWorldContinuity;
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

  private constructor(
    private readonly mode: CardinalMode,
    private readonly disturbances: readonly LiveWorldDisturbance[],
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
    private evaluationCount: number,
    private executedInterventionCount: number,
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
          startTime: 0,
        });
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

    const [evaluations, interventions] = await Promise.all([
      journal.evaluations(worldId),
      journal.interventions(worldId),
    ]);

    return new LiveWorldRuntime(
      options.mode ?? 'intervene',
      options.disturbances ?? [],
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
      evaluations.length,
      interventions.filter((intervention) => intervention.executed).length,
      {
        durable: options.durable ?? false,
        resumed: existing !== undefined,
        resumedFromTick: existing?.now ?? 0,
      },
    );
  }

  async synchronize(): Promise<void> {
    await this.world.reload();
    this.currentTick = this.world.snapshot().now;

    const [evaluations, interventions] = await Promise.all([
      this.journal.evaluations(this.world.snapshot().id),
      this.journal.interventions(this.world.snapshot().id),
    ]);
    this.evaluationCount = evaluations.length;
    this.executedInterventionCount = interventions.filter(
      (intervention) => intervention.executed,
    ).length;
  }

  async tick(): Promise<LiveWorldFrame> {
    const tick = this.currentTick + 1;
    const dueDisturbances = this.disturbances.filter(
      (disturbance) => disturbance.tick === tick,
    );

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

    await this.world.step(tick);
    await this.observeDueOutcomes(tick);

    const independentAuditObservation =
      this.mode === 'off'
        ? undefined
        : await this.auditorSensors.observe(this.world.snapshot(), tick);

    const independentAuditContext =
      this.mode === 'off'
        ? undefined
        : await buildCardinalAuditContext(
            this.journal,
            this.world.snapshot().id,
            tick,
            WORLD_SENSOR_VERSION,
          );

    const evaluation = await this.cardinal.cycle(
      this.mode,
      this.world.snapshot(),
      tick,
    );

    let intervention: InterventionRecord | undefined;
    let worldAuthority: WorldAuthorityRecord | undefined;

    if (evaluation) {
      this.evaluationCount += 1;

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
        }
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

      if (this.mode === 'intervene' && !intervention?.executed) {
        const authorityEvidence = await this.store.recent(
          this.world.snapshot().id,
          16,
          tick,
        );
        const authorityProposal = this.worldArchitect.consider(
          observeWorldArchitecture(this.world.snapshot()),
          evaluation.experience,
          authorityEvidence,
        );
        if (authorityProposal) {
          worldAuthority = await this.worldAuthorityGateway.execute(
            authorityProposal,
            this.world.snapshot(),
            evaluation.experience,
          );
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
    const worldId = this.world.snapshot().id;

    const [evaluations, interventions, outcomes] = await Promise.all([
      this.journal.evaluations(worldId),
      this.journal.interventions(worldId),
      this.journal.outcomes(worldId),
    ]);

    const evaluationById = new Map(
      evaluations.map((evaluation) => [
        evaluation.evaluationId,
        evaluation,
      ]),
    );

    const resolved = new Set(
      outcomes.map((outcome) => outcome.interventionId),
    );

    return interventions
      .filter(
        (intervention) =>
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
