import type { AgentActionKind, AgentState } from '../types';
import type { ResidentLearningContext, LifeProblem, ResidentLearningState, AttemptResult } from './types';
import { MAX_LEARNED_METHODS, MAX_RECENT_ATTEMPTS } from './types';
import { PROBLEM_LABELS, noticeLifeProblem, observeOwnLife, observedEffect } from './LifeObservation';
import { recalled, predictedEffect, relevantKnowledge } from './MethodMemory';
const PROBLEMS = Object.keys(PROBLEM_LABELS) as LifeProblem[];
const clamp = (n: number, low = 0, high = 1) => Math.max(low, Math.min(high, n));

/** Lazy additive state: opening an old save invents no experiences or successes. */
export function learningFor(agent: AgentState): ResidentLearningState {
  return agent.learning ??= {version: 1, sequence: 0, totalEvaluated: 0, methods: [], recent: []};
}

function archive(state: ResidentLearningState, result: AttemptResult): void {
  state.recent.push(result);
  if(state.recent.length>MAX_RECENT_ATTEMPTS)state.recent.shift();
}

export function cancelLearningAttempt(agent: AgentState, worldMinute: number): void {
  const state=agent.learning,p=state?.pending;
  if(!state||!p)return;
  archive(state,{id:p.id,problem:p.problem,action:p.action,placeId:agent.locationId,
    startedWorldMinute:p.startedWorldMinute,finishedWorldMinute:worldMinute,expectedGain:p.expectedGain,
    observedGain:0,outcome:'abandoned',reason:'body_unavailable',before:p.before,after:observeOwnLife(agent),
    knowledgeIds:p.knowledgeIds,recalledMethodIds:p.recalledMethodIds});
  state.pending=undefined;
}

export function beginLearningAttempt(context: Readonly<ResidentLearningContext>, agent: AgentState, action: AgentActionKind): void {
  const problem=noticeLifeProblem(agent);
  if(!problem&&!agent.learning?.pending)return;
  const state=learningFor(agent), minute=context.worldMinute, pending=state.pending;
  // Arrival is not success. Only the actual action at the destination can evaluate its method.
  if(pending && pending.action===action && pending.targetPlaceId===agent.locationId) {
    pending.phase='acting'; pending.before=observeOwnLife(agent); return;
  }
  if(pending) {
    archive(state,{id:pending.id,problem:pending.problem,action:pending.action,placeId:pending.targetPlaceId,
      startedWorldMinute:pending.startedWorldMinute,finishedWorldMinute:minute,expectedGain:pending.expectedGain,
      observedGain:0,outcome:'abandoned',reason:'changed_intention',before:pending.before,after:observeOwnLife(agent),knowledgeIds:pending.knowledgeIds,recalledMethodIds:pending.recalledMethodIds});
    state.pending=undefined;
  }
  if(!problem)return;
  const memories=recalled(context,agent,problem,action);
  state.pending={id:++state.sequence,problem,action,sourcePlaceId:agent.locationId,targetPlaceId:agent.locationId,
    startedWorldMinute:minute,before:observeOwnLife(agent),expectedGain:memories[0]?predictedEffect(memories[0],problem):0,
    knowledgeIds:relevantKnowledge(context,agent,action),recalledMethodIds:memories.map(m=>m.id),phase:'acting'};
}

/** Receipts are written only by the world operation that actually produced the material/help. */
export function noteLearningMaterial(agent: AgentState, material: string, amount: number): void {
  if(agent.learning?.pending) { agent.learning.pending.material=material; agent.learning.pending.materialAmount=amount; }
}

export function noteLearningHelp(agent: AgentState, otherId: string, before: number, after: number): void {
  const p=agent.learning?.pending;
  if(p) { p.beneficiaryId=otherId; p.beneficiaryBefore=before; p.beneficiaryAfter=after; }
}

export function finishLearningAttempt(context: Readonly<ResidentLearningContext>, agent: AgentState): AttemptResult | undefined {
  const state=agent.learning,pending=state?.pending;
  if(!state||!pending)return;
  if(agent.movement) {
    pending.phase='travelling'; pending.targetPlaceId=agent.movement.targetPlaceId; return;
  }
  const after=observeOwnLife(agent), actual=agent.lastAction;
  const didAct=actual===pending.action;
  let gain=didAct?observedEffect(pending.problem,pending.before,after):0;
  let reason: AttemptResult['reason']=!didAct?'different_action':Math.abs(gain)>0.002?'measured_change':'no_change';
  if(pending.action==='gather'&&pending.materialAmount!==undefined&&pending.materialAmount<=0.00001) {
    gain=Math.min(0,gain);reason='no_resources';
  }
  const beneficiaryGain=pending.beneficiaryAfter!==undefined&&pending.beneficiaryBefore!==undefined
    ? pending.beneficiaryAfter-pending.beneficiaryBefore : undefined;
  if(beneficiaryGain!==undefined)reason=beneficiaryGain>0.00001?'recipient_helped':'recipient_declined';
  // Cost and harm are evidence too; getting resources while seriously hurt is not an unqualified success.
  gain-=Math.max(0,pending.before.health-after.health)*0.5;
  if(pending.problem!=='fatigue')gain-=Math.max(0,pending.before.energy-after.energy)*0.1;
  gain=clamp(gain,-1,1);
  const outcome: AttemptResult['outcome']=!didAct?'abandoned':gain>0.005?'helped':gain< -0.005?'harmful':'ineffective';
  const result: AttemptResult={id:pending.id,problem:pending.problem,action:pending.action,placeId:agent.locationId,
    startedWorldMinute:pending.startedWorldMinute,finishedWorldMinute:context.worldMinute,
    expectedGain:pending.expectedGain,observedGain:gain,outcome,reason,before:pending.before,after,
    knowledgeIds:pending.knowledgeIds,recalledMethodIds:pending.recalledMethodIds,...(pending.beneficiaryId?{beneficiaryId:pending.beneficiaryId,beneficiaryGain}: {})};
  archive(state,result);state.pending=undefined;
  if(!didAct)return result;
  state.totalEvaluated++;
  const id=`${pending.problem}:${pending.action}:${agent.locationId}`;
  let method=state.methods.find(m=>m.id===id);
  if(!method) {
    if(state.methods.length>=MAX_LEARNED_METHODS) {
      state.methods.sort((a,b)=>a.lastWorldMinute-b.lastWorldMinute);state.methods.shift();
    }
    method={id,problem:pending.problem,action:pending.action,placeId:agent.locationId,
      placeKind:context.placeKind,trials:0,successes:0,failures:0,
      expectedGain:0,observedEffects:{provisions:0,fatigue:0,distress:0,company:0,purpose:0},confidence:0,lastWorldMinute:context.worldMinute,knowledgeIds:[],lastReason:reason};
    state.methods.push(method);
  }
  method.trials++;
  if(outcome==='helped')method.successes++;else method.failures++;
  // Recency weighting allows evidence to overturn an old habit when conditions change.
  const learningRate=method.trials===1?1:0.28;
  method.expectedGain=clamp(method.expectedGain*(1-learningRate)+gain*learningRate,-1,1);
  for(const problem of PROBLEMS) {
    method.observedEffects[problem]=clamp(method.observedEffects[problem]*(1-learningRate)+
      observedEffect(problem,pending.before,after)*learningRate,-1,1);
  }
  method.confidence=clamp(method.trials/(method.trials+3));
  method.lastWorldMinute=context.worldMinute;
  method.lastReason=reason;
  method.knowledgeIds=[...new Set([...method.knowledgeIds,...pending.knowledgeIds])].slice(-3);
  return result;
}
