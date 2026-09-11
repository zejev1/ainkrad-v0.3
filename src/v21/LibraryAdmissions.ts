import type { AgentState, WorldState } from '../world/types';
import type { SecretLibraryVisitorV18 } from '../v18/SecretLibraryV18';

export const LIBRARY_IDS = ['secret_library_v18', 'elf_library_v20'] as const;
export const LIBRARY_LIMIT = 5;
export const LIBRARY_YEAR = 365 * 24 * 60;
export const LIBRARY_HISTORY_LIMIT = 100;
export const libraryIdOf = (v: SecretLibraryVisitorV18): string => v.libraryPlaceId ?? LIBRARY_IDS[0];
export const isSecretLibrary = (id: string): boolean => (LIBRARY_IDS as readonly string[]).includes(id);
export const admissionDeadline = (v: SecretLibraryVisitorV18): number =>
  (v.arrivedWorldMinute ?? v.selectedWorldMinute) + LIBRARY_YEAR;

export function hasLibraryAdmission(world: Readonly<WorldState>, agent: Readonly<AgentState>,
  id: string, minute = world.calendar.elapsedWorldMinutes): boolean {
  if (!isSecretLibrary(id)) return false;
  if (!agent.life.alive || (agent.race ?? 'human') !== (id === LIBRARY_IDS[1] ? 'elf' : 'human')) return false;
  return !!world.v18?.secretLibrary.visitors.some(v => v.agentId === agent.id && libraryIdOf(v) === id &&
    (v.status === 'travelling' || v.status === 'studying') && v.selectedWorldMinute <= minute && minute < admissionDeadline(v));
}

export function libraryAdmissions(world: Readonly<WorldState>, id: string): SecretLibraryVisitorV18[] {
  return (world.v18?.secretLibrary.visitors ?? []).filter(v => libraryIdOf(v) === id &&
    world.agents[v.agentId] && hasLibraryAdmission(world, world.agents[v.agentId], id));
}

/** A real arrival starts the reading year, including arrivals between semantic ticks. */
export function noteLibraryArrival(world: WorldState, agent: AgentState, minute: number): void {
  const visitor = world.v18?.secretLibrary.visitors.find(v => v.agentId === agent.id && libraryIdOf(v) === agent.locationId);
  if (!visitor || !hasLibraryAdmission(world, agent, agent.locationId, minute)) return;
  visitor.arrivedWorldMinute ??= minute;
  visitor.lastStudyWorldMinute = minute;
  visitor.status = 'studying';
}

/** Reverse the walked part of a denied journey; an occupant walks to the public entrance.
 * No teleport, decision/identity write, traversal credit, or knowledge erasure.
 */
export function enforceLibraryBoundary(world: WorldState, agent: AgentState, minute = world.calendar.elapsedWorldMinutes): void {
  agent.knownPlaceIds = (agent.knownPlaceIds ?? []).filter(id => !isSecretLibrary(id) || hasLibraryAdmission(world, agent, id, minute));
  const journey = agent.movement;
  if (journey && isSecretLibrary(journey.targetPlaceId) && !hasLibraryAdmission(world, agent, journey.targetPlaceId, minute)) {
    const backwards = journey.waypoints.slice(0, Math.max(1, journey.nextWaypointIndex)).reverse();
    const origin = world.places[agent.locationId];
    if (origin && !isSecretLibrary(origin.id)) {
      agent.movement = { ...journey, targetPlaceId: origin.id, purpose: 'walk',
        waypoints: [{x: agent.position.x, y: agent.position.y}, ...backwards],
        nextWaypointIndex: 1, routeIds: [] };
      return;
    }
    agent.movement = undefined;
  }
  if (!agent.life.alive || !isSecretLibrary(agent.locationId) || hasLibraryAdmission(world, agent, agent.locationId, minute) ||
      (agent.movement && !isSecretLibrary(agent.movement.targetPlaceId))) return;
  const entrance = world.places[agent.locationId]?.connectedPlaceIds.find(id => !isSecretLibrary(id) && world.places[id]);
  if (!entrance) return;
  const route = Object.values(world.routes).find(r => r.traversal !== 'boat' &&
    ((r.fromPlaceId === agent.locationId && r.toPlaceId === entrance) || (r.toPlaceId === agent.locationId && r.fromPlaceId === entrance)));
  if (!route) return;
  const points = route.fromPlaceId === agent.locationId ? route.waypoints : [...route.waypoints].reverse();
  agent.movement = { targetPlaceId: entrance, purpose: 'walk', waypoints: [
    {x: agent.position.x, y: agent.position.y}, ...points.slice(1)],
    nextWaypointIndex: 1, routeIds: [route.id], startedAt: world.now, worldStageAtStart: world.growth.stage };
}

/** Bounded active passes and annual receipts survive reload independently of the visit history. */
export function reconcileLibraryAdmissions(world: WorldState, minute = world.calendar.elapsedWorldMinutes,
  repairOccupants = false): SecretLibraryVisitorV18[] {
  const library = world.v18?.secretLibrary;
  if (!library) return [];
  const year = Math.floor(minute / LIBRARY_YEAR) + 1;
  library.visitHistory ??= [];
  library.annualSelections ??= {};
  const legacy = library.admissionVersion !== 1;
  for (const id of LIBRARY_IDS) {
    const prior = library.annualSelections[id];
    if (!prior || prior.year !== year) {
      const records = [...library.visitHistory, ...library.visitors].filter(v => libraryIdOf(v) === id && v.accessYear === year);
      library.annualSelections[id] = { year, agentIds: [...new Set(records.map(v => v.agentId))].slice(0, LIBRARY_LIMIT) };
    }
    if (world.places[id]) world.places[id].capacity = LIBRARY_LIMIT;
  }
  const active: SecretLibraryVisitorV18[] = [], ended: SecretLibraryVisitorV18[] = [];
  // Stable oldest admissions win when repairing an overfilled old save.
  const ordered = [...library.visitors].sort((a,b) => a.selectedWorldMinute-b.selectedWorldMinute || a.agentId.localeCompare(b.agentId));
  for (const visitor of ordered) {
    const agent = world.agents[visitor.agentId], id = libraryIdOf(visitor);
    if (legacy && agent?.locationId === id && !agent.movement && visitor.arrivedWorldMinute === undefined &&
        visitor.status === 'studying') visitor.arrivedWorldMinute = visitor.selectedWorldMinute;
    const quota = library.annualSelections[id];
    const allowed = !!agent && hasLibraryAdmission(world, agent, id, minute) &&
      active.filter(v => libraryIdOf(v) === id).length < LIBRARY_LIMIT &&
      !active.some(v => v.agentId === visitor.agentId) &&
      (visitor.accessYear !== year || !!quota?.agentIds.includes(visitor.agentId));
    if (allowed) active.push(visitor);
    else {
      visitor.status = visitor.arrivedWorldMinute !== undefined || visitor.studyQuanta > 0 ? 'completed' : 'missed';
      visitor.completedWorldMinute ??= Math.min(minute, admissionDeadline(visitor));
      library.visitHistory.push(visitor); ended.push(visitor);
    }
  }
  library.visitors = active;
  library.visitHistory = library.visitHistory.slice(-LIBRARY_HISTORY_LIMIT);
  library.admissionVersion = 1;
  library.status = active.length ? 'open' : library.currentAccessYear ? 'closed' : 'waiting';
  for (const visitor of ended) {
    const agent = world.agents[visitor.agentId];
    if (agent) enforceLibraryBoundary(world, agent, minute);
  }
  if (repairOccupants || legacy) for (const agent of Object.values(world.agents)) enforceLibraryBoundary(world, agent, minute);
  return ended;
}
