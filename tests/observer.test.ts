import { describe, expect, it } from 'vitest';
import { CardinalCore } from '../src/cardinal/CardinalCore';
import { InMemoryCardinalJournal } from '../src/cardinal/InMemoryCardinalJournal';
import { CardinalObserver } from '../src/cardinal/CardinalObserver';
import { CardinalRuntime } from '../src/cardinal/CardinalRuntime';
import { WorldSensors } from '../src/sensors/WorldSensors';
import { InMemoryEventStore } from '../src/world/InMemoryEventStore';
import { InMemoryMemoryStore } from '../src/world/InMemoryMemoryStore';
import { WorldEngine } from '../src/world/WorldEngine';

describe('Cardinal Observer', () => {
  it('does not mutate the autonomous world', async () => {
    const eventStore = new InMemoryEventStore();
    const world = new WorldEngine({
      worldId: 'world_1',
      seed: 'observer-test',
      eventStore,
      memoryStore: new InMemoryMemoryStore(),
      startTime: 0,
    });

    await world.step(1);
    const before = world.snapshot();

    const runtime = new CardinalRuntime(
      new CardinalObserver(new WorldSensors(eventStore)),
      new CardinalCore(),
      new InMemoryCardinalJournal(),
    );

    await runtime.cycle('observer', before, 1);
    expect(world.snapshot()).toEqual(before);
  });
});
