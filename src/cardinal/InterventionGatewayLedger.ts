import { stableJsonStringify } from '../core/stableJson';
import {
  AppendOnlyLogConflictError,
  type AppendOnlyLog,
} from '../persistence/AppendOnlyLog';
import type { InterventionRecord } from './types';

export type GatewayLedgerPhase = 'pending' | 'final';

export interface GatewayLedgerEntry {
  worldId: string;
  proposalId: string;
  evaluationId: string;
  proposalFingerprint: string;
  expectedWorldRevision: number;
  effectDuration: number;
  gatewayPolicyVersion: string;
  phase: GatewayLedgerPhase;
  record: InterventionRecord;
}

export interface InterventionGatewayLedger {
  get(worldId: string, proposalId: string): Promise<GatewayLedgerEntry | undefined>;
  begin(entry: GatewayLedgerEntry): Promise<GatewayLedgerEntry>;
  finalize(entry: GatewayLedgerEntry): Promise<GatewayLedgerEntry>;
  entries(worldId: string): Promise<GatewayLedgerEntry[]>;
  lastExecutedAt(worldId: string): Promise<number | undefined>;
}

function key(worldId: string, proposalId: string): string {
  return `${worldId}::${proposalId}`;
}

function assertEntryShape(entry: GatewayLedgerEntry): void {
  if (
    !entry.worldId.trim() ||
    !entry.proposalId.trim() ||
    !entry.evaluationId.trim() ||
    !entry.proposalFingerprint.trim() ||
    !entry.gatewayPolicyVersion.trim()
  ) {
    throw new Error('Gateway ledger entry contains an empty required identity.');
  }
  if (!Number.isInteger(entry.expectedWorldRevision) || entry.expectedWorldRevision < 0) {
    throw new Error('Gateway ledger expectedWorldRevision must be a non-negative integer.');
  }
  if (!Number.isFinite(entry.effectDuration) || entry.effectDuration < 1) {
    throw new Error('Gateway ledger effectDuration must be finite and at least 1.');
  }
  if (
    entry.record.worldId !== entry.worldId ||
    entry.record.evaluationId !== entry.evaluationId ||
    entry.record.proposal.proposalId !== entry.proposalId ||
    entry.record.observedWorldRevision !== entry.expectedWorldRevision ||
    entry.record.gatewayPolicyVersion !== entry.gatewayPolicyVersion
  ) {
    throw new Error('Gateway ledger entry does not match its intervention record.');
  }
  if (stableJsonStringify(entry.record.proposal) !== entry.proposalFingerprint) {
    throw new Error('Gateway ledger proposal fingerprint does not match its proposal payload.');
  }
  if (!Number.isFinite(entry.record.requestedAt)) {
    throw new Error('Gateway intervention requestedAt must be finite.');
  }
  if (entry.phase === 'pending') {
    if (
      !entry.record.authorized ||
      entry.record.executed ||
      entry.record.executionStatus !== 'authorized_pending'
    ) {
      throw new Error('Pending gateway entry has an invalid execution state.');
    }
    if (entry.record.proposal.worldId !== entry.worldId) {
      throw new Error('Authorized pending proposal belongs to a different world.');
    }
  } else if (entry.record.executionStatus === 'executed') {
    if (!entry.record.authorized || !entry.record.executed) {
      throw new Error('Executed gateway entry has inconsistent authorization state.');
    }
    if (
      !Number.isInteger(entry.record.committedWorldRevision) ||
      entry.record.committedWorldRevision !== entry.expectedWorldRevision + 1
    ) {
      throw new Error(
        'Executed gateway entry must record the exact intervention commit revision.',
      );
    }
  } else if (entry.record.executionStatus === 'denied') {
    if (entry.record.authorized || entry.record.executed) {
      throw new Error('Denied gateway entry has inconsistent execution state.');
    }
  } else if (entry.record.executionStatus === 'stale') {
    if (!entry.record.authorized || entry.record.executed) {
      throw new Error('Stale gateway entry has inconsistent execution state.');
    }
  } else {
    throw new Error('Final gateway entry has an invalid execution status.');
  }
}

function assertTransition(existing: GatewayLedgerEntry, incoming: GatewayLedgerEntry): void {
  if (
    existing.worldId !== incoming.worldId ||
    existing.proposalId !== incoming.proposalId ||
    existing.evaluationId !== incoming.evaluationId ||
    existing.proposalFingerprint !== incoming.proposalFingerprint ||
    existing.expectedWorldRevision !== incoming.expectedWorldRevision ||
    existing.effectDuration !== incoming.effectDuration ||
    existing.gatewayPolicyVersion !== incoming.gatewayPolicyVersion
  ) {
    throw new Error(
      `Gateway proposal ${incoming.proposalId} was reused with different execution context.`,
    );
  }
}

export class InMemoryInterventionGatewayLedger implements InterventionGatewayLedger {
  private readonly byProposal = new Map<string, GatewayLedgerEntry>();
  private readonly order: string[] = [];

  async get(worldId: string, proposalId: string): Promise<GatewayLedgerEntry | undefined> {
    const value = this.byProposal.get(key(worldId, proposalId));
    return value ? structuredClone(value) : undefined;
  }

  async begin(entry: GatewayLedgerEntry): Promise<GatewayLedgerEntry> {
    assertEntryShape(entry);
    if (entry.phase !== 'pending' && !(entry.phase === 'final' && !entry.record.authorized)) {
      throw new Error('Gateway begin must record a pending authorization or a final denial.');
    }
    return this.put(entry);
  }

  async finalize(entry: GatewayLedgerEntry): Promise<GatewayLedgerEntry> {
    assertEntryShape(entry);
    if (entry.phase !== 'final') {
      throw new Error('Gateway finalize requires a final ledger entry.');
    }
    return this.put(entry);
  }

  async entries(worldId: string): Promise<GatewayLedgerEntry[]> {
    return this.order
      .map((itemKey) => this.byProposal.get(itemKey))
      .filter((entry): entry is GatewayLedgerEntry => entry !== undefined && entry.worldId === worldId)
      .map((entry) => structuredClone(entry));
  }

  async lastExecutedAt(worldId: string): Promise<number | undefined> {
    const executed = (await this.entries(worldId)).filter(
      (entry) => entry.phase === 'final' && entry.record.executed,
    );
    return executed.length === 0
      ? undefined
      : Math.max(...executed.map((entry) => entry.record.requestedAt));
  }

  private put(entry: GatewayLedgerEntry): GatewayLedgerEntry {
    const proposalKey = key(entry.worldId, entry.proposalId);
    const existing = this.byProposal.get(proposalKey);

    if (existing) {
      assertTransition(existing, entry);
      if (existing.phase === 'final') {
        if (stableJsonStringify(existing) !== stableJsonStringify(entry)) {
          throw new Error(
            `Final gateway proposal ${entry.proposalId} was rewritten with different content.`,
          );
        }
        return structuredClone(existing);
      }
      if (entry.phase === 'pending') {
        if (stableJsonStringify(existing) !== stableJsonStringify(entry)) {
          throw new Error(
            `Pending gateway proposal ${entry.proposalId} was rewritten with different content.`,
          );
        }
        return structuredClone(existing);
      }
    } else {
      this.order.push(proposalKey);
    }

    this.byProposal.set(proposalKey, structuredClone(entry));
    return structuredClone(entry);
  }
}

interface LedgerLogRecord {
  entry: GatewayLedgerEntry;
}

const MAX_LEDGER_APPEND_RETRIES = 12;

function streamId(worldId: string): string {
  return `intervention-gateway:${worldId}`;
}

function parseRecord(raw: string): LedgerLogRecord {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Gateway ledger contains a non-object record.');
  }
  const candidate = parsed as Partial<LedgerLogRecord>;
  if (!candidate.entry || typeof candidate.entry !== 'object') {
    throw new Error('Gateway ledger contains a malformed record.');
  }
  const entry = candidate.entry as GatewayLedgerEntry;
  if (
    typeof entry.worldId !== 'string' ||
    !entry.worldId.trim() ||
    typeof entry.proposalId !== 'string' ||
    !entry.proposalId.trim() ||
    (entry.phase !== 'pending' && entry.phase !== 'final')
  ) {
    throw new Error('Gateway ledger contains an invalid entry identity.');
  }
  assertEntryShape(entry);
  return { entry };
}

/**
 * Recovery-capable append-only ledger. A durable AppendOnlyLog adapter makes
 * gateway cooldown, authorization intent and completion survive process restarts.
 */
export class LogBackedInterventionGatewayLedger implements InterventionGatewayLedger {
  constructor(private readonly log: AppendOnlyLog) {}

  async get(worldId: string, proposalId: string): Promise<GatewayLedgerEntry | undefined> {
    const latest = this.latestByProposal(await this.readEntries(worldId));
    const value = latest.get(key(worldId, proposalId));
    return value ? structuredClone(value) : undefined;
  }

  async begin(entry: GatewayLedgerEntry): Promise<GatewayLedgerEntry> {
    assertEntryShape(entry);
    if (entry.phase !== 'pending' && !(entry.phase === 'final' && !entry.record.authorized)) {
      throw new Error('Gateway begin must record a pending authorization or a final denial.');
    }
    return await this.appendTransition(entry);
  }

  async finalize(entry: GatewayLedgerEntry): Promise<GatewayLedgerEntry> {
    assertEntryShape(entry);
    if (entry.phase !== 'final') {
      throw new Error('Gateway finalize requires a final ledger entry.');
    }
    return await this.appendTransition(entry);
  }

  async entries(worldId: string): Promise<GatewayLedgerEntry[]> {
    return [...this.latestByProposal(await this.readEntries(worldId)).values()].map(
      (entry) => structuredClone(entry),
    );
  }

  async lastExecutedAt(worldId: string): Promise<number | undefined> {
    const executed = (await this.entries(worldId)).filter(
      (entry) => entry.phase === 'final' && entry.record.executed,
    );
    return executed.length === 0
      ? undefined
      : Math.max(...executed.map((entry) => entry.record.requestedAt));
  }

  private async appendTransition(entry: GatewayLedgerEntry): Promise<GatewayLedgerEntry> {
    const stream = streamId(entry.worldId);

    for (let attempt = 0; attempt < MAX_LEDGER_APPEND_RETRIES; attempt += 1) {
      const raw = await this.log.read(stream);
      const entries = raw.map(parseRecord).map((record) => record.entry);
      const latest = this.latestByProposal(entries).get(key(entry.worldId, entry.proposalId));

      if (latest) {
        assertTransition(latest, entry);
        if (latest.phase === 'final') {
          if (stableJsonStringify(latest) !== stableJsonStringify(entry)) {
            throw new Error(
              `Final gateway proposal ${entry.proposalId} was rewritten with different content.`,
            );
          }
          return structuredClone(latest);
        }
        if (entry.phase === 'pending') {
          if (stableJsonStringify(latest) !== stableJsonStringify(entry)) {
            throw new Error(
              `Pending gateway proposal ${entry.proposalId} was rewritten with different content.`,
            );
          }
          return structuredClone(latest);
        }
      }

      try {
        await this.log.append(
          stream,
          raw.length,
          stableJsonStringify({ entry } satisfies LedgerLogRecord),
        );
        return structuredClone(entry);
      } catch (error) {
        if (!(error instanceof AppendOnlyLogConflictError)) {
          throw error;
        }
      }
    }

    throw new Error(
      `Gateway ledger could not append proposal ${entry.proposalId} after retries.`,
    );
  }

  private async readEntries(worldId: string): Promise<GatewayLedgerEntry[]> {
    return (await this.log.read(streamId(worldId)))
      .map(parseRecord)
      .map((record) => record.entry);
  }

  private latestByProposal(entries: readonly GatewayLedgerEntry[]): Map<string, GatewayLedgerEntry> {
    const latest = new Map<string, GatewayLedgerEntry>();
    for (const entry of entries) {
      const proposalKey = key(entry.worldId, entry.proposalId);
      const prior = latest.get(proposalKey);
      if (prior) {
        assertTransition(prior, entry);
        if (prior.phase === 'final') {
          if (stableJsonStringify(prior) === stableJsonStringify(entry)) {
            continue;
          }
          throw new Error(
            `Gateway ledger contains a transition after final proposal ${entry.proposalId}.`,
          );
        }
        if (entry.phase === 'pending') {
          if (stableJsonStringify(prior) === stableJsonStringify(entry)) {
            continue;
          }
          throw new Error(
            `Gateway ledger contains conflicting pending records for ${entry.proposalId}.`,
          );
        }
      }
      latest.set(proposalKey, structuredClone(entry));
    }
    return latest;
  }
}
