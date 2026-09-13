import { hasLibraryAdmission, isSecretLibrary } from '../v21/LibraryAdmissions';
import type { AgentState, WorldPlace, WorldState } from '../world/types';
import { routeIdBetween } from '../world/WorldNavigation';

export const HUMAN_LIBRARY_ID_V20 = 'secret_library_v18';
export const ELF_LIBRARY_ID_V20 = 'elf_library_v20';
export const LOCAL_TRAIL_NOTICE_RADIUS_V20 = 45;

export function mayKnowPlaceV20(agent: Readonly<AgentState>, placeId: string, world?: Readonly<WorldState>): boolean {
  return !isSecretLibrary(placeId) || (!!world && hasLibraryAdmission(world, agent, placeId));
}

export function observeLocalPlacesV20(world: Readonly<WorldState>, agent: AgentState): void {
  const known = new Set((agent.knownPlaceIds ?? []).filter(id => world.places[id] && mayKnowPlaceV20(agent, id, world)));
  known.add(agent.homeId);
  if (mayKnowPlaceV20(agent, agent.locationId, world)) known.add(agent.locationId);
  for (const id of world.places[agent.locationId]?.connectedPlaceIds ?? []) {
    const place = world.places[id];
    // A directly connected local trail can be perceived as far as the
    // frontier survey radius (procedural frontier sites are at most 40 map
    // units away). This does not reveal an unconnected place or continent.
    if (place && mayKnowPlaceV20(agent, id, world) &&
        Math.hypot(place.mapX - agent.position.x, place.mapY - agent.position.y) <= LOCAL_TRAIL_NOTICE_RADIUS_V20) known.add(id);
  }
  agent.knownPlaceIds = [...known];
  const dungeon = world.v19?.adventureEconomy.dungeonsById[`dungeon:${agent.locationId}`];
  if (dungeon && !agent.movement) agent.knownDungeonIds = [...new Set([...(agent.knownDungeonIds ?? []), dungeon.id])];
}

export function sharePlaceKnowledgeV20(world: Readonly<WorldState>, speaker: Readonly<AgentState>, listener: AgentState): void {
  if (speaker.locationId !== listener.locationId || speaker.movement || listener.movement) return;
  const known = new Set((listener.knownPlaceIds ?? []).filter(id => mayKnowPlaceV20(listener, id, world)));
  for (const id of speaker.knownPlaceIds ?? []) {
    if (world.places[id] && mayKnowPlaceV20(listener, id, world)) known.add(id);
  }
  listener.knownPlaceIds = [...known];
  listener.knownDungeonIds = [...new Set([...(listener.knownDungeonIds ?? []), ...(speaker.knownDungeonIds ?? [])])];
}

export function removeUnsurveyedHomelandLinksV20(world: WorldState): void {
  for (const place of Object.values(world.places)) {
    place.connectedPlaceIds = place.connectedPlaceIds.filter(id => {
      const target = world.places[id];
      // An absent target is corruption, not evidence of an unsurveyed homeland.
      // Keep the edge so strict world validation can report it without erasing history.
      if (!target) return true;
      const distance = Math.hypot(place.mapX - target.mapX, place.mapY - target.mapY);
      const crossesHomeland = (place.id.endsWith('_homeland') || target.id.endsWith('_homeland')) && place.settlementId !== target.settlementId;
      return !crossesHomeland || distance <= 30;
    });
  }
  for (const [id, route] of Object.entries(world.routes)) {
    if (!world.places[route.fromPlaceId]?.connectedPlaceIds.includes(route.toPlaceId)) delete world.routes[id];
  }
  for (const agent of Object.values(world.agents)) {
    if (!agent.knownPlaceIds) observeLocalPlacesV20(world, agent);
    else agent.knownPlaceIds = agent.knownPlaceIds.filter(id => world.places[id] && mayKnowPlaceV20(agent, id, world));
  }
}

/** The frontier grows from an actual explorer, not the global last-created dot. */
export function frontierSiteV20(world: Readonly<WorldState>, explorer: Readonly<AgentState>, sequence: number): { x: number; y: number; connections: string[] } {
  const anchor = world.places[explorer.locationId] ?? world.places[explorer.homeId];
  const goldenAngle = 2.399963229728653;
  const land = Object.values(world.places).filter(place => place.surface !== 'water');
  let best = { x: anchor.mapX, y: anchor.mapY, score: -Infinity };
  for (let index = 0; index < 16; index += 1) {
    const angle = (sequence + index) * goldenAngle;
    const distance = 18 + (sequence * 7 + index * 11) % 22;
    const x = anchor.mapX + Math.cos(angle) * distance;
    const y = anchor.mapY + Math.sin(angle) * distance;
    const planet = world.v18?.planetaryGeography;
    if (x >= 86 || (planet && (x < planet.minMapX || y < planet.minMapY || y > planet.maxMapY))) continue;
    const clearance = land.reduce((closest, place) => Math.min(closest, Math.hypot(place.mapX - x, place.mapY - y)), Infinity);
    const score = clearance + Math.sin(x / 60) * 2 + Math.cos(y / 75) * 2;
    if (score > best.score) best = { x, y, score };
  }
  const neighbours = land.filter(place => place.id !== anchor.id && Math.hypot(place.mapX - best.x, place.mapY - best.y) <= 26)
    .sort((a,b) => Math.hypot(a.mapX-best.x,a.mapY-best.y)-Math.hypot(b.mapX-best.x,b.mapY-best.y)).slice(0,2);
  return { x: best.x, y: best.y, connections: [anchor.id, ...neighbours.map(place => place.id)] };
}

export function rememberTraversalV20(world: WorldState, from: string, to: string): void {
  const route = world.routes[routeIdBetween(from, to)];
  if (route) route.completedTraversals = (route.completedTraversals ?? 0) + 1;
}
