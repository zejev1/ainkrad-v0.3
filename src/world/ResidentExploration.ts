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
): string {
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
    canReach(planned.id)
  ) {
    return planned.id;
  }

  const mapped = new Set(mappedPlaceIds);
  const candidates = [...known]
    .map((id) => world.places[id])
    .filter(
      (place): place is WorldPlace =>
        Boolean(place) &&
        !EXCLUDED_TARGET_KINDS.has(place.kind) &&
        canReach(place.id),
    );

  candidates.sort((left, right) => {
    const rank = (place: WorldPlace) => {
      const outsideRank = place.settlementId === undefined
        ? 3
        : place.settlementId !== homeSettlementId
          ? 2
          : 0;
      const wildernessRank = WILDERNESS_KINDS.has(place.kind) ? 1 : 0;
      const unmappedRank = mapped.has(place.id) ? 0 : 1;
      const distance = home
        ? Math.hypot(place.mapX - home.mapX, place.mapY - home.mapY)
        : 0;
      return [outsideRank, wildernessRank, unmappedRank, distance] as const;
    };
    const a = rank(left);
    const b = rank(right);
    return b[0] - a[0] || b[1] - a[1] || b[2] - a[2] || b[3] - a[3] ||
      left.id.localeCompare(right.id);
  });
  return candidates[0]?.id ?? agent.locationId;
}
