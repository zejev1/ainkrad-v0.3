import { describe, expect, it } from 'vitest';
import { InMemoryMemoryStore } from '../src/world/InMemoryMemoryStore';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WorldEngine } from '../src/world/WorldEngine';

describe('Long-term memory storage', () => {
  it('keeps memory history outside the hot world snapshot', async () => {
    const store = new InMemoryWorldStore();
    const world = await WorldEngine.create({
      worldId: 'memory-world',
      seed: 'memory-seed',
      store,
      startTime: 0,
    });

    for (let tick = 1; tick <= 20; tick += 1) {
      await world.step(tick);
    }

    expect('memories' in world.snapshot()).toBe(false);
    const histories = await Promise.all(
      Object.keys(world.snapshot().agents).map((agentId) =>
        store.historyForAgent('memory-world', agentId),
      ),
    );
    expect(histories.some((history) => history.length > 0)).toBe(true);
  });

  it('treats an exact retry as idempotent and scopes IDs by world', async () => {
    const store = new InMemoryMemoryStore();
    const base = {
      memoryId: 'memory_1',
      agentId: 'agent_1',
      createdAt: 1,
      kind: 'interaction' as const,
      summary: 'Met another agent.',
      importance: 0.5,
      valence: 0.1,
      relatedAgentIds: ['agent_2'],
    };

    const first = await store.append({ ...base, worldId: 'world_1' });
    const retry = await store.append({ ...base, worldId: 'world_1' });
    const otherWorld = await store.append({ ...base, worldId: 'world_2' });

    expect(first.appended).toBe(true);
    expect(retry.duplicate).toBe(true);
    expect(otherWorld.appended).toBe(true);
    expect(await store.historyForAgent('world_1', 'agent_1')).toHaveLength(1);
    expect(await store.historyForAgent('world_2', 'agent_1')).toHaveLength(1);
  });
});
