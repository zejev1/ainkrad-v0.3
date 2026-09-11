import { describe, expect, it } from 'vitest';
import { WorldEngine, WORLD_TICKS_PER_YEAR } from '../src/world/WorldEngine';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { beginLearningAttempt, finishLearningAttempt, learnedActionAdjustment } from '../src/world/learning';
import { canResidentAct } from '../src/world/ResidentBodyBoundary';
import { applyDivineActionV19 } from '../src/v19/DivineAgencyV19';
import { WorldMapCamera } from '../src/presentation/WorldMapCamera';
import { mapScaleBar, mapEntityDepth } from '../src/presentation/WorldMapVisuals';

async function fixture(id:string) {
  return (await WorldEngine.create({worldId:id,seed:'body-boundary',agentNames:['A','B'],store:new InMemoryWorldStore(),startTime:0})).snapshot();
}

describe('A remembered intention cannot overrule the physical body',()=>{
  it('death closes execution and prevents later actions, learning and gifts through repeated reloads',async()=>{
    const state=await fixture('mortal-learner'),a=state.agents.agent_1;
    a.life.ageYears=a.life.lifespanYears-.0001;a.life.stage='elder';
    a.life.bornAt=state.now-a.life.ageYears*WORLD_TICKS_PER_YEAR;
    a.resources=.1;beginLearningAttempt(state,a,'gather');
    const identity=structuredClone({id:a.mind.identityId,personality:a.personality,parents:a.life.parentIds});
    const store=new InMemoryWorldStore();await store.initializeWorld(state);
    let engine=await WorldEngine.open({worldId:state.id,store});
    await engine.step(1);
    const deceased=engine.snapshot().agents[a.id];
    expect(deceased.life.alive).toBe(false);expect(deceased.life.health).toBe(0);
    expect(canResidentAct(deceased)).toBe(false);
    expect(deceased.movement).toBeUndefined();expect(deceased.plan).toBeUndefined();
    expect(deceased.learning!.pending).toBeUndefined();
    expect(deceased.learning!.recent.at(-1)!.reason).toBe('body_unavailable');
    expect(deceased.learning!.totalEvaluated).toBe(0);
    for(let tick=2;tick<=5;tick++) {
      engine=await WorldEngine.open({worldId:state.id,store});await engine.step(tick);
      const after=engine.snapshot(),dead=after.agents[a.id];
      expect(dead.life.alive).toBe(false);expect(dead.life.health).toBe(0);
      expect(dead.learning).toEqual(deceased.learning);expect(dead.skills).toEqual(deceased.skills);
      expect(dead.life.ageYears).toBe(deceased.life.ageYears);
      expect(dead.lastAction).toBeUndefined();expect(dead.lastDecision).toBeUndefined();
      expect(dead.movement).toBeUndefined();expect(after.population.deaths).toBe(1);
      expect({id:dead.mind.identityId,personality:dead.personality,parents:dead.life.parentIds}).toEqual(identity);
      beginLearningAttempt(after,dead,'work');finishLearningAttempt(after,dead);
      expect(dead.learning).toEqual(deceased.learning);
      expect(learnedActionAdjustment(after,dead,'work')).toBe(0);
      expect(()=>applyDivineActionV19(after,{operationId:`dead-gift-${tick}`,agentId:dead.id,
        deityId:'player_deity',deityName:'Создатель',gift:'robust_health',worldMinute:after.calendar.elapsedWorldMinutes,interpretationRoll:.5})).toThrow();
    }
    expect((await store.history(state.id)).filter(e=>e.kind==='agent.died'&&e.payload.agentId===a.id)).toHaveLength(1);
  });

  it('repairs stale actions of an already deceased resident without duplicating a death or erasing memory',async()=>{
    const state=await fixture('legacy-dead-walker'),a=state.agents.agent_1;
    a.resources=.1;beginLearningAttempt(state,a,'gather');
    a.movement={targetPlaceId:'commons',purpose:'gather',waypoints:[a.position,{x:50,y:50}],nextWaypointIndex:1,startedAt:0,worldStageAtStart:0};
    a.life.alive=false;a.life.health=0;a.life.diedAt=0;a.life.deathCause='illness';a.lastAction='work';
    state.population.deaths=1;
    const protectedBefore=structuredClone({mind:a.mind,knowledge:state.v18!.secretLibrary.knowledgeByAgentId,
      calendar:state.calendar,rng:state.determinism,population:state.population});
    const store=new InMemoryWorldStore();await store.initializeWorld(state);
    const after=(await WorldEngine.open({worldId:state.id,store})).snapshot();
    expect(after.agents[a.id].movement).toBeUndefined();expect(after.agents[a.id].lastAction).toBeUndefined();
    expect(after.agents[a.id].learning!.pending).toBeUndefined();
    expect({mind:after.agents[a.id].mind,knowledge:after.v18!.secretLibrary.knowledgeByAgentId,
      calendar:after.calendar,rng:after.determinism,population:after.population}).toEqual(protectedBefore);
    expect((await WorldEngine.open({worldId:state.id,store})).snapshot()).toEqual(after);
  });

  it('a zero-health body cannot authorize action even if a stale flag still says alive',async()=>{
    const a=(await fixture('terminal-body')).agents.agent_1;
    a.life.health=0;expect(a.life.alive).toBe(true);expect(canResidentAct(a)).toBe(false);
  });

  it('keeps the street scale measurable from the same metre coordinates used by physical movement',()=>{
    const camera=new WorldMapCamera();camera.resize(390,600);
    for(const zoom of [.0005,3,175,300,1600]) {
      camera.zoom(zoom);const bar=mapScaleBar(camera.pixelsPerUnit);
      const a=camera.worldPoint(100,100),b=camera.worldPoint(100+bar.pixels,100);
      expect((b.x-a.x)*100).toBeCloseTo(bar.metres,4);
      expect(bar.pixels).toBeLessThanOrEqual(90);
      expect(camera.width*camera.height).toBeLessThanOrEqual(1280*800);
    }
    expect(mapEntityDepth(30,0,600)).toBeLessThan(mapEntityDepth(40,0,600));
  });
});
