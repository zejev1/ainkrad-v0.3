import { describe, expect, it } from 'vitest';
import { WorldEngine } from '../src/world/WorldEngine';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { TERRAIN_BOUNDS } from '../src/world/geography/TerrainTypes';
import {
  WORLD_EXPLORATION_COVERAGE_ROWS,
  worldExplorationLevel,
  worldExplorationPercent,
} from '../src/presentation/WorldExplorationProgress';

const fresh = async () => (
  await WorldEngine.create({
    worldId: 'world-level-coverage',
    seed: 'world-level-coverage',
    store: new InMemoryWorldStore(),
    startTime: 0,
  })
).snapshot();

describe('0.3.22 truthful world exploration level', () => {
  it('never treats the uncapped procedural growth stage as the player world level', async () => {
    const world = await fresh();
    world.growth.stage = 172;
    const levelAt172 = worldExplorationLevel(world);
    const percentAt172 = worldExplorationPercent(world);

    world.growth.stage = 9_999;
    expect(worldExplorationLevel(world)).toBe(levelAt172);
    expect(worldExplorationPercent(world)).toBe(percentAt172);
    expect(levelAt172).toBeGreaterThanOrEqual(1);
    expect(levelAt172).toBeLessThan(100);
  });

  it('is bounded to 1..100 and reaches 100 only after every coarse planet sector has physical travel evidence', async () => {
    const world = await fresh();
    expect(worldExplorationLevel(world)).toBeLessThan(100);

    const rowHeight = (TERRAIN_BOUNDS.maxY - TERRAIN_BOUNDS.minY) /
      WORLD_EXPLORATION_COVERAGE_ROWS;
    for (let row = 0; row < WORLD_EXPLORATION_COVERAGE_ROWS; row += 1) {
      const y = TERRAIN_BOUNDS.minY + (row + 0.5) * rowHeight;
      world.routes[`coverage_${row}`] = {
        id: `coverage_${row}`,
        fromPlaceId: 'commons',
        toPlaceId: 'commons',
        waypoints: [
          { x: TERRAIN_BOUNDS.minX, y },
          { x: TERRAIN_BOUNDS.maxX, y },
        ],
        distance: TERRAIN_BOUNDS.maxX - TERRAIN_BOUNDS.minX,
        surface: 'trail',
        completedTraversals: 1,
      } as any;
    }

    expect(worldExplorationPercent(world)).toBe(100);
    expect(worldExplorationLevel(world)).toBe(100);
  });

  it('is a read-only presentation metric and does not mutate the saved world', async () => {
    const world = await fresh();
    const before = structuredClone({
      growth: world.growth,
      routes: world.routes,
      places: world.places,
      agents: world.agents,
      rng: world.determinism,
    });

    worldExplorationLevel(world);
    worldExplorationPercent(world);

    expect({
      growth: world.growth,
      routes: world.routes,
      places: world.places,
      agents: world.agents,
      rng: world.determinism,
    }).toEqual(before);
  });
});
