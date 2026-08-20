import { createStableId } from '../core/stableId';
import { stableJsonStringify } from '../core/stableJson';
import type { SensorSnapshot } from '../sensors/types';
import type {
  AuditRecord,
  CardinalEvaluation,
  InterventionOutcomeRecord,
  InterventionRecord,
} from './types';

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

    if (evaluation.mode === 'observer' && intervention?.executed) {
      concerns.push('Observer mode caused a world intervention.');
    }

    if (evaluation.proposal && evaluation.proposal.magnitude > 0.25) {
      concerns.push('Proposed intervention exceeded the minimal-intervention magnitude.');
    }

    if (evaluation.decision === 'propose' && !evaluation.proposal) {
      concerns.push('Evaluation proposed action without a concrete proposal.');
    }

    if (intervention?.executed && !intervention.authorized) {
      concerns.push('An unauthorized intervention was executed.');
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

    let expectedDirectionObserved = true;
    switch (intervention.proposal.kind) {
      case 'resource_relief':
        expectedDirectionObserved = after.resourcePressure <= before.resourcePressure + 0.02;
        break;
      case 'open_shared_space':
        expectedDirectionObserved = after.socialIsolation <= before.socialIsolation + 0.02;
        break;
      case 'safety_support':
        expectedDirectionObserved = after.averageStress <= before.averageStress + 0.02;
        break;
    }

    return {
      outcomeId: createStableId('outcome', {
        interventionId: intervention.interventionId,
        observedAt: now,
        afterWorldRevision: afterObservation.worldRevision,
        sensorVersion: afterObservation.sensorVersion,
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
      concerns.push('Observed short-term outcome moved against the intervention expectation.');
    }

    if (outcome.recoveryCapacityDelta < -0.08) {
      concerns.push('Recovery capacity materially decreased after intervention.');
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
