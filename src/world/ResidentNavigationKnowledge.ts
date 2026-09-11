import type { AgentState, WorldState } from './types';

/** A familiar meeting place is a place to look/ask, not knowledge of an unseen source. */
export function knownMeetingPlace(world: Readonly<WorldState>, agent: Readonly<AgentState>): string | undefined {
  return (agent.knownPlaceIds ?? []).map(id=>world.places[id])
    .filter(p=>p && p.id!==agent.locationId && p.kind==='commons' && p.surface!=='water')
    .sort((a,b)=>Math.hypot(a.mapX-agent.position.x,a.mapY-agent.position.y)-
      Math.hypot(b.mapX-agent.position.x,b.mapY-agent.position.y) || a.id.localeCompare(b.id))[0]?.id;
}
