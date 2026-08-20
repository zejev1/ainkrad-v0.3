import { createStableId } from '../core/stableId';
import type { CardinalJournal } from './CardinalJournal';
import type {
  CardinalEvaluation,
  InterventionOutcomeRecord,
  InterventionRecord,
} from './types';

export const CARDINAL_RESEARCH_VERSION = 'ainkrad-cardinal-research-0.3.4';
export const CARDINAL_RESEARCH_WINDOW = 12;

export interface CardinalResearchContext {
  researchVersion: string;
  priorEvaluations: CardinalEvaluation[];
  priorInterventions: InterventionRecord[];
  priorOutcomes: InterventionOutcomeRecord[];
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

  const priorInterventions = interventions
    .filter((intervention) => intervention.requestedAt < currentObservedAt)
    .slice(-CARDINAL_RESEARCH_WINDOW);

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
  });

  return {
    researchVersion: CARDINAL_RESEARCH_VERSION,
    priorEvaluations: structuredClone(priorEvaluations),
    priorInterventions: structuredClone(priorInterventions),
    priorOutcomes: structuredClone(priorOutcomes),
    fingerprint,
  };
}

export function emptyCardinalResearchContext(): CardinalResearchContext {
  return {
    researchVersion: CARDINAL_RESEARCH_VERSION,
    priorEvaluations: [],
    priorInterventions: [],
    priorOutcomes: [],
    fingerprint: createStableId('research-context', {
      researchVersion: CARDINAL_RESEARCH_VERSION,
      empty: true,
    }),
  };
}
