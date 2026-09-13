import type { AgentState, WorldPlace, WorldState } from '../world/types';

/**
 * A home belongs to living residents through homeId, not through the place
 * where their body happens to be. A traveller therefore keeps their home.
 */
export function livingHomeClaimantsV21(
  world: Readonly<WorldState>,
  homeId: string,
): AgentState[] {
  return Object.values(world.agents)
    .filter((agent) => agent.life.alive && agent.homeId === homeId)
    .sort((left, right) => left.id.localeCompare(right.id));
}

/** Only a finished home with no living claimant can be repaired and reused. */
export function reusableAbandonedHomesV21(
  world: Readonly<WorldState>,
  settlementId: string,
): WorldPlace[] {
  const claimedHomeIds = new Set(
    Object.values(world.agents)
      .filter((agent) => agent.life.alive)
      .map((agent) => agent.homeId),
  );
  const settlement = world.settlements[settlementId];
  if (!settlement) return [];
  return settlement.memberPlaceIds
    .map((placeId) => world.places[placeId])
    .filter(
      (place): place is WorldPlace =>
        place?.kind === 'home' && !claimedHomeIds.has(place.id),
    )
    .sort(
      (left, right) =>
        (left.discoveredAt ?? 0) - (right.discoveredAt ?? 0) ||
        left.id.localeCompare(right.id),
    );
}
