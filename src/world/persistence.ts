import type { EventReader, WorldEvent } from './events';
import type { MemoryReader } from './memory';
import type { MemoryRecord, WorldState } from './types';

export interface CommittedWorldOperation {
  operationId: string;
  worldId: string;
  operationFingerprint: string;
  committedRevision: number;
}

export interface WorldCommitBatch {
  operationId: string;
  operationFingerprint: string;
  worldId: string;
  expectedRevision: number;
  nextState: WorldState;
  events: WorldEvent[];
  memories: MemoryRecord[];
}

export interface WorldCommitResult {
  committed: boolean;
  duplicate: boolean;
  state: WorldState;
  operation: CommittedWorldOperation;
}

/**
 * Persistence boundary for one autonomous world.
 *
 * A future database adapter must implement commit() as one atomic transaction
 * across the current world projection, append-only events, memories and the
 * operation-deduplication record (or an equivalent recoverable protocol).
 *
 * WorldEngine stages a whole logical operation before calling commit(). It must
 * never write current state first and historical evidence later.
 */
export interface WorldStore extends EventReader, MemoryReader {
  initializeWorld(state: WorldState): Promise<void>;
  loadWorld(worldId: string): Promise<WorldState | undefined>;
  committedOperation(
    worldId: string,
    operationId: string,
  ): Promise<CommittedWorldOperation | undefined>;
  commit(batch: WorldCommitBatch): Promise<WorldCommitResult>;
}

export class WorldRevisionConflictError extends Error {
  constructor(
    readonly worldId: string,
    readonly expectedRevision: number,
    readonly actualRevision: number,
  ) {
    super(
      `World ${worldId} revision conflict: expected ${expectedRevision}, actual ${actualRevision}.`,
    );
    this.name = 'WorldRevisionConflictError';
  }
}
