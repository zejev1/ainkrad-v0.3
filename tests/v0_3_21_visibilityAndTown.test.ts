import { describe, expect, it } from 'vitest';
import { WorldEngine } from '../src/world/WorldEngine';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { rebuildWorldRoutes } from '../src/world/WorldNavigation';
import { compactLibraryPlot } from '../src/world/SettlementLibraryLayout';
import { townMapFocus, residentMapFocus } from '../src/presentation/WorldMapFocus';
import { WorldMapCamera } from '../src/presentation/WorldMapCamera';
import type { WorldState } from '../src/world/types';

const fresh = async () => (await WorldEngine.create({worldId:'town-visibility', seed:'street',
  store:new InMemoryWorldStore()})).snapshot();

function livedState(world: WorldState) {
  const copy = structuredClone(world);
  const {anchorMapX, anchorMapY, admissionVersion, annualSelections, visitHistory, status, visitors, ...library} = copy.v18!.secretLibrary;
  return {now:copy.now, calendar:copy.calendar, determinism:copy.determinism,
    people:Object.values(copy.agents).map(({position, movement, knownPlaceIds, ...person})=>person),
    relationships:copy.relationships, population:copy.population, v15:copy.v15, v16:copy.v16,
    v18:{...copy.v18, secretLibrary:library}, v19:copy.v19};
}

describe('v0.3.21 FIX1 visible residents and local town buildings', () => {
  it('relocates an old library once, preserving study, people, time and a journey in progress', async () => {
    const before = await fresh();
    const library = before.places.secret_library_v18;
    library.mapX=42; library.mapY=56;
    delete library.urbanLayoutVersion; delete library.settlementId;
    before.v18!.secretLibrary.anchorMapX=42; before.v18!.secretLibrary.anchorMapY=56;
    before.v18!.secretLibrary.totalVisits=1;
    before.v18!.secretLibrary.admissionVersion=undefined;before.v18!.secretLibrary.annualSelections={};
    before.v18!.secretLibrary.visitors=[{agentId:'agent_1', libraryPlaceId:library.id,
      readingMinutes:42, wordsRead:1000, lastStudyWorldMinute:0, accessYear:1, status:'studying', selectedWorldMinute:0,
      originalLocationId:'home_agent_1', acceptedVoluntarily:true, studyQuanta:2, learnedKnowledgeIds:[]}];
    const reader = before.agents.agent_1;
    reader.locationId=library.id; reader.position={x:42,y:56,layerId:'surface'}; reader.lastAction='reflect';
    before.routes=rebuildWorldRoutes(before.places, before.routes);
    const route=Object.values(before.routes).find(r=>[r.fromPlaceId,r.toPlaceId].includes(library.id))!;
    route.completedTraversals=17;
    const path=route.toPlaceId===library.id ? route.waypoints : [...route.waypoints].reverse();
    const walker=before.agents.agent_2;
    walker.locationId='commons'; walker.position={...path[1],layerId:'surface'};
    walker.movement={targetPlaceId:library.id,purpose:'reflect',waypoints:path,nextWaypointIndex:2,
      startedAt:before.now,worldStageAtStart:0,routeIds:[route.id]};
    const preserved=livedState(before), store=new InMemoryWorldStore();
    await store.initializeWorld(before);
    let after=(await WorldEngine.open({worldId:before.id,store})).snapshot();
    expect(livedState(after)).toEqual(preserved);
    expect(after.places.resource_field).toEqual(before.places.resource_field);
    expect(after.places.outskirts).toEqual(before.places.outskirts);
    const repairedLibrary=after.places.secret_library_v18;
    expect(Math.hypot(repairedLibrary.mapX-50,repairedLibrary.mapY-50)).toBeLessThan(.5);
    expect(after.agents.agent_1.position).toEqual({x:repairedLibrary.mapX,y:repairedLibrary.mapY,layerId:'surface'});
    expect(after.v18!.secretLibrary.visitors[0].readingMinutes).toBe(42);
    expect(after.v18!.secretLibrary.visitors[0].wordsRead).toBe(1000);
    expect(after.agents.agent_2.movement?.targetPlaceId).toBe('commons');
    expect(after.agents.agent_2.movement?.waypoints.at(-1)).toEqual({x:50,y:50});
    expect(Math.hypot(after.agents.agent_2.position.x-50, after.agents.agent_2.position.y-50)).toBeLessThan(0.3);
    expect(after.routes[route.id].completedTraversals).toBe(17);
    const repaired=structuredClone(after);
    for(let i=0;i<3;i++) {
      after=(await WorldEngine.open({worldId:before.id,store})).snapshot();
      expect(after).toEqual(repaired);
    }
  });

  it('fits the actual town on a phone, independently of the surrounding countryside', async () => {
    const world=await fresh(), saved=structuredClone(world);
    const focus=townMapFocus(world,'agent_1',390,600)!;
    const camera=new WorldMapCamera(); camera.resize(390,600); Object.assign(camera,focus);
    for(const place of Object.values(world.places).filter(p=>p.urbanLayoutVersion===3 && ['home','library','workshop','quiet_space'].includes(p.kind))) {
      const p=camera.point(place.mapX,place.mapY);
      expect(p.x).toBeGreaterThan(0); expect(p.x).toBeLessThan(100);
      expect(p.y).toBeGreaterThan(0); expect(p.y).toBeLessThan(100);
    }
    expect(world).toEqual(saved);
    world.places.resource_field.mapX+=10000;
    expect(townMapFocus(world,'agent_1',390,600)).toEqual(focus);
    const walker=world.agents.agent_1;
    walker.position={x:150,y:-250,layerId:'surface'};
    walker.movement={targetPlaceId:'commons',purpose:'walk',waypoints:[{x:150,y:-250},{x:50,y:50}],
      nextWaypointIndex:1,startedAt:0,worldStageAtStart:0};
    const traveller=structuredClone(walker);
    expect(residentMapFocus(world,walker.id,0.01)).toEqual({x:150,y:-250,pixelsPerUnit:400});
    expect(walker).toEqual(traveller);
    walker.life.alive=false;
    expect(residentMapFocus(world,walker.id,300)).toBeUndefined();
  });

  it('uses a vacant local plot and keeps library buildings out of water', async () => {
    const world=await fresh();
    const existing=world.places.secret_library_v18;
    const free=compactLibraryPlot(world.places,{x:50,y:50},'new_library')!;
    expect(Math.abs(free.x-existing.mapX)>=0.22-1e-7 || Math.abs(free.y-existing.mapY)>=0.22-1e-7).toBe(true);
    world.places.test_water={...world.places.ocean_ainkrad,id:'test_water',boundaryPolygon:[
      {x:49.8,y:49.6},{x:50.2,y:49.6},{x:50.2,y:49.9},{x:49.8,y:49.9}]};
    const dry=compactLibraryPlot(world.places,{x:50,y:50},existing.id)!;
    expect(Math.abs(dry.x-50)>0.28 || dry.y+0.08<=49.6+1e-7).toBe(true);
  });
});
