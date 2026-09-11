import { orientedRouteWaypoints, routeIdBetween } from './WorldNavigation';
import { pathCrossesWater, routeAroundWater, worldWaterPolygons } from './WaterNavigation';
import { pointInPolygon } from './BuildingFootprints';
import { routeAroundBuildings } from './SettlementStreets';
import type { WorldPoint2D, WorldRouteState, WorldState } from './types';

function length(points:WorldPoint2D[]):number {return points.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-points[i].x,p.y-points[i].y),0);}
function onPath(points:WorldPoint2D[],distance:number) {
  for(let i=1;i<points.length;i++) {
    const a=points[i-1],b=points[i],d=Math.hypot(b.x-a.x,b.y-a.y);
    if(distance<=d||i===points.length-1){const t=Math.max(0,Math.min(1,distance/Math.max(1e-9,d)));return {index:i,point:{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}};}
    distance-=d;
  }
  return {index:1,point:points[0]};
}
function nearest(points:WorldPoint2D[],point:WorldPoint2D) {
  let best={index:1,point:points[0]},distance=Infinity;
  for(let i=1;i<points.length;i++) {
    const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/Math.max(1e-12,dx*dx+dy*dy)));
    const p={x:a.x+dx*t,y:a.y+dy*t},d=Math.hypot(p.x-point.x,p.y-point.y);
    if(d<distance){distance=d;best={index:i,point:p};}
  }
  return best;
}
/** Geometry-only repair: keep destination, purpose and lived road counts.
 * Local relocations preserve progress; distant travellers use the nearest
 * point on their existing journey rather than jumping to a town centre. */
export function reconcileRouteGeometry(world:WorldState,oldRoutes:Readonly<Record<string,WorldRouteState>>,
  moved:ReadonlyMap<string,{before:WorldPoint2D;after:WorldPoint2D}>):void {
  const water=worldWaterPolygons(world.places);
  for(const agent of Object.values(world.agents)) {
    const movement=agent.movement,relocated=moved.get(agent.locationId);
    if(!movement){if(relocated){agent.position.x=relocated.after.x;agent.position.y=relocated.after.y;}continue;}
    const routeIds=movement.routeIds??[routeIdBetween(agent.locationId,movement.targetPlaceId)];
    if(!relocated&&!moved.has(movement.targetPlaceId)&&routeIds.every(id=>oldRoutes[id]===world.routes[id]))continue;
    let from=agent.locationId;const points:WorldPoint2D[]=[];
    for(const id of routeIds) {
      const route=world.routes[id];
      if(!route||(route.fromPlaceId!==from&&route.toPlaceId!==from)){points.length=0;break;}
      points.push(...orientedRouteWaypoints(route,from).slice(points.length?1:0));
      from=route.fromPlaceId===from?route.toPlaceId:route.fromPlaceId;
    }
    let path=from===movement.targetPlaceId&&points.length>1?points:undefined;
    if(!path) {
      const adjusted=movement.waypoints.map(p=>{
        for(const change of moved.values())if(Math.hypot(p.x-change.before.x,p.y-change.before.y)<1e-7)return change.after;
        return p;
      });
      const dry=routeAroundWater(adjusted,world.places);
      path=dry?routeAroundBuildings(dry,agent.locationId,movement.targetPlaceId,world.places):undefined;
      if(path&&pathCrossesWater(path,water))path=undefined;
    }
    if(!path||path.length<2) {
      // A physically closed path ends on the last reachable dry point. No new
      // destination, knowledge or resident decision is manufactured here.
      const dry=movement.waypoints.filter(p=>!water.some(poly=>pointInPolygon(p,poly)));
      if(dry.length){const p=dry.reduce((a,b)=>Math.hypot(a.x-agent.position.x,a.y-agent.position.y)<Math.hypot(b.x-agent.position.x,b.y-agent.position.y)?a:b);agent.position.x=p.x;agent.position.y=p.y;}
      agent.movement=undefined;continue;
    }
    const oldLength=length(movement.waypoints),remaining=length([agent.position,...movement.waypoints.slice(movement.nextWaypointIndex)]);
    const local=length(path)<10&&oldLength<40;
    const position=local?onPath(path,length(path)*Math.max(0,Math.min(1,1-remaining/Math.max(1e-8,oldLength)))):nearest(path,agent.position);
    movement.waypoints=path;movement.nextWaypointIndex=position.index;
    if(points.length>1)movement.routeIds=routeIds;
    agent.position.x=position.point.x;agent.position.y=position.point.y;
  }
}
