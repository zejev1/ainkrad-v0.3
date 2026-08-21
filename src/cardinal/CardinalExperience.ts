import type { CardinalMetrics } from '../sensors/types';
import type {
  CardinalCapability,
  CardinalEvaluation,
  CardinalExperienceState,
  InterventionOutcomeRecord,
} from './types';

interface ExperienceCounters {
  observationCycles: number;
  ecologyObservationCycles: number;
  evaluatedOutcomes: number;
  successfulPredictions: number;
}

function hasEcologyEvidence(metrics: Partial<CardinalMetrics>): boolean {
  return (
    typeof metrics.exploredWorldRatio === 'number' &&
    metrics.exploredWorldRatio > 0
  );
}

function capabilitiesFor(
  counters: ExperienceCounters,
  level: number,
): CardinalCapability[] {
  const capabilities: CardinalCapability[] = [
    'world_observation',
    'autonomy_guard',
  ];

  if (counters.observationCycles >= 8) {
    capabilities.push('trend_reasoning');
  }
  if (counters.ecologyObservationCycles >= 3) {
    capabilities.push('ecosystem_observation');
  }
  if (counters.evaluatedOutcomes >= 2) {
    capabilities.push('outcome_learning');
  }
  if (level >= 2 && counters.ecologyObservationCycles >= 8) {
    capabilities.push('habitat_support_planning');
  }

  return capabilities;
}

function makeExperience(
  counters: ExperienceCounters,
  previousCapabilities: readonly CardinalCapability[] = [],
): CardinalExperienceState {
  const totalExperience =
    counters.observationCycles +
    counters.ecologyObservationCycles * 2 +
    counters.evaluatedOutcomes * 3 +
    counters.successfulPredictions * 2;
  const level = totalExperience >= 55 ? 3 : totalExperience >= 20 ? 2 : 1;
  const capabilities = capabilitiesFor(counters, level);
  const previous = new Set(previousCapabilities);

  return {
    level,
    totalExperience,
    observationCycles: counters.observationCycles,
    ecologyObservationCycles: counters.ecologyObservationCycles,
    evaluatedOutcomes: counters.evaluatedOutcomes,
    successfulPredictions: counters.successfulPredictions,
    capabilities,
    newlyUnlockedCapabilities: capabilities.filter(
      (capability) => !previous.has(capability),
    ),
  };
}

export function deriveCardinalExperience(
  evaluations: readonly CardinalEvaluation[],
  outcomes: readonly InterventionOutcomeRecord[],
): CardinalExperienceState {
  const counters: ExperienceCounters = {
    observationCycles: evaluations.length,
    ecologyObservationCycles: evaluations.filter((evaluation) =>
      hasEcologyEvidence(evaluation.metrics),
    ).length,
    evaluatedOutcomes: outcomes.length,
    successfulPredictions: outcomes.filter(
      (outcome) => outcome.expectedDirectionObserved,
    ).length,
  };

  return makeExperience(counters);
}

export function advanceCardinalExperience(
  previous: Readonly<CardinalExperienceState>,
  currentMetrics: Readonly<CardinalMetrics>,
): CardinalExperienceState {
  return makeExperience(
    {
      observationCycles: previous.observationCycles + 1,
      ecologyObservationCycles:
        previous.ecologyObservationCycles +
        (hasEcologyEvidence(currentMetrics) ? 1 : 0),
      evaluatedOutcomes: previous.evaluatedOutcomes,
      successfulPredictions: previous.successfulPredictions,
    },
    previous.capabilities,
  );
}

