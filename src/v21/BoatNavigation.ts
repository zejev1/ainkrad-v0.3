import {recordOceanPassage} from '../world/geography/OceanExploration';
import type { AgentActionKind, AgentState, V15WorldItemState, WorldBiome, WorldPoint2D, WorldState } from '../world/types';
import { routeIdBetween } from '../world/WorldNavigation';
import { worldWeatherV21 } from './WeatherV21';
import { BOAT_KNOWLEDGE_ID, maritimeUnderstanding, vesselCapabilitiesV22, vesselDesignV22 } from './MaritimePractice';
import { courseLength, fishingCourse, pointDistance, sailingCourse, surveyLanding } from './SailingRoutes';
import { recordPhysicalGoodsV21 } from './EconomySystemV21';

export interface BoatJourney {
  pilotId: string;
  occupantIds: string[];
  originPlaceId: string;
  destinationPlaceId: string;
  onwardPlaceId?: string;
  landing?: { point: WorldPoint2D; biome: WorldBiome };
  purpose: AgentActionKind;
  waypoints: WorldPoint2D[];
  nextWaypointIndex: number;
  startedWorldMinute: number;
  lastAdvancedWorldMinute: number;
  fishingPopulationId?: string;
  fishingRoll?: number;
  fishingMinutes: number;
  returning: boolean;
  travelledDistance: number;
}

type Vessel=V15WorldItemState & {boat: NonNullable<V15WorldItemState['boat']>};
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const bankPoint=(world:Readonly<WorldState>,id:string)=>({x:world.places[id].mapX,y:world.places[id].mapY});

function carriedLoad(world:Readonly<WorldState>, agentId:string):number {
  const a=world.agents[agentId],wallet=world.v19?.adventureEconomy.adventurersByAgentId[agentId];
  // Explicit transport units: one ordinary commodity unit weighs 20 kg.
  return 70+(a?.resources??0)*5+Object.values(wallet?.carriedGoods??{}).reduce((n,q)=>n+(q??0)*20,0);
}

export function availableBoat(world:Readonly<WorldState>,agent:Readonly<AgentState>):Vessel|undefined {
  const rank=(item:V15WorldItemState)=>vesselDesignV22(item)==='coastal_ship'?2:vesselDesignV22(item)==='sailing_boat'?1:0;
  return Object.values(world.v15?.items??{}).filter(item=>item.boat?.completed&&!item.boat.journey&&
    item.ownerAgentId===agent.id&&item.locationId===agent.locationId)
    .sort((a,b)=>rank(b)-rank(a)||b.quality-a.quality)[0] as Vessel|undefined;
}

function residentAcceptsVoyage(world:Readonly<WorldState>,agent:Readonly<AgentState>,boat:Vessel,roll:number):boolean {
  const weather=worldWeatherV21(world),understanding=maritimeUnderstanding(world,agent.id,BOAT_KNOWLEDGE_ID);
  const capabilities=vesselCapabilitiesV22(boat);
  if(!agent.life.alive||agent.life.ageYears<18||agent.movement||agent.energy<.18||agent.life.health<.3||
    (boat.boat.condition??1)<.3||understanding<.35||carriedLoad(world,agent.id)>capabilities.cargoKg)return false;
  if(weather.kind==='storm'&&capabilities.seaworthiness<.66)return false;
  return roll<clamp(.3+agent.personality.curiosity*.2+agent.personality.riskTolerance*.35+understanding*.2+
    capabilities.seaworthiness*.12-weather.severity*(.5-capabilities.seaworthiness*.22));
}

function launch(world:WorldState,agent:AgentState,boat:Vessel,course:WorldPoint2D[],purpose:AgentActionKind,
  destinationPlaceId:string,extra:Partial<BoatJourney>={}):boolean {
  if(course.length<3||courseLength(course)>vesselCapabilitiesV22(boat).range)return false;
  const minute=world.calendar.elapsedWorldMinutes;
  boat.boat.position={x:agent.position.x,y:agent.position.y};
  boat.boat.condition??=1;
  boat.boat.journey={pilotId:agent.id,occupantIds:[agent.id],originPlaceId:agent.locationId,destinationPlaceId,
    purpose,waypoints:course,nextWaypointIndex:1,startedWorldMinute:minute,lastAdvancedWorldMinute:minute,
    fishingMinutes:0,returning:false,travelledDistance:0,...extra};
  agent.movement={boatId:boat.id,targetPlaceId:destinationPlaceId,purpose,waypoints:course,nextWaypointIndex:1,
    startedAt:world.now,worldStageAtStart:world.growth.stage};
  agent.lastAction=purpose;
  return true;
}

export function startBoatFishing(world:WorldState,agent:AgentState,populationId:string,choiceRoll:number,catchRoll:number):boolean {
  const boat=availableBoat(world,agent), fish=world.wildlife[populationId];
  if(!boat||!fish||fish.species!=='fish'||fish.habitatId!==agent.locationId||fish.count<=0||
    !residentAcceptsVoyage(world,agent,boat,choiceRoll))return false;
  const course=fishingCourse(world,agent.position,choiceRoll);
  return !!course&&launch(world,agent,boat,course,'hunt',agent.locationId,{fishingPopulationId:populationId,fishingRoll:catchRoll});
}

export function startBoatExploration(world:WorldState,agent:AgentState,roll:number):boolean {
  const boat=availableBoat(world,agent);if(!boat||!residentAcceptsVoyage(world,agent,boat,roll))return false;
  const landing=surveyLanding(world,agent.position,roll,Math.min(90,vesselCapabilitiesV22(boat).range*.25));if(!landing)return false;
  return launch(world,agent,boat,landing.course,'explore',agent.locationId,{landing:{point:landing.point,biome:landing.biome}});
}

/** Called only after this resident independently chose an actual destination. */
export function startBoatTravel(world:WorldState,agent:AgentState,targetId:string,purpose:AgentActionKind,roll:number,
  dryPath:(a:string,b:string)=>boolean):boolean {
  if(agent.movement||!agent.life.alive||agent.life.ageYears<18||!(agent.knownPlaceIds??[]).includes(targetId))return false;
  // A second person boards only for their own matching chosen journey while
  // the boat is still physically at the bank. A traveller is never collected.
  for(const item of Object.values(world.v15?.items??{})) {
    const j=item.boat?.journey;
    const vessel=item.boat?item as Vessel:undefined;
    const capabilities=vessel?vesselCapabilitiesV22(vessel):undefined;
    if(!j||!capabilities||j.purpose==='hunt'||j.landing||j.returning||j.startedWorldMinute!==world.calendar.elapsedWorldMinutes||
      j.travelledDistance>0||j.originPlaceId!==agent.locationId||j.occupantIds.length>=capabilities.passengers||
      (j.onwardPlaceId??j.destinationPlaceId)!==targetId||j.occupantIds.includes(agent.id)||
      j.occupantIds.reduce((n,id)=>n+carriedLoad(world,id),0)+carriedLoad(world,agent.id)>capabilities.cargoKg)continue;
    if(roll>clamp(.35+agent.personality.riskTolerance*.45-worldWeatherV21(world).severity*.3))return false;
    j.occupantIds.push(agent.id);
    agent.movement={boatId:item.id,targetPlaceId:j.destinationPlaceId,purpose,waypoints:j.waypoints,nextWaypointIndex:1,
      startedAt:world.now,worldStageAtStart:world.growth.stage};return true;
  }
  const boat=availableBoat(world,agent);if(!boat||!residentAcceptsVoyage(world,agent,boat,roll))return false;
  const target=world.places[targetId];if(!target)return false;
  const banks=(agent.knownPlaceIds??[]).map(id=>world.places[id]).filter(p=>p&&p.surface==='shore'&&p.id!==agent.locationId&&
    (p.id===targetId||dryPath(p.id,targetId))).sort((a,b)=>pointDistance(bankPoint(world,a.id),bankPoint(world,targetId))-
      pointDistance(bankPoint(world,b.id),bankPoint(world,targetId))).slice(0,8);
  for(const bank of banks) {
    const course=sailingCourse(world,agent.position,bankPoint(world,bank.id),vesselCapabilitiesV22(boat).range);
    if(course&&launch(world,agent,boat,course,purpose,bank.id,bank.id===targetId?{}:{onwardPlaceId:targetId}))return true;
  }
  return false;
}

function turnBack(world:WorldState,boat:Vessel):void {
  const j=boat.boat.journey!;if(j.returning)return;
  const course=[{...boat.boat.position!},...j.waypoints.slice(0,j.nextWaypointIndex).reverse()];
  j.waypoints=course;j.nextWaypointIndex=1;j.destinationPlaceId=j.originPlaceId;j.returning=true;
  delete j.landing;delete j.onwardPlaceId;delete j.fishingPopulationId;
  for(const id of j.occupantIds){const m=world.agents[id]?.movement;if(m){m.waypoints=course;m.nextWaypointIndex=1;m.targetPlaceId=j.originPlaceId;}}
}

export interface BoatArrival { agentId:string;fromPlaceId:string;toPlaceId:string;boatId:string;onwardPlaceId?:string;discovered:boolean;fishCaught:number;returned:boolean }

function arrive(world:WorldState,boat:Vessel):BoatArrival[] {
  const j=boat.boat.journey!;let destination=j.destinationPlaceId;
  const discovered=!!j.landing;
  if(j.landing) {
    const {point,biome}=j.landing;
    const existing=Object.values(world.places).find(p=>p.surface!=='water'&&pointDistance(point,{x:p.mapX,y:p.mapY})<.4);
    if(existing)destination=existing.id;
    else {
      destination=`landing:${world.id}:${++world.v15!.itemSequence}`;
      const kind=biome==='river'?'river':biome==='lake'?'lake':'shore';
      world.places[destination]={id:destination,name:kind==='river'?'Речной берег':kind==='lake'?'Озёрный берег':'Морской берег',
        kind,biome,surface:'shore',mapX:point.x,mapY:point.y,capacity:16,fertility:.4,danger:.2,
        connectedPlaceIds:[],geographyVersion:1,discoveredAt:world.now};
    }
  }
  if(destination!==j.originPlaceId) {
    for(const [a,b]of [[j.originPlaceId,destination],[destination,j.originPlaceId]])
      if(!world.places[a].connectedPlaceIds.includes(b))world.places[a].connectedPlaceIds.push(b);
    const id=routeIdBetween(j.originPlaceId,destination);
    const prior=world.routes[id];
    // Keep an existing real walking road when both modes are possible.
    if(!prior||prior.traversal==='boat')world.routes[id]={id,fromPlaceId:j.originPlaceId,toPlaceId:destination,traversal:'boat',
      waypoints:j.waypoints.map(p=>({...p})),distance:courseLength(j.waypoints),geometryVersion:3,
      terrainKey:world.terrain?.key,completedTraversals:(prior?.completedTraversals??0)+1};
  }
  let fishCaught=0;
  const pilot=world.agents[j.pilotId], fish=j.fishingPopulationId?world.wildlife[j.fishingPopulationId]:undefined;
  if(!j.returning&&pilot?.life.alive&&fish&&fish.count>0&&j.fishingMinutes>=30) {
    const understanding=maritimeUnderstanding(world,pilot.id,'fishing-handline-and-habitat');
    const chance=clamp(.2+understanding*.22+pilot.skills.hunting*.36+boat.quality*.18-fish.alertness*.2);
    if((j.fishingRoll??1)<chance){fishCaught=Math.min(fish.count,1+Math.floor(boat.quality*2));fish.count-=fishCaught;
      pilot.resources=clamp(pilot.resources+fishCaught*.085);recordPhysicalGoodsV21(world,pilot,'meat',fishCaught*.085*.62);
      fish.alertness=clamp(fish.alertness+.1);fish.lastChangedAt=world.now;}
    pilot.skills.hunting=clamp(pilot.skills.hunting+.003+fishCaught*.002);
  }
  boat.locationId=destination;boat.boat.position=bankPoint(world,destination);
  const arrivals:BoatArrival[]=[];
  for(const id of j.occupantIds) {
    const a=world.agents[id];if(!a)continue;
    const fromPlaceId=a.locationId;
    a.locationId=destination;a.position={...boat.boat.position,layerId:'surface'};delete a.movement;
    if(a.life.alive){a.knownPlaceIds??=[];if(!a.knownPlaceIds.includes(destination))a.knownPlaceIds.push(destination);
      if(discovered)a.skills.exploration=clamp(a.skills.exploration+.004);}
    arrivals.push({agentId:id,fromPlaceId,toPlaceId:destination,boatId:boat.id,discovered,fishCaught:id===j.pilotId?fishCaught:0,
      returned:j.returning,...(j.onwardPlaceId?{onwardPlaceId:j.onwardPlaceId}:{})});
  }
  boat.boat.designExperience=Math.min(1,(boat.boat.designExperience??0)+Math.min(.12,j.travelledDistance/220)+(discovered?.025:0));
  delete boat.boat.journey;return arrivals;
}

/** Physical transport advances from world minutes, even between decision
 * ticks. Money, cargo, mind, knowledge and ownership stay with the occupant. */
export function advanceBoats(world:WorldState,elapsed:number,startMinute:number):BoatArrival[] {
  const arrivals:BoatArrival[]=[];
  for(const item of Object.values(world.v15?.items??{})) {
    if(!item.boat?.journey)continue;
    const boat=item as Vessel,j=boat.boat.journey!;
    let minute=Math.max(startMinute,j.lastAdvancedWorldMinute),end=startMinute+elapsed;
    while(minute<end&&boat.boat.journey) {
      const weather=worldWeatherV21(world,minute);
      let pilot=world.agents[j.pilotId];
      if(!pilot?.life.alive) {
        pilot=j.occupantIds.map(id=>world.agents[id]).find(a=>a?.life.alive)!;
        if(!pilot){for(const id of j.occupantIds){const a=world.agents[id];if(a)delete a.movement;}delete boat.boat.journey;delete boat.locationId;break;}
        j.pilotId=pilot.id;turnBack(world,boat);
      }
      const capabilities=vesselCapabilitiesV22(boat);
      if((weather.kind==='storm'&&capabilities.seaworthiness<.72)||pilot.energy<.12||(boat.boat.condition??1)<.2)turnBack(world,boat);
      const available=Math.min(end-minute,10-(minute%10));
      const designSpeed=vesselDesignV22(boat)==='coastal_ship'?.72:vesselDesignV22(boat)==='sailing_boat'?.62:.5;
      const speed=designSpeed*(.6+pilot.life.physiology.endurance*.4)*(1-weather.severity*(.62-capabilities.seaworthiness*.3));
      const point=boat.boat.position!,next=j.waypoints[j.nextWaypointIndex];
      if(!next)throw new Error('Boat route lost a physical waypoint.');
      const distance=pointDistance(point,next);
      const fishing=!!j.fishingPopulationId&&j.nextWaypointIndex===3&&j.fishingMinutes<60;
      const duration=fishing?Math.min(available,60-j.fishingMinutes):Math.min(available,distance/speed);
      if(fishing)j.fishingMinutes+=duration;
      else {
        const step=Math.min(distance,duration*speed),t=distance>0?step/distance:1;
        point.x+=(next.x-point.x)*t;point.y+=(next.y-point.y)*t;j.travelledDistance+=step;
        for(const id of j.occupantIds){const a=world.agents[id];if(a){a.position={...point,layerId:'surface'};if(a.movement)a.movement.nextWaypointIndex=j.nextWaypointIndex;}}
      }
      boat.boat.condition=clamp((boat.boat.condition??1)-duration*(weather.kind==='storm'?.0004*(1-capabilities.seaworthiness*.72):.00002));
      pilot.energy=clamp(pilot.energy-duration*.00012);
      minute+=duration;j.lastAdvancedWorldMinute=minute;
      recordOceanPassage(world,item.id,j,point,minute);
      if(!fishing&&distance-duration*speed<1e-8) {
        j.nextWaypointIndex++;
        if(j.nextWaypointIndex>=j.waypoints.length)arrivals.push(...arrive(world,boat));
      }
    }
  }
  return arrivals;
}
