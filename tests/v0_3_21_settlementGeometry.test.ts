import { buildingPolygon, polygonGap } from '../src/world/BuildingFootprints';
import { describe, it, expect } from 'vitest';
import { WorldEngine } from '../src/world/WorldEngine';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { repairCompactSettlementLayout } from '../src/world/CompactSettlementLayout';
import { buildingRadius, nextUrbanHomeLot, segmentEntersBuilding, dryBuildingPlot, routeAroundBuildings } from '../src/world/SettlementStreets';
import { settlementOptions } from '../src/presentation/SettlementPicker';
import { settlementMapFocus, residentMapFocus } from '../src/presentation/WorldMapFocus';
import { rebuildWorldRoutes, routeIdBetween } from '../src/world/WorldNavigation';
import type { WorldPlace } from '../src/world/types';

const fresh=async()=> (await WorldEngine.create({worldId:'geometry',seed:'streets',store:new InMemoryWorldStore()})).snapshot();
describe('physical settlement geometry and observer navigation',()=>{
  it('keeps an already-correct F2 geography stable while preserving long homeland separation',async()=>{
    const w=await fresh();
    const protectedState=structuredClone({
      agents:w.agents,
      calendar:w.calendar,
      rng:w.determinism,
      v15:w.v15,
      v18:w.v18!.secretLibrary.knowledgeByAgentId,
    });
    const placeGeometry=structuredClone(Object.fromEntries(Object.entries(w.places).map(([id,p])=>[id,{
      mapX:p.mapX,mapY:p.mapY,settlementId:p.settlementId,urbanLayoutVersion:p.urbanLayoutVersion,
    }])));
    const settlementGeometry=structuredClone(Object.fromEntries(Object.entries(w.settlements).map(([id,t])=>[id,{
      centerPlaceId:t.centerPlaceId,centerX:t.centerX,centerY:t.centerY,radius:t.radius,layoutVersion:t.layoutVersion,
    }])));
    const ids=Object.keys(w.places);

    // This is a current F2 world, not a synthetic pre-F2 compact-layout fixture.
    // A reload/migration pass must therefore never teleport its already-lived
    // geography merely to satisfy an older hard-coded compactness expectation.
    repairCompactSettlementLayout(w);

    expect(Object.keys(w.places)).toEqual(ids);
    expect(Object.fromEntries(Object.entries(w.places).map(([id,p])=>[id,{
      mapX:p.mapX,mapY:p.mapY,settlementId:p.settlementId,urbanLayoutVersion:p.urbanLayoutVersion,
    }]))).toEqual(placeGeometry);
    expect(Object.fromEntries(Object.entries(w.settlements).map(([id,t])=>[id,{
      centerPlaceId:t.centerPlaceId,centerX:t.centerX,centerY:t.centerY,radius:t.radius,layoutVersion:t.layoutVersion,
    }]))).toEqual(settlementGeometry);
    expect({agents:w.agents,calendar:w.calendar,rng:w.determinism,v15:w.v15,v18:w.v18!.secretLibrary.knowledgeByAgentId}).toEqual(protectedState);
    expect(Math.hypot(w.places.settlement_elf.mapX-w.places.commons.mapX,w.places.settlement_elf.mapY-w.places.commons.mapY)).toBeGreaterThanOrEqual(10000);
    const once=structuredClone(w);expect(repairCompactSettlementLayout(w)).toBe(false);expect(w).toEqual(once);
  });
  it('reprojects an old field journey onto its displayed road and retains road use history',async()=>{
    const w=await fresh();w.places.resource_field.mapX=56;w.places.resource_field.mapY=52;
    w.places.outskirts.mapX=62;w.places.outskirts.mapY=55;
    delete w.places.resource_field.urbanLayoutVersion;delete w.places.outskirts.urbanLayoutVersion;
    w.routes=rebuildWorldRoutes(w.places,w.routes);
    const id=routeIdBetween('commons','resource_field'),route=w.routes[id];route.completedTraversals=123;
    const path=route.fromPlaceId==='commons'?route.waypoints:[...route.waypoints].reverse();
    const a=w.agents.agent_1;a.locationId='commons';a.position={...path[1],layerId:'surface'};
    a.movement={targetPlaceId:'resource_field',purpose:'gather',waypoints:path,nextWaypointIndex:2,startedAt:0,worldStageAtStart:0,routeIds:[id]};
    repairCompactSettlementLayout(w);
    expect(w.routes[id].completedTraversals).toBe(123);
    const expected=w.routes[id].fromPlaceId==='commons'?w.routes[id].waypoints:[...w.routes[id].waypoints].reverse();
    expect(a.movement!.waypoints).toEqual(expected);
    const n=a.movement!.nextWaypointIndex,prev=expected[n-1],next=expected[n];
    expect(Math.abs((a.position.x-prev.x)*(next.y-prev.y)-(a.position.y-prev.y)*(next.x-prev.x))).toBeLessThan(1e-8);
    expect(Math.hypot(w.places.resource_field.mapX-w.places.commons.mapX,w.places.resource_field.mapY-w.places.commons.mapY)).toBeLessThan(2);
    expect(Math.hypot(w.places.outskirts.mapX-w.places.commons.mapX,w.places.outskirts.mapY-w.places.commons.mapY)).toBeLessThan(2);
  });
  it('extends curved lanes without crossing buildings, with bounded metre-scale widths',async()=>{
    const w=await fresh(),center={x:w.places.commons.mapX,y:w.places.commons.mapY};
    for(let i=0;i<22;i++) {
      const p=nextUrbanHomeLot(w.places,center,'settlement_ainkrad')!;expect(p).toBeDefined();
      const id='future_'+i;w.places[id]={...w.places.home_agent_1,id,mapX:p.x,mapY:p.y,urbanLot:p.lot,urbanLayoutVersion:3,rotation:p.rotation,connectedPlaceIds:['commons']};
      w.places.commons.connectedPlaceIds.push(id);
    }
    repairCompactSettlementLayout(w);
    const homes=Object.values(w.places).filter(p=>p.kind==='home'&&p.settlementId==='settlement_ainkrad');
    for(const home of homes) {
      const pair=homes.find(p=>p.urbanLot===(home.urbanLot!^1));
      if(pair) {
        const gap=polygonGap(buildingPolygon(pair),buildingPolygon(home))*100;
        expect(gap).toBeGreaterThanOrEqual(3);expect(gap).toBeLessThanOrEqual(6);
      }
    }
    for(const route of Object.values(w.routes)) if(route.distance<4) {
      for(const b of Object.values(w.places).filter(p=>buildingRadius(p)>0&&p.id!==route.fromPlaceId&&p.id!==route.toPlaceId))
        expect(route.waypoints.slice(1).some((p,i)=>segmentEntersBuilding(route.waypoints[i],p,b))).toBe(false);
    }
    expect(w.routes[routeIdBetween('commons','future_21')].waypoints.length).toBeGreaterThan(4);
    expect(w.routes[routeIdBetween('commons','resource_field')]).toBeDefined();
    const lake={...w.places.commons,surface:'water',boundaryPolygon:[{x:0,y:0},{x:.01,y:0},{x:.01,y:.01},{x:0,y:.01}]} as WorldPlace;
    expect(dryBuildingPlot({x:0,y:0},.06,.05,[lake])).toBe(false);
    const narrowRiver={...lake,boundaryPolygon:[{x:-.2,y:-.01},{x:.2,y:-.01},{x:.2,y:.01},{x:-.2,y:.01}]};
    expect(dryBuildingPlot({x:0,y:0},.06,.05,[narrowRiver])).toBe(false);
  });
  it('reroutes a road whose old intermediate bend is covered by a new house',async()=>{
    const w=await fresh(),house={...w.places.home_agent_1,id:'obstacle',mapX:0,mapY:0};
    const path=routeAroundBuildings([{x:-.4,y:-.2},{x:0,y:0},{x:.4,y:.2}],'from','to',{obstacle:house});
    expect(path).toBeDefined();expect(path!.length).toBeGreaterThan(2);
    expect(path!.slice(1).some((p,i)=>segmentEntersBuilding(path![i],p,house))).toBe(false);
  });
  it('lists all settlements and focuses their camera without changing the world or selected resident',async()=>{
    const w=await fresh();
    w.places.remote={...w.places.commons,id:'remote',kind:'village',settlementId:'remote',mapX:-10000,mapY:4000};
    w.settlements.remote={id:'remote',name:'Эльфийский город',kind:'village',centerPlaceId:'remote',centerX:-10000,centerY:4000,radius:1,memberPlaceIds:['remote'],foundedAt:0};
    const saved=structuredClone(w),options=settlementOptions(w);
    expect(options.find(x=>x.id==='remote')).toEqual({id:'remote',name:'Эльфийский город',population:0});
    expect(options.find(x=>x.id==='settlement_ainkrad')!.population).toBe(10);
    expect(settlementMapFocus(w,'remote',390,600)!.x).toBe(-10000);
    expect(residentMapFocus(w,'agent_1',400)).toBeDefined();
    expect(settlementMapFocus(w,'missing',390,600)).toBeUndefined();
    expect(w).toEqual(saved);
  });
});
