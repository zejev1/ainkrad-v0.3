import type {AgentRace,WorldPlace,WorldState,WorldPoint2D} from '../types';
import {SAPIENT_PEOPLE_FOUNDATIONS} from '../SapientPeoples';
import {polygonsOverlap} from '../BuildingFootprints';
import {featureBounds} from './FeatureIndex';
import {terrainModel,type TerrainModel} from './TerrainModel';
import {hash} from './TerrainMath';
import type {TerrainFoundation,TerrainAnchor} from './TerrainTypes';

const contexts=new WeakMap<Readonly<Record<string,WorldPlace>>,TerrainModel>();

const NON_HUMAN_FOUNDING_RACES: readonly Exclude<AgentRace,'human'>[] = ['elf','dwarf','goblin','orc','ogre'];
/**
 * Safe mainland sectors. Assignment and small jitter are seed-specific, but
 * every slot stays inside the persisted continental bounds. Terrain anchors
 * then make the chosen homeland physically part of the same continent.
 */
const HOMELAND_MAINLAND_SLOTS: readonly WorldPoint2D[] = [
  {x:-47_000,y:-14_000},
  {x:-47_000,y:14_000},
  {x:-28_000,y:-8_000},
  {x:-28_000,y:8_000},
  {x:-9_000,y:0},
];
export const terrainForPlaces=(places:Readonly<Record<string,WorldPlace>>)=>contexts.get(places);
export function bindWorldTerrain(world:Readonly<WorldState>):TerrainModel|undefined {
  if(!world.terrain)return undefined;let model=contexts.get(world.places);
  if(!model||model.foundation.key!==world.terrain.key){model=terrainModel(world.terrain);contexts.set(world.places,model);}return model;
}

/** Resolve a persisted settlement first. Before a people appears, reserve a
 * seed-specific remote region in the terrain. All peoples share one rotation,
 * reflection and scale, preserving continental separation without repeating
 * identical coordinates in every new epoch. */
export function homelandCenterForWorld(
  world: Readonly<WorldState>,
  race: AgentRace,
): WorldPoint2D {
  const settlementId = race === 'human'
    ? 'commons'
    : `settlement_${race}_homeland`;
  const existing = world.places[settlementId];
  if (existing) return { x: existing.mapX, y: existing.mapY };
  const reserved = world.terrain?.anchors.find(
    (anchor) => anchor.id === `foundation_${race}`,
  );
  if (reserved) return { x: reserved.x, y: reserved.y };

  const human = world.places.commons ?? SAPIENT_PEOPLE_FOUNDATIONS.human.homelandCenter;
  if (race === 'human') return { x: human.mapX, y: human.mapY };

  const raceIndex = NON_HUMAN_FOUNDING_RACES.indexOf(race as Exclude<AgentRace,'human'>);
  if (raceIndex < 0) return { ...SAPIENT_PEOPLE_FOUNDATIONS[race].homelandCenter };
  const key = `${world.id}:epoch:${world.epoch ?? 1}:homeland-layout-v2`;
  const rotation = hash(`${key}:slot-rotation`) % HOMELAND_MAINLAND_SLOTS.length;
  const reverse = (hash(`${key}:slot-direction`) & 1) === 1;
  const orderedIndex = reverse ? -raceIndex : raceIndex;
  const slotIndex = (rotation + orderedIndex + HOMELAND_MAINLAND_SLOTS.length) % HOMELAND_MAINLAND_SLOTS.length;
  const slot = HOMELAND_MAINLAND_SLOTS[slotIndex];
  const unit = (suffix:string) => hash(`${key}:${race}:${suffix}`) / 0x1_0000_0000;
  // At most ±350 map units (35 km): worlds differ, but settlements never
  // leave their safe continental sectors.
  return {
    x: slot.x + (unit('x') - 0.5) * 700,
    y: slot.y + (unit('y') - 0.5) * 700,
  };
}
function rescueIslandOutline(center:WorldPoint2D,radius:number,seed:number):WorldPoint2D[] {
  return Array.from({length:32},(_,index)=>{
    const angle=index*Math.PI*2/32;
    const wobble=.95+(hash(`${seed}:outline:${index}`)/0x1_0000_0000)*.04;
    return {x:center.x+Math.cos(angle)*radius*wobble,y:center.y+Math.sin(angle)*radius*wobble};
  });
}

/**
 * Compatibility repair for a lived F2 world whose already-persisted homeland
 * was left in physical ocean by the old coordinate migration. Residents,
 * homes, settlement centres, routes' history, calendar and RNG are not moved.
 * We correct the geography underneath those saved coordinates instead.
 */
export function repairSubmergedSapientHomelands(world:WorldState):number {
  if(!world.terrain)return 0;
  const model=bindWorldTerrain(world);if(!model)return 0;
  const additions:NonNullable<TerrainFoundation['offshore']>=[];
  const existingIds=new Set((world.terrain.offshore??[]).map(land=>land.id));

  for(const race of NON_HUMAN_FOUNDING_RACES) {
    const settlementId=`settlement_${race}_homeland`;
    const center=world.places[settlementId];if(!center)continue;
    const members=Object.values(world.places).filter(place=>place.settlementId===settlementId);
    if(!members.some(place=>model.sample(place.mapX,place.mapY).water))continue;
    const id=`homeland-rescue:${race}`;if(existingIds.has(id))continue;

    const maxMemberDistance=Math.max(0,...members.map(place=>Math.hypot(place.mapX-center.mapX,place.mapY-center.mapY)));
    const radius=Math.min(400,Math.max(20,maxMemberDistance+8));
    const seed=hash(`${world.id}:epoch:${world.epoch??1}:${id}`);
    additions.push({
      id,kind:'island',seed,
      center:{x:center.mapX,y:center.mapY},
      radius,
      outline:rescueIslandOutline({x:center.mapX,y:center.mapY},radius,seed),
    });
    existingIds.add(id);
  }

  if(!additions.length)return 0;
  world.terrain.offshore=[...(world.terrain.offshore??[]),...additions];
  world.terrain.key='terrain-v1:'+hash(JSON.stringify({...world.terrain,key:''}));
  assertTerrainFoundation(world.terrain);
  bindWorldTerrain(world);
  if(world.geography)world.geography.revision++;
  return additions.length;
}

/** Freeze the physical foundation once. Exploring or moving the observer
 * never regenerates previously existing rivers, heights or coastlines. */
export function repairWorldTerrain(world:WorldState):boolean {
  if(world.terrain){
    assertTerrainFoundation(world.terrain);
    if(world.terrain.epoch!==(world.epoch??1))throw new Error('World terrain belongs to a different epoch.');
    bindWorldTerrain(world);return false;
  }
  const anchors:TerrainAnchor[]=Object.values(world.places).filter(p=>p.surface!=='water').map(p=>({id:p.id,x:p.mapX,y:p.mapY,kind:p.kind,
    radius:['commons','city','village'].includes(p.kind)?3:['forest','mountains','swamp','meadow'].includes(p.kind)?2:1,
    ...(p.waterPolygon?{water:p.waterPolygon.map(p=>({...p}))}:{})}));
  for(const [race,f] of Object.entries(SAPIENT_PEOPLE_FOUNDATIONS)){
    const biome=f.homelandBiomes[0],kind=biome==='forest'?'forest':biome==='mountains'?'mountains':biome==='swamp'?'swamp':'meadow';
    anchors.push({id:'foundation_'+race,...homelandCenterForWorld(world,race as AgentRace),kind,radius:12});
  }
  anchors.sort((a,b)=>a.id.localeCompare(b.id));
  const seed=hash(world.id+':terrain:'+String(world.epoch??1));
  const foundation:TerrainFoundation={version:1,epoch:world.epoch??1,seed,key:'',anchors};foundation.key='terrain-v1:'+hash(JSON.stringify(foundation));
  world.terrain=foundation;bindWorldTerrain(world);
  return true;
}
export function terrainPlotIsDry(places:Readonly<Record<string,WorldPlace>>,point:WorldPoint2D,radius=.1):boolean {
  const polygon=[[-radius,-radius],[radius,-radius],[radius,radius],[-radius,radius]].map(([x,y])=>({x:point.x+x,y:point.y+y}));
  return terrainParcelIsDry(places,polygon);
}
export function terrainParcelIsDry(places:Readonly<Record<string,WorldPlace>>,polygon:WorldPoint2D[]):boolean {
  const model=terrainForPlaces(places);if(!model)return true;
  const bounds=featureBounds(polygon);
  return !polygonsOverlap(polygon,model.ocean)&&!model.waterIn(bounds).some(water=>polygonsOverlap(polygon,water))&&
    !model.anchors.query(bounds).some(a=>a.water&&polygonsOverlap(polygon,a.water));
}
export function terrainWalkingScale(places:Readonly<Record<string,WorldPlace>>,a:WorldPoint2D,b:WorldPoint2D):number {
  const model=terrainForPlaces(places);if(!model)return 1;
  const distance=Math.hypot(b.x-a.x,b.y-a.y);if(distance<2)return 1; // surveyed streets/local lanes
  const mid=model.sample((a.x+b.x)/2,(a.y+b.y)/2),rise=Math.max(0,model.elevation(b.x,b.y)-model.elevation(a.x,a.y));
  return 1/(1+rise/Math.max(1,distance*100)*8+(mid.biome==='swamp'?.7:mid.biome==='forest'?.2:mid.biome==='mountains'?.35:0));
}
export function assertTerrainFoundation(value:unknown):void {
  if(value===undefined)return;
  const f=value as TerrainFoundation;
  if(f.version!==1||!Number.isSafeInteger(f.seed)||!Number.isSafeInteger(f.epoch)||f.epoch<1||typeof f.key!=='string'||!Array.isArray(f.anchors))throw new Error('World terrain foundation is invalid.');
  const ids=new Set<string>();
  for(const a of f.anchors) {
    if(typeof a.id!=='string'||ids.has(a.id)||!Number.isFinite(a.x)||!Number.isFinite(a.y)||!Number.isFinite(a.radius)||a.radius<0)throw new Error('World terrain anchor is invalid.');
    ids.add(a.id);
    if(a.water&&(!Array.isArray(a.water)||a.water.length<3||a.water.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y))))throw new Error('World terrain water is invalid.');
  }
  if(f.offshore){
    if(!Array.isArray(f.offshore)||f.offshore.length>32)throw new Error('Invalid offshore land count.');
    const landIds=new Set<string>();
    for(const land of f.offshore){
      if(!land||typeof land.id!=='string'||landIds.has(land.id)||!['islet','island','continent'].includes(land.kind)||
        !Number.isSafeInteger(land.seed)||!land.center||!Number.isFinite(land.center.x)||!Number.isFinite(land.center.y)||
        !Number.isFinite(land.radius)||land.radius<2.5||land.radius>3000||!Array.isArray(land.outline)||land.outline.length!==32||
        land.outline.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw new Error('Invalid offshore land recipe.');
      landIds.add(land.id);
    }
  }
  const expected='terrain-v1:'+hash(JSON.stringify({version:1,epoch:f.epoch,seed:f.seed,key:'',anchors:f.anchors,...(f.offshore?{offshore:f.offshore}:{})}));
  if(f.key!==expected)throw new Error('World terrain recipe checksum is invalid.');
}
