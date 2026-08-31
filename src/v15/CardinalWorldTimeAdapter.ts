import {
  CARDINAL_AUTONOMY_WINDOW_WORLD_MINUTES,
  LEGACY_CARDINAL_PREDICTION_WINDOW_WORLD_MINUTES,
} from './WorldTimeContract';

export interface WorldTimedPrediction {
  horizonWorldMinutes: number;
}

export interface WorldTimedProposal {
  kind: string;
  prediction: WorldTimedPrediction;
}

export interface WorldTimedIntervention {
  interventionId: string;
  executed: boolean;
  requestedAtTick?: number;
  requestedWorldMinutes: number;
  authorizedEffectDurationWorldMinutes: number;
  proposal: WorldTimedProposal;
}

export interface WorldTimedOutcome {
  interventionId: string;
  expectedDirectionObserved?: boolean;
}

export interface WorldTimedObservation {
  observedAtTick?: number;
  observedWorldMinutes: number;
}

export interface WorldTimeAutonomyAssessment {
  windowWorldMinutes: number;
  recentExecutedInterventionIds: string[];
  activeOrUnresolvedInterventionIds: string[];
  activeOrUnresolvedSameKindIds: string[];
  interventionDensity: number;
  dependencyRisk: number;
  budgetStatus: 'open' | 'caution' | 'exhausted';
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const CARDINAL_AUTONOMY_MAX_RECENT_INTERVENTIONS_V15 = 3;

export function defaultPredictionWorldMinutes(): number {
  return LEGACY_CARDINAL_PREDICTION_WINDOW_WORLD_MINUTES;
}

function assertWorldMinutes(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be finite and non-negative.`);
  }
}

/**
 * Canonical v15 replacement for the old tick-based CardinalCore.assessAutonomy.
 *
 * Technical ticks are retained on records for deterministic tracing, but are
 * intentionally excluded from all duration/window math.
 */
export function assessAutonomyByWorldTime(
  interventionKind: string,
  observation: WorldTimedObservation,
  priorInterventions: readonly WorldTimedIntervention[],
  priorOutcomes: readonly WorldTimedOutcome[],
  maxRecentInterventions: number = CARDINAL_AUTONOMY_MAX_RECENT_INTERVENTIONS_V15,
  autonomyWindowWorldMinutes: number = CARDINAL_AUTONOMY_WINDOW_WORLD_MINUTES,
): WorldTimeAutonomyAssessment {
  assertWorldMinutes(observation.observedWorldMinutes, 'observedWorldMinutes');
  assertWorldMinutes(autonomyWindowWorldMinutes, 'autonomyWindowWorldMinutes');

  if (!Number.isInteger(maxRecentInterventions) || maxRecentInterventions < 1) {
    throw new Error('maxRecentInterventions must be an integer >= 1.');
  }

  const resolved = new Set(
    priorOutcomes.map((outcome) => outcome.interventionId),
  );

  const executed = priorInterventions.filter((intervention) => {
    if (!intervention.executed) return false;
    assertWorldMinutes(
      intervention.requestedWorldMinutes,
      `intervention ${intervention.interventionId} requestedWorldMinutes`,
    );
    return intervention.requestedWorldMinutes < observation.observedWorldMinutes;
  });

  const recent = executed.filter(
    (intervention) =>
      observation.observedWorldMinutes - intervention.requestedWorldMinutes <=
      autonomyWindowWorldMinutes,
  );

  const activeOrUnresolved = executed.filter((intervention) => {
    assertWorldMinutes(
      intervention.authorizedEffectDurationWorldMinutes,
      `intervention ${intervention.interventionId} authorizedEffectDurationWorldMinutes`,
    );
    assertWorldMinutes(
      intervention.proposal.prediction.horizonWorldMinutes,
      `intervention ${intervention.interventionId} horizonWorldMinutes`,
    );

    const effectOrPredictionWindowWorldMinutes = Math.max(
      intervention.authorizedEffectDurationWorldMinutes,
      intervention.proposal.prediction.horizonWorldMinutes,
    );

    const stillInsideWashout =
      intervention.requestedWorldMinutes +
        effectOrPredictionWindowWorldMinutes >
      observation.observedWorldMinutes;

    return !resolved.has(intervention.interventionId) || stillInsideWashout;
  });

  const sameKind = activeOrUnresolved.filter(
    (intervention) => intervention.proposal.kind === interventionKind,
  );

  const interventionDensity = clamp01(
    recent.length / maxRecentInterventions,
  );

  const budgetStatus: WorldTimeAutonomyAssessment['budgetStatus'] =
    recent.length >= maxRecentInterventions
      ? 'exhausted'
      : recent.length === maxRecentInterventions - 1
        ? 'caution'
        : 'open';

  return {
    windowWorldMinutes: autonomyWindowWorldMinutes,
    recentExecutedInterventionIds: recent.map(
      (intervention) => intervention.interventionId,
    ),
    activeOrUnresolvedInterventionIds: activeOrUnresolved.map(
      (intervention) => intervention.interventionId,
    ),
    activeOrUnresolvedSameKindIds: sameKind.map(
      (intervention) => intervention.interventionId,
    ),
    interventionDensity,
    dependencyRisk: interventionDensity,
    budgetStatus,
  };
}

export function worldTimePredictionStatement(
  metric: string,
  minimumImprovement: number,
  horizonWorldMinutes: number = defaultPredictionWorldMinutes(),
): string {
  assertWorldMinutes(horizonWorldMinutes, 'horizonWorldMinutes');
  const days = horizonWorldMinutes / (24 * 60);
  const roundedDays = Math.round(days * 10) / 10;
  return `${metric} should improve by at least ${minimumImprovement} within ${roundedDays} Ainkrad days.`;
}
