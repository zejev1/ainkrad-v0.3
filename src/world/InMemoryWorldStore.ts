import { stableJsonStringify } from '../core/stableJson';
import type { WorldEvent } from './events';
import type { MemoryRecord, WorldState } from './types';
import type {
  CommittedWorldOperation,
  WorldCommitBatch,
  WorldCommitResult,
  WorldStore,
} from './persistence';
import { WorldRevisionConflictError } from './persistence';

function eventKey(worldId: string, eventId: string): string {
  return `${worldId}::event::${eventId}`;
}

function memoryKey(worldId: string, memoryId: string): string {
  return `${worldId}::memory::${memoryId}`;
}

function operationKey(worldId: string, operationId: string): string {
  return `${worldId}::operation::${operationId}`;
}

function agentKey(worldId: string, agentId: string): string {
  return `${worldId}::agent::${agentId}`;
}

function pairKey(worldId: string, agentId: string, otherAgentId: string): string {
  return `${worldId}::pair::${agentId}::${otherAgentId}`;
}

function assertSame<T>(kind: string, id: string, existing: T, incoming: T): void {
  if (stableJsonStringify(existing) !== stableJsonStringify(incoming)) {
    throw new Error(`${kind} ID ${id} was reused with different content.`);
  }
}

export class InMemoryWorldStore implements WorldStore {
  private readonly worlds = new Map<string, WorldState>();
  private readonly operations = new Map<string, CommittedWorldOperation>();

  private readonly eventsById = new Map<string, WorldEvent>();
  private readonly eventsByWorld = new Map<string, WorldEvent[]>();
  private readonly signalsByWorld = new Map<string, WorldEvent[]>();

  private readonly memoriesById = new Map<string, MemoryRecord>();
  private readonly memoriesByAgent = new Map<string, MemoryRecord[]>();
  private readonly memoriesByPair = new Map<string, MemoryRecord[]>();

  async initializeWorld(state: WorldState): Promise<void> {
    const existing = this.worlds.get(state.id);
    if (existing) {
      assertSame('World initialization', state.id, existing, state);
      return;
    }

    if (!Number.isInteger(state.revision) || state.revision !== 0) {
      throw new Error('A newly initialized world must start at revision 0.');
    }

    this.worlds.set(state.id, structuredClone(state));
  }

  async loadWorld(worldId: string): Promise<WorldState | undefined> {
    const state = this.worlds.get(worldId);
    return state ? structuredClone(state) : undefined;
  }

  async committedOperation(
    worldId: string,
    operationId: string,
  ): Promise<CommittedWorldOperation | undefined> {
    const record = this.operations.get(operationKey(worldId, operationId));
    return record ? structuredClone(record) : undefined;
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

    const opKey = operationKey(batch.worldId, batch.operationId);
    const priorOperation = this.operations.get(opKey);
    if (priorOperation) {
      if (priorOperation.operationFingerprint !== batch.operationFingerprint) {
        throw new Error(
          `World operation ${batch.operationId} was retried with different content.`,
        );
      }

      const current = this.worlds.get(batch.worldId);
      if (!current) {
        throw new Error('Committed world operation exists without current world state.');
      }

      return {
        committed: false,
        duplicate: true,
        state: structuredClone(current),
        operation: structuredClone(priorOperation),
      };
    }

    const current = this.worlds.get(batch.worldId);
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

    // Preflight every append before mutating any projection. The in-memory
    // adapter therefore models the atomicity required from a persistent store.
    const batchEvents = new Map<string, WorldEvent>();
    for (const event of batch.events) {
      if (event.worldId !== batch.worldId) {
        throw new Error('World commit contains an event for another world.');
      }
      const key = eventKey(event.worldId, event.eventId);
      if (batchEvents.has(key)) {
        throw new Error(
          `World operation ${batch.operationId} produced duplicate event ID ${event.eventId}.`,
        );
      }
      if (this.eventsById.has(key)) {
        throw new Error(
          `Event ID ${event.eventId} already belongs to a different committed operation.`,
        );
      }
      batchEvents.set(key, structuredClone(event));
    }

    const batchMemories = new Map<string, MemoryRecord>();
    for (const memory of batch.memories) {
      if (memory.worldId !== batch.worldId) {
        throw new Error('World commit contains a memory for another world.');
      }
      const key = memoryKey(memory.worldId, memory.memoryId);
      if (batchMemories.has(key)) {
        throw new Error(
          `World operation ${batch.operationId} produced duplicate memory ID ${memory.memoryId}.`,
        );
      }
      if (this.memoriesById.has(key)) {
        throw new Error(
          `Memory ID ${memory.memoryId} already belongs to a different committed operation.`,
        );
      }
      batchMemories.set(key, structuredClone(memory));
    }

    // No await points below: current state + evidence + operation tombstone are
    // committed as one synchronous critical section in the reference adapter.
    for (const [key, event] of batchEvents) {
      if (this.eventsById.has(key)) {
        continue;
      }
      this.eventsById.set(key, event);
      const history = this.eventsByWorld.get(event.worldId) ?? [];
      history.push(event);
      this.eventsByWorld.set(event.worldId, history);
      if (
        event.activeUntil !== undefined ||
        event.activeUntilWorldMinutes !== undefined
      ) {
        const signals = this.signalsByWorld.get(event.worldId) ?? [];
        signals.push(event);
        this.signalsByWorld.set(event.worldId, signals);
      }
    }

    for (const [key, memory] of batchMemories) {
      if (this.memoriesById.has(key)) {
        continue;
      }
      this.memoriesById.set(key, memory);

      const aKey = agentKey(memory.worldId, memory.agentId);
      const agentHistory = this.memoriesByAgent.get(aKey) ?? [];
      agentHistory.push(memory);
      this.memoriesByAgent.set(aKey, agentHistory);

      for (const otherAgentId of memory.relatedAgentIds) {
        const pKey = pairKey(memory.worldId, memory.agentId, otherAgentId);
        const pairHistory = this.memoriesByPair.get(pKey) ?? [];
        pairHistory.push(memory);
        this.memoriesByPair.set(pKey, pairHistory);
      }
    }

    const nextState = structuredClone(batch.nextState);
    this.worlds.set(batch.worldId, nextState);

    const operation: CommittedWorldOperation = {
      operationId: batch.operationId,
      worldId: batch.worldId,
      operationFingerprint: batch.operationFingerprint,
      committedRevision: nextState.revision,
    };
    this.operations.set(opKey, operation);

    return {
      committed: true,
      duplicate: false,
      // batch.nextState remains owned by the caller; the store keeps the
      // separate clone above as its durable projection.
      state: batch.nextState,
      operation: structuredClone(operation),
    };
  }

  async get(worldId: string, eventId: string): Promise<WorldEvent | undefined> {
    const event = this.eventsById.get(eventKey(worldId, eventId));
    return event ? structuredClone(event) : undefined;
  }

  async history(worldId: string): Promise<WorldEvent[]> {
    return (this.eventsByWorld.get(worldId) ?? []).map((event) =>
      structuredClone(event),
    );
  }

  async recent(
    worldId: string,
    limit: number,
    atOrBefore?: number,
  ): Promise<WorldEvent[]> {
    if (!Number.isInteger(limit) || limit < 0) {
      throw new Error('WorldStore recent limit must be a non-negative integer.');
    }
    if (atOrBefore !== undefined && !Number.isFinite(atOrBefore)) {
      throw new Error('WorldStore recent time bound must be finite.');
    }

    const eligible = (this.eventsByWorld.get(worldId) ?? []).filter(
      (event) => atOrBefore === undefined || event.occurredAt <= atOrBefore,
    );
    return eligible
      .slice(Math.max(0, eligible.length - limit))
      .map((event) => structuredClone(event));
  }

  async activeSignals(
    worldId: string,
    now: number,
    worldMinutes?: number,
  ): Promise<WorldEvent[]> {
    if (!Number.isFinite(now)) {
      throw new Error('WorldStore activeSignals time must be finite.');
    }
    if (
      worldMinutes !== undefined &&
      (!Number.isFinite(worldMinutes) || worldMinutes < 0)
    ) {
      throw new Error(
        'WorldStore activeSignals worldMinutes must be finite and non-negative.',
      );
    }

    return (this.signalsByWorld.get(worldId) ?? [])
      .filter(
        (event) => {
          if (
            worldMinutes !== undefined &&
            event.occurredWorldMinutes !== undefined &&
            event.activeUntilWorldMinutes !== undefined
          ) {
            return (
              event.occurredWorldMinutes <= worldMinutes &&
              event.activeUntilWorldMinutes > worldMinutes
            );
          }
          return (
            event.occurredAt <= now &&
            event.activeUntil !== undefined &&
            event.activeUntil > now
          );
        },
      )
      .map((event) => structuredClone(event));
  }

  async recentForAgent(
    worldId: string,
    agentId: string,
    limit: number,
  ): Promise<MemoryRecord[]> {
    return this.tail(this.memoriesByAgent.get(agentKey(worldId, agentId)) ?? [], limit);
  }

  async recentForPair(
    worldId: string,
    agentId: string,
    otherAgentId: string,
    limit: number,
  ): Promise<MemoryRecord[]> {
    return this.tail(
      this.memoriesByPair.get(pairKey(worldId, agentId, otherAgentId)) ?? [],
      limit,
    );
  }

  async historyForAgent(worldId: string, agentId: string): Promise<MemoryRecord[]> {
    return (this.memoriesByAgent.get(agentKey(worldId, agentId)) ?? []).map(
      (memory) => structuredClone(memory),
    );
  }

  private tail(values: MemoryRecord[], limit: number): MemoryRecord[] {
    if (!Number.isInteger(limit) || limit < 0) {
      throw new Error('WorldStore memory limit must be a non-negative integer.');
    }
    return values
      .slice(Math.max(0, values.length - limit))
      .map((memory) => structuredClone(memory));
  }
}
