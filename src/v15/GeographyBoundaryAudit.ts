export type V15TraversalMode = 'land' | 'bridge' | 'boat';

export interface V15GeoPlace {
  id: string;
  biome: string;
  isWater: boolean;
  connectedPlaceIds: string[];
}

export interface V15GeoRoute {
  routeId: string;
  fromId: string;
  toId: string;
  mode: V15TraversalMode;
  crossesWater: boolean;
}

export interface V15GeographyAuditResult {
  ok: boolean;
  failures: string[];
}

/**
 * Static geography audit for v15.
 *
 * A resident may only move through declared route connectivity. Water is a
 * physical boundary: a route that crosses water requires an explicit bridge
 * or boat traversal mode. No action/AI decision may implicitly teleport.
 */
export function auditV15Geography(
  places: readonly V15GeoPlace[],
  routes: readonly V15GeoRoute[],
): V15GeographyAuditResult {
  const failures: string[] = [];
  const byId = new Map(places.map((place) => [place.id, place]));

  for (const place of places) {
    for (const neighborId of place.connectedPlaceIds) {
      if (!byId.has(neighborId)) {
        failures.push(`missing_connected_place:${place.id}:${neighborId}`);
      }
    }
  }

  for (const route of routes) {
    const from = byId.get(route.fromId);
    const to = byId.get(route.toId);
    if (!from || !to) {
      failures.push(`route_endpoint_missing:${route.routeId}`);
      continue;
    }
    if (
      !from.connectedPlaceIds.includes(to.id) ||
      !to.connectedPlaceIds.includes(from.id)
    ) {
      failures.push(`route_not_reciprocal:${route.routeId}`);
    }
    if (route.crossesWater && route.mode === 'land') {
      failures.push(`illegal_land_water_crossing:${route.routeId}`);
    }
    if (!route.crossesWater && route.mode === 'boat') {
      failures.push(`boat_route_without_water:${route.routeId}`);
    }
  }

  return {
    ok: failures.length === 0,
    failures: [...new Set(failures)],
  };
}

export function canTraverseDeclaredRoute(
  route: V15GeoRoute | undefined,
): boolean {
  if (!route) return false;
  if (route.crossesWater) {
    return route.mode === 'bridge' || route.mode === 'boat';
  }
  return route.mode === 'land' || route.mode === 'bridge';
}
