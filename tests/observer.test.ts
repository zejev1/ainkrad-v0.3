import { describe, expect, it } from 'vitest';
import { CardinalCore } from '../src/cardinal/CardinalCore';
import { InMemoryCardinalJournal } from '../src/cardinal/InMemoryCardinalJournal';
import { CardinalObserver } from '../src/cardinal/CardinalObserver';
import { CardinalRuntime } from '../src/cardinal/CardinalRuntime';
import { WorldSensors } from '../src/sensors/WorldSensors';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WorldEngine } from '../src/world/WorldEngine';

describe('Cardinal Observer', () => {
  it('does not mutate the autonomous world', async () => {
    const store = new InMemoryWorldStore();
    const world = await WorldEngine.create({
      worldId: 'world_1',
      seed: 'observer-test',
      store,
      startTime: 0,
    });

    await world.step(1);
    const before = world.snapshot();

    const runtime = new CardinalRuntime(
      new CardinalObserver(new WorldSensors(store)),
      new CardinalCore(),
      new InMemoryCardinalJournal(),
    );

    await runtime.cycle('observer', before, 1);
    expect(world.snapshot()).toEqual(before);
  });
});
