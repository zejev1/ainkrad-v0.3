import { CardinalAuditor } from '../cardinal/CardinalAuditor';
import { CardinalCore } from '../cardinal/CardinalCore';
import { InMemoryCardinalJournal } from '../cardinal/InMemoryCardinalJournal';
import { CardinalObserver } from '../cardinal/CardinalObserver';
import { CardinalRuntime } from '../cardinal/CardinalRuntime';
import { IndependentInterventionGateway } from '../cardinal/InterventionGateway';
import type {
  CardinalEvaluation,
  CardinalMode,
  InterventionRecord,
} from '../cardinal/types';
import { stableJsonStringify } from '../core/stableJson';
import type { CardinalMetrics } from '../sensors/types';
import { WorldSensors } from '../sensors/WorldSensors';
import { InMemoryEventStore } from '../world/InMemoryEventStore';
import { InMemoryMemoryStore } from '../world/InMemoryMemoryStore';
import { WorldEngine } from '../world/WorldEngine';
import type { WorldDisturbanceKind } from '../world/types';

export interface ScheduledDisturbance {
  tick: number;
  kind: WorldDisturbanceKind;
  magnitude: number;
  duration?: number;
  operationId?: string;
}

interface PendingOutcome {
  dueTick: number;
  evaluation: CardinalEvaluation;
  intervention: InterventionRecord;
}

export interface ExperimentTickRecord {
  tick: number;
  metrics: CardinalMetrics;
}

export interface ExperimentResult {
  mode: CardinalMode;
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
  offObserverEquivalent: boolean;
  interveneMinusOffFinalMetrics: MetricDeltas;
}

export interface ControlledComparisonResult {
  off: ExperimentResult;
  observer: ExperimentResult;
  intervene: ExperimentResult;
  analysis: ControlledComparisonAnalysis;
}

const outcomeHorizon = 4;

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

  const eventStore = new InMemoryEventStore();
  const world = new WorldEngine({
    // The same logical world ID and seed are used for paired runs. OFF and
    // OBSERVER should therefore remain exactly equivalent if observation has
    // no side effects.
    worldId: 'experiment_world',
    seed,
    eventStore,
    memoryStore: new InMemoryMemoryStore(),
    startTime: 0,
  });

  const sensors = new WorldSensors(eventStore);
  const auditorSensors = new WorldSensors(eventStore);
  const observer = new CardinalObserver(sensors);
  const journal = new InMemoryCardinalJournal();
  const cardinal = new CardinalRuntime(observer, new CardinalCore(), journal);
  const gateway = new IndependentInterventionGateway(world);
  const auditor = new CardinalAuditor();
  const pendingOutcomes: PendingOutcome[] = [];
  const timeline: ExperimentTickRecord[] = [];

  const observeDueOutcomes = async (tick: number): Promise<void> => {
    for (let index = pendingOutcomes.length - 1; index >= 0; index -= 1) {
      const pending = pendingOutcomes[index];
      if (pending.dueTick > tick) {
        continue;
      }

      const afterObservation = await sensors.observe(world.snapshot(), tick);
      const outcome = auditor.observeOutcome(
        pending.evaluation,
        pending.intervention,
        afterObservation.metrics,
        tick,
      );
      await journal.appendOutcome(outcome);
      await journal.appendAudit(
        auditor.auditOutcome(pending.evaluation, outcome, tick),
      );
      pendingOutcomes.splice(index, 1);
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
          disturbance.duration,
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
        await journal.appendIntervention(intervention);

        if (intervention.executed) {
          pendingOutcomes.push({
            dueTick: tick + outcomeHorizon,
            evaluation: structuredClone(evaluation),
            intervention: structuredClone(intervention),
          });
        }
      }

      await journal.appendAudit(
        auditor.auditDecision(
          evaluation,
          intervention,
          tick,
          independentAuditObservation,
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
  const finalWorldHistory = await eventStore.history(finalWorld.id);
  const worldHistoryFingerprint = stableJsonStringify(finalWorldHistory);

  for (
    let followTick = ticks + 1;
    pendingOutcomes.length > 0 && followTick <= ticks + outcomeHorizon;
    followTick += 1
  ) {
    await world.step(followTick);
    await observeDueOutcomes(followTick);
  }

  const worldId = finalWorld.id;
  const interventionRecords = await journal.interventions(worldId);
  const executedInterventionCount = interventionRecords.filter(
    (item) => item.executed,
  ).length;

  return {
    mode,
    finalWorld,
    finalMetrics: structuredClone(finalObservation.metrics),
    worldEventCount: finalWorldHistory.length,
    worldHistoryFingerprint,
    timeline,
    evaluationCount: (await journal.evaluations(worldId)).length,
    authorizationDecisionCount: interventionRecords.length,
    interventionCount: executedInterventionCount,
    executedInterventionCount,
    outcomeCount: (await journal.outcomes(worldId)).length,
    auditCount: (await journal.audits(worldId)).length,
    pendingOutcomeCount: pendingOutcomes.length,
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
