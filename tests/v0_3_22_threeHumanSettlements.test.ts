import { describe, expect, it } from 'vitest';
import { WorldEngine } from '../src/world/WorldEngine';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { waterAccess } from '../src/v21/SailingRoutes';
import { bindWorldTerrain } from '../src/world/geography/WorldTerrain';

describe('0.3.22 F2 three independent human foundations',()=>{
  it('starts Ainkrad, Rulid and Zakkaria across the continent with Rulid directly on the sea',async()=>{
    const world=(await WorldEngine.create({worldId:'f2-three-human',seed:'f2-three-human',store:new InMemoryWorldStore(),startTime:0})).snapshot();
    const ids=['settlement_ainkrad','settlement_rulid','settlement_zakkaria'];
    for(const id of ids) expect(world.settlements[id]).toBeDefined();
    expect(world.settlements.settlement_ainkrad.centerPlaceId).toBe('commons');
    expect(world.settlements.settlement_rulid.centerPlaceId).toBe('rulid_commons');
    expect(world.settlements.settlement_zakkaria.centerPlaceId).toBe('zakkaria_commons');
    const centers=ids.map(id=>({mapX:world.settlements[id].centerX,mapY:world.settlements[id].centerY}));
    const d=(i:number,j:number)=>Math.hypot(centers[i].mapX-centers[j].mapX,centers[i].mapY-centers[j].mapY);
    const distances=[d(0,1),d(0,2),d(1,2)];

    // 1 map unit = 100m. Every pair must start at least ~3500 km apart,
    // placing the three human lines in genuinely remote mainland sectors.
    expect(Math.min(...distances)).toBeGreaterThanOrEqual(35_000);

    const people=Object.values(world.agents).filter(a=>a.race==='human'&&a.life.alive);
    expect(people).toHaveLength(30);
    for(const id of ids) expect(people.filter(a=>world.places[a.homeId]?.settlementId===id)).toHaveLength(10);

    const terrain=bindWorldTerrain(world);
    expect(terrain).toBeDefined();
    const rulid=world.places[world.settlements.settlement_rulid.centerPlaceId];
    expect(terrain!.sample(rulid.mapX,rulid.mapY).water).toBe(false);
    let seaDistance=Infinity;
    for(let distance=.05;distance<=1;distance+=.05){
      if(terrain!.sample(rulid.mapX+distance,rulid.mapY).water){seaDistance=distance;break;}
    }
    // Maximum requested distance from Rulid's civic centre to seawater: 100m.
    expect(seaDistance).toBeLessThanOrEqual(1);

    expect(world.places.rulid_shore.surface).toBe('shore');
    expect(waterAccess(world,{x:world.places.rulid_shore.mapX,y:world.places.rulid_shore.mapY})).toBeDefined();
    const rulidResidents=people.filter(a=>world.places[a.homeId]?.settlementId==='settlement_rulid');
    expect(rulidResidents.every(a=>!terrain!.sample(world.places[a.homeId].mapX,world.places[a.homeId].mapY).water)).toBe(true);

    const foundingCenters = ['commons', 'rulid_commons', 'zakkaria_commons'];
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
    expect(world.settlements.settlement_rulid.centerPlaceId).toBe('rulid_commons');
    expect(world.settlements.settlement_zakkaria.centerPlaceId).toBe('zakkaria_commons');
  });

});
