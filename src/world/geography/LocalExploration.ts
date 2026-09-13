import type { AgentState, WorldBiome, WorldPoint2D, WorldState } from '../types';
import { bindWorldTerrain } from './WorldTerrain';
import { nearestRiverPoint } from './RiverCourses';
import { distanceToSegment, hash } from './TerrainMath';

/** Survey the ground that exists, including the accessible bank, never create
 * a desired biome or move the coast to suit an exploration script. */
export function localTerrainBiome(world: Readonly<WorldState>, point: WorldPoint2D): WorldBiome | undefined {
  const model = bindWorldTerrain(world);
  if (!model) return undefined;
  const sample = model.sample(point.x, point.y);
  if (sample.water) return undefined;
  const box = { minX: point.x - 1, minY: point.y - 1, maxX: point.x + 1, maxY: point.y + 1 };
  for (const anchor of model.anchors.query(box)) {
    if (anchor.kind !== 'lake' || !anchor.water) continue;
    if (anchor.water.some((p, i, polygon) => distanceToSegment(point, p, polygon[(i + 1) % polygon.length]).distance < 0.4)) return 'lake';
  }
  for (const river of model.rivers.query(box)) {
    if (nearestRiverPoint(point, river).distance < river.width + 0.4) return 'river';
  }
  if (model.landOutlines.some(outline=>outline.some((p, i, polygon) => distanceToSegment(point, p, polygon[(i + 1) % polygon.length]).distance < 0.6))) return 'coast';
  return sample.biome;
}

/** A bounded local survey in all directions from the explorer's actual
 * position. Different agents/attempts choose different bearings. It cannot
 * jump to a remote forest, know undiscovered deposits, or cross open water. */
export function localSurveySite(world: Readonly<WorldState>, explorer: Readonly<AgentState>, sequence: number, roll: number) {
  const model = bindWorldTerrain(world);
  if (!model || explorer.movement) return undefined;
  const origin = explorer.position;
  const angleOffset = (hash(`${world.terrain?.seed}:${explorer.id}:${sequence}`) / 0x1_0000_0000 + roll) * Math.PI * 2;
  const nearby = Object.values(world.places).filter(p => p.surface !== 'water' && Math.hypot(p.mapX - origin.x, p.mapY - origin.y) < 10);
  for (const radius of [1.2, 2.4, 4.8, 8]) {
    const choices = [];
    for (let index = 0; index < 24; index++) {
      const angle = angleOffset + index * Math.PI / 12;
      const point = { x: origin.x + Math.cos(angle) * radius, y: origin.y + Math.sin(angle) * radius };
      if (nearby.some(p => Math.hypot(p.mapX - point.x, p.mapY - point.y) < 0.9)) continue;
      const biome = localTerrainBiome(world, point);
      if (!biome) continue;
      // The initial sight/survey line must stay on land. Navigation later
      // computes the real obstacle-avoiding route and charges walking time.
      let dry = true;
      for (let j = 1; j <= Math.ceil(radius / 0.1); j++) {
        const t = j / Math.ceil(radius / 0.1);
        if (model.sample(origin.x + (point.x - origin.x) * t, origin.y + (point.y - origin.y) * t).water) { dry = false; break; }
      }
      if (!dry || !model.isLand(point)) continue;
      const useful = biome === 'forest' ? (1 - explorer.resources) * 0.25 : ['coast', 'river', 'lake'].includes(biome) ? 0.18 : 0;
      const weight = 1 + useful + explorer.personality.curiosity * (index % 3) * 0.08;
      choices.push({ ...point, biome, connections: [explorer.locationId], weight });
    }
    if (choices.length) {
      let pick = roll * choices.reduce((sum, p) => sum + p.weight, 0);
      return choices.find(p => (pick -= p.weight) <= 0) ?? choices[choices.length - 1];
    }
  }
  return undefined;
}
