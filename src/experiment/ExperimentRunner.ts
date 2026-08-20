import { CardinalAuditor } from '../cardinal/CardinalAuditor';
import {
  buildCardinalAuditContext,
  CARDINAL_AUDIT_CONTEXT_VERSION,
} from '../cardinal/CardinalAuditContext';
import {
  CardinalCore,
  MAX_CARDINAL_PREDICTION_HORIZON,
} from '../cardinal/CardinalCore';
import { CARDINAL_RESEARCH_VERSION } from '../cardinal/CardinalResearch';
import { reconcileGatewayJournal } from '../cardinal/CardinalRecovery';
import { LogBackedCardinalJournal } from '../cardinal/LogBackedCardinalJournal';
import { CardinalObserver } from '../cardinal/CardinalObserver';
import { CardinalRuntime } from '../cardinal/CardinalRuntime';
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
import { stableJsonStringify } from '../core/stableJson';
import { InMemoryAppendOnlyLog } from '../persistence/AppendOnlyLog';
import type { CardinalMetrics } from '../sensors/types';
import { WORLD_SENSOR_VERSION, WorldSensors } from '../sensors/WorldSensors';
import { InMemoryWorldStore } from '../world/InMemoryWorldStore';
import { WORLD_RULES_VERSION, WorldEngine } from '../world/WorldEngine';
import type { WorldDisturbanceKind } from '../world/types';

export interface ScheduledDisturbance {
  tick: number;
  kind: WorldDisturbanceKind;
  magnitude: number;
  duration?: number;
  operationId?: string;
}


export interface ExperimentManifest {
  mode: CardinalMode;
  seed: string;
  ticks: number;
  worldRulesVersion: string;
  sensorVersion: string;
  cardinalPolicyVersion: string;
  cardinalResearchVersion: string;
  cardinalAuditContextVersion: string;
  interventionGatewayPolicyVersion: string;
  disturbancesFingerprint: string;
}

export interface ExperimentTickRecord {
  tick: number;
  metrics: CardinalMetrics;
}

export interface ExperimentResult {
  mode: CardinalMode;
  manifest: ExperimentManifest;
  finalWorld: ReturnType<WorldEngine['snapshot']>;
  finalMetrics: CardinalMetrics;
  worldEventCount: number;
  worldHistoryFingerprint: string;
  timeline: ExperimentTickRecord[];
  evaluationCount: number;
  authorizationDecisionCount: number;
  interventionCount: number;
  executedInterventionCount: number;
  outcomeCount: number;
  auditCount: number;
  pendingOutcomeCount: number;
  deferCount: number;
  experimentInProgressDeferralCount: number;
  autonomyBudgetDeferralCount: number;
}

export interface MetricDeltas {
  populationActivity: number;
  averageStress: number;
  socialIsolation: number;
  conflictPressure: number;
  resourcePressure: number;
  relationshipDiversity: number;
  recoveryCapacity: number;
  activeSignalCount: number;
}

export interface ControlledComparisonAnalysis {
  pairedConfigurationEquivalent: boolean;
  offObserverEquivalent: boolean;
  interveneMinusOffFinalMetrics: MetricDeltas;
}

export interface ControlledComparisonResult {
  off: ExperimentResult;
  observer: ExperimentResult;
  intervene: ExperimentResult;
  analysis: ControlledComparisonAnalysis;
}


function metricDeltas(a: CardinalMetrics, b: CardinalMetrics): MetricDeltas {
  return {
    populationActivity: a.populationActivity - b.populationActivity,
    averageStress: a.averageStress - b.averageStress,
    socialIsolation: a.socialIsolation - b.socialIsolation,
    conflictPressure: a.conflictPressure - b.conflictPressure,
    resourcePressure: a.resourcePressure - b.resourcePressure,
    relationshipDiversity: a.relationshipDiversity - b.relationshipDiversity,
    recoveryCapacity: a.recoveryCapacity - b.recoveryCapacity,
    activeSignalCount: a.activeSignalCount - b.activeSignalCount,
  };
}

export async function runExperiment(
  mode: CardinalMode,
  seed: string,
  ticks: number,
  disturbances: readonly ScheduledDisturbance[] = [],
): Promise<ExperimentResult> {
  if (!Number.isInteger(ticks) || ticks < 0) {
    throw new Error('Experiment ticks must be a non-negative integer.');
  }

  const store = new InMemoryWorldStore();
  const world = await WorldEngine.create({
    // The same logical world ID and seed are used for paired runs. OFF and
    // OBSERVER should therefore remain exactly equivalent if observation has
    // no side effects.
    worldId: 'experiment_world',
    seed,
    store,
    startTime: 0,
  });

  const sensors = new WorldSensors(store);
  const auditorSensors = new WorldSensors(store);
  const observer = new CardinalObserver(sensors);
  const controlLog = new InMemoryAppendOnlyLog();
  const journal = new LogBackedCardinalJournal(controlLog);
  const core = new CardinalCore();
  const cardinal = new CardinalRuntime(observer, core, journal);
  const gatewayLedger = new LogBackedInterventionGatewayLedger(controlLog);
  const gateway = new IndependentInterventionGateway(world, {
    ledger: gatewayLedger,
    policyVersion: INTERVENTION_GATEWAY_POLICY_VERSION,
  });
  const auditor = new CardinalAuditor();
  const timeline: ExperimentTickRecord[] = [];

  const unresolvedExecutedInterventions = async (): Promise<
    Array<{ evaluation: CardinalEvaluation; intervention: InterventionRecord }>
  > => {
    const worldId = world.snapshot().id;
    const [evaluations, interventions, outcomes] = await Promise.all([
      journal.evaluations(worldId),
      journal.interventions(worldId),
      journal.outcomes(worldId),
    ]);
    const evaluationById = new Map(
      evaluations.map((evaluation) => [evaluation.evaluationId, evaluation]),
    );
    const resolved = new Set(outcomes.map((outcome) => outcome.interventionId));

    return interventions
      .filter((intervention) => intervention.executed && !resolved.has(intervention.interventionId))
      .map((intervention) => {
        const evaluation = evaluationById.get(intervention.evaluationId);
        if (!evaluation) {
          throw new Error(
            `Executed intervention ${intervention.interventionId} has no evaluation evidence.`,
          );
        }
        return { evaluation, intervention };
      });
  };

  const observeDueOutcomes = async (tick: number): Promise<void> => {
    const unresolved = await unresolvedExecutedInterventions();
    for (const pending of unresolved) {
      if (
        pending.intervention.requestedAt +
          pending.intervention.proposal.prediction.horizon >
        tick
      ) {
        continue;
      }

      const afterObservation = await sensors.observe(world.snapshot(), tick);
      const outcome = auditor.observeOutcome(
        pending.evaluation,
        pending.intervention,
        afterObservation,
        tick,
      );
      await journal.appendOutcome(outcome);
      await journal.appendAudit(
        auditor.auditOutcome(pending.evaluation, outcome, tick),
      );
    }
  };

  for (let tick = 1; tick <= ticks; tick += 1) {
    for (let index = 0; index < disturbances.length; index += 1) {
      const disturbance = disturbances[index];
      if (disturbance.tick === tick) {
        await world.applyDisturbance(
          disturbance.kind,
          disturbance.magnitude,
          tick,
          disturbance.duration ?? 8,
          disturbance.operationId ?? `scheduled:${index}:${tick}`,
        );
      }
    }

    await world.step(tick);
    await observeDueOutcomes(tick);

    const independentAuditObservation =
      mode === 'off'
        ? undefined
        : await auditorSensors.observe(world.snapshot(), tick);
    const independentAuditContext =
      mode === 'off'
        ? undefined
        : await buildCardinalAuditContext(
            journal,
            world.snapshot().id,
            tick,
            WORLD_SENSOR_VERSION,
          );
    const evaluation = await cardinal.cycle(mode, world.snapshot(), tick);

    if (evaluation) {
      let intervention: InterventionRecord | undefined;

      if (mode === 'intervene' && evaluation.proposal) {
        intervention = await gateway.execute(
          evaluation.evaluationId,
          evaluation.proposal,
          world.snapshot(),
          tick,
        );
        await reconcileGatewayJournal(world.snapshot().id, gateway, journal);

      }

      await journal.appendAudit(
        auditor.auditDecision(
          evaluation,
          intervention,
          tick,
          independentAuditObservation,
          independentAuditContext,
        ),
      );
    }

    // This measurement belongs to the experiment harness, not Cardinal. It is
    // collected in every mode so OFF remains a true no-Cardinal control while
    // still being measurable by the researcher.
    const endOfTick = await sensors.observe(world.snapshot(), tick);
    timeline.push({
      tick,
      metrics: structuredClone(endOfTick.metrics),
    });
  }

  // Preserve the requested experiment endpoint before follow-up. We then run a
  // short no-Cardinal observation tail so interventions near the final tick do
  // not silently lose their required outcome/audit record.
  const finalWorld = world.snapshot();
  const finalObservation = await sensors.observe(finalWorld, ticks);
  const finalWorldHistory = await store.history(finalWorld.id);
  const worldHistoryFingerprint = stableJsonStringify(finalWorldHistory);

  for (
    let followTick = ticks + 1;
    followTick <= ticks + MAX_CARDINAL_PREDICTION_HORIZON;
    followTick += 1
  ) {
    if ((await unresolvedExecutedInterventions()).length === 0) {
      break;
    }
    await world.step(followTick);
    await observeDueOutcomes(followTick);
  }

  const worldId = finalWorld.id;
  const evaluationRecords = await journal.evaluations(worldId);
  const interventionRecords = await journal.interventions(worldId);
  const executedInterventionCount = interventionRecords.filter(
    (item) => item.executed,
  ).length;

  return {
    mode,
    manifest: {
      mode,
      seed,
      ticks,
      worldRulesVersion: WORLD_RULES_VERSION,
      sensorVersion: WORLD_SENSOR_VERSION,
      cardinalPolicyVersion: core.policyVersion,
      cardinalResearchVersion: CARDINAL_RESEARCH_VERSION,
      cardinalAuditContextVersion: CARDINAL_AUDIT_CONTEXT_VERSION,
      interventionGatewayPolicyVersion: gateway.policyVersion,
      disturbancesFingerprint: stableJsonStringify(disturbances),
    },
    finalWorld,
    finalMetrics: structuredClone(finalObservation.metrics),
    worldEventCount: finalWorldHistory.length,
    worldHistoryFingerprint,
    timeline,
    evaluationCount: evaluationRecords.length,
    authorizationDecisionCount: interventionRecords.length,
    interventionCount: executedInterventionCount,
    executedInterventionCount,
    outcomeCount: (await journal.outcomes(worldId)).length,
    auditCount: (await journal.audits(worldId)).length,
    pendingOutcomeCount: (await unresolvedExecutedInterventions()).length,
    deferCount: evaluationRecords.filter((item) => item.decision === 'defer').length,
    experimentInProgressDeferralCount: evaluationRecords.filter(
      (item) => item.deferReason === 'experiment_in_progress',
    ).length,
    autonomyBudgetDeferralCount: evaluationRecords.filter(
      (item) => item.deferReason === 'autonomy_budget',
    ).length,
  };
}

export async function runControlledComparison(
  seed: string,
  ticks: number,
  disturbances: readonly ScheduledDisturbance[] = [],
): Promise<ControlledComparisonResult> {
  const [off, observer, intervene] = await Promise.all([
    runExperiment('off', seed, ticks, disturbances),
    runExperiment('observer', seed, ticks, disturbances),
    runExperiment('intervene', seed, ticks, disturbances),
  ]);

  return {
    off,
    observer,
    intervene,
    analysis: {
      pairedConfigurationEquivalent:
        off.manifest.seed === observer.manifest.seed &&
        off.manifest.seed === intervene.manifest.seed &&
        off.manifest.ticks === observer.manifest.ticks &&
        off.manifest.ticks === intervene.manifest.ticks &&
        off.manifest.worldRulesVersion === observer.manifest.worldRulesVersion &&
        off.manifest.worldRulesVersion === intervene.manifest.worldRulesVersion &&
        off.manifest.sensorVersion === observer.manifest.sensorVersion &&
        off.manifest.sensorVersion === intervene.manifest.sensorVersion &&
        off.manifest.cardinalPolicyVersion === observer.manifest.cardinalPolicyVersion &&
        off.manifest.cardinalPolicyVersion === intervene.manifest.cardinalPolicyVersion &&
        off.manifest.cardinalResearchVersion === observer.manifest.cardinalResearchVersion &&
        off.manifest.cardinalResearchVersion === intervene.manifest.cardinalResearchVersion &&
        off.manifest.cardinalAuditContextVersion ===
          observer.manifest.cardinalAuditContextVersion &&
        off.manifest.cardinalAuditContextVersion ===
          intervene.manifest.cardinalAuditContextVersion &&
        off.manifest.interventionGatewayPolicyVersion ===
          observer.manifest.interventionGatewayPolicyVersion &&
        off.manifest.interventionGatewayPolicyVersion ===
          intervene.manifest.interventionGatewayPolicyVersion &&
        off.manifest.disturbancesFingerprint === observer.manifest.disturbancesFingerprint &&
        off.manifest.disturbancesFingerprint === intervene.manifest.disturbancesFingerprint,
      offObserverEquivalent:
        stableJsonStringify(off.finalWorld) === stableJsonStringify(observer.finalWorld) &&
        off.worldHistoryFingerprint === observer.worldHistoryFingerprint,
      interveneMinusOffFinalMetrics: metricDeltas(
        intervene.finalMetrics,
        off.finalMetrics,
      ),
    },
  };
}
