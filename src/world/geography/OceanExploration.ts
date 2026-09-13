import type {WorldPoint2D,WorldState} from '../types';
import {bindWorldTerrain} from './WorldTerrain';
import {distanceToSegment,hash} from './TerrainMath';
import type {BoatJourney} from '../../v21/BoatNavigation';

export const NAUTICAL_MILE=18.52; // one physical world unit is 100 metres
export const OCEAN_CHART_CELL=100,MAX_CHART_CELLS=4096,MAX_OCEAN_DECISIONS=128;
export interface OffshoreLand {id:string;kind:'islet'|'island'|'continent';seed:number;center:WorldPoint2D;radius:number;outline:WorldPoint2D[]}
export interface OceanFrontierRequest {
  id:string;worldId:string;epoch:number;boatId:string;pilotId:string;
  origin:WorldPoint2D;position:WorldPoint2D;direction:WorldPoint2D;
  distance:number;worldMinute:number;seed:number;
}
export interface OceanExplorationState {
  version:1;charted:Record<string,true>;sealed:boolean;
  decisions:Record<string,'ocean'|'islet'|'island'|'continent'>;
  pending?:OceanFrontierRequest;
}
export interface OceanDecision {requestId:string;land?:OffshoreLand}
export const oceanCell=(p:WorldPoint2D)=>`${Math.floor(p.x/OCEAN_CHART_CELL)}:${Math.floor(p.y/OCEAN_CHART_CELL)}`;

/** Called by physical transport, never by the observer's camera. Sea that a
 * crew has actually surveyed is retained permanently, including empty sea.
 * On a full chart we stop extension rather than forget and overwrite water. */
export function recordOceanPassage(world:WorldState,boatId:string,journey:BoatJourney,position:WorldPoint2D,minute:number):void {
  const model=bindWorldTerrain(world);if(!model||!model.sample(position.x,position.y).water||model.sample(position.x,position.y).biome!=='ocean')return;
  const state=world.oceanExploration??={version:1,charted:{},sealed:false,decisions:{}};
  if(state.sealed)return;
  for(const dx of [-20,0,20])for(const dy of [-20,0,20]){
    const key=oceanCell({x:position.x+dx,y:position.y+dy});
    if(!state.charted[key]){
      if(Object.keys(state.charted).length>=MAX_CHART_CELLS){state.sealed=true;return;}
      state.charted[key]=true;
    }
  }
  if(journey.purpose!=='explore'||journey.returning||state.pending||Object.keys(state.decisions).length>=MAX_OCEAN_DECISIONS)return;
  const pilot=world.agents[journey.pilotId],origin=journey.waypoints[0];
  if(!pilot?.life.alive||pilot.movement?.boatId!==boatId||!origin)return;
  const dx=position.x-origin.x,dy=position.y-origin.y,distance=Math.hypot(dx,dy);
  const sector=`${Math.floor(position.x/2000)}:${Math.floor(position.y/2000)}`;
  const id=`ocean:${world.epoch??1}:${sector}`,seed=hash(`${world.terrain!.seed}:${id}`);
  // New ground is a possibility after 20–80 NM of outward exploration,
  // never a reward for circling a harbour or repeatedly loading a save.
  if(state.decisions[id]||distance<(20+(seed/4294967296)*60)*NAUTICAL_MILE)return;
  if(model.landOutlines.some(poly=>poly.some((a,i)=>distanceToSegment(position,a,poly[(i+1)%poly.length]).distance<20*NAUTICAL_MILE)))return;
  state.pending={id,worldId:world.id,epoch:world.epoch??1,boatId,pilotId:pilot.id,origin:{...origin},position:{...position},
    direction:{x:dx/distance,y:dy/distance},distance,worldMinute:minute,seed};
}

export function assertOceanExploration(world:Readonly<WorldState>):void {
  const s=world.oceanExploration;if(!s)return;
  if(s.version!==1||typeof s.sealed!=='boolean'||!s.charted||!s.decisions||Object.keys(s.charted).length>MAX_CHART_CELLS||
    Object.keys(s.decisions).length>MAX_OCEAN_DECISIONS||Object.entries(s.charted).some(([k,v])=>!/^[-]?\d+:[-]?\d+$/.test(k)||v!==true)||
    Object.values(s.decisions).some(k=>!['ocean','islet','island','continent'].includes(k)))throw new Error('Invalid persistent ocean survey.');
  const r=s.pending;
  if(r&&(r.worldId!==world.id||r.epoch!==(world.epoch??1)||typeof r.id!=='string'||s.decisions[r.id]||
    !Number.isSafeInteger(r.seed)||!Number.isFinite(r.distance)||r.distance<20*NAUTICAL_MILE||!Number.isFinite(r.worldMinute)||
    r.worldMinute<0||r.worldMinute>world.calendar.elapsedWorldMinutes+1e-7||
    [r.position,r.origin,r.direction].some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))||
    Math.abs(Math.hypot(r.direction.x,r.direction.y)-1)>1e-7))throw new Error('Invalid ocean exploration evidence.');
}
