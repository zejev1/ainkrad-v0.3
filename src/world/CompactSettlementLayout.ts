import { updateSettlementGeometry } from './SettlementGeometryV21';
import { rebuildWorldRoutes } from './WorldNavigation';
import type { WorldPoint2D, WorldState } from './types';

/** Repair geometry, not life: no clock, RNG, identity, history or decision writes. */
export function repairCompactSettlementLayout(world: WorldState): boolean {
  const moved = new Map<string, { before: WorldPoint2D; after: WorldPoint2D }>();
  const move = (id: string, point: WorldPoint2D) => {
    const place = world.places[id];
    moved.set(id, { before: { x: place.mapX, y: place.mapY }, after: point });
    place.mapX = point.x; place.mapY = point.y; place.urbanLayoutVersion = 2;
  };
  updateSettlementGeometry(world, move);
  if (!moved.size) return false;
  world.routes = rebuildWorldRoutes(world.places, world.routes);
  // Physical proximity does not transfer ownership of the secret library or
  // alter a town's social/economic membership during a geometry repair.
  const localSettlement = (id: string) => world.places[id]?.settlementId ??
    (id === world.v18?.secretLibrary.placeId
      ? world.places[world.v18.secretLibrary.anchorPlaceId]?.settlementId : undefined);
  const shiftedPoint = (point: WorldPoint2D) => {
    for (const { before, after } of moved.values()) {
      if (Math.hypot(point.x - before.x, point.y - before.y) < 1e-7) return { ...after };
    }
    return point;
  };
  for (const agent of Object.values(world.agents)) {
    const movement = agent.movement;
    if (!movement) {
      const relocated = moved.get(agent.locationId);
      if (relocated) {
        // A resting resident is inside this home, even if an older display
        // projection previously stored a stale outlying coordinate.
        agent.position.x = relocated.after.x;
        agent.position.y = relocated.after.y;
      }
      continue;
    }
    const affectedRoute = (movement.routeIds ?? []).some(id => {
      const route = world.routes[id];
      return !route || moved.has(route.fromPlaceId) || moved.has(route.toPlaceId);
    });
    if (!affectedRoute && !moved.has(agent.locationId) && !moved.has(movement.targetPlaceId)) continue;
    const from = world.places[agent.locationId], to = world.places[movement.targetPlaceId];
    const settlementId = from && localSettlement(from.id);
    if (settlementId && to && settlementId === localSettlement(to.id)) {
      const queue = [from.id], prior = new Map<string,string>();
      const seen = new Set([from.id]);
      for (let i = 0; i < queue.length && !seen.has(to.id); i++) {
        const id = queue[i];
        for (const next of world.places[id].connectedPlaceIds) {
          if (seen.has(next) || localSettlement(next) !== settlementId) continue;
          const route = Object.values(world.routes).find(r =>
            (r.fromPlaceId === id && r.toPlaceId === next) || (r.toPlaceId === id && r.fromPlaceId === next));
          if (route) { seen.add(next); prior.set(next,id); queue.push(next); }
        }
      }
      if (seen.has(to.id) && from.id !== to.id) {
        const ids = [to.id];
        while (ids[0] !== from.id) ids.unshift(prior.get(ids[0])!);
        const points: WorldPoint2D[] = [], routeIds: string[] = [];
        for (let i = 1; i < ids.length; i++) {
          const route = Object.values(world.routes).find(r =>
            (r.fromPlaceId === ids[i-1] && r.toPlaceId === ids[i]) ||
            (r.toPlaceId === ids[i-1] && r.fromPlaceId === ids[i]))!;
          const path = route.fromPlaceId === ids[i-1] ? route.waypoints : [...route.waypoints].reverse();
          points.push(...path.slice(points.length ? 1 : 0)); routeIds.push(route.id);
        }
        const length = (path: WorldPoint2D[]) => path.slice(1).reduce((n,p,i) => n + Math.hypot(p.x-path[i].x,p.y-path[i].y),0);
        const oldLength = length(movement.waypoints);
        const remaining = length([agent.position, ...movement.waypoints.slice(movement.nextWaypointIndex)]);
        let travelled = length(points) * Math.max(0, Math.min(1, 1 - remaining / Math.max(1e-8,oldLength)));
        let index = 1, position = points[0];
        for (; index < points.length; index++) {
          const a = points[index-1], b = points[index], distance = Math.hypot(b.x-a.x,b.y-a.y);
          if (travelled <= distance) {
            const t = distance ? travelled / distance : 0;
            position = { x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t }; break;
          }
          travelled -= distance; position = b;
        }
        movement.waypoints = points; movement.routeIds = routeIds;
        movement.nextWaypointIndex = Math.min(index,points.length-1);
        agent.position.x = position.x; agent.position.y = position.y;
        continue;
      }
    }
    // A distant traveller keeps their geographical position and surveyed path;
    // only a relocated endpoint changes, never a jump between continents.
    movement.waypoints = movement.waypoints.map(shiftedPoint);
  }
  return true;
}
