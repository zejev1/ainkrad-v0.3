import type { WorldPlace, WorldPoint2D } from './types';

// Map unit = 100 metres. Homes are 12 x 10m; ordinary lanes 6m, main street 10m.
export const STREET_CLEARANCE = 0.015;
export function buildingRadius(place: Pick<WorldPlace, 'kind'>): number {
  return place.kind === 'home' ? 0.06 :
    place.kind === 'workshop' || place.kind === 'library' ? 0.08 : 0;
}

export function segmentEntersBuilding(a: WorldPoint2D, b: WorldPoint2D, place: WorldPlace): boolean {
  let enter = 0, leave = 1;
  for (const [origin, delta, center, half] of [[a.x, b.x - a.x, place.mapX, buildingRadius(place)], [a.y, b.y - a.y, place.mapY, place.kind === 'home' ? 0.05 : buildingRadius(place)]]) {
    const r = half + STREET_CLEARANCE - 1e-6;
    if (Math.abs(delta) < 1e-10) {
      if (origin <= center - r || origin >= center + r) return false;
    } else {
      const t1 = (center - r - origin) / delta, t2 = (center + r - origin) / delta;
      enter = Math.max(enter, Math.min(t1, t2));
      leave = Math.min(leave, Math.max(t1, t2));
      if (leave <= enter) return false;
    }
  }
  return leave > enter;
}

/** Local walking routes pass through gaps, never through somebody else's house. */
export function routeAroundBuildings(
  path: WorldPoint2D[], fromId: string, toId: string, places: Readonly<Record<string, WorldPlace>>,
): WorldPoint2D[] | undefined {
  const minX = Math.min(...path.map(p => p.x)) - 0.12, maxX = Math.max(...path.map(p => p.x)) + 0.12;
  const minY = Math.min(...path.map(p => p.y)) - 0.12, maxY = Math.max(...path.map(p => p.y)) + 0.12;
  const buildings = Object.values(places).filter(p => p.id !== fromId && p.id !== toId && buildingRadius(p) > 0 &&
    p.mapX >= minX && p.mapX <= maxX && p.mapY >= minY && p.mapY <= maxY);
  const clear = (a: WorldPoint2D, b: WorldPoint2D) => !buildings.some(p => segmentEntersBuilding(a, b, p));
  if (path.slice(1).every((p, i) => clear(path[i], p))) return path;

  // Visibility graph around the real plots. Only a blocked local route pays
  // for this search; existing unblocked terrain paths retain their shape.
  const nodes = [path[0], path.at(-1)!, ...buildings.flatMap(p => {
    const r = buildingRadius(p) + STREET_CLEARANCE;
    return [-1, 1].flatMap(x => [-1, 1].map(y => ({x: p.mapX + x * r, y: p.mapY + y * r})));
  })];
  const distances = nodes.map(() => Infinity), prior = nodes.map(() => -1), visited = new Set<number>();
  distances[0] = 0;
  while (visited.size < nodes.length) {
    let next = -1;
    for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && (next < 0 || distances[i] < distances[next])) next = i;
    if (next < 0 || !Number.isFinite(distances[next])) return undefined;
    if (next === 1) {
      const result: WorldPoint2D[] = [];
      for (let i = 1; i >= 0; i = prior[i]) result.push(nodes[i]);
      return result.reverse();
    }
    visited.add(next);
    for (let i = 0; i < nodes.length; i++) {
      if (visited.has(i)) continue;
      const distance = distances[next] + Math.hypot(nodes[next].x - nodes[i].x, nodes[next].y - nodes[i].y);
      if (distance < distances[i] && clear(nodes[next], nodes[i])) { distances[i] = distance; prior[i] = next; }
    }
  }
  return undefined;
}

export function insideWater(point: WorldPoint2D, water: readonly WorldPlace[]): boolean {
  return water.some(place => {
    const polygon = place.boundaryPolygon;
    if (!polygon) return false;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j];
      if ((a.y > point.y) !== (b.y > point.y) &&
        point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  });
}

/** Reserve a vacant plot when residents themselves choose to build a home. */
export function vacantHomePlot(places: Readonly<Record<string, WorldPlace>>, preferred: WorldPoint2D): WorldPoint2D | undefined {
  const buildings = Object.values(places).filter(p => buildingRadius(p) > 0);
  const water = Object.values(places).filter(p => p.surface === 'water');
  // Bounded local survey, not an uninterruptible search on a crowded planet.
  for (let i = 0; i < 512; i++) {
    const radius = i === 0 ? 0 : 0.9 * Math.sqrt(i);
    const point = {x: preferred.x + Math.cos(i * 2.399963229728653) * radius,
      y: preferred.y + Math.sin(i * 2.399963229728653) * radius};
    if (!insideWater(point, water) && buildings.every(p => Math.hypot(point.x - p.mapX, point.y - p.mapY) >=
      Math.SQRT2 * (0.06 + buildingRadius(p) + 0.06))) return point;
  }
  return undefined;
}

/** Each block has a central 10m street; neighbouring houses leave 6m lanes. */
export function urbanHomeLot(center: WorldPoint2D, lot: number): WorldPoint2D {
  const block = Math.floor(lot / 48), cell = lot % 48;
  // Expand districts sideways, keeping their north edge connected to the town.
  const district = block === 0 ? 0 : Math.ceil(block / 2) * (block % 2 ? 1 : -1);
  const column = cell % 8, row = Math.floor(cell / 8);
  return { x: center.x + district * 1.48 + (column - 3.5) * 0.18 + (column >= 4 ? 0.02 : -0.02),
    y: center.y + 0.34 + row * 0.16 };
}

export function nextUrbanHomeLot(places: Readonly<Record<string, WorldPlace>>, center: WorldPoint2D,
  settlementId: string): (WorldPoint2D & { lot: number }) | undefined {
  const all = Object.values(places);
  const used = new Set(all.filter(p => p.settlementId === settlementId).map(p => p.urbanLot));
  const buildings = all.filter(p => buildingRadius(p) > 0 && p.urbanLayoutVersion === 1);
  const water = all.filter(p => p.surface === 'water');
  for (let lot = 0; lot < used.size + 1024; lot++) {
    if (used.has(lot)) continue;
    const point = urbanHomeLot(center, lot);
    if (insideWater(point, water)) continue;
    if (buildings.some(p => Math.abs(p.mapX - point.x) < buildingRadius(p) + 0.06 + 0.04 - 1e-7 &&
      Math.abs(p.mapY - point.y) < (p.kind === 'home' ? 0.05 : buildingRadius(p)) + 0.05 + 0.04 - 1e-7)) continue;
    return { ...point, lot };
  }
  return undefined;
}

/** Street junctions shared by house routes, with doors opening onto the lane. */
export function urbanStreetPath(from: Readonly<WorldPlace>, to: Readonly<WorldPlace>,
  places: Readonly<Record<string, WorldPlace>>): WorldPoint2D[] | undefined {
  if (!from.settlementId || from.settlementId !== to.settlementId) return undefined;
  if (from.urbanLot === undefined && to.urbanLot === undefined) return undefined;
  const center = Object.values(places).find(p => p.settlementId === from.settlementId &&
    ['commons', 'city', 'village'].includes(p.kind));
  if (!center) return undefined;
  const approach = (p: Readonly<WorldPlace>): WorldPoint2D[] => {
    const start = { x: p.mapX, y: p.mapY };
    if (p.urbanLot === undefined) return [start, { x: center.mapX, y: center.mapY }];
    const block = Math.floor(p.urbanLot / 48);
    const district = block === 0 ? 0 : Math.ceil(block / 2) * (block % 2 ? 1 : -1);
    const streetX = center.mapX + district * 1.48;
    return [start, { x: p.mapX, y: p.mapY - 0.08 }, { x: streetX, y: p.mapY - 0.08 },
      { x: streetX, y: center.mapY }, { x: center.mapX, y: center.mapY }];
  };
  const a = approach(from), b = approach(to);
  // Strip the common tail so neighbours do not detour to the town square.
  while (a.length > 1 && b.length > 1 && Math.hypot(a.at(-2)!.x - b.at(-2)!.x, a.at(-2)!.y - b.at(-2)!.y) < 1e-8) {
    a.pop(); b.pop();
  }
  return [...a, ...b.reverse().slice(1)].filter((p, i, path) => i === 0 || Math.hypot(p.x - path[i-1].x, p.y - path[i-1].y) > 1e-8);
}
