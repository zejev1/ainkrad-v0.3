import { stableJsonStringify } from '../core/stableJson';
import type { WorldEvent } from '../world/events';
import type { MemoryRecord, WorldState } from '../world/types';
import type {
  CommittedWorldOperation,
  WorldCommitBatch,
  WorldCommitResult,
  WorldStore,
} from '../world/persistence';
import { WorldRevisionConflictError } from '../world/persistence';
import type { AppendOnlyLog } from './AppendOnlyLog';
import { AppendOnlyLogConflictError } from './AppendOnlyLog';

const DATABASE_VERSION = 1;

const STORES = {
  worlds: 'worlds',
  operations: 'operations',
  events: 'events',
  memories: 'memories',
  streamHeads: 'stream_heads',
  streamRecords: 'stream_records',
} as const;

const INDEXES = {
  eventWorldTime: 'by_world_time',
  eventWorldActiveUntil: 'by_world_active_until',
  memoryAgentTime: 'by_agent_time',
  memoryPair: 'by_pair',
  streamRecord: 'by_stream_index',
} as const;

export const DEFAULT_AINKRAD_DATABASE_NAME =
  'ainkrad-v0-3-browser-world-v1';

interface StoredOperation extends CommittedWorldOperation {
  key: string;
}

interface StoredWorldEvent extends WorldEvent {
  key: string;
}

interface StoredMemory extends MemoryRecord {
  key: string;
  pairKeys: string[];
}

interface StoredStreamHead {
  streamId: string;
  length: number;
}

interface StoredStreamRecord {
  key: string;
  streamId: string;
  index: number;
  record: string;
}

function operationKey(worldId: string, operationId: string): string {
  return `${worldId}::operation::${operationId}`;
}

function eventKey(worldId: string, eventId: string): string {
  return `${worldId}::event::${eventId}`;
}

function memoryKey(worldId: string, memoryId: string): string {
  return `${worldId}::memory::${memoryId}`;
}

function pairKey(
  worldId: string,
  agentId: string,
  otherAgentId: string,
): string {
  return `${worldId}::pair::${agentId}::${otherAgentId}`;
}

function worldTimeRange(
  worldId: string,
  atOrBefore = Number.MAX_SAFE_INTEGER,
): IDBKeyRange {
  return IDBKeyRange.bound(
    [worldId, Number.MIN_SAFE_INTEGER],
    [worldId, atOrBefore],
  );
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), {
      once: true,
    });
    request.addEventListener(
      'error',
      () => reject(request.error ?? new Error('IndexedDB request failed.')),
      { once: true },
    );
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true });
    transaction.addEventListener(
      'abort',
      () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.')),
      { once: true },
    );
    transaction.addEventListener(
      'error',
      () => reject(transaction.error ?? new Error('IndexedDB transaction failed.')),
      { once: true },
    );
  });
}

async function abortTransaction(
  transaction: IDBTransaction,
  completion: Promise<void>,
): Promise<void> {
  try {
    transaction.abort();
  } catch {
    // The transaction may already have aborted because a request failed.
  }
  await completion.catch(() => undefined);
}

function openDatabase(name: string): Promise<IDBDatabase> {
  if (!name.trim()) {
    return Promise.reject(
      new Error('IndexedDB database name must not be empty.'),
    );
  }
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(
      new Error('This browser does not provide IndexedDB persistence.'),
    );
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, DATABASE_VERSION);

    request.addEventListener('upgradeneeded', () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORES.worlds)) {
        database.createObjectStore(STORES.worlds, { keyPath: 'id' });
      }

      if (!database.objectStoreNames.contains(STORES.operations)) {
        database.createObjectStore(STORES.operations, { keyPath: 'key' });
      }

      if (!database.objectStoreNames.contains(STORES.events)) {
        const events = database.createObjectStore(STORES.events, {
          keyPath: 'key',
        });
        events.createIndex(
          INDEXES.eventWorldTime,
          ['worldId', 'occurredAt'],
        );
        events.createIndex(
          INDEXES.eventWorldActiveUntil,
          ['worldId', 'activeUntil'],
        );
      }

      if (!database.objectStoreNames.contains(STORES.memories)) {
        const memories = database.createObjectStore(STORES.memories, {
          keyPath: 'key',
        });
        memories.createIndex(
          INDEXES.memoryAgentTime,
          ['worldId', 'agentId', 'createdAt'],
        );
        memories.createIndex(INDEXES.memoryPair, 'pairKeys', {
          multiEntry: true,
        });
      }

      if (!database.objectStoreNames.contains(STORES.streamHeads)) {
        database.createObjectStore(STORES.streamHeads, {
          keyPath: 'streamId',
        });
      }

      if (!database.objectStoreNames.contains(STORES.streamRecords)) {
        const records = database.createObjectStore(STORES.streamRecords, {
          keyPath: 'key',
        });
        records.createIndex(
          INDEXES.streamRecord,
          ['streamId', 'index'],
          { unique: true },
        );
      }
    });

    request.addEventListener(
      'success',
      () => {
        const database = request.result;
        database.addEventListener('versionchange', () => database.close());
        resolve(database);
      },
      { once: true },
    );
    request.addEventListener(
      'error',
      () => reject(request.error ?? new Error('Could not open IndexedDB.')),
      { once: true },
    );
    request.addEventListener(
      'blocked',
      () => reject(new Error('IndexedDB upgrade is blocked by another tab.')),
      { once: true },
    );
  });
}

function assertSame<T>(kind: string, id: string, a: T, b: T): void {
  if (stableJsonStringify(a) !== stableJsonStringify(b)) {
    throw new Error(`${kind} ID ${id} was reused with different content.`);
  }
}

function toStoredEvent(event: WorldEvent): StoredWorldEvent {
  return {
    ...structuredClone(event),
    key: eventKey(event.worldId, event.eventId),
  };
}

function fromStoredEvent(stored: StoredWorldEvent): WorldEvent {
  const { key: _key, ...event } = stored;
  return structuredClone(event);
}

function toStoredMemory(memory: MemoryRecord): StoredMemory {
  return {
    ...structuredClone(memory),
    key: memoryKey(memory.worldId, memory.memoryId),
    pairKeys: memory.relatedAgentIds.map((otherAgentId) =>
      pairKey(memory.worldId, memory.agentId, otherAgentId),
    ),
  };
}

function fromStoredMemory(stored: StoredMemory): MemoryRecord {
  const { key: _key, pairKeys: _pairKeys, ...memory } = stored;
  return structuredClone(memory);
}

function validateLimit(limit: number, label: string): void {
  if (!Number.isInteger(limit) || limit < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
}

function cursorValues<T>(
  request: IDBRequest<IDBCursorWithValue | null>,
  limit: number,
): Promise<T[]> {
  return new Promise<T[]>((resolve, reject) => {
    const values: T[] = [];
    request.addEventListener('success', () => {
      const cursor = request.result;
      if (!cursor || values.length >= limit) {
        resolve(values);
        return;
      }
      values.push(structuredClone(cursor.value as T));
      cursor.continue();
    });
    request.addEventListener('error', () => {
      reject(request.error ?? new Error('IndexedDB cursor failed.'));
    });
  });
}

export class IndexedDbWorldStore implements WorldStore {
  constructor(private readonly database: Promise<IDBDatabase>) {}

  async initializeWorld(state: WorldState): Promise<void> {
    if (!Number.isInteger(state.revision) || state.revision !== 0) {
      throw new Error('A newly initialized world must start at revision 0.');
    }

    const database = await this.database;
    const transaction = database.transaction(STORES.worlds, 'readwrite');
    const completion = transactionComplete(transaction);
    const worlds = transaction.objectStore(STORES.worlds);

    try {
      const existing = (await requestResult(
        worlds.get(state.id),
      )) as WorldState | undefined;

      if (existing) {
        assertSame('World initialization', state.id, existing, state);
      } else {
        worlds.add(structuredClone(state));
      }

      await completion;
    } catch (error) {
      await abortTransaction(transaction, completion);
      throw error;
    }
  }

  async loadWorld(worldId: string): Promise<WorldState | undefined> {
    const database = await this.database;
    const transaction = database.transaction(STORES.worlds, 'readonly');
    const completion = transactionComplete(transaction);
    const state = (await requestResult(
      transaction.objectStore(STORES.worlds).get(worldId),
    )) as WorldState | undefined;
    await completion;
    return state ? structuredClone(state) : undefined;
  }

  async committedOperation(
    worldId: string,
    operationId: string,
  ): Promise<CommittedWorldOperation | undefined> {
    const database = await this.database;
    const transaction = database.transaction(STORES.operations, 'readonly');
    const completion = transactionComplete(transaction);
    const stored = (await requestResult(
      transaction
        .objectStore(STORES.operations)
        .get(operationKey(worldId, operationId)),
    )) as StoredOperation | undefined;
    await completion;
    if (!stored) return undefined;
    const { key: _key, ...operation } = stored;
    return structuredClone(operation);
  }

  async commit(batch: WorldCommitBatch): Promise<WorldCommitResult> {
    if (!batch.operationId.trim()) {
      throw new Error('World commit operationId must not be empty.');
    }
    if (!batch.operationFingerprint.trim()) {
      throw new Error('World commit operationFingerprint must not be empty.');
    }
    if (batch.nextState.id !== batch.worldId) {
      throw new Error('World commit nextState belongs to a different world.');
    }

    const eventKeys = new Set<string>();
    for (const event of batch.events) {
      if (event.worldId !== batch.worldId) {
        throw new Error('World commit contains an event for another world.');
      }
      const key = eventKey(event.worldId, event.eventId);
      if (eventKeys.has(key)) {
        throw new Error(
          `World operation ${batch.operationId} produced duplicate event ID ${event.eventId}.`,
        );
      }
      eventKeys.add(key);
    }

    const memoryKeys = new Set<string>();
    for (const memory of batch.memories) {
      if (memory.worldId !== batch.worldId) {
        throw new Error('World commit contains a memory for another world.');
      }
      const key = memoryKey(memory.worldId, memory.memoryId);
      if (memoryKeys.has(key)) {
        throw new Error(
          `World operation ${batch.operationId} produced duplicate memory ID ${memory.memoryId}.`,
        );
      }
      memoryKeys.add(key);
    }

    const database = await this.database;
    const transaction = database.transaction(
      [STORES.worlds, STORES.operations, STORES.events, STORES.memories],
      'readwrite',
    );
    const completion = transactionComplete(transaction);
    const worlds = transaction.objectStore(STORES.worlds);
    const operations = transaction.objectStore(STORES.operations);
    const events = transaction.objectStore(STORES.events);
    const memories = transaction.objectStore(STORES.memories);
    const opKey = operationKey(batch.worldId, batch.operationId);

    try {
      const [prior, current, existingEvents, existingMemories] =
        await Promise.all([
          requestResult(operations.get(opKey)) as Promise<
            StoredOperation | undefined
          >,
          requestResult(worlds.get(batch.worldId)) as Promise<
            WorldState | undefined
          >,
          Promise.all(
            batch.events.map((event) =>
              requestResult(events.get(eventKey(event.worldId, event.eventId))),
            ),
          ),
          Promise.all(
            batch.memories.map((memory) =>
              requestResult(
                memories.get(memoryKey(memory.worldId, memory.memoryId)),
              ),
            ),
          ),
        ]);

      if (prior) {
        if (prior.operationFingerprint !== batch.operationFingerprint) {
          throw new Error(
            `World operation ${batch.operationId} was retried with different content.`,
          );
        }
        if (!current) {
          throw new Error(
            'Committed world operation exists without current world state.',
          );
        }

        await completion;
        const { key: _key, ...operation } = prior;
        return {
          committed: false,
          duplicate: true,
          state: structuredClone(current),
          operation: structuredClone(operation),
        };
      }

      if (!current) {
        throw new Error(`World ${batch.worldId} has not been initialized.`);
      }
      if (current.revision !== batch.expectedRevision) {
        throw new WorldRevisionConflictError(
          batch.worldId,
          batch.expectedRevision,
          current.revision,
        );
      }
      if (batch.nextState.revision !== batch.expectedRevision + 1) {
        throw new Error('World commit must advance revision by exactly one.');
      }
      if (existingEvents.some((event) => event !== undefined)) {
        throw new Error(
          'World commit contains an event ID owned by another operation.',
        );
      }
      if (existingMemories.some((memory) => memory !== undefined)) {
        throw new Error(
          'World commit contains a memory ID owned by another operation.',
        );
      }

      for (const event of batch.events) {
        events.add(toStoredEvent(event));
      }
      for (const memory of batch.memories) {
        memories.add(toStoredMemory(memory));
      }

      const nextState = structuredClone(batch.nextState);
      const operation: CommittedWorldOperation = {
        operationId: batch.operationId,
        worldId: batch.worldId,
        operationFingerprint: batch.operationFingerprint,
        committedRevision: nextState.revision,
      };

      worlds.put(nextState);
      operations.add({ ...operation, key: opKey } satisfies StoredOperation);
      await completion;

      return {
        committed: true,
        duplicate: false,
        state: structuredClone(nextState),
        operation: structuredClone(operation),
      };
    } catch (error) {
      await abortTransaction(transaction, completion);
      throw error;
    }
  }

  async get(
    worldId: string,
    eventId: string,
  ): Promise<WorldEvent | undefined> {
    const database = await this.database;
    const transaction = database.transaction(STORES.events, 'readonly');
    const completion = transactionComplete(transaction);
    const stored = (await requestResult(
      transaction
        .objectStore(STORES.events)
        .get(eventKey(worldId, eventId)),
    )) as StoredWorldEvent | undefined;
    await completion;
    return stored ? fromStoredEvent(stored) : undefined;
  }

  async history(worldId: string): Promise<WorldEvent[]> {
    const database = await this.database;
    const transaction = database.transaction(STORES.events, 'readonly');
    const completion = transactionComplete(transaction);
    const stored = (await requestResult(
      transaction
        .objectStore(STORES.events)
        .index(INDEXES.eventWorldTime)
        .getAll(worldTimeRange(worldId)),
    )) as StoredWorldEvent[];
    await completion;
    return stored.map(fromStoredEvent);
  }

  async recent(
    worldId: string,
    limit: number,
    atOrBefore?: number,
  ): Promise<WorldEvent[]> {
    validateLimit(limit, 'WorldStore recent limit');
    if (atOrBefore !== undefined && !Number.isFinite(atOrBefore)) {
      throw new Error('WorldStore recent time bound must be finite.');
    }
    if (limit === 0) return [];

    const database = await this.database;
    const transaction = database.transaction(STORES.events, 'readonly');
    const completion = transactionComplete(transaction);
    const request = transaction
      .objectStore(STORES.events)
      .index(INDEXES.eventWorldTime)
      .openCursor(worldTimeRange(worldId, atOrBefore), 'prev');
    const stored = await cursorValues<StoredWorldEvent>(request, limit);
    await completion;
    return stored.reverse().map(fromStoredEvent);
  }

  async activeSignals(worldId: string, now: number): Promise<WorldEvent[]> {
    if (!Number.isFinite(now)) {
      throw new Error('WorldStore activeSignals time must be finite.');
    }

    const database = await this.database;
    const transaction = database.transaction(STORES.events, 'readonly');
    const completion = transactionComplete(transaction);
    const range = IDBKeyRange.bound(
      [worldId, now],
      [worldId, Number.MAX_SAFE_INTEGER],
      true,
      false,
    );
    const stored = (await requestResult(
      transaction
        .objectStore(STORES.events)
        .index(INDEXES.eventWorldActiveUntil)
        .getAll(range),
    )) as StoredWorldEvent[];
    await completion;
    return stored
      .filter((event) => event.occurredAt <= now)
      .map(fromStoredEvent);
  }

  async recentForAgent(
    worldId: string,
    agentId: string,
    limit: number,
  ): Promise<MemoryRecord[]> {
    validateLimit(limit, 'WorldStore memory limit');
    if (limit === 0) return [];

    const database = await this.database;
    const transaction = database.transaction(STORES.memories, 'readonly');
    const completion = transactionComplete(transaction);
    const range = IDBKeyRange.bound(
      [worldId, agentId, Number.MIN_SAFE_INTEGER],
      [worldId, agentId, Number.MAX_SAFE_INTEGER],
    );
    const request = transaction
      .objectStore(STORES.memories)
      .index(INDEXES.memoryAgentTime)
      .openCursor(range, 'prev');
    const stored = await cursorValues<StoredMemory>(request, limit);
    await completion;
    return stored.reverse().map(fromStoredMemory);
  }

  async recentForPair(
    worldId: string,
    agentId: string,
    otherAgentId: string,
    limit: number,
  ): Promise<MemoryRecord[]> {
    validateLimit(limit, 'WorldStore memory limit');
    if (limit === 0) return [];

    const database = await this.database;
    const transaction = database.transaction(STORES.memories, 'readonly');
    const completion = transactionComplete(transaction);
    const stored = (await requestResult(
      transaction
        .objectStore(STORES.memories)
        .index(INDEXES.memoryPair)
        .getAll(pairKey(worldId, agentId, otherAgentId)),
    )) as StoredMemory[];
    await completion;
    return stored
      .sort(
        (a, b) =>
          a.createdAt - b.createdAt || a.memoryId.localeCompare(b.memoryId),
      )
      .slice(Math.max(0, stored.length - limit))
      .map(fromStoredMemory);
  }

  async historyForAgent(
    worldId: string,
    agentId: string,
  ): Promise<MemoryRecord[]> {
    const database = await this.database;
    const transaction = database.transaction(STORES.memories, 'readonly');
    const completion = transactionComplete(transaction);
    const range = IDBKeyRange.bound(
      [worldId, agentId, Number.MIN_SAFE_INTEGER],
      [worldId, agentId, Number.MAX_SAFE_INTEGER],
    );
    const stored = (await requestResult(
      transaction
        .objectStore(STORES.memories)
        .index(INDEXES.memoryAgentTime)
        .getAll(range),
    )) as StoredMemory[];
    await completion;
    return stored.map(fromStoredMemory);
  }
}

export class IndexedDbAppendOnlyLog implements AppendOnlyLog {
  constructor(private readonly database: Promise<IDBDatabase>) {}

  async read(streamId: string): Promise<string[]> {
    const database = await this.database;
    const transaction = database.transaction(
      STORES.streamRecords,
      'readonly',
    );
    const completion = transactionComplete(transaction);
    const range = IDBKeyRange.bound(
      [streamId, 0],
      [streamId, Number.MAX_SAFE_INTEGER],
    );
    const stored = (await requestResult(
      transaction
        .objectStore(STORES.streamRecords)
        .index(INDEXES.streamRecord)
        .getAll(range),
    )) as StoredStreamRecord[];
    await completion;
    return stored.map((item) => item.record);
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
      throw new Error(
        'Append-only expectedLength must be a non-negative integer.',
      );
    }
    if (!record.trim()) {
      throw new Error('Append-only record must not be empty.');
    }

    const database = await this.database;
    const transaction = database.transaction(
      [STORES.streamHeads, STORES.streamRecords],
      'readwrite',
    );
    const completion = transactionComplete(transaction);
    const heads = transaction.objectStore(STORES.streamHeads);
    const records = transaction.objectStore(STORES.streamRecords);

    try {
      const current = (await requestResult(
        heads.get(streamId),
      )) as StoredStreamHead | undefined;
      const currentLength = current?.length ?? 0;
      if (currentLength !== expectedLength) {
        throw new AppendOnlyLogConflictError(
          streamId,
          expectedLength,
          currentLength,
        );
      }

      records.add({
        key: `${streamId}::${expectedLength}`,
        streamId,
        index: expectedLength,
        record,
      } satisfies StoredStreamRecord);
      const nextLength = expectedLength + 1;
      heads.put({
        streamId,
        length: nextLength,
      } satisfies StoredStreamHead);
      await completion;
      return nextLength;
    } catch (error) {
      await abortTransaction(transaction, completion);
      throw error;
    }
  }
}

export interface IndexedDbPersistenceBundle {
  worldStore: IndexedDbWorldStore;
  controlLog: IndexedDbAppendOnlyLog;
}

export function createIndexedDbPersistence(
  databaseName = DEFAULT_AINKRAD_DATABASE_NAME,
): IndexedDbPersistenceBundle {
  const database = openDatabase(databaseName);
  return {
    worldStore: new IndexedDbWorldStore(database),
    controlLog: new IndexedDbAppendOnlyLog(database),
  };
}
