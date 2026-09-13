import {beforeAll,describe,expect,it} from 'vitest';
import {WorldEngine} from '../src/world/WorldEngine';
import {InMemoryWorldStore} from '../src/world/InMemoryWorldStore';
import type {WorldState} from '../src/world/types';
import type {BoatJourney} from '../src/v21/BoatNavigation';
import {recordOceanPassage,assertOceanExploration,oceanCell,MAX_CHART_CELLS} from '../src/world/geography/OceanExploration';
import {CardinalOceanArchitect} from '../src/cardinal/CardinalOceanArchitect';
import {IndependentOceanFrontierGateway,applyOceanDecision,oceanDecisionAllowed} from '../src/boundary/OceanFrontierGateway';
import {bindWorldTerrain,assertTerrainFoundation} from '../src/world/geography/WorldTerrain';
import {pointInPolygon} from '../src/world/BuildingFootprints';
import {worldWaterPolygons,pathCrossesWater} from '../src/world/WaterNavigation';
import {localTerrainBiome} from '../src/world/geography/LocalExploration';

let baseline:WorldState;
beforeAll(async()=>{baseline=(await WorldEngine.create({worldId:'ocean-frontier-322',seed:'ocean-frontier-322',store:new InMemoryWorldStore(),startTime:0})).snapshot();});
function expedition(x=10000,y=40000){
  const w=structuredClone(baseline),a=w.agents.agent_1;
  a.life.ageYears=25;a.energy=1;
  const origin={x:x-2000,y},position={x,y};
  const j:BoatJourney={pilotId:a.id,occupantIds:[a.id],originPlaceId:a.locationId,destinationPlaceId:a.locationId,purpose:'explore',
    waypoints:[origin,position,{x:x+50,y},{x:x+50,y:y+50},origin],nextWaypointIndex:2,
    startedWorldMinute:0,lastAdvancedWorldMinute:0,fishingMinutes:0,returning:false,travelledDistance:2000};
  a.position={...position,layerId:'surface'};a.movement={boatId:'expedition',targetPlaceId:a.locationId,purpose:'explore',
    waypoints:j.waypoints,nextWaypointIndex:2,startedAt:0,worldStageAtStart:w.growth.stage};
  w.v15!.items.expedition={id:'expedition',kind:'artifact',name:'Испытательное судно',ownerAgentId:a.id,createdWorldMinute:0,
    locationId:a.locationId,quality:.8,effectiveness:.4,reliability:.8,description:'Физический рейс',
    boat:{completed:true,laborMinutes:4800,requiredLaborMinutes:4800,lastWorkedMinute:0,condition:1,position,journey:j}};
  recordOceanPassage(w,'expedition',j,position,0);
  return w;
}
function landExpedition(){
  const architect=new CardinalOceanArchitect();
  for(let i=0;i<64;i++){
    const w=expedition(10000+i*2000),request=w.oceanExploration!.pending!;
    const decision=architect.consider(request);
    if(decision.land&&oceanDecisionAllowed(w,decision))return {w,decision};
  }
  throw new Error('No lawful land proposal in deterministic fixtures.');
}
describe('0.3.22 demand-driven ocean geography',()=>{
  it('creates no archipelago on a new world, during map inspection or on a short harbour trip',()=>{
    const w=expedition(),j=w.v15!.items.expedition.boat!.journey!;
    delete w.oceanExploration;j.waypoints[0]={x:9990,y:40000};j.travelledDistance=10000;
    recordOceanPassage(w,'expedition',j,{x:10000,y:40000},0);
    expect(w.oceanExploration?.pending).toBeUndefined();expect(w.terrain!.offshore).toBeUndefined();
    const snapshot=JSON.stringify(w);bindWorldTerrain(w)!.sample(10000,40000);expect(JSON.stringify(w)).toBe(snapshot);
  });
  it('retains real sea evidence and the same random decision across reloads and repeated requests',()=>{
    const w=expedition(),r=w.oceanExploration!.pending!;expect(r).toBeDefined();assertOceanExploration(w);
    expect(w.oceanExploration!.charted[oceanCell(r.position)]).toBe(true);
    const architect=new CardinalOceanArchitect(),copy=JSON.parse(JSON.stringify(w));
    expect(architect.consider(copy.oceanExploration.pending)).toEqual(architect.consider(r));
    const result={requestId:r.id};applyOceanDecision(w,result);
    recordOceanPassage(w,'expedition',w.v15!.items.expedition.boat!.journey!,r.position,0);
    expect(w.oceanExploration!.pending).toBeUndefined();expect(oceanDecisionAllowed(w,result)).toBe(false);
  });
  it('supports empty ocean, half-kilometre islets, larger islands and rare continents without guaranteed land',()=>{
    const base=expedition().oceanExploration!.pending!,architect=new CardinalOceanArchitect();
    const kinds=new Set<string>();
    for(let i=0;i<2000;i++){
      const decision=architect.consider({...base,id:`survey-${i}`,seed:i});
      kinds.add(decision.land?.kind??'ocean');
      if(decision.land?.kind==='islet'){
        const [a,b]=[decision.land.outline[0],decision.land.outline[16]];
        const diameter=Math.hypot(a.x-b.x,a.y-b.y)*100;
        expect(diameter).toBeGreaterThanOrEqual(499.99999);expect(diameter).toBeLessThanOrEqual(1000.00001);
      }
    }
    expect([...kinds].sort()).toEqual(['continent','island','islet','ocean']);
  });
  it('requires an active expedition and refuses forged, oversized, charted and repeated land',()=>{
    const {w,decision}=landExpedition();
    expect(oceanDecisionAllowed(w,{...decision,requestId:'forged'})).toBe(false);
    expect(oceanDecisionAllowed(w,{...decision,land:{...decision.land!,radius:100000}})).toBe(false);
    const covered=structuredClone(w);covered.oceanExploration!.charted[oceanCell(decision.land!.center)]=true;
    expect(oceanDecisionAllowed(covered,decision)).toBe(false);
    const returning=structuredClone(w);returning.v15!.items.expedition.boat!.journey!.returning=true;
    expect(oceanDecisionAllowed(returning,decision)).toBe(false);
    const routed=structuredClone(w),p=decision.land!.center,r=decision.land!.radius;
    routed.routes.surveyed={id:'surveyed',fromPlaceId:'commons',toPlaceId:'commons',traversal:'boat',
      waypoints:[{x:p.x-r*2,y:p.y},{x:p.x+r*2,y:p.y}],distance:r*4,geometryVersion:3};
    expect(oceanDecisionAllowed(routed,decision)).toBe(false);
  });
  it('commits through the boundary, survives real store reload, shares physical dry land and leaves minds/mainland intact',async()=>{
    const {w,decision}=landExpedition(),oldModel=bindWorldTerrain(w)!,oldHeights=[...oldModel.heights];
    const store=new InMemoryWorldStore();w.revision=0;await store.initializeWorld(w);
    const engine=await WorldEngine.open({worldId:w.id,store}),before=engine.snapshot();
    const gateway=new IndependentOceanFrontierGateway(engine);
    expect(await gateway.execute(decision,before.revision-1)).toBe(false);
    expect(await gateway.execute(decision,before.revision)).toBe(true);
    const after=(await WorldEngine.open({worldId:w.id,store})).snapshot();
    assertTerrainFoundation(after.terrain);assertOceanExploration(after);
    expect(after.agents).toEqual(before.agents);expect(after.determinism.rngState).toBe(before.determinism.rngState);
    expect(after.places).toEqual(before.places);
    const physicalRoutes=(world:WorldState)=>Object.fromEntries(Object.entries(world.routes).map(([id,{terrainKey,...route}])=>[id,route]));
    expect(physicalRoutes(after)).toEqual(physicalRoutes(before));
    expect(Object.values(after.routes).every(r=>r.terrainKey===after.terrain!.key)).toBe(true);
    const model=bindWorldTerrain(after)!,center=decision.land!.center;
    expect([...model.heights]).toEqual(oldHeights);expect(model.outline).toEqual(oldModel.outline);
    expect(model.sample(center.x,center.y).water).toBe(false);expect(localTerrainBiome(after,center)).toBeDefined();
    expect(worldWaterPolygons(after.places).some(poly=>pointInPolygon(center,poly))).toBe(false);
    expect(pathCrossesWater([{x:center.x-.1,y:center.y},{x:center.x+.1,y:center.y}],after.places)).toBe(false);
    expect(model.sample(w.agents.agent_1.position.x,w.agents.agent_1.position.y).water).toBe(true);
    expect(await gateway.execute(decision,after.revision)).toBe(false);
  });
  it('starts a requested new epoch without prior islands, surveys or pending requests',async()=>{
    const {w,decision}=landExpedition();
    applyOceanDecision(w,decision);
    const store=new InMemoryWorldStore();w.revision=0;await store.initializeWorld(w);
    const engine=await WorldEngine.open({worldId:w.id,store});
    await engine.resetEpoch('fresh-ocean-epoch',['Анна','Иван'],'reset-ocean-test');
    const reset=engine.snapshot();
    expect(reset.epoch).toBe((w.epoch??1)+1);expect(reset.oceanExploration).toBeUndefined();
    expect(reset.terrain?.offshore).toBeUndefined();
    expect((await WorldEngine.open({worldId:w.id,store})).snapshot().oceanExploration).toBeUndefined();
  });
  it('stops extension at the chart memory limit without discarding previously surveyed water',()=>{
    const w=expedition(),s=w.oceanExploration!;delete s.pending;s.charted={};
    for(let i=0;i<MAX_CHART_CELLS;i++)s.charted[`${i}:-100`]=true;
    recordOceanPassage(w,'expedition',w.v15!.items.expedition.boat!.journey!,{x:10000,y:40000},0);
    expect(s.sealed).toBe(true);expect(Object.keys(s.charted)).toHaveLength(MAX_CHART_CELLS);expect(s.charted['0:-100']).toBe(true);
  });
});
