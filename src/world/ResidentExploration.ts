import type { AgentState, WorldPlace, WorldState } from './types';

const EXCLUDED_TARGET_KINDS = new Set(['home', 'village', 'graveyard']);
const WILDERNESS_KINDS = new Set([
  'outskirts',
  'resource_field',
  'meadow',
  'forest',
  'shore',
  'mountains',
  'river',
  'lake',
  'swamp',
  'ruins',
]);

/**
 * One ordinary exploration decision may move toward a local frontier, not a
 * coordinate on the other side of the continent. 80 map units = 8 km. Longer
 * journeys remain possible only as a sequence of lived, mapped local legs.
 */
export const MAX_LOCAL_EXPLORATION_TARGET_DISTANCE = 80;
export const MAX_PLANNED_EXPLORATION_TARGET_DISTANCE = 40;

function distanceFromAgent(agent: Readonly<AgentState>, place: Readonly<WorldPlace>): number {
  return Math.hypot(place.mapX - agent.position.x, place.mapY - agent.position.y);
}

/** Selects where a resident's own explore decision leads. It ranks only
 * places the resident already knows and can physically reach; it never grants
 * knowledge, creates a journey or chooses exploration for the resident. */
export function residentExplorationTarget(
  world: Readonly<WorldState>,
  agent: Readonly<AgentState>,
  canReach: (placeId: string) => boolean,
  mappedPlaceIds: readonly string[] = [],
  choiceRoll?: number,
): string {
  // Repair a stale persisted dungeon plan before normal exploration target
  // selection. Goblins/orcs are not adventure-candidate peoples in v19, but
  // older saves could retain a dungeon_expedition plan and keep reselecting it.
  if (
    agent.plan?.kind === 'dungeon_expedition' &&
    !['human', 'elf', 'dwarf'].includes(agent.race ?? 'human')
  ) {
    (agent as AgentState).plan = undefined;
  }

  const known = new Set(agent.knownPlaceIds ?? []);
  known.add(agent.locationId);
  known.add(agent.homeId);
  const home = world.places[agent.homeId];
  const homeSettlementId = home?.settlementId;
  const planned = agent.plan?.kind === 'explore_frontier'
    ? world.places[agent.plan.targetPlaceId]
    : undefined;
  if (
    planned &&
    known.has(planned.id) &&
    !EXCLUDED_TARGET_KINDS.has(planned.kind) &&
    (planned.settlementId !== homeSettlementId || WILDERNESS_KINDS.has(planned.kind)) &&
    distanceFromAgent(agent, planned) <= MAX_PLANNED_EXPLORATION_TARGET_DISTANCE &&
    canReach(planned.id)
  ) {
    return planned.id;
  }
  // A legacy plan that points across the continent is preserved nowhere as an
  // instruction. The resident may still keep the old place in memory, but must
  // approach it through ordinary local decisions and real traversals.
  if (planned && distanceFromAgent(agent, planned) > MAX_PLANNED_EXPLORATION_TARGET_DISTANCE) {
    (agent as AgentState).plan = undefined;
  }

  // Local surveying remains normal early behaviour. But if a resident has
  // spent many recent attempts looping on the same distress/recovery pattern,
  // an independently chosen explore action should no longer collapse back into
  // staying in exactly the same place. This only unlocks a target the resident
  // already knows and can physically reach below.
  const recentLearning = agent.learning?.recent ?? [];
  const recentDistressLoop = recentLearning.length >= 12 &&
    recentLearning.slice(-12).filter((attempt) =>
      attempt.problem === 'distress' &&
      ['rest', 'relax', 'reflect'].includes(attempt.action),
    ).length >= 9;
  const mapped = new Set(mappedPlaceIds);
  const current = world.places[agent.locationId];
  // A first local survey is useful. An already surveyed home/field must not
  // swallow 55% of every later generation's independently chosen exploration.
  // Resurveying remains a weighted candidate below, not a compulsory exit.
  if (!recentDistressLoop && current && !EXCLUDED_TARGET_KINDS.has(current.kind) &&
      !mapped.has(current.id) && choiceRoll !== undefined && choiceRoll < 0.55) {
    return agent.locationId;
  }
  const candidates = [...known]
    .map((id) => world.places[id])
    .filter(
      (place): place is WorldPlace =>
        Boolean(place) &&
        !EXCLUDED_TARGET_KINDS.has(place.kind) &&
        distanceFromAgent(agent, place) <= MAX_LOCAL_EXPLORATION_TARGET_DISTANCE &&
        canReach(place.id),
    );

  let identityHash = 2166136261;
  for (const char of `${world.id}:${agent.id}`) {
    identityHash ^= char.charCodeAt(0);
    identityHash = Math.imul(identityHash, 16777619);
  }
  const preferredBearing = ((identityHash >>> 0) / 0xffffffff) * Math.PI * 2;
  const scores = new Map<string, number>();
  const score = (place: WorldPlace): number => {
    const cached = scores.get(place.id);
    if (cached !== undefined) return cached;
    const outsideRank = place.settlementId === undefined
      ? 3
      : place.settlementId !== homeSettlementId
        ? 2
        : 0;
    const wildernessRank = WILDERNESS_KINDS.has(place.kind) ? 1 : 0;
    const unmappedRank = mapped.has(place.id) ? 0 : 1;
    const distance = distanceFromAgent(agent, place);
    const bearing = home
      ? Math.atan2(place.mapY - home.mapY, place.mapX - home.mapX)
      : 0;
    const directionalFit = (Math.cos(bearing - preferredBearing) + 1) / 2;
    const terrainFit =
      place.kind === 'forest'
        ? agent.personality.curiosity * 0.18
        : place.kind === 'mountains' || place.kind === 'ruins'
          ? agent.personality.riskTolerance * 0.2
          : place.kind === 'shore' || place.kind === 'river'
            ? agent.personality.resilience * 0.12
            : 0;
    const value = outsideRank * 1.2 + wildernessRank * 0.42 + unmappedRank * 0.9 +
      -Math.log1p(distance) * 0.9 + directionalFit * 0.36 + terrainFit;
    scores.set(place.id, value);
    return value;
  };
  const uncharted = candidates.filter(place => !mapped.has(place.id));
  const frontierCandidates = uncharted.length ? uncharted : candidates;
  frontierCandidates.sort((left, right) => score(right) - score(left) || left.id.localeCompare(right.id));
  if (frontierCandidates.length === 0) return agent.locationId;
  const pool = frontierCandidates.slice(0, Math.min(7, frontierCandidates.length));
  const best = score(pool[0]);
  const weights = pool.map((place) =>
    Math.exp((score(place) - best) / (0.2 + agent.personality.curiosity * 0.18)),
  );
  const fallbackRoll = ((world.determinism.rngState >>> 0) / 0xffffffff +
    ((agent.id.length * 0.61803398875) % 1)) % 1;
  let roll = Math.max(0, Math.min(0.999999, choiceRoll ?? fallbackRoll)) *
    weights.reduce((sum, weight) => sum + weight, 0);
  for (let index = 0; index < pool.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) return pool[index].id;
  }
  return pool.at(-1)?.id ?? agent.locationId;
}
