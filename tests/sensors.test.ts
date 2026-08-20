import { describe, expect, it } from 'vitest';
import { WorldSensors } from '../src/sensors/WorldSensors';
import { InMemoryEventStore } from '../src/world/InMemoryEventStore';
import { InMemoryMemoryStore } from '../src/world/InMemoryMemoryStore';
import { WorldEngine } from '../src/world/WorldEngine';

describe('World sensors', () => {
  it('uses world evidence without treating Cardinal output as independent evidence', async () => {
    const events = new InMemoryEventStore();
    const world = new WorldEngine({
      worldId: 'world_1',
      seed: 'sensor',
      eventStore: events,
      memoryStore: new InMemoryMemoryStore(),
      agentNames: [],
      startTime: 0,
    });

    await events.append({
      eventId: 'agent_fact',
      worldId: 'world_1',
      kind: 'agent.test',
      source: 'agent',
      occurredAt: 1,
      payload: {},
    });
    await events.append({
      eventId: 'cardinal_action',
      worldId: 'world_1',
      kind: 'cardinal.effect.open_shared_space',
      source: 'cardinal',
      occurredAt: 1,
      activeUntil: 5,
      payload: { magnitude: 0.1 },
    });

    const observation = await new WorldSensors(events).observe(world.snapshot(), 1);
    expect(observation.evidenceEventIds).toEqual(['agent_fact']);
    expect(observation.metrics.activeSignalCount).toBe(1);
  });
});
