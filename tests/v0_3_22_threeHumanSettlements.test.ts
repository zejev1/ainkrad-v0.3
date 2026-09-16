import { describe, expect, it } from 'vitest';
import { WorldEngine } from '../src/world/WorldEngine';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { waterAccess } from '../src/v21/SailingRoutes';

describe('0.3.22 F2 three independent human foundations',()=>{
  it('starts Ainkrad, Rulid and Zakkaria as equal distant human settlements with a real Rulid coast',async()=>{
    const world=(await WorldEngine.create({worldId:'f2-three-human',seed:'f2-three-human',store:new InMemoryWorldStore(),startTime:0})).snapshot();
    const ids=['settlement_ainkrad','settlement_rulid','settlement_zakkaria'];
    for(const id of ids) expect(world.settlements[id]).toBeDefined();
    const centers=ids.map(id=>({mapX:world.settlements[id].centerX,mapY:world.settlements[id].centerY}));
    const d=(i:number,j:number)=>Math.hypot(centers[i].mapX-centers[j].mapX,centers[i].mapY-centers[j].mapY);
    const distances=[d(0,1),d(0,2),d(1,2)];
    expect(Math.min(...distances)).toBeGreaterThanOrEqual(12_000);
    expect(Math.max(...distances)-Math.min(...distances)).toBeLessThan(2);
    const people=Object.values(world.agents).filter(a=>a.race==='human'&&a.life.alive);
    expect(people).toHaveLength(30);
    for(const id of ids) expect(people.filter(a=>world.places[a.homeId]?.settlementId===id)).toHaveLength(10);
    expect(world.places.rulid_shore.surface).toBe('shore');
    expect(waterAccess(world,{x:world.places.rulid_shore.mapX,y:world.places.rulid_shore.mapY})).toBeDefined();
    const foundingCenters = ['commons', 'rulid_center', 'zakkaria_center'];
    for (const placeId of foundingCenters) {
      const place = world.places[placeId];
      expect(place.connectedPlaceIds.every((other) => !foundingCenters.includes(other))).toBe(true);
    }
  });

  it('also uses three human settlements when the live runtime supplies its explicit 30 founder names',async()=>{
    const names=Array.from({length:30},(_,index)=>`Основатель ${index+1}`);
    const world=(await WorldEngine.create({worldId:'f2-three-human-explicit',seed:'f2-three-human-explicit',store:new InMemoryWorldStore(),startTime:0,agentNames:names})).snapshot();
    expect(Object.keys(world.settlements)).toEqual(expect.arrayContaining(['settlement_ainkrad','settlement_rulid','settlement_zakkaria']));
    expect(Object.values(world.agents).filter(a=>a.race==='human'&&a.life.alive)).toHaveLength(30);
    expect(Object.values(world.agents).filter(a=>world.places[a.homeId]?.settlementId==='settlement_ainkrad')).toHaveLength(10);
    expect(Object.values(world.agents).filter(a=>world.places[a.homeId]?.settlementId==='settlement_rulid')).toHaveLength(10);
    expect(Object.values(world.agents).filter(a=>world.places[a.homeId]?.settlementId==='settlement_zakkaria')).toHaveLength(10);
  });

});
