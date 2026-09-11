import { routeAroundBuildings, urbanStreetPath } from './SettlementStreets';
import type {
  WorldPlace,
  WorldPoint2D,
  WorldRouteState,
  WorldSurfaceKind,
  WorldTraversalKind,
} from './types';

const WALKABLE_SURFACES = new Set<WorldSurfaceKind>(['land', 'shore']);

function pointDistance(a: Readonly<WorldPoint2D>, b: Readonly<WorldPoint2D>): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function stableBendSign(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2 === 0 ? 1 : -1;
}

export function surfaceForPlace(
  place: Pick<WorldPlace, 'kind' | 'biome'>,
): WorldSurfaceKind {
  // A lake/river/sea location represents its reachable bank. Open water will
  // be modelled by explicit `water` places once boats exist.
  if (
    place.kind === 'ocean' ||
    place.biome === 'ocean'
  ) {
    return 'water';
  }
  if (
    place.kind === 'shore' ||
    place.kind === 'lake' ||
    place.kind === 'river' ||
    place.biome === 'coast' ||
    place.biome === 'lake' ||
    place.biome === 'river'
  ) {
    return 'shore';
  }
  return 'land';
}

function orientation(
  a: Readonly<WorldPoint2D>,
  b: Readonly<WorldPoint2D>,
  c: Readonly<WorldPoint2D>,
): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function segmentsIntersect(
  a: Readonly<WorldPoint2D>,
  b: Readonly<WorldPoint2D>,
  c: Readonly<WorldPoint2D>,
  d: Readonly<WorldPoint2D>,
): boolean {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  return (
    ((abC > 0 && abD < 0) || (abC < 0 && abD > 0)) &&
    ((cdA > 0 && cdB < 0) || (cdA < 0 && cdB > 0))
  );
}

function pointInsidePolygon(
  point: Readonly<WorldPoint2D>,
  polygon: readonly WorldPoint2D[],
): boolean {
  let inside = false;
  for (let index = 0, prior = polygon.length - 1; index < polygon.length; prior = index++) {
    const a = polygon[index];
    const b = polygon[prior];
    const crosses =
      (a.y > point.y) !== (b.y > point.y) &&
      point.x <
        ((b.x - a.x) * (point.y - a.y)) /
          (b.y - a.y) +
          a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function segmentCrossesWaterArea(
  from: Readonly<WorldPlace>,
  to: Readonly<WorldPlace>,
  places: Readonly<Record<string, WorldPlace>>,
): boolean {
  const start = { x: from.mapX, y: from.mapY };
  const end = { x: to.mapX, y: to.mapY };
  const middle = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  return Object.values(places).some((place) => {
    const polygon = place.boundaryPolygon;
    if (place.surface !== 'water' || !polygon || polygon.length < 3) {
      return false;
    }
    if (
      pointInsidePolygon(start, polygon) ||
      pointInsidePolygon(end, polygon) ||
      pointInsidePolygon(middle, polygon)
    ) {
      return true;
    }
    return polygon.some((point, index) =>
      segmentsIntersect(
        start,
        end,
        point,
        polygon[(index + 1) % polygon.length],
      ),
    );
  });
}

export function isSurfaceWalkable(surface: WorldSurfaceKind): boolean {
  return WALKABLE_SURFACES.has(surface);
}

export function routeIdBetween(a: string, b: string): string {
  return `route:${[a, b].sort().join(':')}`;
}

function traversalBetween(
  a: Readonly<WorldPlace>,
  b: Readonly<WorldPlace>,
): WorldTraversalKind | undefined {
  if (isSurfaceWalkable(a.surface) && isSurfaceWalkable(b.surface)) {
    return 'walk';
  }
  // No implicit water walking: a later gateway/world rule must explicitly
  // create a bridge or boat route.
  return undefined;
}

export function buildRoute(
  from: Readonly<WorldPlace>,
  to: Readonly<WorldPlace>,
  traversal: WorldTraversalKind = 'walk',
  terrain: Readonly<Record<string, WorldPlace>> = {},
): WorldRouteState {
  const start = { x: from.mapX, y: from.mapY };
  const end = { x: to.mapX, y: to.mapY };
  const directDistance = Math.max(0.001, pointDistance(start, end));
  const perpendicularX = -(end.y - start.y) / directDistance;
  const perpendicularY = (end.x - start.x) / directDistance;
  const bend = Math.min(6, directDistance * 0.13);
  const sign = stableBendSign(routeIdBetween(from.id, to.id));
  const middle = {
    x: (start.x + end.x) / 2 + perpendicularX * bend * sign,
    y: (start.y + end.y) / 2 + perpendicularY * bend * sign,
  };
  const streetPath = traversal === 'walk' ? urbanStreetPath(from, to, terrain) : undefined;
  const waypoints = streetPath ?? (directDistance < 7 ? [start, middle, end] : [start]);
  if (!streetPath && directDistance >= 7) {
    const rough = Object.values(terrain).filter(place => ['mountains', 'swamp', 'forest'].includes(place.kind) &&
      pointDistance(start, { x: place.mapX, y: place.mapY }) < directDistance + 12);
    for (let index = 1; index <= 4; index += 1) {
      const t = index / 5;
      const base = { x: start.x + (end.x-start.x)*t, y: start.y + (end.y-start.y)*t };
      const amplitude = Math.min(4, directDistance*0.12) * Math.sin(Math.PI*t);
      const options = [-1, 0, 1].map(side => ({ x: base.x+perpendicularX*amplitude*side, y: base.y+perpendicularY*amplitude*side, side }));
      options.sort((a,b) => {
        const cost = (point: typeof a) => rough.reduce((total, place) => total +
          (place.kind === 'mountains' ? 7 : place.kind === 'swamp' ? 5 : 2) /
          (1 + Math.hypot(place.mapX-point.x, place.mapY-point.y)), 0) +
          (point.side === sign ? 0 : 0.04);
        return cost(a)-cost(b);
      });
      waypoints.push({ x: options[0].x, y: options[0].y });
    }
    waypoints.push(end);
  }
  const distance = waypoints.slice(1).reduce((sum, point, index) => sum + pointDistance(waypoints[index], point), 0);

  return {
    id: routeIdBetween(from.id, to.id),
    fromPlaceId: from.id,
    toPlaceId: to.id,
    traversal,
    waypoints,
    distance,
  };
}

export function rebuildWorldRoutes(
  places: Readonly<Record<string, WorldPlace>>,
  existing: Readonly<Record<string, WorldRouteState>> = {},
): Record<string, WorldRouteState> {
  const routes: Record<string, WorldRouteState> = {};
  for (const place of Object.values(places)) {
    for (const connectedId of place.connectedPlaceIds) {
      const connected = places[connectedId];
      if (!connected) continue;
      const id = routeIdBetween(place.id, connected.id);
      if (routes[id]) continue;
      const explicit = existing[id];
      const traversal = explicit?.traversal ?? traversalBetween(place, connected);
      if (!traversal) continue;
      if (
        traversal === 'walk' &&
        segmentCrossesWaterArea(place, connected, places)
      ) {
        continue;
      }
      const route = buildRoute(place, connected, traversal, places);
      route.completedTraversals = explicit?.completedTraversals ?? 0;
      if (traversal === 'walk' && route.waypoints.slice(1).some((point, index) =>
        segmentCrossesWaterArea(
          { ...place, mapX: route.waypoints[index].x, mapY: route.waypoints[index].y },
          { ...connected, mapX: point.x, mapY: point.y }, places))) {
        // Follow the verified bank segment if a decorative bend would cut water.
        route.waypoints = [{ x: place.mapX, y: place.mapY }, { x: connected.mapX, y: connected.mapY }];
        route.distance = pointDistance(route.waypoints[0], route.waypoints[1]);
      }
      if (traversal === 'walk') {
        const walkingPath = routeAroundBuildings(route.waypoints, place.id, connected.id, places);
        if (!walkingPath || walkingPath.slice(1).some((point, index) => segmentCrossesWaterArea(
          { ...place, mapX: walkingPath[index].x, mapY: walkingPath[index].y },
          { ...connected, mapX: point.x, mapY: point.y }, places))) continue;
        route.waypoints = walkingPath;
        route.distance = walkingPath.slice(1).reduce((sum, p, i) => sum + pointDistance(walkingPath[i], p), 0);
      }
      routes[id] = route;
    }
  }
  return routes;
}

export function orientedRouteWaypoints(
  route: Readonly<WorldRouteState>,
  fromPlaceId: string,
): WorldPoint2D[] {
  return fromPlaceId === route.fromPlaceId
    ? route.waypoints.map((point) => ({ ...point }))
    : [...route.waypoints].reverse().map((point) => ({ ...point }));
}
