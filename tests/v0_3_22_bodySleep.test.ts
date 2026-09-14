import { describe, expect, it } from 'vitest';
import { advanceBodySleepV21, bodyFatigueDecisionBoostV21, bodyFatigueMobilityScaleV21, bodySleepStateV21, startBodySleepV21 } from '../src/v21/BodySleepV21';
import type { AgentState, WorldState } from '../src/world/types';

function agent(overrides: Partial<AgentState> = {}): AgentState {
  return {
    id:'a',name:'A',origin:'native',race:'human',energy:0.1,stress:0.2,resources:0.8,socialDrive:0.5,
    personality:{sociability:.5,diligence:.5,curiosity:.5,generosity:.5,resilience:.5,riskTolerance:.5},
    life:{bornAt:0,ageYears:24,lifespanYears:80,stage:'adult',alive:true,health:1,physiology:{strength:.6,endurance:.6,mobility:.6,recovery:.6},generation:0,parentIds:[],childIds:[]},
    mind:{identityId:'a',continuity:1,autonomy:1,memoryCoherence:1,emotions:{joy:.5,fear:0,grief:0,awe:0,hope:.5},values:{care:.5,freedom:.5,knowledge:.5,tradition:.5,ambition:.5},beliefs:{worldTrust:.5,divinePresence:0,fate:0,afterlife:0}},
    needs:{belonging:.7,purpose:.7},skills:{gathering:.1,hunting:.1,craft:.1,social:.1,exploration:.1},goal:{kind:'recover',strength:.5,since:0},
    homeId:'home',locationId:'home',position:{x:0,y:0,layerId:'surface'},lastMeaningfulEventAt:0,
    ...overrides,
  };
}
function world(a:AgentState):WorldState {
  return {id:'w',now:0,revision:0,rulesVersion:'ainkrad-world-rules-0.3.19',calendar:{elapsedWorldMinutes:0},agents:{a},relationships:{},places:{home:{id:'home',name:'Home',kind:'home',capacity:4,biome:'settlement',mapX:0,mapY:0,connectedPlaceIds:[],fertility:1,danger:0,surface:'land'}},routes:{},wildlife:{},settlements:{},growth:{stage:0,explorationProgress:0,lastExpansionAt:0,discoveredRegionIds:[],frontierSequence:0},population:{nextAgentSequence:2,births:0,deaths:0},environment:{resourcePool:1,resourceRegenerationRate:1,socialOpportunity:1,safetySupport:1,habitatSupport:1},cosmology:{mysteryLevel:0,omenCount:0,traditions:[],deities:{}},governance:{constitutionVersion:'ainkrad-constitution-0.3.19',authorityRevision:0,protectedPersonhoodDomains:['identity','memory','agency','values','relationships'],laws:{}},determinism:{rngState:1,eventSequence:0}} as unknown as WorldState;
}

describe('body-driven sleep',()=>{
  it('warns progressively below ten percent without forcing a choice',()=>{
    const a=agent({energy:.1}),w=world(a);
    const first=bodyFatigueDecisionBoostV21(w,a);
    a.energy=.05;
    const later=bodyFatigueDecisionBoostV21(w,a);
    expect(first).toBeGreaterThan(0);
    expect(later).toBeGreaterThan(first);
    expect(bodyFatigueMobilityScaleV21(a)).toBeLessThan(.5);
    expect(bodySleepStateV21(w,a.id)).toBeUndefined();
  });
  it('collapses at zero and wakes after six world-hours',()=>{
    const a=agent({energy:0}),w=world(a);
    expect(advanceBodySleepV21(w,a)).toBe(true);
    const sleep=bodySleepStateV21(w,a.id)!;
    expect(sleep.forced).toBe(true);
    expect(sleep.wakesAtWorldMinute-sleep.startedWorldMinute).toBe(360);
    w.calendar.elapsedWorldMinutes=359;
    expect(advanceBodySleepV21(w,a)).toBe(true);
    w.calendar.elapsedWorldMinutes=360;
    expect(advanceBodySleepV21(w,a)).toBe(false);
    expect(a.energy).toBeGreaterThan(0);
  });
  it('home sleep restores more than forced outdoor collapse',()=>{
    const homeAgent=agent({energy:.05}),homeWorld=world(homeAgent);
    startBodySleepV21(homeWorld,homeAgent,false);
    const homeTarget=bodySleepStateV21(homeWorld,'a')!.targetEnergy;
    const fieldAgent=agent({energy:0,locationId:'field',position:{x:1,y:1,layerId:'surface'}});
    const fieldWorld=world(fieldAgent);
    fieldWorld.places.field={id:'field',name:'Field',kind:'commons',capacity:5,biome:'plains',mapX:1,mapY:1,connectedPlaceIds:[],fertility:.5,danger:.1,surface:'land'};
    advanceBodySleepV21(fieldWorld,fieldAgent);
    const fieldTarget=bodySleepStateV21(fieldWorld,'a')!.targetEnergy;
    expect(homeTarget).toBeGreaterThanOrEqual(.95);
    expect(fieldTarget).toBeLessThanOrEqual(.6);
    expect(homeTarget).toBeGreaterThan(fieldTarget);
  });
});
