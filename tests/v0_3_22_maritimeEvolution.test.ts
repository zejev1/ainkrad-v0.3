import { describe, expect, it } from 'vitest';
import { WorldEngine } from '../src/world/WorldEngine';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { BOAT_KNOWLEDGE_ID, VESSEL_DESIGNS_V22, workOnBoat, vesselDesignV22 } from '../src/v21/MaritimePractice';
import { HISTORICAL_SOURCES } from '../src/v18/HistoricalSourceCorpus';

describe('0.3.22 F2 lived shipbuilding progression',()=>{
  it('requires real prior vessel experience before a Spark can improve the design',async()=>{
    const world=(await WorldEngine.create({worldId:'f2-maritime-evolution',seed:'f2-maritime-evolution',store:new InMemoryWorldStore(),startTime:0})).snapshot();
    const a=world.agents.agent_11; // first Rulid founder
    a.life.ageYears=25;a.life.stage='adult';a.skills.craft=.95;a.energy=1;
    a.locationId='rulid_shore';a.position={x:world.places.rulid_shore.mapX,y:world.places.rulid_shore.mapY,layerId:'surface'};delete a.movement;
    a.knownPlaceIds=[...(a.knownPlaceIds??[]),'rulid_shore'];
    world.v18!.secretLibrary.knowledgeByAgentId[a.id]=[{id:'boat-knowledge',knowledgeId:BOAT_KNOWLEDGE_ID,title:'Корабль',category:'engineering',historicalSource:'исторический источник',sourceTitle:'Корабль',sourceUrl:HISTORICAL_SOURCES[0].sourceUrl,acquiredWorldMinute:0,understanding:.95,summary:'корпус, парус, мореходность',concepts:['судостроение'],practiceCount:1,sharedCount:0}];
    const settlement=world.places[a.homeId].settlementId!;const economy=world.v16!.settlementEconomyById[settlement];
    economy.stocks.wood=30;economy.stocks.stone=10;delete economy.activeHumanHomeProject;
    expect(workOnBoat(world,a)).toBe(true);
    let boat=Object.values(world.v15!.items).find(i=>i.ownerAgentId===a.id&&i.boat)!;
    expect(vesselDesignV22(boat)).toBe('coastal_skiff');
    for(let i=0;i<20&&!boat.boat!.completed;i++){world.calendar.elapsedWorldMinutes+=480;expect(workOnBoat(world,a)).toBe(true);}
    expect(boat.boat!.completed).toBe(true);
    // Knowledge alone does not unlock the next tier.
    world.calendar.elapsedWorldMinutes+=480;
    expect(workOnBoat(world,a)).toBe(false);
    boat.boat!.designExperience=VESSEL_DESIGNS_V22.sailing_boat.priorExperience;
    expect(workOnBoat(world,a)).toBe(true);
    const projects=Object.values(world.v15!.items).filter(i=>i.ownerAgentId===a.id&&i.boat&&!i.boat.completed);
    expect(projects).toHaveLength(1);
    expect(vesselDesignV22(projects[0])).toBe('sailing_boat');
  });
});
