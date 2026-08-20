import { stableJsonStringify } from '../core/stableJson';
import type { CardinalJournal } from './CardinalJournal';
import type {
  AuditRecord,
  CardinalEvaluation,
  InterventionOutcomeRecord,
  InterventionRecord,
} from './types';

interface IndexedLog<T> {
  byId: Map<string, T>;
  order: string[];
}

function createLog<T>(): IndexedLog<T> {
  return { byId: new Map<string, T>(), order: [] };
}

function appendIdempotent<T>(
  log: IndexedLog<T>,
  id: string,
  value: T,
  label: string,
): void {
  const existing = log.byId.get(id);
  if (existing) {
    if (stableJsonStringify(existing) !== stableJsonStringify(value)) {
      throw new Error(`${label} ID ${id} was reused with different content.`);
    }
    return;
  }

  log.byId.set(id, structuredClone(value));
  log.order.push(id);
}

function valuesForWorld<T extends { worldId: string }>(
  log: IndexedLog<T>,
  worldId: string,
): T[] {
  return log.order
    .map((id) => log.byId.get(id))
    .filter((item): item is T => item !== undefined && item.worldId === worldId)
    .map((item) => structuredClone(item));
}

/**
 * Append-only reference journal with retry-safe identities.
 *
 * Persistent implementations must enforce the same unique-ID/collision rule;
 * retrying a completed Cardinal cycle must not manufacture extra evidence.
 */
export class InMemoryCardinalJournal implements CardinalJournal {
  private readonly evaluationLog = createLog<CardinalEvaluation>();
  private readonly interventionLog = createLog<InterventionRecord>();
  private readonly outcomeLog = createLog<InterventionOutcomeRecord>();
  private readonly auditLog = createLog<AuditRecord>();

  async appendEvaluation(evaluation: CardinalEvaluation): Promise<void> {
    appendIdempotent(
      this.evaluationLog,
      evaluation.evaluationId,
      evaluation,
      'Evaluation',
    );
  }

  async appendIntervention(intervention: InterventionRecord): Promise<void> {
    appendIdempotent(
      this.interventionLog,
      intervention.interventionId,
      intervention,
      'Intervention',
    );
  }

  async appendOutcome(outcome: InterventionOutcomeRecord): Promise<void> {
    appendIdempotent(this.outcomeLog, outcome.outcomeId, outcome, 'Outcome');
  }

  async appendAudit(audit: AuditRecord): Promise<void> {
    appendIdempotent(this.auditLog, audit.auditId, audit, 'Audit');
  }

  async evaluations(worldId: string): Promise<CardinalEvaluation[]> {
    return valuesForWorld(this.evaluationLog, worldId);
  }

  async interventions(worldId: string): Promise<InterventionRecord[]> {
    return valuesForWorld(this.interventionLog, worldId);
  }

  async outcomes(worldId: string): Promise<InterventionOutcomeRecord[]> {
    return valuesForWorld(this.outcomeLog, worldId);
  }

  async audits(worldId: string): Promise<AuditRecord[]> {
    return valuesForWorld(this.auditLog, worldId);
  }
}
