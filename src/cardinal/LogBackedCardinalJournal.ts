import { stableJsonStringify } from '../core/stableJson';
import {
  AppendOnlyLogConflictError,
  type AppendOnlyLog,
} from '../persistence/AppendOnlyLog';
import type {
  CardinalJournal,
  CardinalJournalSummary,
} from './CardinalJournal';
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

interface JournalStreamCache {
  rawLength: number;
  byId: Map<string, JournalEntry>;
  order: string[];
  aggregate: JournalStreamAggregate;
  lastLogicalTime?: number;
  monotonicTime: boolean;
}

interface JournalStreamAggregate {
  count: number;
  proposals: number;
  ecologyEvaluations: number;
  executedInterventions: number;
  deniedInterventions: number;
  successfulPredictions: number;
}

function emptyAggregate(): JournalStreamAggregate {
  return {
    count: 0,
    proposals: 0,
    ecologyEvaluations: 0,
    executedInterventions: 0,
    deniedInterventions: 0,
    successfulPredictions: 0,
  };
}

function evidenceTime(kind: EvidenceKind, value: EvidenceValue): number {
  return kind === 'evaluation'
    ? (value as CardinalEvaluation).evaluatedAt
    : kind === 'intervention'
      ? (value as InterventionRecord).requestedAt
      : kind === 'outcome'
        ? (value as InterventionOutcomeRecord).observedAt
        : (value as AuditRecord).auditedAt;
}

function adjustAggregate(
  aggregate: JournalStreamAggregate,
  kind: EvidenceKind,
  value: EvidenceValue,
  delta: 1 | -1,
): void {
  aggregate.count += delta;
  if (kind === 'evaluation') {
    const evaluation = value as CardinalEvaluation;
    if (evaluation.proposal) aggregate.proposals += delta;
    if (evaluation.metrics.exploredWorldRatio > 0) {
      aggregate.ecologyEvaluations += delta;
    }
  } else if (kind === 'intervention') {
    const intervention = value as InterventionRecord;
    if (intervention.executed) aggregate.executedInterventions += delta;
    else aggregate.deniedInterventions += delta;
  } else if (
    kind === 'outcome' &&
    (value as InterventionOutcomeRecord).expectedDirectionObserved
  ) {
    aggregate.successfulPredictions += delta;
  }
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

  if (candidate.kind === 'intervention') {
    const durationWorldMinutes =
      value.authorizedEffectDurationWorldMinutes;
    const legacyDuration = value.authorizedEffectDuration;
    if (
      !(
        typeof durationWorldMinutes === 'number' &&
        Number.isFinite(durationWorldMinutes) &&
        durationWorldMinutes >= 1
      ) &&
      !(
        typeof legacyDuration === 'number' &&
        Number.isFinite(legacyDuration) &&
        legacyDuration >= 1
      )
    ) {
      throw new Error(
        'Cardinal journal intervention is missing a valid canonical or legacy authorized effect duration.',
      );
    }
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
  private readonly caches = new Map<string, Promise<JournalStreamCache>>();

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

  async recentEvaluations(
    worldId: string,
    limit: number,
    beforeExclusive?: number,
  ): Promise<CardinalEvaluation[]> {
    return (await this.recentValues(
      worldId,
      'evaluation',
      limit,
      beforeExclusive,
    )) as CardinalEvaluation[];
  }

  async recentInterventions(
    worldId: string,
    limit: number,
    beforeExclusive?: number,
  ): Promise<InterventionRecord[]> {
    return (await this.recentValues(
      worldId,
      'intervention',
      limit,
      beforeExclusive,
    )) as InterventionRecord[];
  }

  async recentOutcomes(
    worldId: string,
    limit: number,
    beforeExclusive?: number,
  ): Promise<InterventionOutcomeRecord[]> {
    return (await this.recentValues(
      worldId,
      'outcome',
      limit,
      beforeExclusive,
    )) as InterventionOutcomeRecord[];
  }

  async recentAudits(
    worldId: string,
    limit: number,
    beforeExclusive?: number,
  ): Promise<AuditRecord[]> {
    return (await this.recentValues(
      worldId,
      'audit',
      limit,
      beforeExclusive,
    )) as AuditRecord[];
  }

  async summary(
    worldId: string,
    beforeExclusive?: number,
  ): Promise<CardinalJournalSummary> {
    const [evaluations, interventions, outcomes, audits] = await Promise.all([
      this.cache(streamId(worldId, 'evaluation'), 'evaluation', worldId),
      this.cache(streamId(worldId, 'intervention'), 'intervention', worldId),
      this.cache(streamId(worldId, 'outcome'), 'outcome', worldId),
      this.cache(streamId(worldId, 'audit'), 'audit', worldId),
    ]);
    const evaluationStats = this.aggregateBefore(
      evaluations,
      'evaluation',
      beforeExclusive,
    );
    const interventionStats = this.aggregateBefore(
      interventions,
      'intervention',
      beforeExclusive,
    );
    const outcomeStats = this.aggregateBefore(
      outcomes,
      'outcome',
      beforeExclusive,
    );
    const auditStats = this.aggregateBefore(audits, 'audit', beforeExclusive);
    return {
      evaluationCount: evaluationStats.count,
      proposalCount: evaluationStats.proposals,
      ecologyEvaluationCount: evaluationStats.ecologyEvaluations,
      interventionCount: interventionStats.count,
      executedInterventionCount: interventionStats.executedInterventions,
      deniedInterventionCount: interventionStats.deniedInterventions,
      outcomeCount: outcomeStats.count,
      successfulPredictionCount: outcomeStats.successfulPredictions,
      auditCount: auditStats.count,
    };
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
      const cache = await this.cache(stream, kind, worldId);
      const existing = cache.byId.get(id);

      if (existing) {
        if (stableJsonStringify(existing) !== incomingFingerprint) {
          throw new Error(`${kind} ID ${id} was reused with different content.`);
        }
        return;
      }

      try {
        await this.log.append(
          stream,
          cache.rawLength,
          stableJsonStringify(incoming),
        );
        cache.rawLength += 1;
        cache.byId.set(id, incoming);
        cache.order.push(id);
        const logicalTime = evidenceTime(kind, incoming.value);
        cache.monotonicTime =
          cache.monotonicTime &&
          (cache.lastLogicalTime === undefined ||
            logicalTime >= cache.lastLogicalTime);
        cache.lastLogicalTime = logicalTime;
        adjustAggregate(cache.aggregate, kind, incoming.value, 1);
        return;
      } catch (error) {
        if (!(error instanceof AppendOnlyLogConflictError)) {
          throw error;
        }
        this.caches.delete(stream);
      }
    }

    throw new Error(`Cardinal journal could not append ${kind} ${id} after retries.`);
  }

  private async values(worldId: string, kind: EvidenceKind): Promise<EvidenceValue[]> {
    return (await this.valueReferences(worldId, kind)).map((value) =>
      structuredClone(value),
    );
  }

  private async valueReferences(
    worldId: string,
    kind: EvidenceKind,
  ): Promise<EvidenceValue[]> {
    const cache = await this.cache(streamId(worldId, kind), kind, worldId);
    return cache.order.map((id) => cache.byId.get(id)!.value);
  }

  private async recentValues(
    worldId: string,
    kind: EvidenceKind,
    limit: number,
    beforeExclusive?: number,
  ): Promise<EvidenceValue[]> {
    if (!Number.isInteger(limit) || limit < 0) {
      throw new Error('Cardinal recent-evidence limit must be non-negative.');
    }
    if (limit === 0) return [];
    const values = await this.valueReferences(worldId, kind);
    const recent: EvidenceValue[] = [];
    for (let index = values.length - 1; index >= 0; index -= 1) {
      const value = values[index];
      if (
        beforeExclusive !== undefined &&
        evidenceTime(kind, value) >= beforeExclusive
      ) {
        continue;
      }
      recent.push(structuredClone(value));
      if (recent.length >= limit) break;
    }
    return recent.reverse();
  }

  private aggregateBefore(
    cache: JournalStreamCache,
    kind: EvidenceKind,
    beforeExclusive?: number,
  ): JournalStreamAggregate {
    const result = { ...cache.aggregate };
    if (
      beforeExclusive === undefined ||
      cache.lastLogicalTime === undefined ||
      (cache.monotonicTime && cache.lastLogicalTime < beforeExclusive)
    ) {
      return result;
    }
    for (let index = cache.order.length - 1; index >= 0; index -= 1) {
      const value = cache.byId.get(cache.order[index])!.value;
      const time = evidenceTime(kind, value);
      if (time < beforeExclusive) {
        if (cache.monotonicTime) break;
        continue;
      }
      adjustAggregate(result, kind, value, -1);
    }
    return result;
  }

  private cache(
    stream: string,
    kind: EvidenceKind,
    worldId: string,
  ): Promise<JournalStreamCache> {
    const existing = this.caches.get(stream);
    if (existing) return existing;
    const loading = this.loadCache(stream, kind, worldId);
    this.caches.set(stream, loading);
    return loading;
  }

  private async loadCache(
    stream: string,
    kind: EvidenceKind,
    worldId: string,
  ): Promise<JournalStreamCache> {
    const total = await this.log.length(stream);
    const rawEntries: string[] = [];
    const pageSize = 512;
    for (let start = 0; start < total; start += pageSize) {
      rawEntries.push(
        ...(await this.log.readRange(
          stream,
          start,
          Math.min(pageSize, total - start),
        )),
      );
    }
    if (rawEntries.length !== total) {
      throw new Error(`Cardinal journal stream ${stream} changed while loading.`);
    }
    const byId = new Map<string, JournalEntry>();
    const order: string[] = [];
    const aggregate = emptyAggregate();
    let lastLogicalTime: number | undefined;
    let monotonicTime = true;
    for (const raw of rawEntries) {
      const entry = parseEntry(raw);
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
      const logicalTime = evidenceTime(kind, entry.value);
      monotonicTime =
        monotonicTime &&
        (lastLogicalTime === undefined || logicalTime >= lastLogicalTime);
      lastLogicalTime = logicalTime;
      adjustAggregate(aggregate, kind, entry.value, 1);
    }
    return {
      rawLength: total,
      byId,
      order,
      aggregate,
      lastLogicalTime,
      monotonicTime,
    };
  }
}
