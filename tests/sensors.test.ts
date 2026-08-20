import { describe, expect, it } from 'vitest';
import { WorldSensors } from '../src/sensors/WorldSensors';
import { InMemoryEventStore } from '../src/world/InMemoryEventStore';
import type { WorldState } from '../src/world/types';

function emptyWorld(): WorldState {
  return {
    id: 'world_1',
    now: 1,
    revision: 0,
    rulesVersion: 'ainkrad-world-rules-0.3.3',
    environment: {
      resourcePool: 1,
      resourceRegenerationRate: 0.01,
      socialOpportunity: 0.5,
      safetySupport: 0.5,
    },
    determinism: {
      rngState: 1,
      eventSequence: 0,
    },
    agents: {},
    relationships: {},
  };
}

describe('World sensors', () => {
  it('uses world evidence without treating Cardinal output as independent evidence', async () => {
    const events = new InMemoryEventStore();

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

    const observation = await new WorldSensors(events).observe(emptyWorld(), 1);
    expect(observation.evidenceEventIds).toEqual(['agent_fact']);
    expect(observation.metrics.activeSignalCount).toBe(1);
  });

  it('does not use future events as present evidence', async () => {
    const events = new InMemoryEventStore();
    await events.append({
      eventId: 'future_fact',
      worldId: 'world_1',
      kind: 'agent.future',
      source: 'agent',
      occurredAt: 10,
      payload: {},
    });

    const observation = await new WorldSensors(events).observe(emptyWorld(), 1);
    expect(observation.evidenceEventIds).not.toContain('future_fact');
  });
});

describe('Sensor snapshot time integrity', () => {
  it('rejects mixing a current snapshot with a different observation time', async () => {
    const events = new InMemoryEventStore();
    await expect(new WorldSensors(events).observe(emptyWorld(), 2)).rejects.toThrow();
  });
});
