import type { AgentState, WorldState } from './types';
import { cancelLearningAttempt } from './learning/ResidentLearning';

/** Intent cannot authorize a body that is dead or has no remaining health. */
export function canResidentAct(agent: Readonly<AgentState>): boolean {
  return agent.life.alive && agent.life.health>0 && agent.life.diedAt===undefined;
}

/** End execution, preserving identity, relationships, knowledge and all prior experience. */
export function stopDeceasedActions(world: WorldState, agent: AgentState): void {
  if(agent.life.alive)return;
  agent.life.health=0;
  agent.movement=undefined;
  agent.plan=undefined;
  agent.lastAction=undefined;
  agent.lastDecision=undefined;
  const rhythm=world.v18?.lifeRhythmByAgentId[agent.id];
  if(rhythm)rhythm.pendingArrivalAction=undefined;
  cancelLearningAttempt(agent,world.calendar.elapsedWorldMinutes);
}

/** Additive legacy repair: no resurrection, duplicate death, time advance or RNG use. */
export function repairDeceasedActions(world: WorldState): void {
  for(const agent of Object.values(world.agents))if(!agent.life.alive)stopDeceasedActions(world,agent);
}

export function assertDeceasedBody(agent: Readonly<AgentState>): void {
  if(!agent.life.alive && (agent.life.health!==0 || agent.movement || agent.plan || agent.lastAction ||
    agent.lastDecision || agent.learning?.pending))throw new Error(`Dead resident ${agent.id} cannot retain an active action`);
}
