import type { AgentState, WorldState } from './types';
import { isSecretLibrary } from '../v21/LibraryAdmissions';

export interface SurveyNote {
  surveyedBy: string;
  surveyedWorldMinute: number;
}
export interface SettlementMapPoint {
  knownRevision: number;
  surveyedRevision?: number;
  survey?: SurveyNote;
}
export interface SettlementMapRoute {
  knownRevision: number;
  traversedBy: string;
  traversedWorldMinute: number;
}
export interface SettlementMap {
  revision: number;
  points: Record<string, SettlementMapPoint>;
  routes: Record<string, SettlementMapRoute>;
}
export interface WorldCartography {
  version: 1;
  bySettlementId: Record<string, SettlementMap>;
}
export interface ResidentMapNotes {
  revision: number;
  /** A carried copy is a historical revision, NEVER a live subscription. */
  copies: Record<string, number>;
  surveys: Record<string, SurveyNote>;
  routes: Record<string, Omit<SettlementMapRoute, 'knownRevision'>>;
}
const notes = (agent: AgentState): ResidentMapNotes => agent.cartography ??= {
  revision: 0, copies: {}, surveys: {}, routes: {},
};
const publicPoint = (world: Readonly<WorldState>, id: string): boolean =>
  Boolean(world.places[id]) && !isSecretLibrary(id);
export function physicallyAtPlace(world: Readonly<WorldState>, agent: Readonly<AgentState>): boolean {
  const place = world.places[agent.locationId];
  return Boolean(agent.life.alive && !agent.movement && place &&
    Math.hypot(place.mapX - agent.position.x, place.mapY - agent.position.y) <= 0.001);
}

/** Visits only revisions actually acquired. Later reports in a remote archive
 * cannot alter an already carried map. First-known stamps are never overwritten. */
function eachCarriedPoint(world: Readonly<WorldState>, agent: Readonly<AgentState>,
  visit: (id: string, survey: SurveyNote | undefined) => void): void {
  for (const [settlementId, revision] of Object.entries(agent.cartography?.copies ?? {})) {
    const archive = world.cartography?.bySettlementId[settlementId];
    if (!archive) continue;
    for (const [id, point] of Object.entries(archive.points)) {
      if (point.knownRevision <= revision && publicPoint(world, id)) {
        visit(id, point.surveyedRevision !== undefined && point.surveyedRevision <= revision ? point.survey : undefined);
      }
    }
  }
}

const surveyedCache = new WeakMap<AgentState, { notes: ResidentMapNotes | undefined; revision: number; archives: WorldCartography | undefined; ids: readonly string[] }>();
/** Shared surveys do not become personal cartographer achievements. Legacy
 * mappedPlaceIds are intentionally NOT published: old engines set them on intent. */
export function residentSurveyedPlaceIds(world: Readonly<WorldState>, agent: AgentState): readonly string[] {
  const stored = surveyedCache.get(agent), revision = agent.cartography?.revision ?? 0;
  if (stored && stored.notes === agent.cartography && stored.revision === revision && stored.archives === world.cartography) return stored.ids;
  const mapped = new Set(Object.keys(agent.cartography?.surveys ?? {}).filter(id => publicPoint(world, id)));
  eachCarriedPoint(world, agent, (id, survey) => { if (survey) mapped.add(id); });
  const ids = [...mapped];
  surveyedCache.set(agent, { notes: agent.cartography, revision, archives: world.cartography, ids });
  return ids;
}

interface ConsultationStamp { archive: SettlementMap; archiveRevision: number; noteRevision: number;
  known: string[] | undefined; count: number; homeId: string; locationId: string }
const consultations = new WeakMap<AgentState, ConsultationStamp>();
/** Physically deposit and consult the home settlement's accumulated map. No
 * copying into every distant resident, no library disclosure, no invented survey. */
export function consultSettlementMap(world: WorldState, agent: AgentState): void {
  if (!physicallyAtPlace(world, agent)) return;
  const settlementId = world.places[agent.homeId]?.settlementId;
  if (!settlementId || world.places[agent.locationId]?.settlementId !== settlementId || !world.settlements[settlementId]) return;
  const maps = (world.cartography ??= { version: 1, bySettlementId: {} });
  const archive = maps.bySettlementId[settlementId] ??= { revision: 0, points: {}, routes: {} };
  const own = notes(agent), stamp = consultations.get(agent);
  if (stamp && stamp.archive === archive && stamp.archiveRevision === archive.revision &&
      stamp.noteRevision === own.revision && stamp.known === agent.knownPlaceIds &&
      stamp.count === (agent.knownPlaceIds?.length ?? 0) && stamp.homeId === agent.homeId && stamp.locationId === agent.locationId) return;
  const publish = (id: string, survey?: SurveyNote): void => {
    if (!publicPoint(world, id)) return;
    const entry = archive.points[id] ??= { knownRevision: ++archive.revision };
    if (survey && entry.surveyedRevision === undefined) {
      entry.surveyedRevision = ++archive.revision;
      entry.survey = { ...survey };
    }
  };
  const publishRoute = (id: string, route: Omit<SettlementMapRoute, 'knownRevision'>): void => {
    const physical = world.routes[id];
    if (!physical || !publicPoint(world, physical.fromPlaceId) || !publicPoint(world, physical.toPlaceId)) return;
    archive.routes[id] ??= { ...route, knownRevision: ++archive.revision };
    publish(physical.fromPlaceId); publish(physical.toPlaceId);
  };
  for (const id of agent.knownPlaceIds ?? []) publish(id);
  publish(agent.homeId); publish(agent.locationId);
  for (const [id, survey] of Object.entries(own.surveys)) publish(id, survey);
  // People who met another traveller, or moved town, can physically bring a copy.
  eachCarriedPoint(world, agent, publish);
  for (const [id, route] of Object.entries(own.routes)) publishRoute(id, route);
  for (const [id, revision] of Object.entries(own.copies)) {
    if (id === settlementId) continue;
    for (const [routeId, route] of Object.entries(maps.bySettlementId[id]?.routes ?? {})) {
      if (route.knownRevision <= revision) publishRoute(routeId, route);
    }
  }
  const known = new Set(agent.knownPlaceIds ?? []);
  for (const id of Object.keys(archive.points)) if (publicPoint(world, id)) known.add(id);
  if (known.size !== (agent.knownPlaceIds?.length ?? 0)) agent.knownPlaceIds = [...known];
  if (own.copies[settlementId] !== archive.revision) {
    own.copies[settlementId] = archive.revision;
    own.revision += 1;
  }
  // Once deposited, the carried archive revision is the durable copy. Keeping
  // the same survey/route payload on every townsman's body would grow O(N*map).
  if (Object.keys(own.surveys).length || Object.keys(own.routes).length) {
    own.surveys = {}; own.routes = {}; own.revision += 1;
  }
  consultations.set(agent, { archive, archiveRevision: archive.revision, noteRevision: own.revision,
    known: agent.knownPlaceIds, count: agent.knownPlaceIds?.length ?? 0, homeId: agent.homeId, locationId: agent.locationId });
}

export function recordResidentSurvey(world: WorldState, agent: AgentState, placeId: string): boolean {
  if (agent.locationId !== placeId || !physicallyAtPlace(world, agent) || !publicPoint(world, placeId)) return false;
  consultSettlementMap(world, agent);
  if (residentSurveyedPlaceIds(world, agent).includes(placeId)) return false;
  const own = notes(agent);
  own.surveys[placeId] = { surveyedBy: agent.id, surveyedWorldMinute: world.calendar.elapsedWorldMinutes };
  own.revision += 1;
  consultSettlementMap(world, agent);
  return true;
}

/** Record only the route that has really been completed; intention is not proof. */
export function recordResidentRouteArrival(world: WorldState, agent: AgentState, routeIds: readonly string[], arrivalWorldMinute = world.calendar.elapsedWorldMinutes): void {
  if (!physicallyAtPlace(world, agent)) return;
  const own = notes(agent), known = new Set(agent.knownPlaceIds ?? []);
  for (const id of routeIds) {
    const route = world.routes[id];
    if (!route || !publicPoint(world, route.fromPlaceId) || !publicPoint(world, route.toPlaceId)) continue;
    if (!own.routes[id]) {
      own.routes[id] = { traversedBy: agent.id, traversedWorldMinute: Math.round(arrivalWorldMinute * 1e6) / 1e6 };
      own.revision += 1;
    }
    known.add(route.fromPlaceId); known.add(route.toPlaceId);
  }
  if (known.size !== (agent.knownPlaceIds?.length ?? 0)) agent.knownPlaceIds = [...known];
}

/** A real conversation may transmit carried copies/notes, not the speaker's
 * settlement's current remote revision. Original evidence attribution survives. */
export function shareResidentCartography(world: Readonly<WorldState>, speaker: Readonly<AgentState>, listener: AgentState): void {
  if (speaker.id === listener.id || speaker.locationId !== listener.locationId ||
      !physicallyAtPlace(world, speaker) || !physicallyAtPlace(world, listener) || !speaker.cartography) return;
  const own = notes(listener), carried = speaker.cartography;
  for (const [id, revision] of Object.entries(carried.copies)) {
    if ((own.copies[id] ?? -1) < revision) { own.copies[id] = revision; own.revision += 1; }
  }
  for (const [id, survey] of Object.entries(carried.surveys)) {
    if (publicPoint(world, id) && !own.surveys[id]) { own.surveys[id] = { ...survey }; own.revision += 1; }
  }
  for (const [id, route] of Object.entries(carried.routes)) {
    const physical = world.routes[id];
    if (physical && publicPoint(world, physical.fromPlaceId) && publicPoint(world, physical.toPlaceId) && !own.routes[id]) {
      own.routes[id] = { ...route }; own.revision += 1;
    }
  }
  const known = new Set(listener.knownPlaceIds ?? []);
  eachCarriedPoint(world, listener, id => known.add(id));
  for (const id of Object.keys(own.surveys)) if (publicPoint(world, id)) known.add(id);
  if (known.size !== (listener.knownPlaceIds?.length ?? 0)) listener.knownPlaceIds = [...known];
}

/** Validate additive save data at transaction boundaries, never silently repair
 * a future map revision or a fabricated survey into authority. */
export function assertResidentCartography(world: Readonly<WorldState>): void {
  const maps = world.cartography;
  if (maps && (maps.version !== 1 || !maps.bySettlementId || typeof maps.bySettlementId !== 'object')) throw new Error('Invalid settlement cartography version');
  const integer = (n: unknown): n is number => Number.isSafeInteger(n) && Number(n) >= 0;
  const surveyValid = (s: SurveyNote | undefined): boolean => !!s && typeof s.surveyedBy === 'string' && Number.isFinite(s.surveyedWorldMinute) && s.surveyedWorldMinute >= 0;
  for (const map of Object.values(maps?.bySettlementId ?? {})) {
    if (!map || !integer(map.revision) || !map.points || !map.routes) throw new Error('Invalid settlement map');
    for (const [id, point] of Object.entries(map.points)) {
      if (isSecretLibrary(id) || !integer(point.knownRevision) || point.knownRevision > map.revision ||
          (point.surveyedRevision !== undefined && (!integer(point.surveyedRevision) || point.surveyedRevision < point.knownRevision || point.surveyedRevision > map.revision || !surveyValid(point.survey)))) throw new Error('Invalid map point evidence');
    }
    for (const route of Object.values(map.routes)) {
      if (!integer(route.knownRevision) || route.knownRevision > map.revision || typeof route.traversedBy !== 'string' || !Number.isFinite(route.traversedWorldMinute) || route.traversedWorldMinute < 0) throw new Error('Invalid map route evidence');
    }
  }
  for (const agent of Object.values(world.agents)) {
    const own = agent.cartography;
    if (!own) continue;
    if (!integer(own.revision) || !own.copies || !own.surveys || !own.routes) throw new Error('Invalid resident map notes');
    for (const [id, revision] of Object.entries(own.copies)) {
      if (!integer(revision) || !maps?.bySettlementId[id] || revision > maps.bySettlementId[id].revision) throw new Error('Invalid carried map revision');
    }
    for (const [id, survey] of Object.entries(own.surveys)) {
      if (isSecretLibrary(id) || !surveyValid(survey)) throw new Error('Invalid resident survey evidence');
    }
    for (const route of Object.values(own.routes)) {
      if (!route || typeof route.traversedBy !== 'string' || !Number.isFinite(route.traversedWorldMinute) || route.traversedWorldMinute < 0) throw new Error('Invalid resident route evidence');
    }
  }
}
