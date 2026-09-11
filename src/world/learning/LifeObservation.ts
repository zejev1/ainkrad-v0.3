import type { AgentState } from '../types';
import type { LifeProblem, LifeObservation } from './types';

export const PROBLEM_LABELS: Record<LifeProblem, string> = {
  provisions: 'не хватает собственных припасов', fatigue: 'нужно восстановить силы',
  distress: 'нужно справиться с напряжением', company: 'не хватает общения', purpose: 'хочется быть полезным',
};
export function observeOwnLife(agent: Readonly<AgentState>): LifeObservation {
  return {provisions: agent.resources, energy: agent.energy, stress: agent.stress,
    belonging: agent.needs.belonging, purpose: agent.needs.purpose, health: agent.life.health};
}

export function noticeLifeProblem(agent: Readonly<AgentState>): LifeProblem | undefined {
  const needs: Array<[LifeProblem, number]> = [
    ['provisions', Math.max(0, 0.48-agent.resources)*1.5],
    ['fatigue', Math.max(0, 0.65-agent.energy)*1.2],
    ['distress', Math.max(0, agent.stress-0.3)],
    ['company', Math.max(0, 0.58-agent.needs.belonging)*(0.5+agent.personality.sociability*0.5)],
    ['purpose', Math.max(0, 0.55-agent.needs.purpose)*(0.5+agent.personality.diligence*0.5)],
  ];
  needs.sort((a,b)=>b[1]-a[1]);
  return needs[0][1] > 0.06 ? needs[0][0] : undefined;
}

export function observedEffect(problem: LifeProblem, before: LifeObservation, after: LifeObservation): number {
  switch(problem) {
    case 'provisions': return after.provisions-before.provisions;
    case 'fatigue': return after.energy-before.energy;
    case 'distress': return before.stress-after.stress;
    case 'company': return after.belonging-before.belonging;
    case 'purpose': return after.purpose-before.purpose;
  }
}

