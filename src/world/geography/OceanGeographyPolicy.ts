import type {WorldState} from '../types';
import type {OceanDecision,OffshoreLand} from './OceanExploration';
import {MAX_OCEAN_DECISIONS,OCEAN_CHART_CELL} from './OceanExploration';
import {bindWorldTerrain} from './WorldTerrain';
import {pointInPolygon,polygonsOverlap,segmentHitsPolygon} from '../BuildingFootprints';
import {hash} from './TerrainMath';

const area=(p:OffshoreLand)=>Math.abs(p.outline.reduce((s,a,i)=>{const b=p.outline[(i+1)%p.outline.length];return s+a.x*b.y-a.y*b.x;},0))/2;
export function oceanDecisionAllowed(world:Readonly<WorldState>,decision:Readonly<OceanDecision>):boolean {
  const state=world.oceanExploration,request=state?.pending,model=bindWorldTerrain(world);
  if(!model||!state||!request||state.sealed||request.worldId!==world.id||request.epoch!==(world.epoch??1)||
    decision.requestId!==request.id||state.decisions[request.id]||Object.keys(state.decisions).length>=MAX_OCEAN_DECISIONS)return false;
  const land=decision.land;if(!land)return true;
  const boat=world.v15?.items[request.boatId],pilot=world.agents[request.pilotId],journey=boat?.boat?.journey;
  if(!boat?.boat?.completed||!pilot?.life.alive||journey?.purpose!=='explore'||journey.returning||
    pilot.movement?.boatId!==request.boatId||journey.pilotId!==request.pilotId||
    world.calendar.elapsedWorldMinutes-request.worldMinute>1440)return false;
  const existing=world.terrain?.offshore??[];
  if(!land.center||Math.hypot(land.center.x-request.position.x,land.center.y-request.position.y)<land.radius+200||
    Math.hypot(land.center.x-request.position.x,land.center.y-request.position.y)>land.radius+600)return false;
  if(land.id!==request.id||land.seed!==request.seed||existing.length>=32||!['islet','island','continent'].includes(land.kind)||
    !Number.isFinite(land.radius)||land.radius<2.5||land.radius>3000||!Array.isArray(land.outline)||land.outline.length!==32||
    !Number.isFinite(land.center.x)||!Number.isFinite(land.center.y)||
    Math.abs(land.center.x)+land.radius>190000||Math.abs(land.center.y)+land.radius>90000||
    land.outline.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.hypot(p.x-land.center.x,p.y-land.center.y)>land.radius*1.001)||
    !pointInPolygon(land.center,land.outline)||area(land)<1||
    (land.kind==='islet'&&land.radius>5)||(land.kind==='island'&&(land.radius<20||land.radius>400))||
    (land.kind==='continent'&&(land.radius<1500||existing.some(p=>p.kind==='continent')))||
    existing.reduce((sum,p)=>sum+area(p),area(land))>30_000_000)return false;
  // Every approval preserves old mainland, prior islands, visited sea and
  // all existing settlements/roads and currently planned sailing segments.
  if(model.landOutlines.some(poly=>polygonsOverlap(land.outline,poly))||
    existing.some(p=>Math.hypot(p.center.x-land.center.x,p.center.y-land.center.y)<p.radius+land.radius+200))return false;
  for(const key of Object.keys(state.charted)){
    const [x,y]=key.split(':').map(Number),size=OCEAN_CHART_CELL;
    const square=[{x:x*size,y:y*size},{x:(x+1)*size,y:y*size},{x:(x+1)*size,y:(y+1)*size},{x:x*size,y:(y+1)*size}];
    if(polygonsOverlap(land.outline,square))return false;
  }
  if(Object.values(world.places).some(p=>pointInPolygon({x:p.mapX,y:p.mapY},land.outline))||
    Object.values(world.agents).some(a=>pointInPolygon(a.position,land.outline)))return false;
  if(Object.values(world.routes).some(route=>route.waypoints.slice(1).some((p,i)=>segmentHitsPolygon(route.waypoints[i],p,land.outline))))return false;
  for(const item of Object.values(world.v15?.items??{})){
    const route=item.boat?.journey?.waypoints;
    if(route?.slice(1).some((p,i)=>segmentHitsPolygon(route[i],p,land.outline)))return false;
  }
  return true;
}

export function applyOceanDecision(world:WorldState,decision:Readonly<OceanDecision>):void {
  if(!oceanDecisionAllowed(world,decision))throw new Error('Ocean proposal violates surveyed geography.');
  const state=world.oceanExploration!;
  state.decisions[decision.requestId]=decision.land?.kind??'ocean';delete state.pending;
  if(decision.land){
    const f=world.terrain!;f.offshore??=[];f.offshore.push(structuredClone(decision.land));
    f.key='terrain-v1:'+hash(JSON.stringify({...f,key:''}));
    bindWorldTerrain(world);
    if(world.geography)world.geography.revision++;
  }
}

