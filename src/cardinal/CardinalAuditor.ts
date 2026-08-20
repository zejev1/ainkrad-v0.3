import { createStableId } from '../core/stableId';
import { stableJsonStringify } from '../core/stableJson';
import type { CardinalMetrics, SensorSnapshot } from '../sensors/types';
import type {
  AuditRecord,
  CardinalEvaluation,
  CardinalPredictionMetric,
  InterventionOutcomeRecord,
  InterventionRecord,
} from './types';

function metricValue(
  metrics: CardinalMetrics,
  metric: CardinalPredictionMetric,
): number {
  return metrics[metric];
}

export class CardinalAuditor {
  auditDecision(
    evaluation: Readonly<CardinalEvaluation>,
    intervention: Readonly<InterventionRecord> | undefined,
    now: number,
    independentObservation?: Readonly<SensorSnapshot>,
  ): AuditRecord {
    const concerns: string[] = [];
    let independentObservationMatched: boolean | undefined;

    if (!independentObservation) {
      independentObservationMatched = false;
      concerns.push('Decision audit did not receive an independent world observation.');
    } else {
      independentObservationMatched =
        independentObservation.sensorVersion === evaluation.sensorVersion &&
        independentObservation.worldId === evaluation.worldId &&
        independentObservation.worldRevision === evaluation.observedWorldRevision &&
        independentObservation.observedAt === evaluation.evaluatedAt &&
        stableJsonStringify(independentObservation.metrics) ===
          stableJsonStringify(evaluation.metrics) &&
        stableJsonStringify(independentObservation.evidenceEventIds) ===
          stableJsonStringify(evaluation.evidenceEventIds) &&
        stableJsonStringify(independentObservation.limitations) ===
          stableJsonStringify(evaluation.uncertaintyNotes);

      if (!independentObservationMatched) {
        concerns.push(
          'Cardinal evaluation does not match the Auditor independent observation.',
        );
      }
    }

    if (!evaluation.researchVersion.trim() || !evaluation.researchContextFingerprint.trim()) {
      concerns.push('Cardinal evaluation is missing versioned research-context evidence.');
    }

    if (evaluation.mode === 'observer' && intervention?.executed) {
      concerns.push('Observer mode caused a world intervention.');
    }

    if (evaluation.proposal && evaluation.proposal.magnitude > 0.25) {
      concerns.push('Proposed intervention exceeded the minimal-intervention magnitude.');
    }

    if (evaluation.decision === 'propose' && !evaluation.proposal) {
      concerns.push('Evaluation proposed action without a concrete proposal.');
    }

    if (evaluation.decision !== 'propose' && evaluation.proposal) {
      concerns.push('Cardinal attached a proposal to a decision that should not act.');
    }

    if (evaluation.decision !== 'no_action' && !evaluation.detectedProblem) {
      concerns.push('Cardinal detected actionable pressure without a testable problem hypothesis.');
    }

    if (evaluation.detectedProblem) {
      if (
        evaluation.detectedProblem.confidence < 0 ||
        evaluation.detectedProblem.confidence > 1
      ) {
        concerns.push('Cardinal hypothesis confidence is outside the normalized range.');
      }
      if (evaluation.detectedProblem.persistence < 1) {
        concerns.push('Cardinal hypothesis persistence must include the current observation.');
      }
    }

    if (evaluation.proposal) {
      if (
        !evaluation.detectedProblem ||
        evaluation.proposal.hypothesisId !== evaluation.detectedProblem.hypothesisId
      ) {
        concerns.push('Intervention proposal is not bound to the detected hypothesis.');
      }
      if (
        !Number.isFinite(evaluation.proposal.prediction.minimumImprovement) ||
        evaluation.proposal.prediction.minimumImprovement < 0 ||
        !Number.isInteger(evaluation.proposal.prediction.horizon) ||
        evaluation.proposal.prediction.horizon < 1
      ) {
        concerns.push('Intervention proposal does not contain a valid falsifiable prediction.');
      }
    }

    if (intervention?.executed && !intervention.authorized) {
      concerns.push('An unauthorized intervention was executed.');
    }

    if (intervention) {
      if (!intervention.gatewayPolicyVersion.trim()) {
        concerns.push('Intervention is missing its gateway policy version.');
      }
      if (intervention.observedWorldRevision !== evaluation.observedWorldRevision) {
        concerns.push('Gateway intervention was bound to a different observed world revision.');
      }
      if (
        intervention.executionStatus === 'executed' &&
        (!intervention.executed || intervention.committedWorldRevision === undefined)
      ) {
        concerns.push('Executed intervention is missing committed revision evidence.');
      }
      if (intervention.executionStatus !== 'executed' && intervention.executed) {
        concerns.push('Intervention execution status conflicts with executed=true.');
      }
    }

    if (evaluation.decision === 'propose' && evaluation.evidenceEventIds.length === 0) {
      concerns.push('Intervention proposal has no recorded world-event evidence.');
    }

    return {
      auditId: createStableId('audit-decision', {
        evaluationId: evaluation.evaluationId,
        interventionId: intervention?.interventionId,
      }),
      worldId: evaluation.worldId,
      auditedAt: now,
      stage: 'decision',
      evaluationId: evaluation.evaluationId,
      interventionId: intervention?.interventionId,
      independentObservationMatched,
      accepted: concerns.length === 0,
      concerns,
    };
  }

  observeOutcome(
    evaluation: Readonly<CardinalEvaluation>,
    intervention: Readonly<InterventionRecord>,
    afterObservation: Readonly<SensorSnapshot>,
    now: number,
  ): InterventionOutcomeRecord {
    const before = evaluation.metrics;
    const after = structuredClone(afterObservation.metrics);
    const prediction = intervention.proposal.prediction;
    const observedPredictionDelta =
      metricValue(after, prediction.metric) - metricValue(before, prediction.metric);
    const expectedDirectionObserved =
      prediction.direction === 'decrease' &&
      observedPredictionDelta <= -prediction.minimumImprovement;

    return {
      outcomeId: createStableId('outcome', {
        interventionId: intervention.interventionId,
        observedAt: now,
        afterWorldRevision: afterObservation.worldRevision,
        sensorVersion: afterObservation.sensorVersion,
        prediction,
      }),
      worldId: evaluation.worldId,
      interventionId: intervention.interventionId,
      evaluationId: evaluation.evaluationId,
      observedAt: now,
      sensorVersion: afterObservation.sensorVersion,
      beforeWorldRevision: evaluation.observedWorldRevision,
      afterWorldRevision: afterObservation.worldRevision,
      evidenceEventIds: [...afterObservation.evidenceEventIds],
      beforeMetrics: structuredClone(before),
      afterMetrics: after,
      recoveryCapacityDelta: after.recoveryCapacity - before.recoveryCapacity,
      averageStressDelta: after.averageStress - before.averageStress,
      socialIsolationDelta: after.socialIsolation - before.socialIsolation,
      conflictPressureDelta: after.conflictPressure - before.conflictPressure,
      resourcePressureDelta: after.resourcePressure - before.resourcePressure,
      predictionMetric: prediction.metric,
      predictedMinimumImprovement: prediction.minimumImprovement,
      observedPredictionDelta,
      expectedDirectionObserved,
      causalClaim: 'observational_only',
    };
  }

  auditOutcome(
    evaluation: Readonly<CardinalEvaluation>,
    outcome: Readonly<InterventionOutcomeRecord>,
    now: number,
  ): AuditRecord {
    const concerns: string[] = [];

    if (outcome.sensorVersion !== evaluation.sensorVersion) {
      concerns.push('Outcome was measured with a different sensor version than the decision.');
    }

    if (!outcome.expectedDirectionObserved) {
      concerns.push('Observed short-term outcome failed the intervention prediction.');
    }

    if (outcome.recoveryCapacityDelta < -0.08) {
      concerns.push('Recovery capacity materially decreased after intervention.');
    }

    if (outcome.causalClaim !== 'observational_only') {
      concerns.push('Outcome overstates causality beyond the experimental evidence.');
    }

    return {
      auditId: createStableId('audit-outcome', {
        evaluationId: evaluation.evaluationId,
        outcomeId: outcome.outcomeId,
      }),
      worldId: evaluation.worldId,
      auditedAt: now,
      stage: 'outcome',
      evaluationId: evaluation.evaluationId,
      interventionId: outcome.interventionId,
      outcomeId: outcome.outcomeId,
      accepted: concerns.length === 0,
      concerns,
    };
  }
}
