import type { AgentRace, WorldPoint2D, WorldState } from '../types';
import { PreparedPolygonQuery } from '../PreparedPolygonQuery';
import { continentOutline } from './ContinentalRelief';
import { hash } from './TerrainMath';
import type { TerrainFoundation } from './TerrainTypes';

type People = Exclude<AgentRace, 'human'>;
const PEOPLES: readonly People[] = ['elf', 'dwarf', 'goblin', 'orc', 'ogre'];
const cache = new WeakMap<object, { signature: string; points: Record<People, WorldPoint2D> }>();
const point = (p: { mapX: number; mapY: number }): WorldPoint2D => ({ x: p.mapX, y: p.mapY });

/** Creation only. Existing settlements and saved foundation anchors take
 * precedence in homelandCenterForWorld. No semantic RNG draws, coordinate
 * migration, discovery, camera input or Cardinal authority are involved. */
export function plannedMainlandHomeland(world: Readonly<WorldState>, race: People): WorldPoint2D {
  const occupied = Object.values(world.settlements)
    .map(town => world.places[town.centerPlaceId])
    .filter(Boolean).map(point);
  const epoch = world.epoch ?? 1;
  const signature = JSON.stringify([world.id, epoch, world.determinism.rngState, occupied]);
  const previous = cache.get(world.places);
  if (previous?.signature === signature) return { ...previous.points[race] };

  // Use the unmodified continental outline, not the position of Ainkrad plus
  // a rigid constellation. The latter pushed southern peoples beyond the
  // finite north/south edge of the continent after the F2 human relocation.
  const seed = hash(`${world.id}:terrain:${epoch}`);
  const foundation: TerrainFoundation = { version: 1, epoch, seed, key: '', anchors: [] };
  const mainland = new PreparedPolygonQuery(continentOutline(foundation));
  const unit = (suffix: string) => hash(`${signature}:${suffix}`) / 0x1_0000_0000;
  const order = [...PEOPLES].sort((a, b) => unit(`order:${a}`) - unit(`order:${b}`) || a.localeCompare(b));
  const interior = (p: WorldPoint2D) => mainland.contains(p) &&
    Array.from({ length: 16 }, (_, i) => i * Math.PI / 8).every(angle =>
      mainland.contains({ x: p.x + Math.cos(angle) * 500, y: p.y + Math.sin(angle) * 500 }));

  // Deterministic rejection sampling with bounded restarts keeps the random
  // distribution broad while respecting >= 1000 km between all foundations.
  for (let restart = 0; restart < 32; restart++) {
    const points = {} as Record<People, WorldPoint2D>;
    const used = [...occupied];
    let complete = true;
    for (const people of order) {
      let found: WorldPoint2D | undefined;
      for (let candidate = 0; candidate < 2048; candidate++) {
        const key = `${restart}:${people}:${candidate}`;
        const p = { x: -54_000 + unit(`${key}:x`) * 53_000, y: -22_000 + unit(`${key}:y`) * 45_000 };
        if (!interior(p) || used.some(other => Math.hypot(p.x - other.x, p.y - other.y) < 10_000)) continue;
        found = p;
        break;
      }
      if (!found) { complete = false; break; }
      points[people] = found;
      used.push(found);
    }
    if (complete) {
      cache.set(world.places, { signature, points });
      return { ...points[race] };
    }
  }
  throw new Error('Cannot reserve five separated mainland homelands; refusing an ocean fallback.');
}
