import { createStableId } from '../core/stableId';
import type { CardinalJournal } from './CardinalJournal';
import type {
  CardinalEvaluation,
  InterventionOutcomeRecord,
  InterventionRecord,
} from './types';
import { CARDINAL_RESEARCH_VERSION } from './CardinalResearch';
import {
  CARDINAL_AUTONOMY_WINDOW_WORLD_MINUTES,
  isCanonicalWorldMinutes,
} from '../v15/WorldTimeContract';

export const CARDINAL_AUDIT_CONTEXT_VERSION = 'ainkrad-cardinal-audit-context-0.3.15';
export const CARDINAL_AUDIT_HISTORY_MAX_RECORDS = 128;

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
  currentWorldMinutes: number,
  worldEpoch: number,
  policyVersion: string,
  sensorVersion: string,
): Promise<CardinalAuditContext> {
  if (!isCanonicalWorldMinutes(currentWorldMinutes)) {
    throw new Error(
      'Cardinal audit currentWorldMinutes must be finite and non-negative.',
    );
  }
  const [evaluations, interventions, outcomes] = await Promise.all([
    journal.recentEvaluations(worldId, 512, currentObservedAt),
    journal.recentInterventions(worldId, 512, currentObservedAt),
    journal.recentOutcomes(worldId, 512, currentObservedAt),
  ]);

  const priorEvaluations = evaluations
    .filter(
      (evaluation) =>
        evaluation.evaluatedAt < currentObservedAt &&
        evaluation.worldEpoch === worldEpoch &&
        evaluation.policyVersion === policyVersion &&
        evaluation.sensorVersion === sensorVersion &&
        evaluation.researchVersion === CARDINAL_RESEARCH_VERSION &&
        isCanonicalWorldMinutes(evaluation.evaluatedWorldMinutes) &&
        evaluation.evaluatedWorldMinutes < currentWorldMinutes,
    )
    .sort(
      (a, b) =>
        a.evaluatedWorldMinutes - b.evaluatedWorldMinutes ||
        a.evaluatedAt - b.evaluatedAt ||
        a.evaluationId.localeCompare(b.evaluationId),
    )
    .slice(-CARDINAL_AUDIT_HISTORY_MAX_RECORDS);

  const eligibleInterventions = interventions.filter(
    (intervention) =>
      intervention.requestedAt < currentObservedAt &&
      intervention.worldEpoch === worldEpoch &&
      intervention.policyVersion === policyVersion &&
      intervention.sensorVersion === sensorVersion &&
      intervention.researchVersion === CARDINAL_RESEARCH_VERSION &&
      isCanonicalWorldMinutes(intervention.requestedWorldMinutes) &&
      isCanonicalWorldMinutes(
        intervention.authorizedEffectDurationWorldMinutes,
      ) &&
      isCanonicalWorldMinutes(
        intervention.proposal?.prediction?.horizonWorldMinutes,
      ) &&
      intervention.requestedWorldMinutes < currentWorldMinutes,
  );
  const allPriorOutcomeIds = new Set(
    outcomes
      .filter(
        (outcome) =>
          outcome.observedAt < currentObservedAt &&
          outcome.worldEpoch === worldEpoch &&
          outcome.policyVersion === policyVersion &&
          outcome.sensorVersion === sensorVersion &&
          outcome.researchVersion === CARDINAL_RESEARCH_VERSION &&
          isCanonicalWorldMinutes(outcome.observedWorldMinutes) &&
          outcome.observedWorldMinutes < currentWorldMinutes,
      )
      .map((outcome) => outcome.interventionId),
  );
  const unresolvedExecuted = eligibleInterventions.filter(
    (intervention) =>
      intervention.executed && !allPriorOutcomeIds.has(intervention.interventionId),
  );
  const recentTimedInterventions = eligibleInterventions.filter(
    (intervention) =>
      currentWorldMinutes - intervention.requestedWorldMinutes <=
      CARDINAL_AUTONOMY_WINDOW_WORLD_MINUTES,
  );
  const tailInterventions = eligibleInterventions
    .sort(
      (a, b) =>
        a.requestedWorldMinutes - b.requestedWorldMinutes ||
        a.requestedAt - b.requestedAt ||
        a.interventionId.localeCompare(b.interventionId),
    )
    .slice(-CARDINAL_AUDIT_HISTORY_MAX_RECORDS);
  const requiredInterventionIds = new Set(
    [
      ...unresolvedExecuted,
      ...recentTimedInterventions,
      ...tailInterventions,
    ].map(
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
        outcome.worldEpoch === worldEpoch &&
        outcome.policyVersion === policyVersion &&
        outcome.sensorVersion === sensorVersion &&
        outcome.researchVersion === CARDINAL_RESEARCH_VERSION &&
        isCanonicalWorldMinutes(outcome.observedWorldMinutes) &&
        outcome.observedWorldMinutes < currentWorldMinutes &&
        requiredInterventionIds.has(outcome.interventionId),
    )
    .sort(
      (a, b) =>
        a.observedWorldMinutes - b.observedWorldMinutes ||
        a.observedAt - b.observedAt ||
        a.outcomeId.localeCompare(b.outcomeId),
    )
    .slice(-CARDINAL_AUDIT_HISTORY_MAX_RECORDS);

  return {
    version: CARDINAL_AUDIT_CONTEXT_VERSION,
    priorEvaluations: structuredClone(priorEvaluations),
    priorInterventions: structuredClone(priorInterventions),
    priorOutcomes: structuredClone(priorOutcomes),
    fingerprint: createStableId('audit-context', {
      version: CARDINAL_AUDIT_CONTEXT_VERSION,
      worldId,
      worldEpoch,
      currentObservedAt,
      currentWorldMinutes,
      policyVersion,
      sensorVersion,
      priorEvaluations,
      priorInterventions,
      priorOutcomes,
    }),
  };
}
