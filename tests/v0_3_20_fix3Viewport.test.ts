import { describe, expect, it } from 'vitest';
import { WorldMapCamera, clipMapPolygon, clipMapSegment } from '../src/presentation/WorldMapCamera';
import { WorldEngine } from '../src/world/WorldEngine';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { repairCompactSettlementLayout } from '../src/world/CompactSettlementLayout';
import { nextUrbanHomeLot, urbanHomeLot } from '../src/world/SettlementStreets';
import { rebuildWorldRoutes } from '../src/world/WorldNavigation';

describe('FIX3 metre-scale cities and bounded map surfaces', () => {
  it('keeps GPU geometry inside one viewport through world/city zoom, pan and resize', () => {
    const camera = new WorldMapCamera(); camera.resize(1920,1080);
    for (const zoom of [0.0005,0.01,8.2,300,1600,1e9]) {
      camera.zoom(zoom); camera.pan(110,-200);
      expect(camera.width * camera.height).toBeLessThanOrEqual(1280*800);
      const polygon = clipMapPolygon([{x:-1e9,y:-1e9},{x:1e9,y:-1e9},{x:1e9,y:1e9},{x:-1e9,y:1e9}]);
      expect(polygon).toHaveLength(4);
      for (const p of polygon) { expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThanOrEqual(100);
        expect(p.y).toBeGreaterThanOrEqual(0); expect(p.y).toBeLessThanOrEqual(100); }
    }
    expect(clipMapSegment({x:-1e7,y:40},{x:1e7,y:40})).toEqual([{x:0,y:40},{x:100,y:40}]);
    expect(clipMapSegment({x:-20,y:40},{x:-10,y:80})).toBeUndefined();
    const anchor=camera.worldPoint(100,200); camera.zoom(300,100,200);
    expect(camera.worldPoint(100,200).x).toBeCloseTo(anchor.x,8);
    expect(camera.worldPoint(100,200).y).toBeCloseTo(anchor.y,8);
    expect(camera.visible(100_000,100_000)).toBe(false);
  });

  it('leaves 3–6m lanes and a main street no wider than 10m, independent of distant homelands', async () => {
    const world=(await WorldEngine.create({worldId:'city-metres',seed:'street',store:new InMemoryWorldStore()})).snapshot();
    const homes=Object.values(world.places).filter(p=>p.kind==='home').sort((a,b)=>a.urbanLot!-b.urbanLot!);
    expect(homes).toHaveLength(10);
    const mainGap=(homes[1].mapX-homes[0].mapX)*100-12;
    const laneGap=(homes[2].mapY-homes[0].mapY)*100-10;
    expect(mainGap).toBeGreaterThanOrEqual(6);expect(mainGap).toBeLessThanOrEqual(10);
    expect(laneGap).toBeGreaterThanOrEqual(3);expect(laneGap).toBeLessThanOrEqual(6);
    const positions=homes.map(p=>[p.mapX,p.mapY]);
    world.places.far={...world.places.commons,id:'far',settlementId:'far',mapX:10_000,mapY:-10_000};
    expect(repairCompactSettlementLayout(world)).toBe(false);
    expect(homes.map(p=>[p.mapX,p.mapY])).toEqual(positions);
    const plot=nextUrbanHomeLot(world.places,{x:50,y:50},'settlement_ainkrad')!;
    expect(plot.lot).toBe(10);
    expect(urbanHomeLot({x:50,y:50},plot.lot)).toEqual({x:plot.x,y:plot.y});
    for (const r of Object.values(world.routes).filter(r=>r.fromPlaceId.startsWith('home_')||r.toPlaceId.startsWith('home_'))) {
      expect(r.distance*100).toBeLessThan(150);
    }
  });

  it('repairs legacy home coordinates, including an existing walk, once without resetting life', async () => {
    const store=new InMemoryWorldStore();
    const source=await WorldEngine.create({worldId:'old-metre-layout',seed:'old-town',store});
    const legacy=source.snapshot();
    for (const p of Object.values(legacy.places)) {
      if (p.kind !== 'home') continue;
      delete p.urbanLot; delete p.urbanLayoutVersion;
      p.mapX=50+(p.mapX-50)*50; p.mapY=50+(p.mapY-50)*50;
    }
    for (const a of Object.values(legacy.agents)) {
      a.position.x=legacy.places[a.locationId].mapX; a.position.y=legacy.places[a.locationId].mapY;
    }
    legacy.routes=rebuildWorldRoutes(legacy.places,legacy.routes);
    const walker=legacy.agents.agent_1;
    const route=Object.values(legacy.routes).find(r=>[r.fromPlaceId,r.toPlaceId].includes(walker.homeId)&&[r.fromPlaceId,r.toPlaceId].includes('commons'))!;
    route.completedTraversals=23;
    const points=route.fromPlaceId===walker.homeId?route.waypoints:[...route.waypoints].reverse();
    walker.movement={targetPlaceId:'commons',purpose:'walk',waypoints:points,nextWaypointIndex:1,startedAt:legacy.now,worldStageAtStart:0,routeIds:[route.id]};
    const protectedState=(w:typeof legacy)=>({calendar:w.calendar,determinism:w.determinism,population:w.population,
      relationships:w.relationships,v18:w.v18,people:Object.values(w.agents).map(({position,movement,...life})=>life)});
    const protectedBefore=structuredClone(protectedState(legacy));
    await store.commit({worldId:legacy.id,expectedRevision:legacy.revision,nextState:{...legacy,revision:legacy.revision+1},
      operationId:'old-town-input',operationFingerprint:'old-town-input',events:[],memories:[]});
    const opened=await WorldEngine.open({worldId:legacy.id,store});
    const after=opened.snapshot();
    expect(protectedState(after)).toEqual(protectedBefore);
    expect(after.routes[route.id].completedTraversals).toBe(23);
    expect(Math.hypot(after.agents.agent_1.position.x-50,after.agents.agent_1.position.y-50)).toBeLessThan(1);
    const resting=after.agents.agent_2,home=after.places[resting.locationId];
    expect(resting.position.x).toBe(home.mapX);expect(resting.position.y).toBe(home.mapY);
    expect((await WorldEngine.open({worldId:legacy.id,store})).snapshot()).toEqual(after);
    await opened.advanceCanonicalTimeTo(after.calendar.elapsedWorldMinutes+60);
    expect(opened.snapshot().calendar.elapsedWorldMinutes).toBe(after.calendar.elapsedWorldMinutes+60);
  });
});
