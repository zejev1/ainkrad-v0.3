import { createStableId } from '../core/stableId';
import type { CardinalJournal } from './CardinalJournal';
import type {
  CardinalEvaluation,
  InterventionOutcomeRecord,
  InterventionRecord,
} from './types';

export const CARDINAL_AUDIT_CONTEXT_VERSION = 'ainkrad-cardinal-audit-context-0.3.6';
export const CARDINAL_AUDIT_HISTORY_WINDOW = 32;

export interface CardinalAuditContext {
  version: string;
  priorEvaluations: CardinalEvaluation[];
  priorInterventions: InterventionRecord[];
  priorOutcomes: InterventionOutcomeRecord[];
  fingerprint: string;
}

/**
 * Auditor history is reconstructed independently from the append-only journal.
 * It deliberately does not reuse Cardinal Core's derived autonomy assessment.
 */
export async function buildCardinalAuditContext(
  journal: CardinalJournal,
  worldId: string,
  currentObservedAt: number,
  sensorVersion: string,
): Promise<CardinalAuditContext> {
  const [evaluations, interventions, outcomes] = await Promise.all([
    journal.evaluations(worldId),
    journal.interventions(worldId),
    journal.outcomes(worldId),
  ]);

  const priorEvaluations = evaluations
    .filter(
      (evaluation) =>
        evaluation.evaluatedAt < currentObservedAt &&
        evaluation.sensorVersion === sensorVersion,
    )
    .slice(-CARDINAL_AUDIT_HISTORY_WINDOW);

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
  const tailInterventions = eligibleInterventions.slice(-CARDINAL_AUDIT_HISTORY_WINDOW);
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
    .slice(-CARDINAL_AUDIT_HISTORY_WINDOW);

  return {
    version: CARDINAL_AUDIT_CONTEXT_VERSION,
    priorEvaluations: structuredClone(priorEvaluations),
    priorInterventions: structuredClone(priorInterventions),
    priorOutcomes: structuredClone(priorOutcomes),
    fingerprint: createStableId('audit-context', {
      version: CARDINAL_AUDIT_CONTEXT_VERSION,
      worldId,
      currentObservedAt,
      sensorVersion,
      priorEvaluations,
      priorInterventions,
      priorOutcomes,
    }),
  };
}
