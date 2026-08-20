import type { MemoryRecord } from './types';

export interface AppendMemoryResult {
  appended: boolean;
  duplicate: boolean;
}

export interface MemoryReader {
  recentForAgent(
    worldId: string,
    agentId: string,
    limit: number,
  ): Promise<MemoryRecord[]>;

  recentForPair(
    worldId: string,
    agentId: string,
    otherAgentId: string,
    limit: number,
  ): Promise<MemoryRecord[]>;

  historyForAgent(worldId: string, agentId: string): Promise<MemoryRecord[]>;
}

export interface MemoryWriter {
  append(memory: MemoryRecord): Promise<AppendMemoryResult>;
}

export interface MemoryStore extends MemoryReader, MemoryWriter {}
