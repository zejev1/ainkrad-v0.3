import type { WorldPoint2D, WorldState } from './types';
import { bindWorldTerrain } from './geography/WorldTerrain';
import { waterAccess } from '../v21/SailingRoutes';
import { finishWorldGeography } from './WorldGeography';
import { routeIdBetween } from './WorldNavigation';
import { pathCrossesWater } from './WaterNavigation';
import { routeAroundBuildings } from './SettlementStreets';

export const RULID_HARBOR_ID='rulid_harbor';
export const RULID_BEACH_ID='rulid_beach';

function drySegment(world:Readonly<WorldState>,a:WorldPoint2D,b:WorldPoint2D):boolean {
  const terrain=bindWorldTerrain(world);if(!terrain)return false;
  const steps=Math.max(2,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/.015));
  for(let i=0;i<=steps;i++) {
    const t=i/steps;
    if(terrain.sample(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t).water)return false;
  }
  return true;
}


function installCoastalWalk(world:WorldState,fromId:string,toId:string):boolean {
  const from=world.places[fromId],to=world.places[toId];
  if(!from||!to)return false;
  const path=[{x:from.mapX,y:from.mapY},{x:to.mapX,y:to.mapY}];
  if(pathCrossesWater(path,world.places))return false;
  if(routeAroundBuildings(path,fromId,toId,world.places)!==path)return false;
  const id=routeIdBetween(fromId,toId);
  world.routes[id]={
    id,fromPlaceId:fromId,toPlaceId:toId,traversal:'walk',
    waypoints:path,
    distance:Math.hypot(to.mapX-from.mapX,to.mapY-from.mapY),
    geometryVersion:3,widthMetres:3,terrainKey:world.terrain?.key,
    completedTraversals:world.routes[id]?.completedTraversals??0,
  };
  return true;
}

function coastalNeighbour(
  world:Readonly<WorldState>,
  shore:WorldPoint2D,
  side:-1|1,
):WorldPoint2D|undefined {
  const terrain=bindWorldTerrain(world),wet=waterAccess(world,shore);
  if(!terrain||!wet)return;
  const dx=wet.x-shore.x,dy=wet.y-shore.y,length=Math.max(1e-9,Math.hypot(dx,dy));
  const seaward={x:dx/length,y:dy/length};
  const tangent={x:-seaward.y*side,y:seaward.x*side};
  const occupied=Object.values(world.places).filter(p=>p.surface!=='water');

  // Start within a few metres of the existing physical bank and widen only
  // when an old building already occupies that patch. This bounded survey
  // guarantees we search the local coast rather than inventing a remote port.
  for(const along of [.02,.03,.04,.05,.06,.08,.10,.12,.16,.20,.28,.36,.48,.62,.78]) {
    for(const inward of [.01,.02,.03,.04,.05,.07,.10,.14,.18]) {
      const p={
        x:shore.x+tangent.x*along-seaward.x*inward,
        y:shore.y+tangent.y*along-seaward.y*inward,
      };
      if(terrain.sample(p.x,p.y).water||!waterAccess(world,p)||!drySegment(world,shore,p))continue;
      if(occupied.some(place=>place.id!=='rulid_shore'&&
        Math.hypot(place.mapX-p.x,place.mapY-p.y)<.08))continue;
      const direct=[{...shore},{...p}];
      if(pathCrossesWater(direct,world.places))continue;
      if(routeAroundBuildings(direct,'rulid_shore','__rulid_coastal_candidate__',world.places)!==direct)continue;
      return p;
    }
  }
}

/**
 * Adds two fixed pieces of Rulid's civic coast. No resident, home or existing
 * shoreline is relocated. Boat routes still begin from physical water access;
 * these places merely provide a real build/mooring bank and a public beach.
 */
export function ensureRulidHarbor(world:WorldState):boolean {
  const town=world.settlements.settlement_rulid;
  const shore=world.places.rulid_shore;
  if(!town||!shore||!world.terrain)return false;

  const needHarbor=!world.places[RULID_HARBOR_ID];
  const needBeach=!world.places[RULID_BEACH_ID];
  if(!needHarbor&&!needBeach)return false;

  const shorePoint={x:shore.mapX,y:shore.mapY};
  const harborPoint=needHarbor?coastalNeighbour(world,shorePoint,1):undefined;
  const beachPoint=needBeach?coastalNeighbour(world,shorePoint,-1):undefined;
  // Never create a decorative or unreachable facility.
  if((needHarbor&&!harborPoint)||(needBeach&&!beachPoint))return false;

  if(needHarbor&&harborPoint){
    world.places[RULID_HARBOR_ID]={
      id:RULID_HARBOR_ID,
      name:'Верфь и причал Рулида',
      kind:'shore',
      capacity:24,
      biome:'coast',
      mapX:harborPoint.x,mapY:harborPoint.y,
      connectedPlaceIds:[
        'rulid_shore',
        ...(world.places.rulid_commons &&
          drySegment(world,{x:world.places.rulid_commons.mapX,y:world.places.rulid_commons.mapY},harborPoint)
          ? ['rulid_commons']
          : []),
      ],
      fertility:.16,danger:.08,surface:'shore',
      discoveredAt:world.epochStartedAt??world.now,
      geographyVersion:1,
    };
    if(!shore.connectedPlaceIds.includes(RULID_HARBOR_ID))shore.connectedPlaceIds.push(RULID_HARBOR_ID);
    if(!installCoastalWalk(world,'rulid_shore',RULID_HARBOR_ID))
      throw new Error('Rulid harbor was placed without a physical shore path.');
    const commons=world.places.rulid_commons;
    if(commons&&world.places[RULID_HARBOR_ID].connectedPlaceIds.includes('rulid_commons')&&
       !commons.connectedPlaceIds.includes(RULID_HARBOR_ID)) commons.connectedPlaceIds.push(RULID_HARBOR_ID);
  }
  if(needBeach&&beachPoint){
    world.places[RULID_BEACH_ID]={
      id:RULID_BEACH_ID,
      name:'Пляж Рулида',
      kind:'shore',
      capacity:30,
      biome:'coast',
      mapX:beachPoint.x,mapY:beachPoint.y,
      connectedPlaceIds:['rulid_shore'],
      fertility:.24,danger:.1,surface:'shore',
      discoveredAt:world.epochStartedAt??world.now,
      geographyVersion:1,
    };
    if(!shore.connectedPlaceIds.includes(RULID_BEACH_ID))shore.connectedPlaceIds.push(RULID_BEACH_ID);
    if(!installCoastalWalk(world,'rulid_shore',RULID_BEACH_ID))
      throw new Error('Rulid beach was placed without a physical shore path.');
  }
  // Commit the new places/connections into the geography signature now. A
  // later reopen must be a pure read, not a second "repair" revision.
  finishWorldGeography(world);
  return true;
}
