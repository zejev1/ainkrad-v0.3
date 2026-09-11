import { describe, expect, it } from 'vitest';
import { WorldEngine } from '../src/world/WorldEngine';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import type { WorldState } from '../src/world/types';
import { LIBRARY_IDS, LIBRARY_YEAR, libraryAdmissions, reconcileLibraryAdmissions, hasLibraryAdmission,
  noteLibraryArrival, enforceLibraryBoundary, LIBRARY_HISTORY_LIMIT } from '../src/v21/LibraryAdmissions';
import { observeLocalPlacesV20, sharePlaceKnowledgeV20, mayKnowPlaceV20 } from '../src/v20/KnowledgeBoundariesV20';
import { canReadLibraryV20 } from '../src/v20/DivineGiftsV20';
import { inspectPlaceV16 } from '../src/v16/TruthfulInspectorsV16';

async function fresh() {
  return (await WorldEngine.create({worldId: 'library-passes', seed: 'library', store: new InMemoryWorldStore(),
    agentNames: Array.from({length: 12}, (_,i) => 'Reader'+i)})).snapshot();
}
function grant(w:WorldState, count=5, selected=0, arrived?:number) {
  const lib=w.v18!.secretLibrary;
  lib.admissionVersion=undefined; lib.annualSelections={}; lib.currentAccessYear=Math.floor(selected/LIBRARY_YEAR)+1;
  lib.visitors=Object.values(w.agents).slice(0,count).map(a=>({agentId:a.id,libraryPlaceId:LIBRARY_IDS[0],
    accessYear:lib.currentAccessYear,status:arrived===undefined?'travelling':'studying',
    selectedWorldMinute:selected,arrivedWorldMinute:arrived,originalLocationId:a.homeId,
    acceptedVoluntarily:true,studyQuanta:0,learnedKnowledgeIds:[]}));
}
describe('bounded library admissions',()=>{
  it('counts travellers across New Year and grants a year from actual arrival',async()=>{
    const w=await fresh();w.calendar.elapsedWorldMinutes=LIBRARY_YEAR-100;grant(w,5,LIBRARY_YEAR-100);
    reconcileLibraryAdmissions(w);
    const a=w.agents.agent_1;a.locationId=LIBRARY_IDS[0];a.movement=undefined;
    noteLibraryArrival(w,a,LIBRARY_YEAR-50);
    w.calendar.elapsedWorldMinutes=LIBRARY_YEAR+1;reconcileLibraryAdmissions(w);
    expect(libraryAdmissions(w,LIBRARY_IDS[0])).toHaveLength(5);
    expect(w.v18!.secretLibrary.annualSelections![LIBRARY_IDS[0]].agentIds).toHaveLength(0);
    w.calendar.elapsedWorldMinutes=2*LIBRARY_YEAR-51;reconcileLibraryAdmissions(w);
    expect(hasLibraryAdmission(w,a,LIBRARY_IDS[0])).toBe(true);
    w.calendar.elapsedWorldMinutes++;reconcileLibraryAdmissions(w);
    expect(hasLibraryAdmission(w,a,LIBRARY_IDS[0])).toBe(false);
    expect(a.movement?.targetPlaceId).toBe('commons');
    expect(w.v18!.secretLibrary.visitors).toHaveLength(0);
  });
  it('hearsay, perception and old knowledge never grant entry or reading',async()=>{
    const w=await fresh();grant(w,1);reconcileLibraryAdmissions(w);
    const a=w.agents.agent_1,b=w.agents.agent_2;
    for(const p of [a,b]) {p.locationId='commons';p.movement=undefined;p.position={x:50,y:50,layerId:'surface'};}
    a.knownPlaceIds=[LIBRARY_IDS[0],'commons'];b.knownPlaceIds=[LIBRARY_IDS[0],'commons'];
    sharePlaceKnowledgeV20(w,a,b);observeLocalPlacesV20(w,b);
    expect(b.knownPlaceIds).not.toContain(LIBRARY_IDS[0]);
    expect(mayKnowPlaceV20(b,LIBRARY_IDS[0],w)).toBe(false);
    b.locationId=LIBRARY_IDS[0];expect(canReadLibraryV20(b,LIBRARY_IDS[0],w)).toBe(false);
    const experience=structuredClone({skills:a.skills,learning:a.learning,mind:a.mind,knowledge:w.v18!.secretLibrary.knowledgeByAgentId});
    w.calendar.elapsedWorldMinutes=LIBRARY_YEAR;reconcileLibraryAdmissions(w);
    expect(hasLibraryAdmission(w,a,LIBRARY_IDS[0])).toBe(false);
    expect({skills:a.skills,learning:a.learning,mind:a.mind,knowledge:w.v18!.secretLibrary.knowledgeByAgentId}).toEqual(experience);
  });
  it('repairs ten occupants, separates races and conservatively accounts for all old yearly choices',async()=>{
    const w=await fresh();grant(w,10,0,0);
    for(const a of Object.values(w.agents).slice(0,10)) {a.locationId=LIBRARY_IDS[0];a.movement=undefined;
      a.position={x:w.places[LIBRARY_IDS[0]].mapX,y:w.places[LIBRARY_IDS[0]].mapY,layerId:'surface'};}
    const identity=Object.values(w.agents).map(a=>({id:a.id,life:a.life,personality:a.personality,home:a.homeId}));
    reconcileLibraryAdmissions(w,0,true);
    expect(libraryAdmissions(w,LIBRARY_IDS[0])).toHaveLength(5);
    expect(w.v18!.secretLibrary.visitHistory).toHaveLength(5);
    expect(Object.values(w.agents).filter(a=>a.locationId===LIBRARY_IDS[0]&&!a.movement)).toHaveLength(5);
    expect(w.v18!.secretLibrary.annualSelections![LIBRARY_IDS[0]].agentIds).toHaveLength(5);
    expect(Object.values(w.agents).map(a=>({id:a.id,life:a.life,personality:a.personality,home:a.homeId}))).toEqual(identity);
    const report=JSON.stringify(inspectPlaceV16(w,LIBRARY_IDS[0]));
    expect(report).toContain('5/5');expect(report).not.toContain('10/5');
    const selected=w.agents[w.v18!.secretLibrary.visitors[0].agentId];selected.race='elf';
    expect(hasLibraryAdmission(w,selected,LIBRARY_IDS[0])).toBe(false);
    expect(hasLibraryAdmission(w,selected,LIBRARY_IDS[1])).toBe(false);
    const once=structuredClone(w);reconcileLibraryAdmissions(w);reconcileLibraryAdmissions(w);
    expect(w.v18!.secretLibrary.visitors).toHaveLength(4);
    expect(w.v18!.secretLibrary.visitHistory!.length).toBeLessThanOrEqual(LIBRARY_HISTORY_LIMIT);
    expect(once.determinism).toEqual(w.determinism);
  });
  it('turns a denied incoming traveller along the walked road without teleport or traversal credit',async()=>{
    const w=await fresh(),a=w.agents.agent_1;
    a.locationId='commons';a.position={x:50,y:49.9,layerId:'surface'};
    a.movement={targetPlaceId:LIBRARY_IDS[0],purpose:'reflect',waypoints:[{x:50,y:50},{x:50,y:49.8},{x:50,y:49.74}],
      nextWaypointIndex:1,startedAt:0,worldStageAtStart:0,routeIds:[]};
    const p={...a.position};enforceLibraryBoundary(w,a);
    expect(a.position).toEqual(p);expect(a.movement!.targetPlaceId).toBe('commons');
    expect(a.movement!.waypoints).toEqual([{x:50,y:49.9},{x:50,y:50}]);
    expect(a.movement!.routeIds).toEqual([]);
  });
  it('preserves limits under accelerated catch-up, year boundaries and repeated reloads',async()=>{
    const store=new InMemoryWorldStore();
    const engine=await WorldEngine.create({worldId:'library-clock',seed:'volunteers',store});
    for(const t of [LIBRARY_YEAR-100,LIBRARY_YEAR+1,2*LIBRARY_YEAR+1]) {
      await engine.advanceCanonicalTimeTo(t);
      const saved=engine.snapshot();
      expect(libraryAdmissions(saved,LIBRARY_IDS[0]).length).toBeLessThanOrEqual(5);
      for(const receipt of Object.values(saved.v18!.secretLibrary.annualSelections!)) expect(receipt.agentIds.length).toBeLessThanOrEqual(5);
      const reopened=await WorldEngine.open({worldId:saved.id,store});
      expect(reopened.snapshot()).toEqual(saved);
    }
  });
});
