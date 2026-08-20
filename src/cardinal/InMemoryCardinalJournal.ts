import type { CardinalJournal } from './CardinalJournal';
import type {
  AuditRecord,
  CardinalEvaluation,
  InterventionOutcomeRecord,
  InterventionRecord,
} from './types';

export class InMemoryCardinalJournal implements CardinalJournal {
  private readonly evaluationLog: CardinalEvaluation[] = [];
  private readonly interventionLog: InterventionRecord[] = [];
  private readonly outcomeLog: InterventionOutcomeRecord[] = [];
  private readonly auditLog: AuditRecord[] = [];

  async appendEvaluation(evaluation: CardinalEvaluation): Promise<void> {
    this.evaluationLog.push(structuredClone(evaluation));
  }

  async appendIntervention(intervention: InterventionRecord): Promise<void> {
    this.interventionLog.push(structuredClone(intervention));
  }

  async appendOutcome(outcome: InterventionOutcomeRecord): Promise<void> {
    this.outcomeLog.push(structuredClone(outcome));
  }

  async appendAudit(audit: AuditRecord): Promise<void> {
    this.auditLog.push(structuredClone(audit));
  }

  async evaluations(worldId: string): Promise<CardinalEvaluation[]> {
    return this.evaluationLog
      .filter((item) => item.worldId === worldId)
      .map((item) => structuredClone(item));
  }

  async interventions(worldId: string): Promise<InterventionRecord[]> {
    return this.interventionLog
      .filter((item) => item.worldId === worldId)
      .map((item) => structuredClone(item));
  }

  async outcomes(worldId: string): Promise<InterventionOutcomeRecord[]> {
    return this.outcomeLog
      .filter((item) => item.worldId === worldId)
      .map((item) => structuredClone(item));
  }

  async audits(worldId: string): Promise<AuditRecord[]> {
    return this.auditLog
      .filter((item) => item.worldId === worldId)
      .map((item) => structuredClone(item));
  }
}
