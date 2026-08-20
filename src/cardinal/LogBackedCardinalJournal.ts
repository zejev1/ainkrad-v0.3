import { stableJsonStringify } from '../core/stableJson';
import {
  AppendOnlyLogConflictError,
  type AppendOnlyLog,
} from '../persistence/AppendOnlyLog';
import type { CardinalJournal } from './CardinalJournal';
import type {
  AuditRecord,
  CardinalEvaluation,
  InterventionOutcomeRecord,
  InterventionRecord,
} from './types';

type EvidenceKind = 'evaluation' | 'intervention' | 'outcome' | 'audit';

type EvidenceValue =
  | CardinalEvaluation
  | InterventionRecord
  | InterventionOutcomeRecord
  | AuditRecord;

interface JournalEntry {
  kind: EvidenceKind;
  id: string;
  worldId: string;
  value: EvidenceValue;
}

const MAX_APPEND_RETRIES = 12;

function streamId(worldId: string, kind: EvidenceKind): string {
  return `cardinal-journal:${worldId}:${kind}`;
}

function entryId(kind: EvidenceKind, value: EvidenceValue): string {
  switch (kind) {
    case 'evaluation':
      return (value as CardinalEvaluation).evaluationId;
    case 'intervention':
      return (value as InterventionRecord).interventionId;
    case 'outcome':
      return (value as InterventionOutcomeRecord).outcomeId;
    case 'audit':
      return (value as AuditRecord).auditId;
  }
}

function parseEntry(raw: string): JournalEntry {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Cardinal journal contains a non-object record.');
  }

  const candidate = parsed as Partial<JournalEntry>;
  if (
    !['evaluation', 'intervention', 'outcome', 'audit'].includes(
      candidate.kind as string,
    ) ||
    typeof candidate.id !== 'string' ||
    !candidate.id.trim() ||
    typeof candidate.worldId !== 'string' ||
    !candidate.worldId.trim() ||
    !candidate.value ||
    typeof candidate.value !== 'object'
  ) {
    throw new Error('Cardinal journal contains a malformed record.');
  }

  const value = candidate.value as unknown as Record<string, unknown>;
  if (value.worldId !== candidate.worldId) {
    throw new Error('Cardinal journal record worldId does not match its evidence payload.');
  }

  const identityField =
    candidate.kind === 'evaluation'
      ? 'evaluationId'
      : candidate.kind === 'intervention'
        ? 'interventionId'
        : candidate.kind === 'outcome'
          ? 'outcomeId'
          : 'auditId';

  if (value[identityField] !== candidate.id) {
    throw new Error('Cardinal journal record ID does not match its evidence payload.');
  }

  return candidate as JournalEntry;
}

/**
 * Append-only Cardinal evidence store that can survive component restarts when
 * backed by a durable AppendOnlyLog implementation.
 *
 * No update/delete API exists here. Same evidence ID + same content is a retry;
 * same ID + different content is a hard collision.
 */
export class LogBackedCardinalJournal implements CardinalJournal {
  constructor(private readonly log: AppendOnlyLog) {}

  async appendEvaluation(evaluation: CardinalEvaluation): Promise<void> {
    await this.append('evaluation', evaluation);
  }

  async appendIntervention(intervention: InterventionRecord): Promise<void> {
    await this.append('intervention', intervention);
  }

  async appendOutcome(outcome: InterventionOutcomeRecord): Promise<void> {
    await this.append('outcome', outcome);
  }

  async appendAudit(audit: AuditRecord): Promise<void> {
    await this.append('audit', audit);
  }

  async evaluations(worldId: string): Promise<CardinalEvaluation[]> {
    return (await this.values(worldId, 'evaluation')) as CardinalEvaluation[];
  }

  async interventions(worldId: string): Promise<InterventionRecord[]> {
    return (await this.values(worldId, 'intervention')) as InterventionRecord[];
  }

  async outcomes(worldId: string): Promise<InterventionOutcomeRecord[]> {
    return (await this.values(worldId, 'outcome')) as InterventionOutcomeRecord[];
  }

  async audits(worldId: string): Promise<AuditRecord[]> {
    return (await this.values(worldId, 'audit')) as AuditRecord[];
  }

  private async append(kind: EvidenceKind, value: EvidenceValue): Promise<void> {
    const id = entryId(kind, value);
    const worldId = value.worldId;
    if (!id.trim() || !worldId.trim()) {
      throw new Error('Cardinal evidence IDs and worldId must not be empty.');
    }

    const incoming: JournalEntry = {
      kind,
      id,
      worldId,
      value: structuredClone(value),
    };
    const incomingFingerprint = stableJsonStringify(incoming);
    const stream = streamId(worldId, kind);

    for (let attempt = 0; attempt < MAX_APPEND_RETRIES; attempt += 1) {
      const rawEntries = await this.log.read(stream);
      const entries = rawEntries.map(parseEntry);
      const existing = entries.find((entry) => entry.kind === kind && entry.id === id);

      if (existing) {
        if (stableJsonStringify(existing) !== incomingFingerprint) {
          throw new Error(`${kind} ID ${id} was reused with different content.`);
        }
        return;
      }

      try {
        await this.log.append(
          stream,
          rawEntries.length,
          stableJsonStringify(incoming),
        );
        return;
      } catch (error) {
        if (!(error instanceof AppendOnlyLogConflictError)) {
          throw error;
        }
      }
    }

    throw new Error(`Cardinal journal could not append ${kind} ${id} after retries.`);
  }

  private async values(worldId: string, kind: EvidenceKind): Promise<EvidenceValue[]> {
    const entries = (await this.log.read(streamId(worldId, kind))).map(parseEntry);
    const byId = new Map<string, JournalEntry>();
    const order: string[] = [];

    for (const entry of entries) {
      if (entry.kind !== kind || entry.worldId !== worldId) {
        throw new Error('Cardinal journal stream contains evidence for another scope.');
      }
      const prior = byId.get(entry.id);
      if (prior) {
        if (stableJsonStringify(prior) !== stableJsonStringify(entry)) {
          throw new Error(`${kind} ID ${entry.id} has conflicting persisted content.`);
        }
        continue;
      }
      byId.set(entry.id, entry);
      order.push(entry.id);
    }

    return order.map((id) => structuredClone(byId.get(id)!.value));
  }
}
