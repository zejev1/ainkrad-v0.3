import type { AgentState, WorldState } from '../world/types';
import { isBodySleepingV21 } from '../v21/BodySleepV21';
import { MARITIME_PRIMER, harborForPlaceV22, maritimeKnowledgeV22, maritimePointV22, maritimePrimerAvailableV22, maritimeStateV22, type MaritimeSubjectV22 } from './MaritimeFoundationV22';

export interface MaritimeLearningResultV22 {
  agentId: string; placeId: string; subject: MaritimeSubjectV22;
  startedWorldMinute: number; endedWorldMinute: number; minutes: number;
  completed: boolean; understanding: number; source: string;
}
export function beginMaritimeStudyV22(world: WorldState, agent: AgentState, subject: MaritimeSubjectV22): boolean {
  const harbor=harborForPlaceV22(world,agent.locationId);
  const threshold=subject==='swimming'?0.5:0.72;
  if (!agent.life.alive || agent.life.ageYears<13 || agent.movement || agent.energy<0.2 ||
      isBodySleepingV21(world,agent.id) || !harbor || !maritimePrimerAvailableV22(world,agent.locationId) ||
      (world.maritime?.knowledge[agent.id]?.[subject]??0)>=threshold || world.maritime?.studies[agent.id]) return false;
  const p=world.places[agent.locationId];
  if (Math.hypot(agent.position.x-p.mapX,agent.position.y-p.mapY)>0.02) return false;
  const state=maritimeStateV22(world), minute=world.calendar.elapsedWorldMinutes;
  state.studies[agent.id]={agentId:agent.id,placeId:agent.locationId,subject,bookId:MARITIME_PRIMER,
    startedWorldMinute:minute,endsWorldMinute:minute+30};
  return true;
}

/** Completion time is absolute, not caller frame size. Nobody learns a page
 * instantly at launch, by closing the tab, or while absent from its copy. */
export function advanceMaritimeStudiesV22(world: WorldState, endMinute: number): MaritimeLearningResultV22[] {
  const results: MaritimeLearningResultV22[]=[];
  for (const lesson of Object.values(world.maritime?.studies??{})) {
    const a=world.agents[lesson.agentId], p=world.places[lesson.placeId];
    const present=!!a?.life.alive && !a.movement && a.locationId===lesson.placeId && !!p &&
      Math.hypot(a.position.x-p.mapX,a.position.y-p.mapY)<=0.02 && !isBodySleepingV21(world,a.id) &&
      maritimePrimerAvailableV22(world,lesson.placeId);
    if (present && endMinute<lesson.endsWorldMinute) continue;
    const record=world.maritime!.knowledge[lesson.agentId];
    const completed=present && endMinute>=lesson.endsWorldMinute;
    if (completed) {
      const learned=maritimeKnowledgeV22(world,a.id);
      const literacy=world.v18?.languageByAgentId[a.id]?.cyrillicLiteracy??0.1;
      const gain=0.12+Math.max(0,Math.min(1,literacy))*0.09+a.personality.curiosity*0.04;
      learned[lesson.subject]=Math.min(0.74,learned[lesson.subject]+gain);
      learned.readingMinutes+=30;
      learned.firstLearnedWorldMinute??=lesson.endsWorldMinute;
      learned.lastLearnedWorldMinute=lesson.endsWorldMinute;
    }
    results.push({agentId:lesson.agentId,placeId:lesson.placeId,subject:lesson.subject,
      startedWorldMinute:lesson.startedWorldMinute,endedWorldMinute:completed?lesson.endsWorldMinute:endMinute,
      minutes:completed?30:0,completed,understanding:world.maritime!.knowledge[lesson.agentId]?.[lesson.subject]??record?.[lesson.subject]??0,
      source:lesson.bookId});
    delete world.maritime!.studies[lesson.agentId];
  }
  return results;
}

/** A constructive voluntary conversation can carry theory, never motor skill,
 * secret-library admission, distant coordinates or a command to swim. */
export function shareMaritimeKnowledgeV22(world: WorldState, teacher: AgentState, pupil: AgentState): MaritimeSubjectV22[] {
  const source=world.maritime?.knowledge[teacher.id];
  if (!source || teacher.id===pupil.id || !teacher.life.alive || !pupil.life.alive || teacher.movement || pupil.movement ||
      teacher.locationId!==pupil.locationId || Math.hypot(teacher.position.x-pupil.position.x,teacher.position.y-pupil.position.y)>0.08) return [];
  const subjects: MaritimeSubjectV22[]=[];
  for (const subject of ['boat','fishing','swimming'] as const) {
    const prior=world.maritime?.knowledge[pupil.id]?.[subject]??0;
    if (source[subject]<0.3 || source[subject]-prior<0.08) continue;
    const target=maritimeKnowledgeV22(world,pupil.id);
    target[subject]=Math.min(source[subject]*0.8,target[subject]+0.05+teacher.skills.social*0.025);
    target.firstLearnedWorldMinute??=world.calendar.elapsedWorldMinutes;
    target.lastLearnedWorldMinute=world.calendar.elapsedWorldMinutes;
    source.lessonsGiven++;
    subjects.push(subject);
  }
  return subjects;
}
