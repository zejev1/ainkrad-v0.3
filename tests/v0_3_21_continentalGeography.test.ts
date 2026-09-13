import 'fake-indexeddb/auto';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {describe,it,expect,beforeAll} from 'vitest';
import {WorldEngine} from '../src/world/WorldEngine';
import {InMemoryWorldStore} from '../src/world/InMemoryWorldStore';
import {createIndexedDbPersistence} from '../src/persistence/IndexedDbPersistence';
import {bindWorldTerrain,terrainPlotIsDry,terrainParcelIsDry,assertTerrainFoundation,terrainWalkingScale} from '../src/world/geography/WorldTerrain';
import {TerrainModel} from '../src/world/geography/TerrainModel';
import {surveyFrontier,surveySettlementSite} from '../src/world/geography/FrontierSurvey';
import {nearestRiverPoint} from '../src/world/geography/RiverCourses';
import {pointInPolygon,buildingPolygon} from '../src/world/BuildingFootprints';
import {pathCrossesWater} from '../src/world/WaterNavigation';
import {repairCompactSettlementLayout} from '../src/world/CompactSettlementLayout';
import {settlementOptions} from '../src/presentation/SettlementPicker';
import {WorldMapCamera} from '../src/presentation/WorldMapCamera';
import {WorldAtlasIndex} from '../src/presentation/WorldAtlasIndex';
import {WORLD_MINUTES_PER_YEAR as Y} from '../src/world/WorldClock';
import type {WorldState} from '../src/world/types';

// Captured from real main 423fee6, seed ainkrad-browser-world, immediately
// before its negative child-choice failure. No synthetic people or calendar.
const baseline=():WorldState=>({...JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/fix5-year21.json.gz',import.meta.url))).toString()),revision:0});
let world:WorldState,model:TerrainModel;
beforeAll(async()=>{const old=baseline(),store=new InMemoryWorldStore();await store.initializeWorld(old);
 world=(await WorldEngine.open({worldId:old.id,store})).snapshot();model=bindWorldTerrain(world)!;},20000);

describe('one physical world from continental view to walking streets',()=>{
 it('connects every river to a downhill outlet, including the saved lakes, without cycles',()=>{
  const byId=new Map(model.reaches.map(r=>[r.id,r]));expect(byId.size).toBe(model.reaches.length);
  expect(model.reaches.length).toBeGreaterThan(1000);
  for(const first of model.reaches){const seen=new Set<string>();let r=first;
   for(;;){expect(seen.has(r.id)).toBe(false);seen.add(r.id);expect(r.bedTo).toBeLessThanOrEqual(r.bedFrom);
    if(!r.downstream){expect(pointInPolygon(r.to,model.outline)).toBe(false);break;}
    const next=byId.get(r.downstream);expect(next,r.id).toBeDefined();
    expect(r.to).toEqual(next!.from);expect(r.bedTo).toBeGreaterThanOrEqual(next!.bedFrom-1e-7);r=next!;
   }
  }
  for(const a of model.foundation.anchors.filter(a=>a.water))expect(model.reaches.some(r=>r.id.startsWith('tributary_'+a.id+'_'))).toBe(true);
 });
 it('uses the same river bends for collision and leaves existing homes, farms, bank locations and roads dry',()=>{
  for(const r of model.reaches.filter((_,i)=>i%37===0)){
   const p=r.points![4];if(!pointInPolygon(p,model.outline))continue;
   expect(model.sample(p.x,p.y).water).toBe(true);
   expect(terrainPlotIsDry(world.places,p,.01)).toBe(false);
   expect(nearestRiverPoint(p,r).distance).toBeLessThan(1e-8);
  }
  for(const p of Object.values(world.places))if(p.surface!=='water'){
   expect(model.sample(p.mapX,p.mapY).water,p.id).toBe(false);
   if(p.kind==='home'||p.kind==='workshop'||p.kind==='library')expect(terrainParcelIsDry(world.places,buildingPolygon(p)),p.id).toBe(true);
   if(p.kind==='resource_field')expect(terrainParcelIsDry(world.places,p.boundaryPolygon!),p.id).toBe(true);
  }
  for(const r of Object.values(world.routes))if(r.traversal==='walk')expect(pathCrossesWater(r.waypoints,world.places),r.id).toBe(false);
 });
 it('keeps the atlas read only, all six towns separated, and terrain deterministic on reload',()=>{
  const saved=structuredClone(world),second=new TerrainModel(structuredClone(world.terrain!));
  expect(second.outline).toEqual(model.outline);expect(second.reaches).toEqual(model.reaches);
  expect(settlementOptions(world)).toHaveLength(6);
  const towns=Object.values(world.settlements);
  for(let i=0;i<towns.length;i++)for(let j=i+1;j<towns.length;j++)expect(Math.hypot(towns[i].centerX-towns[j].centerX,towns[i].centerY-towns[j].centerY)*100/1000).toBeGreaterThan(900);
  const camera=new WorldMapCamera(),atlas=new WorldAtlasIndex();atlas.update(world);
  for(let i=0;i<120;i++){camera.zoom([.005,.1,3,30,300,1600][i%6]);camera.x=towns[i%6].centerX;camera.y=towns[i%6].centerY;
   atlas.visibleAreas(camera);atlas.visiblePlaces(world,camera,new Set());atlas.visibleRoads(world,camera);expect(atlas.tiles.size).toBeLessThanOrEqual(64);}
  expect(world).toEqual(saved);expect(repairCompactSettlementLayout(world)).toBe(false);
 });
 it('surveys future settlements and discoveries from existing ground, including real travel costs',()=>{
  const before=structuredClone(world);
  for(const t of Object.values(world.settlements)){
   const proposal={x:t.centerX+10,y:t.centerY+5},site=surveyFrontier(world,proposal,'forest');expect(site).toBeDefined();
   expect(model.sample(site!.x,site!.y).water).toBe(false);
   const town=surveySettlementSite(world,proposal);expect(town).toBeDefined();expect(terrainPlotIsDry(world.places,town!,2)).toBe(true);
  }
  const river=model.reaches[200],center=river.points![4];expect(terrainPlotIsDry(world.places,center,.5)).toBe(false);
  expect(surveyFrontier(world,{x:2000,y:2000},'plains')).toBeUndefined();
  expect(terrainWalkingScale(world.places,{x:-33000,y:-10000},{x:-32000,y:-11000})).toBeLessThan(1);
  expect(world).toEqual(before);
 });
 it('migrates once with a backup, retaining people, deaths, knowledge, road counts and Cardinal records',async()=>{
  const old=baseline(),bundle=createIndexedDbPersistence('fix6-continuity');await bundle.worldStore.initializeWorld(old);
  const records=['experience:observed:17','journal:decision:gateway-pending'];for(let i=0;i<records.length;i++)await bundle.controlLog.append('cardinal:continuity',i,records[i]);
  const engine=await WorldEngine.open({worldId:old.id,store:bundle.worldStore}),after=engine.snapshot();
  for(const key of ['id','epoch','calendar','determinism','relationships'] as const)expect(after[key]).toEqual(old[key]);
  for(const [id,a]of Object.entries(old.agents)){
   const {position:_p,movement:_m,...person}=a,{position:_q,movement:_n,...continued}=after.agents[id];expect(continued,id).toEqual(person);
  }
  expect(Object.keys(after.places).sort()).toEqual(Object.keys(old.places).sort());
  expect(after.v18!.secretLibrary.knowledgeByAgentId).toEqual(old.v18!.secretLibrary.knowledgeByAgentId);
  for(const [id,r]of Object.entries(old.routes))expect(after.routes[id]?.completedTraversals,id).toBe(r.completedTraversals);
  expect(await bundle.controlLog.read('cardinal:continuity')).toEqual(records);
  const reopened=await WorldEngine.open({worldId:old.id,store:bundle.worldStore});expect(reopened.snapshot()).toEqual(after);
  // Resume beyond the actual FIX5 failure, rather than merely loading a file.
  await reopened.advanceCanonicalTimeTo(22*Y);expect(reopened.snapshot().calendar.elapsedWorldMinutes).toBe(22*Y);
 },30000);
 it('rejects damaged or future terrain recipes without silently replacing the saved world',async()=>{
  const broken=structuredClone(world);broken.terrain!.anchors[0].x+=1;expect(()=>assertTerrainFoundation(broken.terrain)).toThrow('checksum');
  broken.revision=0;const store=new InMemoryWorldStore();await store.initializeWorld(broken);
  await expect(WorldEngine.open({worldId:broken.id,store})).rejects.toThrow('checksum');expect(await store.loadWorld(broken.id)).toEqual(broken);
 });
});
