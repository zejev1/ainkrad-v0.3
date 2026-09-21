import type { TerrainModel } from '../../geography/TerrainModel';
import { pointInPolygon } from '../../BuildingFootprints';
import { terrainGridPoint } from '../../geography/DrainageNetwork';
import { TERRAIN_BOUNDS as B, TERRAIN_GRID as N } from '../../geography/TerrainTypes';
import { WATER_CALIBRATION as C } from './HydrologyKnowledge';
import type { WaterUnitSpec } from './HydrologyModel';

export interface HydrologyTopology {
  specs: readonly WaterUnitSpec[];
  cellBasins: readonly string[];
  basinAt(x: number, y: number): string | undefined;
}
const cache = new WeakMap<TerrainModel, HydrologyTopology>();
/** Partition the existing drainage tree, not a newly invented river map.
 * 25,921 cells are visited only at terrain adoption. Small independent coastal
 * outlets share an ocean-bound aggregate; no inland edges are merged cyclically. */
export function hydrologyTopology(terrain: TerrainModel): HydrologyTopology {
  const cached = cache.get(terrain); if (cached) return cached;
  const { land, heights, drainageParent: parent } = terrain;
  const order = Array.from(land.keys()).filter(i => land[i]).sort((a, b) => heights[b] - heights[a] || a - b);
  const size = new Uint32Array(N * N), outlets = new Map<number, string>();
  for (const i of order) {
    size[i]++;
    const p = parent[i], ocean = p < 0 || !land[p];
    if (ocean || size[i] >= C.catchmentCells) {
      const id = ocean ? `coast:${Math.floor(i % N / 12)}:${Math.floor(Math.floor(i / N) / 12)}` : `basin:${i}`;
      outlets.set(i, id);
    } else size[p] += size[i];
  }
  const cellBasins = new Array<string>(N * N).fill('');
  for (let n = order.length - 1; n >= 0; n--) {
    const i = order[n]; cellBasins[i] = outlets.get(i) ?? cellBasins[parent[i]];
    if (!cellBasins[i]) throw new Error('Unresolved physical drainage cell');
  }
  const cellArea = (B.maxX - B.minX) * (B.maxY - B.minY) / ((N - 1) ** 2) * 10_000;
  const specs = new Map<string, WaterUnitSpec>();
  const counts = new Map<string, number>();
  for (const i of order) {
    const id = cellBasins[i], p = terrainGridPoint(i);
    let spec = specs.get(id);
    if (!spec) { spec = { id, kind: 'catchment', x: 0, y: 0, elevationM: 0, areaM2: 0, moisture: 0,
      slope: 0, soilCapacityMm: C.soilCapacityMm, surfaceAreaM2: 0, bankfullM3: 0, residenceDays: 2.5 }; specs.set(id, spec); }
    spec.x += p.x; spec.y += p.y; spec.elevationM += heights[i]; spec.areaM2 += cellArea;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  for (const [i, id] of outlets) {
    const p = parent[i];
    if (p >= 0 && land[p]) specs.get(id)!.downstream = cellBasins[p];
  }
  for (const spec of specs.values()) {
    const count = counts.get(spec.id)!; spec.x /= count; spec.y /= count; spec.elevationM /= count;
    const sample = terrain.sample(spec.x, spec.y, false);
    spec.moisture = sample.moisture; spec.slope = Math.min(1, sample.slope);
    spec.surfaceAreaM2 = spec.areaM2 * 0.003;
    spec.bankfullM3 = spec.surfaceAreaM2 * 1.5;
  }
  // Authorized offshore geography is represented only after it exists.
  for (const island of terrain.foundation.offshore ?? []) {
    const areaM2 = Math.abs(island.outline.reduce((n, p, i, a) => n + p.x * a[(i+1)%a.length].y - a[(i+1)%a.length].x * p.y, 0)) * 5000;
    const p = island.center, sample = terrain.sample(p.x, p.y, false);
    specs.set(`island:${island.id}`, { id: `island:${island.id}`, kind: 'catchment', ...p,
      elevationM: sample.height, moisture: sample.moisture, slope: Math.min(1, sample.slope), areaM2,
      soilCapacityMm: C.soilCapacityMm, surfaceAreaM2: areaM2 * 0.003, bankfullM3: areaM2 * 0.0045, residenceDays: 2.5 });
  }
  const result: HydrologyTopology = { specs: [...specs.values()].sort((a,b) => a.id.localeCompare(b.id)), cellBasins,
    basinAt(x, y) {
      const island = terrain.foundation.offshore?.find(p => Math.abs(x-p.center.x)<=p.radius && Math.abs(y-p.center.y)<=p.radius && pointInPolygon({x,y},p.outline));
      if (island) return `island:${island.id}`;
      const gx = Math.max(0, Math.min(N-1, Math.round((x-B.minX)/(B.maxX-B.minX)*(N-1))));
      const gy = Math.max(0, Math.min(N-1, Math.round((y-B.minY)/(B.maxY-B.minY)*(N-1))));
      if (cellBasins[gy*N+gx]) return cellBasins[gy*N+gx];
      // A surveyed coastal plot can lie between coarse grid centres.
      for (let radius=1; radius<=3; radius++) for (let dy=-radius;dy<=radius;dy++) for(let dx=-radius;dx<=radius;dx++) {
        const a=gx+dx,b=gy+dy;if(a>=0&&b>=0&&a<N&&b<N&&cellBasins[b*N+a])return cellBasins[b*N+a];
      }
      return undefined;
    } };
  cache.set(terrain, result); return result;
}
