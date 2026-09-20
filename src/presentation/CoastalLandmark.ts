import type { WorldPlace, WorldPoint2D, WorldState } from '../world/types';
import type { TerrainModel } from '../world/geography/TerrainModel';
import { bindWorldTerrain } from '../world/geography/WorldTerrain';
import { distanceToSegment } from '../world/geography/TerrainMath';
import { boundsOf } from './MapSpatialIndex';

export interface CoastalLandmark {
  /** The saved place is the dry access point; the waterfront is on the real coast. */
  origin: WorldPoint2D;
  access: WorldPoint2D;
  beach: WorldPoint2D[];
  yard: WorldPoint2D[];
  pier: WorldPoint2D[];
  pierTip: WorldPoint2D;
  approach: WorldPoint2D[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  svg: string;
}

const cache = new WeakMap<TerrainModel, { x: number; y: number; value: CoastalLandmark | undefined }>();

/** A projection of an existing coastal site, never a geography migration.
 * The 30 m inland access point remains the route/boat-launch destination.
 * Beach, yard and pier use metres and the SAME ocean boundary as navigation.
 * One bounded entry per cached terrain; moving/zooming the camera does no survey.
 */
export function coastalLandmark(world: Readonly<WorldState>): CoastalLandmark | undefined {
  const place = world.places.rulid_shore;
  const terrain = bindWorldTerrain(world);
  if (!place || !terrain) return;
  const found = cache.get(terrain);
  if (found?.x === place.mapX && found.y === place.mapY) return found.value;
  const value = surveyCoastalLandmark(place, terrain);
  cache.set(terrain, { x: place.mapX, y: place.mapY, value });
  return value;
}

export function surveyCoastalLandmark(place: Readonly<WorldPlace>, terrain: TerrainModel): CoastalLandmark | undefined {
  const access = { x: place.mapX, y: place.mapY };
  if (terrain.sample(access.x, access.y).water) return;
  let best: { point: WorldPoint2D; normal: WorldPoint2D; distance: number } | undefined;
  for (const outline of terrain.landOutlines) for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    const near = distanceToSegment(access, a, b);
    // Existing launching approaches are bounded to 60 m, not long invented roads.
    if (near.distance > .6 || near.distance >= (best?.distance ?? Infinity)) continue;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < 1e-9) continue;
    let normal = { x: (b.y - a.y) / length, y: -(b.x - a.x) / length };
    const ahead = { x: near.point.x + normal.x * .01, y: near.point.y + normal.y * .01 };
    if (terrain.isLand(ahead)) normal = { x: -normal.x, y: -normal.y };
    const behind = { x: near.point.x - normal.x * .01, y: near.point.y - normal.y * .01 };
    if (terrain.sample(behind.x, behind.y).water) continue;
    best = { point: near.point, normal, distance: near.distance };
  }
  if (!best) return;
  const origin = best.point, normal = best.normal;
  const point = (x: number, y: number): WorldPoint2D => ({
    x: origin.x + normal.x * x - normal.y * y,
    y: origin.y + normal.y * x + normal.x * y,
  });
  const rectangle = (x0: number, y0: number, x1: number, y1: number) =>
    [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) => point(x, y));
  const beach = rectangle(-.10, -.32, -.001, .32);
  const yard = rectangle(-.14, -.25, -.025, -.10);
  const pier = rectangle(-.07, -.018, .18, .018);
  const pierTip = point(.18, 0), approach = [access, point(-.07, 0)];
  // Do not put the working yard in water or paint a dock across another island.
  if ([...beach, ...yard].some(p => terrain.sample(p.x, p.y).water) ||
      terrain.isLand(pierTip)) return;
  const bounds = boundsOf([...beach, ...yard, ...pier, access]);
  const local = (p: WorldPoint2D) => `${((p.x - bounds.minX) * 100).toFixed(5)} ${((p.y - bounds.minY) * 100).toFixed(5)}`;
  const polygon = (points: WorldPoint2D[], fill: string, extra = '') =>
    `<path d="M${points.map(local).join('L')}Z" fill="${fill}" ${extra}/>`;
  const line = (points: WorldPoint2D[], stroke: string, width: number, extra = '') =>
    `<path d="M${points.map(local).join('L')}" fill="none" stroke="${stroke}" stroke-width="${width}" ${extra}/>`;
  const svg = `<svg class="place-art rulid-harbor-art" viewBox="0 0 ${(bounds.maxX - bounds.minX) * 100} ${(bounds.maxY - bounds.minY) * 100}" aria-hidden="true">` +
    polygon(beach, '#ddcd9c', 'data-part="beach"') +
    line(approach, '#d8c7a4', 2.5, 'data-part="shore-approach"') +
    polygon(yard, '#bca17b', 'data-part="shipyard" stroke="#7a674b" stroke-width=".35"') +
    [-.22, -.18, -.14].map(y => line([point(-.13, y), point(-.035, y)], '#79674c', .65)).join('') +
    polygon(pier, '#94734e', 'data-part="pier" stroke="#53432f" stroke-width=".4"') +
    Array.from({ length: 16 }, (_, i) => line([point(-.055 + i * .015, -.017), point(-.055 + i * .015, .017)], '#bfa179', .24)).join('') +
    [-.02, .07, .16].flatMap(x => [-.022, .022].map(y => {
      const p = local(point(x, y)).split(' ');
      return `<circle cx="${p[0]}" cy="${p[1]}" r=".45" fill="#514334"/>`;
    })).join('') + '</svg>';
  return { origin, access, beach, yard, pier, pierTip, approach, bounds, svg };
}
