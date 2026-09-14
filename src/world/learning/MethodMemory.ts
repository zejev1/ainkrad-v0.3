import type { AgentActionKind, AgentState } from '../types';
import type { ResidentLearningContext, LifeProblem, LearnedMethod } from './types';
import { noticeLifeProblem } from './LifeObservation';
const clamp = (n: number, low = 0, high = 1) => Math.max(low, Math.min(high, n));

export function predictedEffect(method: LearnedMethod, problem: LifeProblem): number {
  return method.problem===problem ? method.expectedGain : method.observedEffects[problem];
}

export function recalled(context: Readonly<ResidentLearningContext>, agent: Readonly<AgentState>, problem: LifeProblem, action: AgentActionKind): LearnedMethod[] {
  const known = new Set(agent.knownPlaceIds ?? []);
  known.add(agent.homeId); known.add(agent.locationId);
  return (agent.learning?.methods ?? []).filter(m=>m.action===action &&
    (m.problem===problem || Math.abs(predictedEffect(m,problem))>0.005) &&
    known.has(m.placeId) && m.trials>0)
    .sort((a,b)=>(b.confidence*Math.abs(predictedEffect(b,problem)))-(a.confidence*Math.abs(predictedEffect(a,problem)))).slice(0,3);
}

/** Advice competes with personality, need and uncertainty. It never overrides age or physics. */
export function learnedActionAdjustment(context: Readonly<ResidentLearningContext>, agent: Readonly<AgentState>, action: AgentActionKind): number {
  const problem=noticeLifeProblem(agent);
  if (!problem) return 0;
  const memories=recalled(context,agent,problem,action);
  // A personally understood subject suggests a trial, never a successful outcome.
  if (!memories.length) return knowledgeTrialAdvice(context,agent,action,problem);
  const minute=context.worldMinute;
  let sum=0,weight=0;
  for(const m of memories) {
    const ageYears=Math.max(0,minute-m.lastWorldMinute)/(365*1440);
    const relevance=(m.placeId===agent.locationId ? 1 : 0.7)/(1+ageYears*0.12);
    const belief=clamp(predictedEffect(m,problem)/0.08,-1,1);
    const transferConfidence=m.problem===problem ? m.confidence : Math.min(0.35,m.confidence);
    // Repeated confirmation is memory, not an endlessly growing reason to do
    // the same thing. After a method is well established its decision weight
    // tapers, leaving room for other personally plausible solutions.
    const saturation = m.trials <= 8 ? 1 : Math.max(0.22, 8 / m.trials);
    sum += belief*transferConfidence*relevance*saturation; weight+=relevance;
  }
  return clamp(sum/Math.max(1,weight)*0.32,-0.32,0.32);
}

/** Compare previously tried sites, without reading their unobserved current stocks. */
export function learnedSiteAdjustment(agent: Readonly<AgentState>, action: AgentActionKind, placeId: string): number {
  const problem=agent.learning?.pending?.problem ?? noticeLifeProblem(agent);
  if(!problem)return 0;
  const method=agent.learning?.methods.find(m=>m.action===action&&m.problem===problem&&m.placeId===placeId);
  return method ? clamp(method.expectedGain/0.08,-1,1)*method.confidence : 0;
}

export function relevantKnowledge(context: Readonly<ResidentLearningContext>, agent: Readonly<AgentState>, action: AgentActionKind): string[] {
  const categories: Partial<Record<AgentActionKind,string[]>> = {
    gather:['agriculture','biology','logistics'], work:['construction','craft','metallurgy','engineering'],
    help:['medicine','education'], rest:['medicine'], hunt:['military','biology','logistics'],
    explore:['navigation','astronomy','logistics'], socialize:['education','trade','philosophy'],
    reflect:['philosophy','education'], bond:['education'], relax:['medicine'],
  };
  return context.ownKnowledge
    .filter(k=>k.understanding>=0.22 && categories[action]?.includes(k.category))
    .sort((a,b)=>b.understanding-a.understanding).slice(0,3).map(k=>k.knowledgeId);
}

function knowledgeTrialAdvice(context: Readonly<ResidentLearningContext>, agent: Readonly<AgentState>, action: AgentActionKind, problem: LifeProblem): number {
  const problemSubjects: Record<LifeProblem,string[]>={
    provisions:['agriculture','biology','logistics','craft','trade'], fatigue:['medicine'],
    distress:['medicine','philosophy'], company:['education','philosophy'], purpose:['education','craft','engineering'],
  };
  const candidateIds=new Set(relevantKnowledge(context,agent,action));
  const understood=context.ownKnowledge.filter(k=>
    candidateIds.has(k.knowledgeId)&&problemSubjects[problem].includes(k.category));
  return understood.length ? Math.min(0.045,understood.reduce((n,k)=>n+k.understanding,0)*0.025) : 0;
}

