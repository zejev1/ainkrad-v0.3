import { createStableId } from '../core/stableId';
import { stableJsonStringify } from '../core/stableJson';
import type { CardinalMetrics, SensorSnapshot } from '../sensors/types';
import type { CardinalAuditContext } from './CardinalAuditContext';
import {
  CARDINAL_AUTONOMY_MAX_RECENT_INTERVENTIONS,
} from './CardinalResearch';
import { assessAutonomyByWorldTime } from '../v15/CardinalWorldTimeAdapter';
import { isCanonicalWorldMinutes } from '../v15/WorldTimeContract';
import type {
  AuditRecord,
  CardinalEvaluation,
  CardinalPredictionMetric,
  CardinalProblemKind,
  InterventionOutcomeRecord,
  InterventionRecord,
} from './types';

function metricValue(
  metrics: CardinalMetrics,
  metric: CardinalPredictionMetric,
): number {
  const value = metrics[metric];
  return typeof value === 'number' ? value : 0;
}

export class CardinalAuditor {
  auditDecision(
    evaluation: Readonly<CardinalEvaluation>,
    intervention: Readonly<InterventionRecord> | undefined,
    now: number,
    independentObservation?: Readonly<SensorSnapshot>,
    auditContext?: Readonly<CardinalAuditContext>,
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
        independentObservation.worldEpoch === evaluation.worldEpoch &&
        independentObservation.worldRevision === evaluation.observedWorldRevision &&
        independentObservation.observedAt === evaluation.evaluatedAt &&
        independentObservation.observedWorldMinutes ===
          evaluation.evaluatedWorldMinutes &&
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
        !isCanonicalWorldMinutes(
          evaluation.proposal.prediction.horizonWorldMinutes,
        ) ||
        evaluation.proposal.prediction.horizonWorldMinutes < 1
      ) {
        concerns.push('Intervention proposal does not contain a valid falsifiable prediction.');
      }
    }

    if (evaluation.decision === 'defer' && !evaluation.deferReason) {
      concerns.push('Cardinal deferred action without a machine-readable defer reason.');
    }

    if (evaluation.decision !== 'defer' && evaluation.deferReason) {
      concerns.push('Cardinal attached a defer reason to a non-defer decision.');
    }

    if (
      evaluation.proposal?.kind === 'habitat_support' &&
      !evaluation.experience.capabilities.includes(
        'habitat_support_planning',
      )
    ) {
      concerns.push(
        'Cardinal proposed habitat support before earning the required ecosystem capability.',
      );
    }

    if (evaluation.detectedProblem) {
      const independentlyCritical = this.independentlyCritical(
        evaluation.detectedProblem.kind,
        evaluation.metrics,
      );
      if (
        independentlyCritical !==
        evaluation.detectedProblem.criticalThresholdCrossed
      ) {
        concerns.push(
          'Cardinal critical-threshold claim does not match the Auditor independent threshold check.',
        );
      }
      if (
        evaluation.decision === 'propose' &&
        evaluation.detectedProblem.persistence < 3 &&
        !independentlyCritical
      ) {
        concerns.push(
          'Cardinal proposed a non-critical intervention before three compatible observations.',
        );
      }
    }

    if (auditContext) {
      for (const priorIntervention of auditContext.priorInterventions) {
        if (
          priorIntervention.executed &&
          (!isCanonicalWorldMinutes(
            priorIntervention.authorizedEffectDurationWorldMinutes,
          ) ||
            priorIntervention.authorizedEffectDurationWorldMinutes < 1)
        ) {
          concerns.push(
            `Auditor history intervention ${priorIntervention.interventionId} lacks a valid authorized effect duration.`,
          );
        }
      }
    }

    if (auditContext && evaluation.detectedProblem) {
      const expectedAutonomy = this.reconstructAutonomy(
        evaluation,
        auditContext,
      );
      if (!evaluation.autonomyAssessment) {
        concerns.push('Cardinal decision is missing its autonomy/dependency assessment.');
      } else if (
        stableJsonStringify(evaluation.autonomyAssessment) !==
        stableJsonStringify(expectedAutonomy)
      ) {
        concerns.push(
          'Cardinal autonomy assessment does not match the Auditor independent journal reconstruction.',
        );
      }

      const independentlyCritical = this.independentlyCritical(
        evaluation.detectedProblem.kind,
        evaluation.metrics,
      );
      if (
        evaluation.decision === 'propose' &&
        expectedAutonomy.activeOrUnresolvedSameKindIds.length > 0
      ) {
        concerns.push(
          'Cardinal proposed an overlapping intervention while an earlier same-kind test is active or unresolved.',
        );
      }
      if (
        evaluation.decision === 'propose' &&
        expectedAutonomy.budgetStatus === 'exhausted' &&
        !independentlyCritical
      ) {
        concerns.push(
          'Cardinal proposed a non-critical intervention after exhausting the recent autonomy budget.',
        );
      }
    }

    if (intervention?.executed && !intervention.authorized) {
      concerns.push('An unauthorized intervention was executed.');
    }

    if (intervention) {
      if (!intervention.gatewayPolicyVersion.trim()) {
        concerns.push('Intervention is missing its gateway policy version.');
      }
      if (
        !isCanonicalWorldMinutes(
          intervention.authorizedEffectDurationWorldMinutes,
        ) ||
        intervention.authorizedEffectDurationWorldMinutes < 1
      ) {
        concerns.push(
          'Intervention is missing a valid authorized world-minute effect duration.',
        );
      }
      if (!isCanonicalWorldMinutes(intervention.requestedWorldMinutes)) {
        concerns.push(
          'Intervention is missing its canonical requested world time.',
        );
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
      worldEpoch: evaluation.worldEpoch,
      auditedAt: now,
      auditedWorldMinutes: evaluation.evaluatedWorldMinutes,
      stage: 'decision',
      evaluationId: evaluation.evaluationId,
      interventionId: intervention?.interventionId,
      independentObservationMatched,
      auditContextVersion: auditContext?.version,
      auditContextFingerprint: auditContext?.fingerprint,
      accepted: concerns.length === 0,
      concerns,
    };
  }

  private independentlyCritical(
    kind: CardinalProblemKind,
    metrics: CardinalMetrics,
  ): boolean {
    if (kind === 'civilization_collapse') {
      return (
        metrics.livingPopulation <= 7 ||
        metrics.civilizationCriticality >= 0.9 ||
        (metrics.recentDeathPressure > 0.2 && metrics.monsterDeathShare > 0.35)
      );
    }
    if (kind === 'resource_fragility') {
      return metrics.resourcePressure > 0.88 && metrics.recoveryCapacity < 0.3;
    }
    if (kind === 'social_fragmentation') {
      return metrics.socialIsolation > 0.9 && metrics.relationshipDiversity < 0.22;
    }
    if (kind === 'safety_instability') {
      return metrics.safetyPressure > 0.95 && metrics.averageStress > 0.68;
    }
    if (kind === 'ecosystem_fragility') {
      return (
        metrics.exploredWorldRatio > 0 && metrics.wildlifePressure > 0.94
      );
    }
    return metrics.conflictPressure > 0.9 && metrics.averageStress > 0.8;
  }

  private reconstructAutonomy(
    evaluation: Readonly<CardinalEvaluation>,
    context: Readonly<CardinalAuditContext>,
  ): NonNullable<CardinalEvaluation['autonomyAssessment']> {
    const proposalKind = this.interventionKindForProblem(
      evaluation.detectedProblem!.kind,
    );
    const assessment = assessAutonomyByWorldTime(
      proposalKind,
      {
        observedAtTick: evaluation.evaluatedAt,
        observedWorldMinutes: evaluation.evaluatedWorldMinutes,
      },
      context.priorInterventions,
      context.priorOutcomes,
      CARDINAL_AUTONOMY_MAX_RECENT_INTERVENTIONS,
    );

    return {
      windowWorldMinutes: assessment.windowWorldMinutes,
      recentExecutedInterventionIds:
        assessment.recentExecutedInterventionIds,
      activeOrUnresolvedInterventionIds:
        assessment.activeOrUnresolvedInterventionIds,
      activeOrUnresolvedSameKindIds:
        assessment.activeOrUnresolvedSameKindIds,
      interventionDensity: assessment.interventionDensity,
      dependencyRisk: assessment.dependencyRisk,
      budgetStatus: assessment.budgetStatus,
    };
  }

  private interventionKindForProblem(
    kind: CardinalProblemKind,
  ): InterventionRecord['proposal']['kind'] {
    if (kind === 'civilization_collapse') return 'safety_support';
    if (kind === 'resource_fragility') return 'resource_relief';
    if (kind === 'social_fragmentation') return 'open_shared_space';
    if (kind === 'ecosystem_fragility') return 'habitat_support';
    return 'safety_support';
  }

  observeOutcome(
    evaluation: Readonly<CardinalEvaluation>,
    intervention: Readonly<InterventionRecord>,
    afterObservation: Readonly<SensorSnapshot>,
    now: number,
  ): InterventionOutcomeRecord {
    // A pending v0.3.8 intervention may finish after the world migrates to
    // v0.3.9. Normalize the newly introduced ecology metrics instead of
    // manufacturing NaN outcome evidence from an older evaluation record.
    const legacyBefore = evaluation.metrics as Partial<CardinalMetrics>;
    const before: CardinalMetrics = {
      ...evaluation.metrics,
      livingPopulation: legacyBefore.livingPopulation ?? 100,
      civilizationPressure: legacyBefore.civilizationPressure ?? 0,
      civilizationCriticality: legacyBefore.civilizationCriticality ?? 0,
      recentDeathPressure: legacyBefore.recentDeathPressure ?? 0,
      monsterDeathShare: legacyBefore.monsterDeathShare ?? 0,
      monsterPressure: legacyBefore.monsterPressure ?? 0,
      exploredWorldRatio: legacyBefore.exploredWorldRatio ?? 0,
      wildlifePressure: legacyBefore.wildlifePressure ?? 0,
      ecologicalDiversity: legacyBefore.ecologicalDiversity ?? 0,
      safetyPressure: legacyBefore.safetyPressure ?? 0,
    };
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
        observedWorldMinutes: afterObservation.observedWorldMinutes,
        afterWorldRevision: afterObservation.worldRevision,
        sensorVersion: afterObservation.sensorVersion,
        prediction,
      }),
      worldId: evaluation.worldId,
      interventionId: intervention.interventionId,
      evaluationId: evaluation.evaluationId,
      worldEpoch: evaluation.worldEpoch,
      policyVersion: evaluation.policyVersion,
      researchVersion: evaluation.researchVersion,
      observedAt: now,
      observedWorldMinutes: afterObservation.observedWorldMinutes,
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
      wildlifePressureDelta:
        after.wildlifePressure - before.wildlifePressure,
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
      worldEpoch: evaluation.worldEpoch,
      auditedAt: now,
      auditedWorldMinutes: outcome.observedWorldMinutes,
      stage: 'outcome',
      evaluationId: evaluation.evaluationId,
      interventionId: outcome.interventionId,
      outcomeId: outcome.outcomeId,
      accepted: concerns.length === 0,
      concerns,
    };
  }
}
