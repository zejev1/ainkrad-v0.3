import type {
  AuditRecord,
  CardinalEvaluation,
  InterventionOutcomeRecord,
  InterventionRecord,
} from './types';

export interface CardinalJournalSummary {
  evaluationCount: number;
  proposalCount: number;
  ecologyEvaluationCount: number;
  interventionCount: number;
  executedInterventionCount: number;
  deniedInterventionCount: number;
  outcomeCount: number;
  successfulPredictionCount: number;
  auditCount: number;
}

export interface CardinalJournal {
  appendEvaluation(evaluation: CardinalEvaluation): Promise<void>;
  appendIntervention(intervention: InterventionRecord): Promise<void>;
  appendOutcome(outcome: InterventionOutcomeRecord): Promise<void>;
  appendAudit(audit: AuditRecord): Promise<void>;

  evaluations(worldId: string): Promise<CardinalEvaluation[]>;
  interventions(worldId: string): Promise<InterventionRecord[]>;
  outcomes(worldId: string): Promise<InterventionOutcomeRecord[]>;
  audits(worldId: string): Promise<AuditRecord[]>;

  recentEvaluations(
    worldId: string,
    limit: number,
    beforeExclusive?: number,
  ): Promise<CardinalEvaluation[]>;
  recentInterventions(
    worldId: string,
    limit: number,
    beforeExclusive?: number,
  ): Promise<InterventionRecord[]>;
  recentOutcomes(
    worldId: string,
    limit: number,
    beforeExclusive?: number,
  ): Promise<InterventionOutcomeRecord[]>;
  recentAudits(
    worldId: string,
    limit: number,
    beforeExclusive?: number,
  ): Promise<AuditRecord[]>;
  summary(
    worldId: string,
    beforeExclusive?: number,
  ): Promise<CardinalJournalSummary>;
}
