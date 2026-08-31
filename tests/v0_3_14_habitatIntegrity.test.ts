import { describe, expect, it } from 'vitest';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WorldEngine } from '../src/world/WorldEngine';

describe('v0.3.14 habitat integrity long-run audit', () => {
  it('never recovers wildlife or monsters in incompatible city/water habitats', async () => {
    const store = new InMemoryWorldStore();
    const world = await WorldEngine.create({
      worldId: 'v14-habitat', seed: 'v14-habitat', store,
      agentNames: Array.from({ length: 24 }, (_, i) => `Explorer ${i + 1}`),
    });
    for (let tick = 1; tick <= 900; tick += 1) await world.step(tick);
    const snapshot = world.snapshot();
    const allowed: Record<string, string[]> = {
      rabbit: ['plains', 'forest'], deer: ['plains', 'forest'], fish: ['coast', 'lake', 'river'],
      boar: ['forest', 'plains', 'swamp'], wolf: ['forest', 'mountains', 'plains'], bird: ['plains', 'forest', 'coast'],
      dire_wolf: ['forest', 'mountains', 'ancient_ruins'], ogre: ['swamp', 'mountains', 'ancient_ruins'], wraith: ['ancient_ruins', 'swamp'],
    };
    for (const population of Object.values(snapshot.wildlife)) {
      if (population.count <= 0) continue;
      const habitat = snapshot.places[population.habitatId];
      expect(allowed[population.species]).toContain(habitat.biome);
      expect(habitat.biome).not.toBe('settlement');
      if (population.species === 'fish') expect(['shore', 'water']).toContain(habitat.surface);
      else expect(habitat.surface).toBe('land');
    }
  }, 60_000);
});
