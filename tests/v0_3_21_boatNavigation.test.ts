import {describe,it,expect} from 'vitest';
import {WorldEngine} from '../src/world/WorldEngine';
import {InMemoryWorldStore} from '../src/world/InMemoryWorldStore';
import {hash} from '../src/world/geography/TerrainMath';
import {bindWorldTerrain} from '../src/world/geography/WorldTerrain';
import {startBoatTravel,startBoatFishing,startBoatExploration,advanceBoats} from '../src/v21/BoatNavigation';
import {sailingCourse,waterSegment} from '../src/v21/SailingRoutes';
import {assertBoatNavigation} from '../src/v21/BoatValidation';
import {worldWeatherV21} from '../src/v21/WeatherV21';
import {BOAT_KNOWLEDGE_ID} from '../src/v21/MaritimePractice';
import {recordPhysicalGoodsV21} from '../src/v21/EconomySystemV21';
import {WorldAtlasIndex} from '../src/presentation/WorldAtlasIndex';
import {WorldMapCamera} from '../src/presentation/WorldMapCamera';

async function setup() {
 const world=(await WorldEngine.create({worldId:'boat-water-test',seed:'boat-water-test',store:new InMemoryWorldStore(),startTime:0})).snapshot();
 const center={x:world.places.commons.mapX+12,y:world.places.commons.mapY+12},f=world.terrain!;
 f.anchors.push({id:'boat-test-lake',...center,kind:'lake',radius:2,water:[{x:center.x-1.5,y:center.y-2},{x:center.x+1.5,y:center.y-2},{x:center.x+1.5,y:center.y+2},{x:center.x-1.5,y:center.y+2}]});
 f.key='terrain-v1:'+hash(JSON.stringify({...f,key:''}));bindWorldTerrain(world);
 for(const [id,dx]of [['boat_west',-1.53],['boat_east',1.53]] as const)world.places[id]={id,name:'Озёрный берег',kind:'lake',biome:'lake',surface:'shore',
  mapX:center.x+dx,mapY:center.y,capacity:10,connectedPlaceIds:[],fertility:.4,danger:0,geographyVersion:1};
 for(const a of [world.agents.agent_1,world.agents.agent_2]) {
  a.life.ageYears=25;a.life.alive=true;a.life.health=1;a.energy=1;a.locationId='boat_west';delete a.movement;
  a.position={x:world.places.boat_west.mapX,y:center.y,layerId:'surface'};
  a.knownPlaceIds=['boat_west','boat_east'];a.skills.craft=.8;
  world.v18!.secretLibrary.knowledgeByAgentId[a.id]=[{id:'boat-theory',knowledgeId:BOAT_KNOWLEDGE_ID,title:'Корабль',category:'engineering',
   historicalSource:'ЭСБЕ',sourceTitle:'Корабль',sourceUrl:'https://ru.wikisource.org/wiki/ЭСБЕ/Корабль',acquiredWorldMinute:0,understanding:.8,
   summary:'Киль, шпангоуты, обшивка',concepts:['кораблестроение'],practiceCount:1,sharedCount:0}];
 }
 for(let d=0;worldWeatherV21(world).kind==='storm'&&d<20;d++)world.calendar.elapsedWorldMinutes+=2880;
 world.v15!.items.test_boat={id:'test_boat',kind:'artifact',name:'Гребная лодка',ownerAgentId:'agent_1',createdWorldMinute:0,locationId:'boat_west',
  quality:.8,effectiveness:.4,reliability:.8,description:'Лодка',boat:{completed:true,laborMinutes:4800,requiredLaborMinutes:4800,lastWorkedMinute:0,condition:1}};
 return world;
}

describe('physical, voluntary boat navigation',()=>{
 it('opens an actual saved world with a voyage in progress and retains its physical course',async()=>{
  const w=await setup(),a=w.agents.agent_1,minute=w.calendar.elapsedWorldMinutes;
  expect(startBoatTravel(w,a,'boat_east','walk',0,()=>false)).toBe(true);advanceBoats(w,2,minute);
  w.calendar.elapsedWorldMinutes=minute+2;w.revision=0;
  const store=new InMemoryWorldStore();await store.initializeWorld(w);
  const restored=await WorldEngine.open({worldId:w.id,store});
  const saved=restored.snapshot();expect(saved.agents.agent_1.movement?.boatId).toBe('test_boat');
  expect(saved.agents.agent_1.position).toEqual(a.position);assertBoatNavigation(saved,'test_boat');
  await restored.advanceCanonicalTime(1,30);
  expect(restored.snapshot().agents.agent_1.locationId).toBe('boat_east');
  const reopened=await WorldEngine.open({worldId:w.id,store});
  expect(reopened.snapshot().agents.agent_1.movement).toBeUndefined();
  expect(reopened.snapshot().v15!.items.test_boat.locationId).toBe('boat_east');
 });
 it('boards only willing adults, carries their existing cargo continuously and lands them together',async()=>{
  const w=await setup(),a=w.agents.agent_1,b=w.agents.agent_2,start={...a.position},minute=w.calendar.elapsedWorldMinutes;
  recordPhysicalGoodsV21(w,a,'wood',2);recordPhysicalGoodsV21(w,b,'meat',.4);
  const before=structuredClone(w.v19!.adventureEconomy.adventurersByAgentId);
  expect(startBoatTravel(w,a,'boat_east','walk',0,()=>false)).toBe(true);
  expect(b.movement).toBeUndefined();
  expect(startBoatTravel(w,b,'boat_east','walk',0,()=>false)).toBe(true);
  expect(advanceBoats(w,.05,minute)).toHaveLength(0);
  expect(a.position.x).toBeGreaterThan(start.x);expect(a.position.x).toBeLessThan(w.places.boat_east.mapX);
  expect(b.position).toEqual(a.position);expect(a.locationId).toBe('boat_west');assertBoatNavigation(w,'test_boat');
  const reloaded=JSON.parse(JSON.stringify(w));assertBoatNavigation(reloaded,'test_boat');
  const arrived=advanceBoats(reloaded,30,minute+.05);
  expect(arrived).toHaveLength(2);expect(reloaded.agents.agent_1.locationId).toBe('boat_east');
  expect(reloaded.agents.agent_2.movement).toBeUndefined();expect(reloaded.v15.items.test_boat.locationId).toBe('boat_east');
  expect(reloaded.v19.adventureEconomy.adventurersByAgentId).toEqual(before);
 });

 it('cannot launch without a real vessel, theory, room for the load or in a storm',async()=>{
  const w=await setup(),a=w.agents.agent_1;
  a.life.ageYears=12;expect(startBoatTravel(w,a,'boat_east','walk',0,()=>false)).toBe(false);a.life.ageYears=25;
  const theory=w.v18!.secretLibrary.knowledgeByAgentId[a.id];w.v18!.secretLibrary.knowledgeByAgentId[a.id]=[];
  expect(startBoatTravel(w,a,'boat_east','walk',0,()=>false)).toBe(false);w.v18!.secretLibrary.knowledgeByAgentId[a.id]=theory;
  recordPhysicalGoodsV21(w,a,'stone',20);expect(startBoatTravel(w,a,'boat_east','walk',0,()=>false)).toBe(false);
  w.v19!.adventureEconomy.adventurersByAgentId[a.id].carriedGoods={};
  for(let i=0;i<100&&worldWeatherV21(w).kind!=='storm';i++)w.calendar.elapsedWorldMinutes+=2880;
  expect(worldWeatherV21(w).kind).toBe('storm');expect(startBoatTravel(w,a,'boat_east','walk',0,()=>false)).toBe(false);
 });

 it('uses water for every sailing segment and never draws a water voyage as a road',async()=>{
  const w=await setup(),a=w.agents.agent_1,course=sailingCourse(w,a.position,{x:w.places.boat_east.mapX,y:w.places.boat_east.mapY});
  expect(course).toBeDefined();
  for(let i=2;i<course!.length-1;i++)expect(waterSegment(w,course![i-1],course![i])).toBe(true);
  expect(sailingCourse(w,a.position,{x:a.position.x-8,y:a.position.y-8})).toBeUndefined();
  expect(startBoatTravel(w,a,'boat_east','walk',0,()=>false)).toBe(true);advanceBoats(w,30,w.calendar.elapsedWorldMinutes);
  expect(Object.values(w.routes).some(r=>r.traversal==='boat')).toBe(true);
  const atlas=new WorldAtlasIndex();atlas.update(w);const camera=new WorldMapCamera();
  expect(atlas.visibleRoads(w,camera).every(r=>r.traversal!=='boat')).toBe(true);
 });

 it('catches fish only after time on the water and return, with the same result after a reload',async()=>{
  const w=await setup(),a=w.agents.agent_1,minute=w.calendar.elapsedWorldMinutes;
  const original=Object.values(w.wildlife)[0];
  w.wildlife.boat_fish={...original,id:'boat_fish',species:'fish',habitatId:'boat_west',count:20,carryingCapacity:40,threat:0,isMonster:false,alertness:0};
  expect(startBoatFishing(w,a,'boat_fish',0,0)).toBe(true);expect(w.wildlife.boat_fish.count).toBe(20);
  const full=structuredClone(w);advanceBoats(full,100,minute);
  advanceBoats(w,20,minute);expect(w.wildlife.boat_fish.count).toBe(20);
  const resumed=JSON.parse(JSON.stringify(w));advanceBoats(resumed,80,minute+20);
  expect(resumed.wildlife.boat_fish.count).toBeLessThan(20);expect(resumed.wildlife.boat_fish.count).toBe(full.wildlife.boat_fish.count);
  expect(resumed.agents.agent_1.position).toEqual(full.agents.agent_1.position);
  expect(resumed.agents.agent_1.energy).toBeCloseTo(full.agents.agent_1.energy,10);
  const caught=resumed.wildlife.boat_fish.count;advanceBoats(resumed,100,minute+100);expect(resumed.wildlife.boat_fish.count).toBe(caught);
 });

 it('discovers the actual landing only on arrival and gives no knowledge to an absent person',async()=>{
  const w=await setup(),a=w.agents.agent_1,b=w.agents.agent_2;delete w.places.boat_east;a.knownPlaceIds=['boat_west'];
  const otherKnowledge=[...b.knownPlaceIds!],count=Object.keys(w.places).length;
  expect(startBoatExploration(w,a,0)).toBe(true);expect(Object.keys(w.places)).toHaveLength(count);
  expect(a.knownPlaceIds).toEqual(['boat_west']);
  const arrived=advanceBoats(w,60,w.calendar.elapsedWorldMinutes);expect(arrived[0].discovered).toBe(true);
  expect(Object.keys(w.places)).toHaveLength(count+1);expect(a.locationId).not.toBe('boat_west');
  expect(bindWorldTerrain(w)!.sample(a.position.x,a.position.y).water).toBe(false);expect(b.knownPlaceIds).toEqual(otherKnowledge);
 });

 it('returns a surviving passenger physically when the pilot dies and rejects corrupted saved occupancy',async()=>{
  const w=await setup(),a=w.agents.agent_1,b=w.agents.agent_2,minute=w.calendar.elapsedWorldMinutes;
  expect(startBoatTravel(w,a,'boat_east','walk',0,()=>false)).toBe(true);expect(startBoatTravel(w,b,'boat_east','walk',0,()=>false)).toBe(true);
  advanceBoats(w,2,minute);const bad=structuredClone(w);bad.agents.agent_2.position.x+=5;
  expect(()=>assertBoatNavigation(bad,'test_boat')).toThrow();
  a.life.alive=false;const arrivals=advanceBoats(w,30,minute+2);
  expect(arrivals.every(r=>r.returned)).toBe(true);expect(b.locationId).toBe('boat_west');expect(a.life.alive).toBe(false);
 });
});
