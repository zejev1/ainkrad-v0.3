import { describe, expect, it } from 'vitest';
import { InMemoryEventStore } from '../src/world/InMemoryEventStore';

describe('Experiment history', () => {
  it('keeps expired signals in history while removing them from active influence', async () => {
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

  it('is idempotent for exact duplicate event IDs', async () => {
    const store = new InMemoryEventStore();
    const event = {
      eventId: 'same',
      worldId: 'world_1',
      kind: 'input.agent.intent',
      source: 'agent' as const,
      occurredAt: 1,
      payload: {},
    };

    expect((await store.append(event)).appended).toBe(true);
    expect((await store.append(event)).duplicate).toBe(true);
    expect(await store.history('world_1')).toHaveLength(1);
  });
});
