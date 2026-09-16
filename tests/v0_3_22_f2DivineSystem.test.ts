import { describe, expect, it } from 'vitest';
import { WorldEngine } from '../src/world/WorldEngine';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { applyDivineActionV19, recordContextualPrayerV19 } from '../src/v19/DivineAgencyV19';
import {
  canImmortalTransmitKnowledgeV20,
  giftMasteryV20,
  practiceGiftV20,
  burdenIntensityV22,
  giftIsHeritableV20,
  triggerPhoenixV22,
  EXCEPTIONAL_ABILITIES_V22,
  IMMORTAL_KNOWLEDGE_TRANSFER_WINDOW_WORLD_MINUTES,
  personalEarningRetentionV22,
} from '../src/v20/DivineGiftsV20';

const fresh=async(id:string)=>WorldEngine.create({worldId:id,seed:id,store:new InMemoryWorldStore(),startTime:0});

describe('0.3.22 F2 divine progression, immortality and punishment',()=>{
  it('grants potential instead of maxing stats and grows only through matching lived practice',async()=>{
    const engine=await fresh('f2-gift-growth'); const world=(engine as any).committedState; const a=world.agents.agent_1;
    const progression=structuredClone(a.progression);
    applyDivineActionV19(world,{operationId:'heal',agentId:a.id,deityId:'player_deity',deityName:'Создатель',gift:'healing_touch',worldMinute:0,interpretationRoll:.5});
    expect(a.progression).toEqual(progression);
    expect(giftMasteryV20(world,a.id,'healing_touch')).toBeCloseTo(.08);
    for(let i=0;i<20;i++) practiceGiftV20(world,a.id,'healing_touch',.02,i+1);
    expect(giftMasteryV20(world,a.id,'healing_touch')).toBeGreaterThan(.2);
    expect(giftMasteryV20(world,a.id,'healing_touch')).toBeLessThan(1);
  });

  it('keeps immortality nonheritable, blocks reproduction and limits transmitted old knowledge',async()=>{
    const engine=await fresh('f2-immortal'); const world=(engine as any).committedState; const a=world.agents.agent_1,b=world.agents.agent_2;
    applyDivineActionV19(world,{operationId:'immortal',agentId:a.id,deityId:'player_deity',deityName:'Создатель',gift:'immortality',worldMinute:0,interpretationRoll:.5});
    a.life.ageYears=25;b.life.ageYears=25;a.life.stage='adult';b.life.stage='adult';a.life.health=1;b.life.health=1;
    a.sex='male';b.sex='female';a.race='human';b.race='human';
    (engine as any).workingState=world;
    expect((engine as any).canConsiderChildDecision(a,b,0)).toBe(false);
    (engine as any).workingState=undefined;
    world.calendar.elapsedWorldMinutes=IMMORTAL_KNOWLEDGE_TRANSFER_WINDOW_WORLD_MINUTES+10;
    expect(canImmortalTransmitKnowledgeV20(world,a.id,0)).toBe(false);
    expect(canImmortalTransmitKnowledgeV20(world,a.id,world.calendar.elapsedWorldMinutes-100)).toBe(true);
  });

  it('keeps punishment separate from gifts and persists a lineage curse',async()=>{
    const engine=await fresh('f2-curse'); const world=(engine as any).committedState; const a=world.agents.agent_1;
    applyDivineActionV19(world,{operationId:'curse',agentId:a.id,deityId:'player_deity',deityName:'Создатель',burden:'misfortune',lineageCurse:true,worldMinute:0,interpretationRoll:.5});
    const profile=world.v19.divineAgency.byAgentId[a.id];
    expect(profile.gifts).toHaveLength(0);
    expect(profile.burdens).toHaveLength(1);
    expect(profile.burdens[0].lineage).toBe(true);
    expect(burdenIntensityV22(world,a.id,'misfortune')).toBeCloseTo(.35);
  });

  it('makes Empty Hands reduce only personal earnings and leaves shared stores alone',async()=>{
    const engine=await fresh('f2-empty-hands'); const world=(engine as any).committedState; const a=world.agents.agent_1;
    const settlementFood=world.settlements[a.homeSettlementId!]?.storedResources.food ?? 0;
    applyDivineActionV19(world,{operationId:'empty-hands',agentId:a.id,deityId:'player_deity',deityName:'Создатель',burden:'empty_hands',worldMinute:0,interpretationRoll:.5});
    expect(personalEarningRetentionV22(world,a.id)).toBeLessThan(1);
    expect(personalEarningRetentionV22(world,a.id)).toBeGreaterThan(.8);
    expect(world.settlements[a.homeSettlementId!]?.storedResources.food ?? 0).toBe(settlementFood);
  });

  it('passes ordinary gifts and lineage curses independently but never inherits immortality',async()=>{
    const engine=await fresh('f2-divine-inheritance'); const world=(engine as any).committedState;
    const a=world.agents.agent_1,b=world.agents.agent_2;
    a.sex='male'; b.sex='female'; a.race='human'; b.race='human'; a.life.ageYears=25; b.life.ageYears=25; a.life.stage='adult'; b.life.stage='adult';
    applyDivineActionV19(world,{operationId:'parent-might',agentId:a.id,deityId:'player_deity',deityName:'Создатель',gift:'might',worldMinute:0,interpretationRoll:.5});
    applyDivineActionV19(world,{operationId:'parent-immortal',agentId:a.id,deityId:'player_deity',deityName:'Создатель',gift:'immortality',worldMinute:0,interpretationRoll:.5});
    applyDivineActionV19(world,{operationId:'parent-lineage',agentId:a.id,deityId:'player_deity',deityName:'Создатель',burden:'frailty',lineageCurse:true,worldMinute:0,interpretationRoll:.5});
    (engine as any).workingState=world; (engine as any).stagedEvents=[]; (engine as any).stagedMemories=[];
    const rng=(engine as any).rng; const originalNext=rng.next.bind(rng); rng.next=()=>0;
    const childId=(engine as any).createChild(a,b,1,a.locationId);
    rng.next=originalNext; (engine as any).workingState=undefined; (engine as any).stagedEvents=undefined; (engine as any).stagedMemories=undefined;
    const childProfile=world.v19.divineAgency.byAgentId[childId];
    expect(childProfile.gifts.some((g:any)=>g.gift==='might')).toBe(true);
    expect(childProfile.gifts.some((g:any)=>g.gift==='immortality')).toBe(false);
    const inherited=childProfile.burdens.find((g:any)=>g.burden==='frailty');
    expect(inherited).toBeDefined();
    expect(inherited.inheritedFromAgentId).toBe(a.id);
    expect(inherited.intensity).toBeLessThan(burdenIntensityV22(world,a.id,'frailty'));
  });

  it('keeps cheat-like abilities separate from inheritable gifts and consumes Phoenix only once',async()=>{
    const engine=await fresh('f2-exceptional-abilities'); const world=(engine as any).committedState; const a=world.agents.agent_1;
    for (const ability of EXCEPTIONAL_ABILITIES_V22) {
      expect(giftIsHeritableV20(ability)).toBe(false);
    }
    applyDivineActionV19(world,{operationId:'phoenix',agentId:a.id,deityId:'player_deity',deityName:'Создатель',gift:'phoenix',worldMinute:0,interpretationRoll:.5});
    expect(triggerPhoenixV22(world,a.id)).toBe(true);
    expect(triggerPhoenixV22(world,a.id)).toBe(false);
  });


  it('keeps repeated prayers grounded in several live concerns instead of locking adults onto one family subject',async()=>{
    const engine=await fresh('f2-prayer-diversity'); const world=(engine as any).committedState; const a=world.agents.agent_1;
    a.life.health=.55; a.resources=.1; a.stress=.75; a.needs.purpose=.1;
    const topics=[] as string[];
    for(let index=0;index<12;index+=1){
      topics.push(recordContextualPrayerV19(world,a,{subject:.25,deity:.4,wording:.5}).topic);
      world.calendar.elapsedWorldMinutes+=60;
    }
    expect(new Set(topics).size).toBeGreaterThanOrEqual(2);
  });

});
