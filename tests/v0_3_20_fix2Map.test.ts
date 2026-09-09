import { describe, expect, it } from 'vitest';
import { createWorldMapProjection } from '../src/presentation/WorldMapProjection';
import { projectedResidentPosition } from '../src/presentation/ResidentMotionProjection';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { WorldEngine } from '../src/world/WorldEngine';
import { rebuildWorldRoutes } from '../src/world/WorldNavigation';
import { buildingRadius, routeAroundBuildings, segmentEntersBuilding, vacantHomePlot } from '../src/world/SettlementStreets';
import type { WorldPlace } from '../src/world/types';

describe('FIX2 city scale and walking streets', () => {
  it('keeps a resting child inside the same home footprint after adding homelands 1000 km away', async () => {
    const world = (await WorldEngine.create({worldId:'map-home',seed:'ainkrad-browser-world',store:new InMemoryWorldStore()})).snapshot();
    const child = world.agents.agent_1;
    child.life.ageYears = 3.9; child.life.stage = 'child'; child.lastAction = 'rest';
    const home = world.places[child.homeId];
    for (const distance of [0, 10_000, 100_000]) {
      if (distance) world.places.far = {...world.places.commons,id:'far',mapX:-distance,mapY:distance};
      const projected = projectedResidentPosition(child, world, 100);
      expect(Math.hypot(projected.x-home.mapX,projected.y-home.mapY)).toBeLessThan(0.15);
      const transform = createWorldMapProjection(world);
      const marker = transform.point(projected.x, projected.y), building = transform.point(home.mapX,home.mapY);
      expect(Math.abs(marker.x-building.x) / transform.scaleX).toBeLessThan(0.15);
      expect(Math.abs(marker.y-building.y) / transform.scaleY).toBeLessThan(0.15);
      const city = world.settlements.settlement_ainkrad;
      expect(transform.size(city.radius*2).width / transform.scaleX).toBeCloseTo(city.radius*2);
    }
  });

  it('routes around an occupied plot and leaves clearance for a newly chosen home site', async () => {
    const world = (await WorldEngine.create({worldId:'streets',seed:'street',store:new InMemoryWorldStore()})).snapshot();
    const base = world.places.home_agent_1;
    const blocker: WorldPlace = {...base,id:'middle',mapX:0,mapY:0};
    const path = routeAroundBuildings([{x:-3,y:0},{x:3,y:0}], 'a','b',{middle:blocker})!;
    expect(path.length).toBeGreaterThan(2);
    expect(path.slice(1).every((p,i)=> !segmentEntersBuilding(path[i],p,blocker))).toBe(true);
    const site = vacantHomePlot({middle:blocker},{x:0,y:0})!;
    expect(Math.hypot(site.x,site.y)).toBeGreaterThan(buildingRadius(blocker)*2 + 0.12);
    const routes = rebuildWorldRoutes(world.places, world.routes);
    for (const route of Object.values(routes)) {
      const obstacles = Object.values(world.places).filter(p=> buildingRadius(p)>0 &&
        p.id !== route.fromPlaceId && p.id !== route.toPlaceId);
      for (let i=1;i<route.waypoints.length;i++) expect(obstacles.some(p=>
        segmentEntersBuilding(route.waypoints[i-1],route.waypoints[i],p))).toBe(false);
    }
    expect(Object.values(routes).filter(r=> r.fromPlaceId.startsWith('home_') || r.toPlaceId.startsWith('home_'))).toHaveLength(10);
  });

  it('upgrades old walking routes without changing residents, history, time, RNG or completed traversals', async () => {
    const store = new InMemoryWorldStore();
    const source = await WorldEngine.create({worldId:'old-streets',seed:'street',store});
    const before = source.snapshot();
    const route = Object.values(before.routes).find(r=>r.fromPlaceId==='commons' && r.toPlaceId==='home_agent_4')!;
    const blocker = before.places.home_agent_2;
    route.waypoints.splice(1,0,{x:blocker.mapX,y:blocker.mapY});
    route.completedTraversals = 7;
    const preserved = structuredClone({agents:before.agents,calendar:before.calendar,determinism:before.determinism,population:before.population});
    await store.commit({worldId:before.id,expectedRevision:before.revision,nextState:{...before,revision:before.revision+1},
      operationId:'legacy-street',operationFingerprint:'legacy-street',events:[],memories:[]});
    const after=(await WorldEngine.open({worldId:before.id,store})).snapshot();
    expect({agents:after.agents,calendar:after.calendar,determinism:after.determinism,population:after.population}).toEqual(preserved);
    expect(after.routes[route.id].completedTraversals).toBe(7);
    expect(after.routes[route.id].waypoints).not.toEqual(route.waypoints);
    expect((await WorldEngine.open({worldId:before.id,store})).snapshot()).toEqual(after);
  });
});
