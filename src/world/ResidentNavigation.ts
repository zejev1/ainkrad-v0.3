import type { AgentState, WorldState } from './types';
import { mayKnowPlaceV20 } from '../v20/KnowledgeBoundariesV20';
import { isSecretLibrary } from '../v21/LibraryAdmissions';
import { routeIdBetween } from './WorldNavigation';

interface PathMemo {
  places: WorldState['places']; routes: WorldState['routes'];
  known: string[] | undefined; count: number; from: string; home: string;
  minute: number; graphRevision: number; paths: Map<string, string[]>;
}
const graphRevisions = new WeakMap<Readonly<WorldState>, number>();
/** Also invalidate mutations performed in place (boat landings/library changes),
 * not only replacements of the physical routes object. */
export function invalidateResidentNavigation(world: Readonly<WorldState>): void {
  graphRevisions.set(world, (graphRevisions.get(world) ?? 0) + 1);
}
const pathsByResident = new WeakMap<AgentState, PathMemo>();
/** One BFS over the resident's known graph. A physically existing global road
 * through unknown intermediate places is not knowledge of a safe itinerary.
 * A longer known detour must remain usable when the global shortest path isn't. */
export function residentKnownPath(world: Readonly<WorldState>, agent: AgentState, destinationId: string): string[] | undefined {
  if (destinationId === agent.locationId) return [destinationId];
  const graphRevision = graphRevisions.get(world) ?? 0;
  const previous = pathsByResident.get(agent);
  // The per-quantum key also expires library admissions and in-place topology
  // changes. The physical routes object is replaced on discoveries/geometry edits.
  if (previous && previous.places === world.places && previous.routes === world.routes &&
      previous.known === agent.knownPlaceIds && previous.count === (agent.knownPlaceIds?.length ?? 0) &&
      previous.graphRevision === graphRevision && previous.from === agent.locationId && previous.home === agent.homeId && previous.minute === world.calendar.elapsedWorldMinutes) {
    const path = previous.paths.get(destinationId);
    return path?.slice();
  }
  const known = new Set(agent.knownPlaceIds ?? []);
  known.add(agent.homeId); known.add(agent.locationId);
  const paths = new Map<string, string[]>([[agent.locationId, [agent.locationId]]]);
  const queue = [agent.locationId];
  for (let index = 0; index < queue.length; index += 1) {
    const sourceId = queue[index];
    if (sourceId !== agent.locationId && isSecretLibrary(sourceId)) continue;
    for (const targetId of world.places[sourceId]?.connectedPlaceIds ?? []) {
      if (paths.has(targetId) || !known.has(targetId) || !world.places[targetId] || !mayKnowPlaceV20(agent, targetId, world)) continue;
      const route = world.routes[routeIdBetween(sourceId, targetId)];
      if (!route || route.traversal === 'boat') continue;
      paths.set(targetId, [...paths.get(sourceId)!, targetId]);
      queue.push(targetId);
    }
  }
  pathsByResident.set(agent, { places: world.places, routes: world.routes, known: agent.knownPlaceIds,
    count: agent.knownPlaceIds?.length ?? 0, from: agent.locationId, home: agent.homeId,
    minute: world.calendar.elapsedWorldMinutes, graphRevision, paths });
  return paths.get(destinationId)?.slice();
}
