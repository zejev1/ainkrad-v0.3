import { describe, expect, it } from 'vitest';
import { WorldEngine } from '../src/world/WorldEngine';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { waterAccess } from '../src/v21/SailingRoutes';
import { boatWorkSite, BOAT_KNOWLEDGE_ID } from '../src/v21/MaritimePractice';
import { RULID_BEACH_ID, RULID_HARBOR_ID } from '../src/world/RulidHarbor';
import { routeIdBetween } from '../src/world/WorldNavigation';
import { pathCrossesWater } from '../src/world/WaterNavigation';

describe('Rulid physical harbor foundation',()=>{
  it('creates a reachable shipyard/pier and beach on the real coast across seeds',async()=>{
    for(let index=0;index<6;index++){
      const world=(await WorldEngine.create({
        worldId:`rulid-harbor-${index}`,
        seed:`rulid-harbor-seed-${index}`,
        store:new InMemoryWorldStore(),
        startTime:0,
      })).snapshot();
      const shore=world.places.rulid_shore;
      const harbor=world.places[RULID_HARBOR_ID];
      const beach=world.places[RULID_BEACH_ID];
      expect(harbor).toBeDefined();expect(beach).toBeDefined();
      expect(harbor.settlementId).toBe('settlement_rulid');
      expect(beach.settlementId).toBe('settlement_rulid');
      expect(harbor.surface).toBe('shore');expect(beach.surface).toBe('shore');
      expect(waterAccess(world,{x:harbor.mapX,y:harbor.mapY})).toBeDefined();
      expect(waterAccess(world,{x:beach.mapX,y:beach.mapY})).toBeDefined();
      for(const id of [RULID_HARBOR_ID,RULID_BEACH_ID]){
        const route=world.routes[routeIdBetween('rulid_shore',id)];
        expect(route).toBeDefined();
        expect(route.traversal).toBe('walk');
        expect(pathCrossesWater(route.waypoints,world.places)).toBe(false);
      }
      expect(harbor.connectedPlaceIds).toContain('rulid_commons');
      const cityRoute=world.routes[routeIdBetween('rulid_commons',RULID_HARBOR_ID)];
      expect(cityRoute).toBeDefined();
      expect(cityRoute.traversal).toBe('walk');
      expect(pathCrossesWater(cityRoute.waypoints,world.places)).toBe(false);
      expect(harbor.connectedPlaceIds).not.toContain('ocean_ainkrad');
      expect(beach.connectedPlaceIds).not.toContain('ocean_ainkrad');
      expect(Math.hypot(harbor.mapX-shore.mapX,harbor.mapY-shore.mapY)).toBeLessThan(1);
      expect(Math.hypot(beach.mapX-shore.mapX,beach.mapY-shore.mapY)).toBeLessThan(1);
    }
  },60_000);

  it('makes the known harbor the preferred Rulid boat worksite without forcing knowledge',async()=>{
    const world=(await WorldEngine.create({
      worldId:'rulid-harbor-worksite',seed:'rulid-harbor-worksite',
      store:new InMemoryWorldStore(),startTime:0,
    })).snapshot();
    const resident=world.agents.agent_11;
    resident.life.ageYears=25;resident.life.stage='adult';resident.skills.craft=.8;
    resident.knownPlaceIds=[...(resident.knownPlaceIds??[]),'rulid_shore',RULID_HARBOR_ID];
    world.v18!.secretLibrary.knowledgeByAgentId[resident.id]=[{
      id:'harbor-boat-knowledge',knowledgeId:BOAT_KNOWLEDGE_ID,title:'Корабль',category:'engineering',
      historicalSource:'практика',sourceTitle:'судостроение',sourceUrl:'local://rulid',
      acquiredWorldMinute:0,understanding:.8,summary:'корпус и спуск на воду',
      concepts:['судостроение'],practiceCount:1,sharedCount:0,
    }];
    expect(boatWorkSite(world,resident)).toBe(RULID_HARBOR_ID);

    resident.knownPlaceIds=resident.knownPlaceIds.filter(id=>id!==RULID_HARBOR_ID);
    expect(boatWorkSite(world,resident)).toBe('rulid_shore');
  });

  it('reopens without relocating the harbor or beach',async()=>{
    const store=new InMemoryWorldStore();
    const engine=await WorldEngine.create({
      worldId:'rulid-harbor-reopen',seed:'rulid-harbor-reopen',store,startTime:0,
    });
    const before=engine.snapshot();
    const reopened=await WorldEngine.open({worldId:before.id,store});
    expect(reopened.snapshot()).toEqual(before);
  });
});
