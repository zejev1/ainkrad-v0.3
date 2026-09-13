import { routeAroundWater, pathCrossesWater } from './WaterNavigation';
import {regionalTerrainRoute} from './geography/RegionalNavigation';
import {terrainForPlaces} from './geography/WorldTerrain';
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
  const streetPath = traversal === 'walk' ? urbanStreetPath(from, to, terrain)??regionalTerrainRoute(start,end,terrain) : undefined;
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
  const terrainKey=terrainForPlaces(places)?.foundation.key;
  for (const place of Object.values(places)) {
    for (const connectedId of place.connectedPlaceIds) {
      const connected = places[connectedId];
      if (!connected) continue;
      const id = routeIdBetween(place.id, connected.id);
      if (routes[id]) continue;
      const explicit = existing[id];
      const traversal = explicit?.traversal ?? traversalBetween(place, connected);
      if (!traversal) continue;
      if(explicit?.geometryVersion===2 && explicit.terrainKey===terrainKey && explicit.waypoints.length>1) {
        const first=explicit.waypoints[0],last=explicit.waypoints.at(-1)!;
        const direct=explicit.fromPlaceId===place.id;
        const a=direct?place:connected,b=direct?connected:place;
        if(pointDistance(first,{x:a.mapX,y:a.mapY})<1e-8&&pointDistance(last,{x:b.mapX,y:b.mapY})<1e-8&&
          (traversal!=='walk'||(!pathCrossesWater(explicit.waypoints,places)&&
            routeAroundBuildings(explicit.waypoints,place.id,connected.id,places)===explicit.waypoints))) {
          routes[id]=explicit;continue;
        }
      }
      const route = buildRoute(place, connected, traversal, places);
      route.completedTraversals = explicit?.completedTraversals ?? 0;
      route.geometryVersion=2;route.widthMetres=traversal==='walk'?3:4;
      if(terrainKey)route.terrainKey=terrainKey;
      if (traversal === 'walk') {
        let path:WorldPoint2D[]|undefined=route.waypoints;
        for(let attempt=0;attempt<3;attempt++) {
          path=routeAroundBuildings(path,place.id,connected.id,places);
          if(!path)break;
          path=routeAroundWater(path,places);
          if(!path)break;
          const checked=routeAroundBuildings(path,place.id,connected.id,places);
          if(checked&&!pathCrossesWater(checked,places)){path=checked;break;}
          path=checked;
          if(!path)break;
        }
        if(!path||pathCrossesWater(path,places))continue;
        // A final building pass must not invalidate the verified water route.
        const final=routeAroundBuildings(path,place.id,connected.id,places);
        if(!final||pathCrossesWater(final,places))continue;
        route.waypoints=final;
        route.distance=final.slice(1).reduce((sum,p,i)=>sum+pointDistance(final[i],p),0);
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
