import type { AgentActionKind, AgentState, WorldState } from '../world/types';
import { PROBLEM_LABELS, noticeLifeProblem, type AttemptResult } from '../world/learning/index';
import { HUMAN_KNOWLEDGE_V18 } from '../v18/HumanKnowledgeV18';

const actions: Record<AgentActionKind,string> = {
  rest:'отдых',relax:'отдых на природе',walk:'прогулка',gather:'сбор припасов',hunt:'охота',work:'работа',
  socialize:'общение',help:'помощь',explore:'исследование',reflect:'размышление',bond:'сближение',pray:'молитва',
};
const outcomes: Record<AttemptResult['outcome'],string>={helped:'помогло',ineffective:'не помогло',harmful:'стало хуже',abandoned:'замысел изменился'};
const outcomeText=(r:AttemptResult)=>r.reason==='body_unavailable'?'смерть прервала попытку':outcomes[r.outcome];
const percent=(n:number)=>`${Math.round(n*100)}%`;
const score=(n:number)=>`${n>0?'+':''}${Math.round(n*100)}`;
const knowledgeTitles=new Map(HUMAN_KNOWLEDGE_V18.map(k=>[k.id,k.title]));

/** Observer descriptions, never fabricated first-person speech or hidden thoughts. */
export function residentLearningSummary(agent: Readonly<AgentState>): string {
  const state=agent.learning;
  if(!state?.totalEvaluated&&!state?.pending)return 'Личные попытки ещё не записаны';
  const last=state.recent.at(-1);
  return `${state.totalEvaluated} проверенных попыток${last ? ` · ${actions[last.action]}: ${outcomeText(last)}` : ''}${state.pending ? ' · следующая попытка в пути или в работе' : ''}`;
}

export function residentLearningRows(world: Readonly<WorldState>, agent: Readonly<AgentState>): Array<{label:string;value:string}> {
  const state=agent.learning, problem=noticeLifeProblem(agent);
  const rows=[{label:'Замеченная потребность',value:problem?PROBLEM_LABELS[problem]:'нет выраженной неудовлетворённой потребности'},
    {label:'Личный опыт',value:residentLearningSummary(agent)}];
  if(state?.pending) {
    const p=state.pending;
    rows.push({label:'Текущая попытка',value:`${actions[p.action]} · ${world.places[p.targetPlaceId]?.name??p.targetPlaceId} · ${p.phase==='travelling'?'ещё идёт к месту; результата пока нет':'проверяет способ'}`});
  }
  for(const r of [...(state?.recent??[])].reverse()) {
    const year=1+Math.floor(r.finishedWorldMinute/(365*1440));
    const before=r.before,after=r.after;
    const recalled=r.recalledMethodIds.length ? ` Вспомнил ${r.recalledMethodIds.length} собственных способов.` : '';
    const reading=r.knowledgeIds.length ? ` Связанные прочитанные знания: ${r.knowledgeIds.map(id=>knowledgeTitles.get(id)??id).join(', ')}.` : '';
    const receiver=r.beneficiaryId ? ` Для ${world.agents[r.beneficiaryId]?.name??r.beneficiaryId}: ${(r.beneficiaryGain??0)>0?'получена помощь':'измеримой помощи не получено'}.` : '';
    rows.push({label:`Год ${year} · ${actions[r.action]} · ${outcomeText(r)}`,
      value:`Причина: ${PROBLEM_LABELS[r.problem]}. Место: ${world.places[r.placeId]?.name??r.placeId}. Припасы ${percent(before.provisions)} → ${percent(after.provisions)}, силы ${percent(before.energy)} → ${percent(after.energy)}, напряжение ${percent(before.stress)} → ${percent(after.stress)}. Оценка: ожидал ${score(r.expectedGain)}, получил ${score(r.observedGain)} из 100.${recalled}${reading}${receiver}`});
  }
  if(state?.methods.length) {
    rows.push({label:'Как это влияет на следующие решения',value:'Повторяет удачные способы чаще, после неудач пересматривает ожидания. Побочный результат прошлого действия может подсказать способ решить другую проблему. Это предположение до новой проверки.'});
    rows.push({label:'Долгая память',value:`${state.methods.length} обобщённых способов; подробности последних ${state.recent.length} попыток. Более ранние детали сворачиваются в число проверок и оценку результата.`});
  }
  return rows;
}
