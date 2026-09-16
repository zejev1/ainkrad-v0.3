import type { AgentState, WorldState } from './types';
import type { V18ExplorationEvidence } from '../v18/types';
import { ensureLivelihoodV18 } from '../v18/LivelihoodAndRhythmV18';

/** Additive, bounded receipts. Old saves start tracking now, not with invented
 * historical journeys inferred from an old map or a profession label. */
export function explorationEvidence(world: WorldState, agent: Readonly<AgentState>): V18ExplorationEvidence {
  const livelihood = ensureLivelihoodV18(world, agent);
  return livelihood.explorationEvidence ??= {
    sinceWorldMinute: world.calendar.elapsedWorldMinutes,
    choices: 0, journeyAttempts: 0, journeysStarted: 0, failedRoutes: 0,
    arrivals: 0, surveys: 0, newlyMapped: 0, campRests: 0,
    provisionsTaken: 0, practicalLessons: 0,
  };
}

/** Arrival and surveying are separate facts. Arrival never forces the next
 * decision, grants mapped territory or awards an adventurer profession. */
export function recordExplorationArrival(world: WorldState, agent: Readonly<AgentState>): void {
  const evidence = world.v18?.livelihoodByAgentId[agent.id]?.explorationEvidence;
  if (!evidence || agent.movement || evidence.pendingTargetPlaceId !== agent.locationId) return;
  evidence.arrivals += 1;
  evidence.pendingTargetPlaceId = undefined;
}
