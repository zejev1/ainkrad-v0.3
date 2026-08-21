import { createStableId } from '../core/stableId';
import type { CardinalJournal } from './CardinalJournal';
import { deriveCardinalExperience } from './CardinalExperience';
import type {
  CardinalEvaluation,
  CardinalExperienceState,
  InterventionOutcomeRecord,
  InterventionRecord,
} from './types';

export const CARDINAL_RESEARCH_VERSION = 'ainkrad-cardinal-research-0.3.10';
export const CARDINAL_RESEARCH_WINDOW = 12;
export const CARDINAL_AUTONOMY_WINDOW = 16;
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
  policyVersion: string,
  sensorVersion: string,
): Promise<CardinalResearchContext> {
  const [evaluations, interventions, outcomes] = await Promise.all([
    journal.evaluations(worldId),
    journal.interventions(worldId),
    journal.outcomes(worldId),
  ]);
  const experience = deriveCardinalExperience(
    evaluations.filter(
      (evaluation) => evaluation.evaluatedAt < currentObservedAt,
    ),
    outcomes.filter((outcome) => outcome.observedAt < currentObservedAt),
  );

  // Strictly earlier logical time is intentional. If the same Cardinal cycle is
  // retried after its evaluation was already journaled, the retry must rebuild
  // exactly the same research context rather than treating itself as new history.
  const priorEvaluations = evaluations
    .filter(
      (evaluation) =>
        evaluation.evaluatedAt < currentObservedAt &&
        evaluation.policyVersion === policyVersion &&
        evaluation.sensorVersion === sensorVersion,
    )
    .slice(-CARDINAL_RESEARCH_WINDOW);

  const eligibleInterventions = interventions.filter(
    (intervention) => intervention.requestedAt < currentObservedAt,
  );
  const allPriorOutcomeIds = new Set(
    outcomes
      .filter((outcome) => outcome.observedAt < currentObservedAt)
      .map((outcome) => outcome.interventionId),
  );
  const unresolvedExecuted = eligibleInterventions.filter(
    (intervention) =>
      intervention.executed && !allPriorOutcomeIds.has(intervention.interventionId),
  );
  const tailInterventions = eligibleInterventions.slice(-CARDINAL_RESEARCH_WINDOW);
  const requiredInterventionIds = new Set(
    [...unresolvedExecuted, ...tailInterventions].map(
      (intervention) => intervention.interventionId,
    ),
  );
  const priorInterventions = eligibleInterventions.filter((intervention) =>
    requiredInterventionIds.has(intervention.interventionId),
  );

  const priorOutcomes = outcomes
    .filter(
      (outcome) =>
        outcome.observedAt < currentObservedAt &&
        outcome.sensorVersion === sensorVersion,
    )
    .slice(-CARDINAL_RESEARCH_WINDOW);

  const fingerprint = createStableId('research-context', {
    researchVersion: CARDINAL_RESEARCH_VERSION,
    policyVersion,
    sensorVersion,
    evaluations: priorEvaluations,
    interventions: priorInterventions,
    outcomes: priorOutcomes,
    experience,
  });

  return {
    researchVersion: CARDINAL_RESEARCH_VERSION,
    priorEvaluations: structuredClone(priorEvaluations),
    priorInterventions: structuredClone(priorInterventions),
    priorOutcomes: structuredClone(priorOutcomes),
    experience: structuredClone(experience),
    fingerprint,
  };
}

export function emptyCardinalResearchContext(): CardinalResearchContext {
  const experience = deriveCardinalExperience([], []);
  return {
    researchVersion: CARDINAL_RESEARCH_VERSION,
    priorEvaluations: [],
    priorInterventions: [],
    priorOutcomes: [],
    experience,
    fingerprint: createStableId('research-context', {
      researchVersion: CARDINAL_RESEARCH_VERSION,
      empty: true,
      experience,
    }),
  };
}
