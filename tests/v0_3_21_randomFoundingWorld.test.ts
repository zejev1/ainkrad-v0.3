import { describe, expect, it } from 'vitest';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WorldEngine } from '../src/world/WorldEngine';

const create = (worldId: string, seed: string) => WorldEngine.create({
  worldId,
  seed,
  store: new InMemoryWorldStore(),
  startTime: 0,
});

describe('seeded founding geography', () => {
  it('varies town position and plan between new worlds but repeats the same seed exactly', async () => {
    const first = (await create('random-foundation', 'seed-one')).snapshot();
    const repeated = (await create('random-foundation', 'seed-one')).snapshot();
    const second = (await create('another-foundation', 'seed-two')).snapshot();
    const projection = (world: typeof first) => Object.fromEntries(
      ['commons', 'workshop', 'resource_field', 'quiet_space', 'home_agent_1']
        .map((id) => [id, { x: world.places[id].mapX, y: world.places[id].mapY }]),
    );

    expect(projection(repeated)).toEqual(projection(first));
    expect(projection(second)).not.toEqual(projection(first));
    expect(first.places.commons.mapX).not.toBe(50);
    expect(first.places.commons.mapY).not.toBe(50);
    expect(first.terrain?.anchors.find((anchor) => anchor.id === 'foundation_elf')).not.toEqual(
      second.terrain?.anchors.find((anchor) => anchor.id === 'foundation_elf'),
    );
  });
});
