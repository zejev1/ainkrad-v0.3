import type { AgentActionKind, AgentState, WorldState } from '../types';
import type { ResidentLearningContext } from './types';
import { beginLearningAttempt as begin, finishLearningAttempt as finish, cancelLearningAttempt } from './ResidentLearning';
import { learnedActionAdjustment as advise } from './MethodMemory';

/** World boundary: reasoning receives only the resident's own reading and local context. */
function contextFor(world: Readonly<WorldState>, agent: Readonly<AgentState>): ResidentLearningContext {
  return {
    worldMinute: world.calendar.elapsedWorldMinutes,
    placeKind: world.places[agent.locationId]?.kind ?? 'unknown',
    ownKnowledge: world.v18?.secretLibrary.knowledgeByAgentId[agent.id] ?? [],
  };
}

export function beginLearningAttempt(world: Readonly<WorldState>, agent: AgentState, action: AgentActionKind): void {
  if(agent.life.alive && agent.life.health>0 && agent.life.diedAt===undefined) begin(contextFor(world,agent),agent,action);
}

export function finishLearningAttempt(world: Readonly<WorldState>, agent: AgentState) {
  if(!agent.life.alive || agent.life.health<=0) { cancelLearningAttempt(agent,world.calendar.elapsedWorldMinutes); return; }
  return finish(contextFor(world,agent),agent);
}

export function learnedActionAdjustment(world: Readonly<WorldState>, agent: Readonly<AgentState>, action: AgentActionKind): number {
  return agent.life.alive && agent.life.health>0 ? advise(contextFor(world,agent),agent,action) : 0;
}
