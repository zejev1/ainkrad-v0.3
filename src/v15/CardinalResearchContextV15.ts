import {
  buildResearchDecisionContext,
  type ResearchObservationModifiers,
} from './CardinalResearchEvidence';
import type { InterventionKind } from '../cardinal/types';

export const V15_CARDINAL_RESEARCH_VERSION =
  'ainkrad-cardinal-research-v15-recovery';

export interface CardinalAllTimeExperienceLike {
  observationCycles: number;
  totalExperience?: number;
  level?: number;
  capabilities?: readonly string[];
  [key: string]: unknown;
}

export interface V15EvaluationHistoryItem {
  evaluationId: string;
  worldId: string;
  worldEpoch: string;
  policyVersion: string;
  sensorVersion: string;
  evaluatedAtTick: number;
  evaluatedWorldMinutes?: number;
}

export interface V15InterventionHistoryItem {
  interventionId: string;
  worldId: string;
  worldEpoch: string;
  executed: boolean;
  requestedAtTick: number;
  requestedWorldMinutes?: number;
  authorizedEffectDurationWorldMinutes?: number;
  proposal: {
    kind: InterventionKind;
    prediction: {
      horizonWorldMinutes?: number;
    };
  };
}

export interface V15OutcomeHistoryItem {
  outcomeId: string;
  interventionId: string;
  worldId: string;
  worldEpoch: string;
  observedAtTick: number;
  observedWorldMinutes?: number;
  expectedDirectionObserved: boolean;
}

export interface V15ResearchHistoryInput {
  allTimeExperience: CardinalAllTimeExperienceLike;
  evaluations: readonly V15EvaluationHistoryItem[];
  interventions: readonly V15InterventionHistoryItem[];
  outcomes: readonly V15OutcomeHistoryItem[];
}

export interface V15ResearchContext {
  researchVersion: typeof V15_CARDINAL_RESEARCH_VERSION;
  worldId: string;
  worldEpoch: string;
  policyVersion: string;
  sensorVersion: string;
  currentWorldMinutes: number;
  experience: CardinalAllTimeExperienceLike;
  priorEvaluations: V15EvaluationHistoryItem[];
  priorInterventions: Array<
    V15InterventionHistoryItem & {
      requestedWorldMinutes: number;
      authorizedEffectDurationWorldMinutes: number;
      proposal: V15InterventionHistoryItem['proposal'] & {
        prediction: {
          horizonWorldMinutes: number;
        };
      };
    }
  >;
  priorOutcomes: Array<
    V15OutcomeHistoryItem & {
      observedWorldMinutes: number;
    }
  >;
  excluded: {
    incompatibleEvaluations: string[];
    wrongEpochEvaluations: string[];
    legacyTimedInterventions: string[];
    wrongEpochInterventions: string[];
    legacyTimedOutcomes: string[];
    wrongEpochOutcomes: string[];
  };
  evidenceQuality: ReturnType<typeof buildResearchDecisionContext>;
  mayCreateAuthority: false;
  mayBypassGateway: false;
  mayWriteResidentPersonhood: false;
}

function assertText(value: string, label: string): void {
  if (!value.trim()) throw new Error(`${label} must not be empty.`);
}

function isCanonicalWorldMinute(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * v15 replacement contract for the old CardinalResearch history selection.
 *
 * Proven old behavior retained:
 * - all-time Cardinal experience survives policy/sensor advancement;
 * - prior evaluations for current reasoning require current policy+sensor.
 *
 * v15 additions:
 * - current decision history is current-epoch only;
 * - all duration-bearing intervention/outcome history must have canonical
 *   Ainkrad world-minute timestamps;
 * - Signal Noise + Community Guidance affect confidence only.
 */
export function buildV15CardinalResearchContext(
  history: V15ResearchHistoryInput,
  params: {
    worldId: string;
    worldEpoch: string;
    policyVersion: string;
    sensorVersion: string;
    currentWorldMinutes: number;
    observationModifiers?: ResearchObservationModifiers;
    baseConfidence?: number;
  },
): V15ResearchContext {
  assertText(params.worldId, 'worldId');
  assertText(params.worldEpoch, 'worldEpoch');
  assertText(params.policyVersion, 'policyVersion');
  assertText(params.sensorVersion, 'sensorVersion');
  if (!isCanonicalWorldMinute(params.currentWorldMinutes)) {
    throw new Error('currentWorldMinutes must be finite and non-negative.');
  }
  if (
    !Number.isInteger(history.allTimeExperience.observationCycles) ||
    history.allTimeExperience.observationCycles < 0
  ) {
    throw new Error('allTimeExperience.observationCycles must be a non-negative integer.');
  }

  const excluded = {
    incompatibleEvaluations: [] as string[],
    wrongEpochEvaluations: [] as string[],
    legacyTimedInterventions: [] as string[],
    wrongEpochInterventions: [] as string[],
    legacyTimedOutcomes: [] as string[],
    wrongEpochOutcomes: [] as string[],
  };

  const priorEvaluations = history.evaluations
    .filter((item) => {
      if (item.worldId !== params.worldId || item.worldEpoch !== params.worldEpoch) {
        excluded.wrongEpochEvaluations.push(item.evaluationId);
        return false;
      }
      if (
        item.policyVersion !== params.policyVersion ||
        item.sensorVersion !== params.sensorVersion
      ) {
        excluded.incompatibleEvaluations.push(item.evaluationId);
        return false;
      }
      if (
        item.evaluatedWorldMinutes !== undefined &&
        (
          !isCanonicalWorldMinute(item.evaluatedWorldMinutes) ||
          item.evaluatedWorldMinutes > params.currentWorldMinutes
        )
      ) {
        return false;
      }
      return true;
    })
    .sort(
      (a, b) =>
        (a.evaluatedWorldMinutes ?? Number.NEGATIVE_INFINITY) -
          (b.evaluatedWorldMinutes ?? Number.NEGATIVE_INFINITY) ||
        a.evaluatedAtTick - b.evaluatedAtTick ||
        a.evaluationId.localeCompare(b.evaluationId),
    );

  const priorInterventions = history.interventions
    .filter((item) => {
      if (item.worldId !== params.worldId || item.worldEpoch !== params.worldEpoch) {
        excluded.wrongEpochInterventions.push(item.interventionId);
        return false;
      }
      const horizon = item.proposal.prediction.horizonWorldMinutes;
      if (
        !isCanonicalWorldMinute(item.requestedWorldMinutes) ||
        !isCanonicalWorldMinute(item.authorizedEffectDurationWorldMinutes) ||
        !isCanonicalWorldMinute(horizon)
      ) {
        excluded.legacyTimedInterventions.push(item.interventionId);
        return false;
      }
      if (item.requestedWorldMinutes > params.currentWorldMinutes) return false;
      return true;
    })
    .map((item) => ({
      ...item,
      requestedWorldMinutes: item.requestedWorldMinutes as number,
      authorizedEffectDurationWorldMinutes:
        item.authorizedEffectDurationWorldMinutes as number,
      proposal: {
        ...item.proposal,
        prediction: {
          horizonWorldMinutes:
            item.proposal.prediction.horizonWorldMinutes as number,
        },
      },
    }))
    .sort(
      (a, b) =>
        a.requestedWorldMinutes - b.requestedWorldMinutes ||
        a.requestedAtTick - b.requestedAtTick ||
        a.interventionId.localeCompare(b.interventionId),
    );

  const acceptedInterventionIds = new Set(
    priorInterventions.map((item) => item.interventionId),
  );

  const priorOutcomes = history.outcomes
    .filter((item) => {
      if (item.worldId !== params.worldId || item.worldEpoch !== params.worldEpoch) {
        excluded.wrongEpochOutcomes.push(item.outcomeId);
        return false;
      }
      if (!isCanonicalWorldMinute(item.observedWorldMinutes)) {
        excluded.legacyTimedOutcomes.push(item.outcomeId);
        return false;
      }
      if (item.observedWorldMinutes > params.currentWorldMinutes) return false;
      if (!acceptedInterventionIds.has(item.interventionId)) return false;
      return true;
    })
    .map((item) => ({
      ...item,
      observedWorldMinutes: item.observedWorldMinutes as number,
    }))
    .sort(
      (a, b) =>
        a.observedWorldMinutes - b.observedWorldMinutes ||
        a.observedAtTick - b.observedAtTick ||
        a.outcomeId.localeCompare(b.outcomeId),
    );

  const modifiers = params.observationModifiers ?? {
    signalNoise: 0,
    communityGuidance: 0,
  };

  return {
    researchVersion: V15_CARDINAL_RESEARCH_VERSION,
    worldId: params.worldId,
    worldEpoch: params.worldEpoch,
    policyVersion: params.policyVersion,
    sensorVersion: params.sensorVersion,
    currentWorldMinutes: params.currentWorldMinutes,
    experience: structuredClone(history.allTimeExperience),
    priorEvaluations,
    priorInterventions,
    priorOutcomes,
    excluded,
    evidenceQuality: buildResearchDecisionContext(
      params.baseConfidence ?? 0.5,
      modifiers,
    ),
    mayCreateAuthority: false,
    mayBypassGateway: false,
    mayWriteResidentPersonhood: false,
  };
}
