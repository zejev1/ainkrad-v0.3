import { describe, expect, it } from 'vitest';
import { InMemoryEventStore } from '../src/world/InMemoryEventStore';

describe('Experiment history', () => {
  it('keeps expired signals in history while removing them from current influence', async () => {
    const store = new InMemoryEventStore();

    await store.append({
      eventId: 'signal_1',
      worldId: 'world_1',
      kind: 'test.signal',
      source: 'world',
      occurredAt: 1,
      activeUntil: 5,
      payload: {},
    });

    expect(await store.activeSignals('world_1', 3)).toHaveLength(1);
    expect(await store.activeSignals('world_1', 6)).toHaveLength(0);
    expect(await store.history('world_1')).toHaveLength(1);
  });

  it('does not expose a signal before its occurrence time', async () => {
    const store = new InMemoryEventStore();
    await store.append({
      eventId: 'future_signal',
      worldId: 'world_1',
      kind: 'test.signal',
      source: 'world',
      occurredAt: 10,
      activeUntil: 20,
      payload: {},
    });

    expect(await store.activeSignals('world_1', 5)).toHaveLength(0);
    expect(await store.activeSignals('world_1', 15)).toHaveLength(1);
  });

  it('keeps read-only temporal queries reversible instead of compacting on observation', async () => {
    const store = new InMemoryEventStore();
    await store.append({
      eventId: 'signal_1',
      worldId: 'world_1',
      kind: 'test.signal',
      source: 'world',
      occurredAt: 1,
      activeUntil: 10,
      payload: {},
    });

    expect(await store.activeSignals('world_1', 20)).toHaveLength(0);
    expect(await store.activeSignals('world_1', 5)).toHaveLength(1);
  });

  it('does not treat ordinary historical events as permanently active signals', async () => {
    const store = new InMemoryEventStore();
    await store.append({
      eventId: 'history_1',
      worldId: 'world_1',
      kind: 'agent.explored',
      source: 'agent',
      occurredAt: 1,
      payload: {},
    });

    expect(await store.activeSignals('world_1', 100)).toHaveLength(0);
    expect(await store.history('world_1')).toHaveLength(1);
  });

  it('is idempotent for exact duplicate event IDs even if payload key order changes', async () => {
    const store = new InMemoryEventStore();
    const first = {
      eventId: 'same',
      worldId: 'world_1',
      kind: 'input.agent.intent',
      source: 'agent' as const,
      occurredAt: 1,
      payload: { a: 1, b: 2 },
    };
    const retry = {
      ...first,
      payload: { b: 2, a: 1 },
    };

    expect((await store.append(first)).appended).toBe(true);
    expect((await store.append(retry)).duplicate).toBe(true);
    expect(await store.history('world_1')).toHaveLength(1);
  });

  it('scopes event identity by world', async () => {
    const store = new InMemoryEventStore();
    for (const worldId of ['world_1', 'world_2']) {
      await store.append({
        eventId: 'shared_input_id',
        worldId,
        kind: 'input.agent.intent',
        source: 'agent',
        occurredAt: 1,
        payload: {},
      });
    }

    expect(await store.history('world_1')).toHaveLength(1);
    expect(await store.history('world_2')).toHaveLength(1);
  });
});
