import { createStableId } from '../core/stableId';
import type { CardinalJournal } from './CardinalJournal';
import {
  deriveCardinalExperience,
  deriveCardinalExperienceFromCounters,
} from './CardinalExperience';
import type {
  CardinalEvaluation,
  CardinalExperienceState,
  InterventionOutcomeRecord,
  InterventionRecord,
} from './types';
import {
  CARDINAL_AUTONOMY_WINDOW_WORLD_MINUTES,
  CARDINAL_RESEARCH_LOOKBACK_WORLD_MINUTES,
  isCanonicalWorldMinutes,
} from '../v15/WorldTimeContract';

export const CARDINAL_RESEARCH_VERSION = 'ainkrad-cardinal-research-0.3.15';
export const CARDINAL_RESEARCH_MAX_RECORDS = 64;
export const CARDINAL_AUTONOMY_MAX_RECENT_INTERVENTIONS = 3;

export interface CardinalResearchContext {
  researchVersion: string;
  priorEvaluations: CardinalEvaluation[];
  priorInterventions: InterventionRecord[];
  priorOutcomes: InterventionOutcomeRecord[];
  experience: CardinalExperienceState;
  fingerprint: string;
}

export async function buildCardinalResearchContext(
  journal: CardinalJournal,
  worldId: string,
  currentObservedAt: number,
  currentWorldMinutes: number,
  worldEpoch: number,
  policyVersion: string,
  sensorVersion: string,
): Promise<CardinalResearchContext> {
  if (!isCanonicalWorldMinutes(currentWorldMinutes)) {
    throw new Error(
      'Cardinal research currentWorldMinutes must be finite and non-negative.',
    );
  }

  if (!Number.isInteger(worldEpoch) || worldEpoch < 1) {
    throw new Error(
      'Cardinal research worldEpoch must be an integer >= 1.',
    );
  }

  const [
    evaluations,
    interventions,
    outcomes,
    lifetimeSummary,
  ] = await Promise.all([
    journal.recentEvaluations(
      worldId,
      512,
      currentObservedAt,
    ),

    journal.recentInterventions(
      worldId,
      512,
      currentObservedAt,
    ),

    journal.recentOutcomes(
      worldId,
      512,
      currentObservedAt,
    ),

    /**
     * ВАЖНО:
     * опыт Cardinal — пожизненный для данного worldId.
     *
     * Нельзя ограничивать его currentObservedAt,
     * потому что после "Новый мир" технический tick
     * снова начинается с малого значения.
     *
     * Старые записи тогда выглядят как "будущее"
     * и опыт искусственно обнуляется.
     */
    journal.summary(
      worldId,
    ),
  ]);

  /**
   * Глобальный накопленный опыт Cardinal.
   *
   * Он переживает новые эпохи мира.
   */
  const experience =
    deriveCardinalExperienceFromCounters({
      observationCycles:
        lifetimeSummary.evaluationCount,

      ecologyObservationCycles:
        lifetimeSummary.ecologyEvaluationCount,

      evaluatedOutcomes:
        lifetimeSummary.outcomeCount,

      successfulPredictions:
        lifetimeSummary.successfulPredictionCount,
    });

  /**
   * А вот оперативная память решений остаётся
   * строго привязана к текущей эпохе.
   */
  const priorEvaluations =
    evaluations
      .filter(
        (evaluation) =>
          evaluation.evaluatedAt <
            currentObservedAt &&
          evaluation.worldEpoch ===
            worldEpoch &&
          evaluation.policyVersion ===
            policyVersion &&
          evaluation.sensorVersion ===
            sensorVersion &&
          evaluation.researchVersion ===
            CARDINAL_RESEARCH_VERSION &&
          isCanonicalWorldMinutes(
            evaluation.evaluatedWorldMinutes,
          ) &&
          evaluation.evaluatedWorldMinutes <
            currentWorldMinutes &&
          currentWorldMinutes -
            evaluation.evaluatedWorldMinutes <=
            CARDINAL_RESEARCH_LOOKBACK_WORLD_MINUTES,
      )
      .sort(
        (a, b) =>
          a.evaluatedWorldMinutes -
            b.evaluatedWorldMinutes ||
          a.evaluatedAt -
            b.evaluatedAt ||
          a.evaluationId.localeCompare(
            b.evaluationId,
          ),
      )
      .slice(
        -CARDINAL_RESEARCH_MAX_RECORDS,
      );

  const eligibleInterventions =
    interventions.filter(
      (intervention) =>
        intervention.requestedAt <
          currentObservedAt &&
        intervention.worldEpoch ===
          worldEpoch &&
        intervention.policyVersion ===
          policyVersion &&
        intervention.sensorVersion ===
          sensorVersion &&
        intervention.researchVersion ===
          CARDINAL_RESEARCH_VERSION &&
        isCanonicalWorldMinutes(
          intervention.requestedWorldMinutes,
        ) &&
        isCanonicalWorldMinutes(
          intervention
            .authorizedEffectDurationWorldMinutes,
        ) &&
        isCanonicalWorldMinutes(
          intervention
            .proposal
            ?.prediction
            ?.horizonWorldMinutes,
        ) &&
        intervention.requestedWorldMinutes <
          currentWorldMinutes,
    );

  const allPriorOutcomeIds =
    new Set(
      outcomes
        .filter(
          (outcome) =>
            outcome.observedAt <
              currentObservedAt &&
            outcome.worldEpoch ===
              worldEpoch &&
            outcome.policyVersion ===
              policyVersion &&
            outcome.sensorVersion ===
              sensorVersion &&
            outcome.researchVersion ===
              CARDINAL_RESEARCH_VERSION &&
            isCanonicalWorldMinutes(
              outcome.observedWorldMinutes,
            ) &&
            outcome.observedWorldMinutes <
              currentWorldMinutes,
        )
        .map(
          (outcome) =>
            outcome.interventionId,
        ),
    );

  const unresolvedExecuted =
    eligibleInterventions.filter(
      (intervention) =>
        intervention.executed &&
        !allPriorOutcomeIds.has(
          intervention.interventionId,
        ),
    );

  const recentTimedInterventions =
    eligibleInterventions.filter(
      (intervention) =>
        currentWorldMinutes -
          intervention.requestedWorldMinutes <=
        CARDINAL_AUTONOMY_WINDOW_WORLD_MINUTES,
    );

  const tailInterventions =
    eligibleInterventions
      .sort(
        (a, b) =>
          a.requestedWorldMinutes -
            b.requestedWorldMinutes ||
          a.requestedAt -
            b.requestedAt ||
          a.interventionId.localeCompare(
            b.interventionId,
          ),
      )
      .slice(
        -CARDINAL_RESEARCH_MAX_RECORDS,
      );

  const requiredInterventionIds =
    new Set(
      [
        ...unresolvedExecuted,
        ...recentTimedInterventions,
        ...tailInterventions,
      ].map(
        (intervention) =>
          intervention.interventionId,
      ),
    );

  const priorInterventions =
    eligibleInterventions.filter(
      (intervention) =>
        requiredInterventionIds.has(
          intervention.interventionId,
        ),
    );

  const priorOutcomes =
    outcomes
      .filter(
        (outcome) =>
          outcome.observedAt <
            currentObservedAt &&
          outcome.worldEpoch ===
            worldEpoch &&
          outcome.policyVersion ===
            policyVersion &&
          outcome.sensorVersion ===
            sensorVersion &&
          outcome.researchVersion ===
            CARDINAL_RESEARCH_VERSION &&
          isCanonicalWorldMinutes(
            outcome.observedWorldMinutes,
          ) &&
          outcome.observedWorldMinutes <
            currentWorldMinutes &&
          requiredInterventionIds.has(
            outcome.interventionId,
          ),
      )
      .sort(
        (a, b) =>
          a.observedWorldMinutes -
            b.observedWorldMinutes ||
          a.observedAt -
            b.observedAt ||
          a.outcomeId.localeCompare(
            b.outcomeId,
          ),
      )
      .slice(
        -CARDINAL_RESEARCH_MAX_RECORDS,
      );

  const fingerprint =
    createStableId(
      'research-context',
      {
        researchVersion:
          CARDINAL_RESEARCH_VERSION,

        policyVersion,

        sensorVersion,

        worldEpoch,

        currentObservedAt,

        currentWorldMinutes,

        evaluations:
          priorEvaluations,

        interventions:
          priorInterventions,

        outcomes:
          priorOutcomes,

        experience,
      },
    );

  return {
    researchVersion:
      CARDINAL_RESEARCH_VERSION,

    priorEvaluations:
      structuredClone(
        priorEvaluations,
      ),

    priorInterventions:
      structuredClone(
        priorInterventions,
      ),

    priorOutcomes:
      structuredClone(
        priorOutcomes,
      ),

    experience:
      structuredClone(
        experience,
      ),

    fingerprint,
  };
}

export function emptyCardinalResearchContext():
  CardinalResearchContext {
  const experience =
    deriveCardinalExperience(
      [],
      [],
    );

  return {
    researchVersion:
      CARDINAL_RESEARCH_VERSION,

    priorEvaluations: [],
    priorInterventions: [],
    priorOutcomes: [],

    experience,

    fingerprint:
      createStableId(
        'research-context',
        {
          researchVersion:
            CARDINAL_RESEARCH_VERSION,

          empty:
            true,

          experience,
        },
      ),
  };
}
