export class AppendOnlyLogConflictError extends Error {
  constructor(
    readonly streamId: string,
    readonly expectedLength: number,
    readonly actualLength: number,
  ) {
    super(
      `Append-only stream ${streamId} length conflict: expected ${expectedLength}, actual ${actualLength}.`,
    );
    this.name = 'AppendOnlyLogConflictError';
  }
}

/**
 * Minimal persistence port for append-only research/control records.
 *
 * A durable adapter may use files, SQLite, PostgreSQL, object storage, etc.
 * The domain does not know or care which provider is behind this interface.
 *
 * append() is compare-and-append per stream. There is deliberately no global
 * sequence shared by all worlds, Cardinal cycles or gateway decisions.
 */
export interface AppendOnlyLog {
  read(streamId: string): Promise<string[]>;
  length(streamId: string): Promise<number>;
  readRange(streamId: string, start: number, limit: number): Promise<string[]>;
  readTail(streamId: string, limit: number): Promise<string[]>;
  append(streamId: string, expectedLength: number, record: string): Promise<number>;
}

/**
 * Reference implementation used by tests and in-memory experiments.
 * Recreating higher-level stores over the same log simulates a process-level
 * component restart while preserving its persisted records.
 */
export class InMemoryAppendOnlyLog implements AppendOnlyLog {
  private readonly streams = new Map<string, string[]>();

  async read(streamId: string): Promise<string[]> {
    return [...(this.streams.get(streamId) ?? [])];
  }

  async length(streamId: string): Promise<number> {
    return (this.streams.get(streamId) ?? []).length;
  }

  async readRange(
    streamId: string,
    start: number,
    limit: number,
  ): Promise<string[]> {
    if (!Number.isInteger(start) || start < 0) {
      throw new Error('Append-only range start must be a non-negative integer.');
    }
    if (!Number.isInteger(limit) || limit < 0) {
      throw new Error('Append-only range limit must be a non-negative integer.');
    }
    return (this.streams.get(streamId) ?? []).slice(start, start + limit);
  }

  async readTail(streamId: string, limit: number): Promise<string[]> {
    if (!Number.isInteger(limit) || limit < 0) {
      throw new Error('Append-only tail limit must be a non-negative integer.');
    }
    const values = this.streams.get(streamId) ?? [];
    return values.slice(Math.max(0, values.length - limit));
  }

  async append(
    streamId: string,
    expectedLength: number,
    record: string,
  ): Promise<number> {
    if (!streamId.trim()) {
      throw new Error('Append-only streamId must not be empty.');
    }
    if (!Number.isInteger(expectedLength) || expectedLength < 0) {
      throw new Error('Append-only expectedLength must be a non-negative integer.');
    }
    if (!record.trim()) {
      throw new Error('Append-only record must not be empty.');
    }

    const current = this.streams.get(streamId) ?? [];
    if (current.length !== expectedLength) {
      throw new AppendOnlyLogConflictError(
        streamId,
        expectedLength,
        current.length,
      );
    }

    const next = [...current, record];
    this.streams.set(streamId, next);
    return next.length;
  }
}
