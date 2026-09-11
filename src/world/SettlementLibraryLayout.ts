import { buildingRadius, insideWater, dryBuildingPlot } from './SettlementStreets';
import type { WorldPlace, WorldPoint2D } from './types';

/** A library is a 16m building in its own town, not a kilometre-wide map icon.
 * Reserve a real plot with at least 6m to neighbouring buildings. The first
 * plot leaves a 10m approach north of the 16m square. No terrain is moved. */
export function compactLibraryPlot(
  places: Readonly<Record<string, WorldPlace>>,
  center: WorldPoint2D,
  libraryId: string,
): WorldPoint2D | undefined {
  const all = Object.values(places);
  const buildings = all.filter(p => p.id !== libraryId && buildingRadius(p) > 0);
  const water = all.filter(p => p.surface === 'water');
  for (let row = 0; row < 9; row++) {
    for (const column of [0, -1, 1, -2, 2, -3, 3, -4, 4]) {
      const point = { x: center.x + column * 0.22, y: center.y - 0.26 - row * 0.22 };
      const corners = [-0.08, 0.08].flatMap(x => [-0.08, 0.08].map(y => ({x: point.x + x, y: point.y + y})));
      if (!dryBuildingPlot(point, 0.08, 0.08, water)) continue;
      if (buildings.some(p => Math.abs(p.mapX - point.x) < buildingRadius(p) + 0.08 + 0.06 - 1e-7 &&
        Math.abs(p.mapY - point.y) < (p.kind === 'home' ? 0.05 : buildingRadius(p)) + 0.08 + 0.06 - 1e-7)) continue;
      return point;
    }
  }
  return undefined;
}
