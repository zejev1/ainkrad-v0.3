import type {AgentRace,WorldPlace,WorldState,WorldPoint2D} from '../types';
import {SAPIENT_PEOPLE_FOUNDATIONS} from '../SapientPeoples';
import {polygonsOverlap} from '../BuildingFootprints';
import {featureBounds} from './FeatureIndex';
import {terrainModel,type TerrainModel} from './TerrainModel';
import {hash} from './TerrainMath';
import type {TerrainFoundation,TerrainAnchor} from './TerrainTypes';

const contexts=new WeakMap<Readonly<Record<string,WorldPlace>>,TerrainModel>();
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
  const key = `${world.id}:epoch:${world.epoch ?? 1}:homeland-layout`;
  const unit = (suffix: string) => hash(`${key}:${suffix}`) / 0x1_0000_0000;
  const angle = (unit('rotation') - 0.5) * 0.44;
  const scale = 1.02 + unit('scale') * 0.16;
  const mirror = unit('reflection') < 0.5 ? -1 : 1;
  const canonical = SAPIENT_PEOPLE_FOUNDATIONS[race].homelandCenter;
  const dx = canonical.x - SAPIENT_PEOPLE_FOUNDATIONS.human.homelandCenter.x;
  const dy = (canonical.y - SAPIENT_PEOPLE_FOUNDATIONS.human.homelandCenter.y) * mirror;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    x: human.mapX + (dx * cosine - dy * sine) * scale,
    y: human.mapY + (dx * sine + dy * cosine) * scale,
  };
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
