import type {
  AuditRecord,
  CardinalEvaluation,
  InterventionRecord,
} from './types';

export interface CardinalJournal {
  appendEvaluation(
    evaluation:
      CardinalEvaluation,
  ): Promise<void>;

  appendIntervention(
    intervention:
      InterventionRecord,
  ): Promise<void>;

  appendAudit(
    audit:
      AuditRecord,
  ): Promise<void>;

  evaluations(
    worldId: string,
  ): Promise<CardinalEvaluation[]>;

  interventions(
    worldId: string,
  ): Promise<InterventionRecord[]>;

  audits(
    worldId: string,
  ): Promise<AuditRecord[]>;
}
