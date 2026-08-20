import type {
  AuditRecord,
  CardinalEvaluation,
  InterventionOutcomeRecord,
  InterventionRecord,
} from './types';

export interface CardinalJournal {
  appendEvaluation(evaluation: CardinalEvaluation): Promise<void>;
  appendIntervention(intervention: InterventionRecord): Promise<void>;
  appendOutcome(outcome: InterventionOutcomeRecord): Promise<void>;
  appendAudit(audit: AuditRecord): Promise<void>;

  evaluations(worldId: string): Promise<CardinalEvaluation[]>;
  interventions(worldId: string): Promise<InterventionRecord[]>;
  outcomes(worldId: string): Promise<InterventionOutcomeRecord[]>;
  audits(worldId: string): Promise<AuditRecord[]>;
}
