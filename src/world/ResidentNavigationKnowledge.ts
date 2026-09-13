import type { AgentState, WorldState } from './types';

/** A familiar meeting place is a place to look/ask, not knowledge of an unseen source. */
export function knownMeetingPlace(world: Readonly<WorldState>, agent: Readonly<AgentState>): string | undefined {
  return (agent.knownPlaceIds ?? []).map(id=>world.places[id])
    .filter(p=>p && p.id!==agent.locationId &&
      ['commons','quiet_space','workshop','village','city'].includes(p.kind) &&
      p.surface!=='water')
    .sort((a,b)=>Math.hypot(a.mapX-agent.position.x,a.mapY-agent.position.y)-
      Math.hypot(b.mapX-agent.position.x,b.mapY-agent.position.y) || a.id.localeCompare(b.id))[0]?.id;
}

/** Being alone at home is not proof that social life is unavailable. A
 * resident who remembers a reachable public meeting place may choose to go
 * there; the decision remains theirs. */
export function socialOpportunityAvailable(
  world: Readonly<WorldState>,
  agent: Readonly<AgentState>,
  localAgents: readonly Readonly<AgentState>[],
): boolean {
  return localAgents.some(
    (other) => other.id !== agent.id && other.life.alive,
  ) || knownMeetingPlace(world, agent) !== undefined;
}
