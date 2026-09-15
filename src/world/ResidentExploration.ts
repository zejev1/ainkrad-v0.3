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
    Math.hypot(planned.mapX - agent.position.x, planned.mapY - agent.position.y) < 40 &&
    canReach(planned.id)
  ) {
    return planned.id;
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
        canReach(place.id),
    );

  const score = (place: WorldPlace): number => {
      const outsideRank = place.settlementId === undefined
        ? 3
        : place.settlementId !== homeSettlementId
          ? 2
          : 0;
      const wildernessRank = WILDERNESS_KINDS.has(place.kind) ? 1 : 0;
      const unmappedRank = mapped.has(place.id) ? 0 : 1;
      const distance = Math.hypot(place.mapX - agent.position.x, place.mapY - agent.position.y);
      const bearing = home
        ? Math.atan2(place.mapY - home.mapY, place.mapX - home.mapX)
        : 0;
      let identityHash = 2166136261;
      for (const char of `${world.id}:${agent.id}`) {
        identityHash ^= char.charCodeAt(0);
        identityHash = Math.imul(identityHash, 16777619);
      }
      const preferredBearing = ((identityHash >>> 0) / 0xffffffff) * Math.PI * 2;
      const directionalFit = (Math.cos(bearing - preferredBearing) + 1) / 2;
      const terrainFit =
        place.kind === 'forest'
          ? agent.personality.curiosity * 0.18
          : place.kind === 'mountains' || place.kind === 'ruins'
            ? agent.personality.riskTolerance * 0.2
            : place.kind === 'shore' || place.kind === 'river'
              ? agent.personality.resilience * 0.12
              : 0;
      return outsideRank * 1.2 + wildernessRank * 0.42 + unmappedRank * 0.9 +
        -Math.log1p(distance) * 0.9 + directionalFit * 0.36 + terrainFit;
  };
  candidates.sort((left, right) => score(right) - score(left) || left.id.localeCompare(right.id));
  if (candidates.length === 0) return agent.locationId;
  const pool = candidates.slice(0, Math.min(7, candidates.length));
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
