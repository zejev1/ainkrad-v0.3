import type { WorldState } from '../world/types';

/** Saved occupancy and course validation prevents double boats, teleports
 * and accepting a corrupt unfinished voyage as ordinary land travel. */
export function assertBoatNavigation(world:Readonly<WorldState>,itemId:string):void {
  const item=world.v15?.items[itemId],boat=item?.boat;if(!boat)return;
  const finite=(n:unknown)=>typeof n==='number'&&Number.isFinite(n);
  const point=(p:unknown)=>!!p&&typeof p==='object'&&finite((p as {x:number}).x)&&finite((p as {y:number}).y);
  if(boat.condition!==undefined&&(!finite(boat.condition)||boat.condition<0||boat.condition>1))throw new Error('Invalid boat condition.');
  if(boat.position!==undefined&&!point(boat.position))throw new Error('Invalid boat position.');
  const j=boat.journey;if(!j)return;
  if(!boat.completed||!boat.position||!world.places[j.originPlaceId]||!world.places[j.destinationPlaceId]||
    !Array.isArray(j.occupantIds)||!j.occupantIds.length||j.occupantIds.length>2||new Set(j.occupantIds).size!==j.occupantIds.length||
    !j.occupantIds.includes(j.pilotId)||!Array.isArray(j.waypoints)||j.waypoints.length<2||j.waypoints.length>2000||
    j.waypoints.some(p=>!point(p))||!Number.isInteger(j.nextWaypointIndex)||j.nextWaypointIndex<1||j.nextWaypointIndex>=j.waypoints.length||
    ![j.startedWorldMinute,j.lastAdvancedWorldMinute,j.fishingMinutes,j.travelledDistance].every(n=>finite(n)&&n>=0)||
    j.lastAdvancedWorldMinute<j.startedWorldMinute||typeof j.returning!=='boolean'||(j.landing&&!point(j.landing.point)))throw new Error('Invalid saved boat journey.');
  for(const id of j.occupantIds) {
    const a=world.agents[id];if(!a||a.movement?.boatId!==itemId||Math.hypot(a.position.x-boat.position.x,a.position.y-boat.position.y)>1e-7)
      throw new Error('Boat passenger and physical position disagree.');
  }
}
