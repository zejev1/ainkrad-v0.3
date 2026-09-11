import { organicHomeLot, organicStreetPath } from './OrganicSettlementStreets';
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

  // A pre-existing bend may now lie inside a new building. Such a point is
  // not a mandatory street junction: remove it before detouring the segment.
  const outside=path.filter((point,index)=>index===0 || index===path.length-1 ||
    !buildings.some(place=>segmentEntersBuilding(point,point,place)));
  if(outside.length!==path.length)return routeAroundBuildings(outside,fromId,toId,places);

  // Keep every unblocked bend of the shared street. Solve only short blocked
  // segments, so a route across town does not build one quadratic city graph.
  if (path.length > 2) {
    const result: WorldPoint2D[] = [path[0]];
    for (let i=1;i<path.length;i++) {
      const piece=routeAroundBuildings([path[i-1],path[i]],fromId,toId,places);
      if(!piece)return undefined;
      result.push(...piece.slice(1));
    }
    return result;
  }

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
    const radius = i === 0 ? 0 : 0.18 * Math.sqrt(i);
    const point = {x: preferred.x + Math.cos(i * 2.399963229728653) * radius,
      y: preferred.y + Math.sin(i * 2.399963229728653) * radius};
    if (dryBuildingPlot(point, 0.06, 0.05, water) && buildings.every(p => Math.hypot(point.x - p.mapX, point.y - p.mapY) >=
      Math.SQRT2 * (0.06 + buildingRadius(p) + 0.06))) return point;
  }
  return undefined;
}

/** Stable surveyed plots and the same lane geometry used by route generation. */
export const urbanHomeLot = organicHomeLot;
export const urbanStreetPath = organicStreetPath;

export function dryBuildingPlot(point: WorldPoint2D, halfX: number, halfY: number, water: readonly WorldPlace[]): boolean {
  const corners = [-halfX, halfX].flatMap(x => [-halfY, halfY].map(y => ({x: point.x+x,y: point.y+y})));
  if ([point,...corners].some(p => insideWater(p,water))) return false;
  // Also reject a small water polygon entirely contained by the building.
  return !water.some(p => p.boundaryPolygon?.some(v => Math.abs(v.x-point.x)<=halfX && Math.abs(v.y-point.y)<=halfY));
}
export function nextUrbanHomeLot(places: Readonly<Record<string, WorldPlace>>, center: WorldPoint2D,
  settlementId: string): (WorldPoint2D & { lot: number }) | undefined {
  const all=Object.values(places);
  const used=new Set(all.filter(p=>p.settlementId===settlementId && p.urbanLayoutVersion===2 && p.urbanLot!==undefined).map(p=>p.urbanLot!));
  const buildings=all.filter(p=>buildingRadius(p)>0 && (p.urbanLayoutVersion===2 || p.kind==='library'));
  const water=all.filter(p=>p.surface==='water');
  for(let lot=0;lot<used.size+1024;lot++) {
    if(used.has(lot))continue;
    const point=urbanHomeLot(center,lot);
    if(!dryBuildingPlot(point,.06,.05,water))continue;
    if(buildings.some(p=>Math.abs(p.mapX-point.x)<buildingRadius(p)+.06+.03-1e-7 &&
      Math.abs(p.mapY-point.y)<(p.kind==='home'?.05:buildingRadius(p))+.05+.03-1e-7))continue;
    return {...point,lot};
  }
  return undefined;
}
