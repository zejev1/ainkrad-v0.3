import { createEventId } from '../runtime/inputBus/createEventId';
import type { CardinalMetrics } from '../sensors/types';
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
  ): AuditRecord {
    const concerns: string[] = [];

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
      auditId: createEventId('audit'),
      worldId: evaluation.worldId,
      auditedAt: now,
      stage: 'decision',
      evaluationId: evaluation.evaluationId,
      interventionId: intervention?.interventionId,
      accepted: concerns.length === 0,
      concerns,
    };
  }

  observeOutcome(
    evaluation: Readonly<CardinalEvaluation>,
    intervention: Readonly<InterventionRecord>,
    afterMetrics: Readonly<CardinalMetrics>,
    now: number,
  ): InterventionOutcomeRecord {
    const before = evaluation.metrics;
    const after = structuredClone(afterMetrics);

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
      outcomeId: createEventId('outcome'),
      worldId: evaluation.worldId,
      interventionId: intervention.interventionId,
      evaluationId: evaluation.evaluationId,
      observedAt: now,
      beforeMetrics: structuredClone(before),
      afterMetrics: after,
      recoveryCapacityDelta: after.recoveryCapacity - before.recoveryCapacity,
      averageStressDelta: after.averageStress - before.averageStress,
      socialIsolationDelta: after.socialIsolation - before.socialIsolation,
      conflictPressureDelta: after.conflictPressure - before.conflictPressure,
      resourcePressureDelta: after.resourcePressure - before.resourcePressure,
      expectedDirectionObserved,
    };
  }

  auditOutcome(
    evaluation: Readonly<CardinalEvaluation>,
    outcome: Readonly<InterventionOutcomeRecord>,
    now: number,
  ): AuditRecord {
    const concerns: string[] = [];

    if (!outcome.expectedDirectionObserved) {
      concerns.push('Observed short-term outcome moved against the intervention expectation.');
    }

    if (outcome.recoveryCapacityDelta < -0.08) {
      concerns.push('Recovery capacity materially decreased after intervention.');
    }

    return {
      auditId: createEventId('audit'),
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
