import type { AgentActionKind } from '../types';
import type { LifeProblem } from './types';
import { MAX_LEARNED_METHODS, MAX_RECENT_ATTEMPTS } from './types';
import { PROBLEM_LABELS } from './LifeObservation';
const ACTIONS: AgentActionKind[] = ['rest','relax','walk','gather','hunt','work','socialize','help','explore','reflect','bond','pray'];
const PROBLEMS = Object.keys(PROBLEM_LABELS) as LifeProblem[];

/** Bad optional data is rejected, never silently turned into learned mastery. */
export function assertResidentLearning(value: unknown, worldMinute: number): void {
  if(value===undefined)return;
  const object=(v:unknown):Record<string,unknown>=>{
    if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('Resident learning must be an object');
    return v as Record<string,unknown>;
  };
  const number=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER)=>{
    if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error('Invalid resident learning number');
  };
  const text=(v:unknown)=>{if(typeof v!=='string'||!v.length||v.length>500)throw new Error('Invalid resident learning identifier');};
  const strings=(v:unknown,max:number)=>{if(!Array.isArray(v)||v.length>max)throw new Error('Invalid resident learning list');v.forEach(text);};
  const observation=(v:unknown)=>{const o=object(v);for(const k of ['provisions','energy','stress','belonging','purpose','health'])number(o[k],0,1);};
  const common=(m:Record<string,unknown>)=>{
    if(!PROBLEMS.includes(m.problem as LifeProblem)||!ACTIONS.includes(m.action as AgentActionKind))throw new Error('Unknown resident learning method');
    strings(m.knowledgeIds,3);number(m.expectedGain,-1,1);
  };
  const s=object(value);
  if(s.version!==1)throw new Error('Unsupported resident learning version');
  for(const k of ['sequence','totalEvaluated']){number(s[k]);if(!Number.isInteger(s[k]))throw new Error('Invalid learning counter');}
  if(!Array.isArray(s.methods)||s.methods.length>MAX_LEARNED_METHODS||!Array.isArray(s.recent)||s.recent.length>MAX_RECENT_ATTEMPTS)throw new Error('Resident learning budget exceeded');
  const ids=new Set<string>();
  for(const entry of s.methods) {
    const m=object(entry);common(m);text(m.id);text(m.placeId);text(m.placeKind);
    if(ids.has(m.id as string))throw new Error('Duplicate learning method');ids.add(m.id as string);
    for(const k of ['trials','successes','failures']){number(m[k]);if(!Number.isInteger(m[k]))throw new Error('Invalid method counter');}
    if((m.successes as number)+(m.failures as number)!==m.trials)throw new Error('Learning outcomes do not match trials');
    const effects=object(m.observedEffects);for(const problem of PROBLEMS)number(effects[problem],-1,1);
    number(m.confidence,0,1);number(m.lastWorldMinute,0,worldMinute);
  }
  for(const entry of s.recent) {
    const r=object(entry);common(r);text(r.placeId);number(r.id,1,s.sequence as number);
    number(r.startedWorldMinute,0,worldMinute);number(r.finishedWorldMinute,r.startedWorldMinute as number,worldMinute);
    number(r.observedGain,-1,1);observation(r.before);observation(r.after);strings(r.recalledMethodIds,3);
    if(!['helped','ineffective','harmful','abandoned'].includes(r.outcome as string))throw new Error('Invalid learning outcome');
  }
  if(s.pending!==undefined) {
    const p=object(s.pending);common(p);text(p.sourcePlaceId);text(p.targetPlaceId);number(p.id,1,s.sequence as number);
    number(p.startedWorldMinute,0,worldMinute);strings(p.recalledMethodIds,3);observation(p.before);
    if(!['acting','travelling'].includes(p.phase as string))throw new Error('Invalid learning phase');
    if(p.materialAmount!==undefined)number(p.materialAmount);
    if(p.beneficiaryId!==undefined){text(p.beneficiaryId);number(p.beneficiaryBefore,0,2);number(p.beneficiaryAfter,0,2);}
  }
}
