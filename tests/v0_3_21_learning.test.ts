import { describe, expect, it } from 'vitest';
import { WorldEngine } from '../src/world/WorldEngine';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import type { AgentState, WorldState, AgentActionKind } from '../src/world/types';
import { beginLearningAttempt, finishLearningAttempt, learnedActionAdjustment, learnedSiteAdjustment,
  noteLearningMaterial, noteLearningHelp, assertResidentLearning, MAX_LEARNED_METHODS, MAX_RECENT_ATTEMPTS } from '../src/world/learning';
import { inspectResidentV16 } from '../src/v16/TruthfulInspectorsV16';
import { WORLD_MINUTES_PER_YEAR } from '../src/world/WorldClock';

const fresh=async()=> (await WorldEngine.create({worldId:'lived-learning',seed:'learning',agentNames:['A','B'],store:new InMemoryWorldStore(),startTime:0})).snapshot();
function prepare(a:AgentState) {
  a.resources=.2;a.energy=.9;a.stress=.1;a.needs.belonging=.8;a.needs.purpose=.8;a.life.health=.9;
  a.movement=undefined;
}
function tryAction(w:WorldState,a:AgentState,action:AgentActionKind,change:()=>void) {
  beginLearningAttempt(w,a,action);change();a.lastAction=action;
  w.calendar.elapsedWorldMinutes+=1;
  return finishLearningAttempt(w,a)!;
}

describe('Personal observation → attempt → real receipt → changed advice',()=>{
  it('uses success, reverses an obsolete habit after failures, and does not teach a bystander',async()=>{
    const w=await fresh(),a=w.agents.agent_1,b=w.agents.agent_2;prepare(a);prepare(b);
    const identity=structuredClone({personality:a.personality,skills:a.skills,parents:a.life.parentIds,values:a.mind.values});
    for(let i=0;i<4;i++) {prepare(a);tryAction(w,a,'gather',()=>{a.resources+=.2;a.energy-=.05;noteLearningMaterial(a,'food',.2);});}
    prepare(a);
    expect(learnedActionAdjustment(w,a,'gather')).toBeGreaterThan(.1);
    expect(learnedActionAdjustment(w,b,'gather')).toBe(0);
    for(let i=0;i<8;i++) {prepare(a);tryAction(w,a,'gather',()=>{a.energy-=.25;a.life.health-=.15;noteLearningMaterial(a,'food',0);});}
    prepare(a);
    expect(learnedActionAdjustment(w,a,'gather')).toBeLessThan(0);
    expect(learnedSiteAdjustment(a,'gather',a.locationId)).toBeLessThan(0);
    expect(a.learning!.recent.at(-1)!.reason).toBe('no_resources');
    expect({personality:a.personality,skills:a.skills,parents:a.life.parentIds,values:a.mind.values}).toEqual(identity);
    assertResidentLearning(a.learning,w.calendar.elapsedWorldMinutes);
  });

  it('finds a new use for an incidental result rather than requiring a prepared problem/action recipe',async()=>{
    const w=await fresh(),a=w.agents.agent_1;prepare(a);a.resources=.8;a.energy=.1;a.stress=.65;
    tryAction(w,a,'rest',()=>{a.energy+=.5;a.stress-=.25;});
    expect(a.learning!.methods[0].problem).toBe('fatigue');
    a.energy=.95;a.stress=.9;
    expect(learnedActionAdjustment(w,a,'rest')).toBeGreaterThan(0);
    expect(a.learning!.methods.some(m=>m.problem==='distress')).toBe(false);
    beginLearningAttempt(w,a,'rest');
    expect(a.learning!.pending!.problem).toBe('distress');
    expect(a.learning!.pending!.recalledMethodIds).toContain(a.learning!.methods[0].id);
    expect(a.learning!.pending!.expectedGain).toBeCloseTo(.25);
  });

  it('uses only personally understood reading as a tentative idea, with no free yield or skill grant',async()=>{
    const w=await fresh(),a=w.agents.agent_1,b=w.agents.agent_2;prepare(a);prepare(b);
    const knowledge={id:'read:crop',knowledgeId:'agriculture-three-field-rotation',title:'Севооборот',category:'agriculture' as const,
      historicalSource:'Средневековое земледелие',sourceTitle:'Севооборот',sourceUrl:'',acquiredWorldMinute:0,
      understanding:.7,summary:'Почва должна восстанавливаться',concepts:['почва'],practiceCount:0,sharedCount:0};
    w.v18!.secretLibrary.knowledgeByAgentId[a.id]=[knowledge];
    const body=structuredClone({resources:a.resources,skills:a.skills,health:a.life.health});
    expect(learnedActionAdjustment(w,a,'gather')).toBeGreaterThan(0);
    expect(learnedActionAdjustment(w,b,'gather')).toBe(0);
    tryAction(w,a,'gather',()=>noteLearningMaterial(a,'food',0));
    expect(a.learning!.recent.at(-1)!.outcome).toBe('ineffective');
    expect(learnedActionAdjustment(w,a,'gather')).toBe(0);
    expect({resources:a.resources,skills:a.skills,health:a.life.health}).toEqual(body);
    expect(a.learning!.recent.at(-1)!.knowledgeIds).toEqual([knowledge.knowledgeId]);
  });

  it('does not count a journey or an interrupted intention as work, including a save during travel',async()=>{
    const w=await fresh(),a=w.agents.agent_1;prepare(a);
    beginLearningAttempt(w,a,'gather');
    a.movement={targetPlaceId:'commons',purpose:'gather',waypoints:[a.position,{x:50,y:50}],nextWaypointIndex:1,
      startedAt:w.now,worldStageAtStart:0};a.lastAction='walk';
    expect(finishLearningAttempt(w,a)).toBeUndefined();
    expect(a.learning!.totalEvaluated).toBe(0);
    const saved=JSON.parse(JSON.stringify(a)) as AgentState;
    expect(saved.learning).toEqual(JSON.parse(JSON.stringify(a.learning)));
    saved.movement=undefined;saved.locationId='commons';
    beginLearningAttempt(w,saved,'reflect');saved.lastAction='reflect';finishLearningAttempt(w,saved);
    expect(saved.learning!.recent.some(r=>r.action==='gather'&&r.outcome==='abandoned')).toBe(true);
    expect(saved.learning!.methods.some(m=>m.action==='gather')).toBe(false);
    const study=w.v18!.secretLibrary.knowledgeByAgentId[a.id];
    expect(study??[]).toHaveLength(0);
  });

  it('distinguishes accepted help from refusal using the recipient receipt',async()=>{
    const w=await fresh(),a=w.agents.agent_1;prepare(a);a.resources=.8;a.needs.purpose=.15;
    const refused=tryAction(w,a,'help',()=>noteLearningHelp(a,'agent_2',.8,.8));
    expect(refused.reason).toBe('recipient_declined');expect(refused.beneficiaryGain).toBe(0);
    a.needs.purpose=.15;
    const helped=tryAction(w,a,'help',()=>{a.needs.purpose+=.05;noteLearningHelp(a,'agent_2',.8,.9);});
    expect(helped.reason).toBe('recipient_helped');expect(helped.beneficiaryGain).toBeCloseTo(.1);
  });

  it('keeps a bounded personal working memory after many attempts, while retaining evaluation counters',async()=>{
    const w=await fresh(),a=w.agents.agent_1;
    for(let i=0;i<1500;i++) {
      prepare(a);a.locationId=`observed-site-${i%30}`;
      tryAction(w,a,'gather',()=>{a.resources+=.06;noteLearningMaterial(a,'food',.06);});
    }
    expect(a.learning!.totalEvaluated).toBe(1500);
    expect(a.learning!.methods.length).toBeLessThanOrEqual(MAX_LEARNED_METHODS);
    expect(a.learning!.recent.length).toBeLessThanOrEqual(MAX_RECENT_ATTEMPTS);
    expect(new TextEncoder().encode(JSON.stringify(a.learning)).length).toBeLessThan(12_000);
    assertResidentLearning(a.learning,w.calendar.elapsedWorldMinutes);
    const invalid=structuredClone(a.learning)!;invalid.methods[0].observedEffects.provisions=Infinity;
    expect(()=>assertResidentLearning(invalid,w.calendar.elapsedWorldMinutes)).toThrow();
  });

  it('runs in the real world without Cardinal and reopens with exactly the same experience and time',async()=>{
    const store=new InMemoryWorldStore();
    const engine=await WorldEngine.create({worldId:'integration-learning',seed:'learning-life',agentNames:Array.from({length:10},(_,i)=>'Learner'+i),store,startTime:0});
    expect(Object.values(engine.snapshot().agents).every(a=>a.learning===undefined)).toBe(true);
    await engine.advanceCanonicalTimeTo(WORLD_MINUTES_PER_YEAR);
    const before=engine.snapshot();
    const people=Object.values(before.agents).filter(a=>(a.learning?.totalEvaluated??0)>0);
    expect(people.length).toBeGreaterThan(0);
    const history=await store.history(before.id);
    expect(history.some(e=>e.kind==='agent.gathered')).toBe(true);
    expect(history.some(e=>e.payload.recalledMethodIds!==undefined||e.kind==='agent.learning.outcome_evaluated')).toBe(false);
    const reopened=await WorldEngine.open({worldId:before.id,store});
    expect(reopened.snapshot()).toEqual(before);
    const report=inspectResidentV16(before,people[0].id)!;
    expect(report.sections.find(s=>s.title==='Опыт и решения')!.rows.length).toBeGreaterThan(2);
    expect(JSON.stringify(report)).toContain('Оценка: ожидал');
  });
});
