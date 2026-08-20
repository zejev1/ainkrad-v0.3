import type { MemoryStore } from './memory';
import type { MemoryRecord } from './types';

function pairIndexKey(worldId: string, agentId: string, otherAgentId: string): string {
  return `${worldId}::${agentId}::${otherAgentId}`;
}

function agentIndexKey(worldId: string, agentId: string): string {
  return `${worldId}::${agentId}`;
}

export class InMemoryMemoryStore implements MemoryStore {
  private readonly ids = new Set<string>();
  private readonly byAgent = new Map<string, MemoryRecord[]>();
  private readonly byPair = new Map<string, MemoryRecord[]>();

  async append(memory: MemoryRecord): Promise<void> {
    if (this.ids.has(memory.memoryId)) {
      throw new Error(`Duplicate memory ID: ${memory.memoryId}`);
    }

    const stored = structuredClone(memory);
    this.ids.add(stored.memoryId);

    const agentKey = agentIndexKey(stored.worldId, stored.agentId);
    const agentHistory = this.byAgent.get(agentKey) ?? [];
    agentHistory.push(stored);
    this.byAgent.set(agentKey, agentHistory);

    for (const otherAgentId of stored.relatedAgentIds) {
      const pairKey = pairIndexKey(stored.worldId, stored.agentId, otherAgentId);
      const pairHistory = this.byPair.get(pairKey) ?? [];
      pairHistory.push(stored);
      this.byPair.set(pairKey, pairHistory);
    }
  }

  async recentForAgent(
    worldId: string,
    agentId: string,
    limit: number,
  ): Promise<MemoryRecord[]> {
    return this.tail(this.byAgent.get(agentIndexKey(worldId, agentId)) ?? [], limit);
  }

  async recentForPair(
    worldId: string,
    agentId: string,
    otherAgentId: string,
    limit: number,
  ): Promise<MemoryRecord[]> {
    return this.tail(
      this.byPair.get(pairIndexKey(worldId, agentId, otherAgentId)) ?? [],
      limit,
    );
  }

  async historyForAgent(worldId: string, agentId: string): Promise<MemoryRecord[]> {
    return (this.byAgent.get(agentIndexKey(worldId, agentId)) ?? []).map((memory) =>
      structuredClone(memory),
    );
  }

  private tail(values: MemoryRecord[], limit: number): MemoryRecord[] {
    if (!Number.isInteger(limit) || limit < 0) {
      throw new Error('Memory query limit must be a non-negative integer.');
    }

    return values
      .slice(Math.max(0, values.length - limit))
      .map((memory) => structuredClone(memory));
  }
}
