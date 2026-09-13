import { describe,it,expect } from 'vitest';
import { WorldEngine } from '../src/world/WorldEngine';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { repairCompactSettlementLayout } from '../src/world/CompactSettlementLayout';
import { buildingPolygon,polygonGap,pointInPolygon,polygonsOverlap } from '../src/world/BuildingFootprints';
import { buildingRadius,nextUrbanHomeLot,segmentEntersBuilding } from '../src/world/SettlementStreets';
import { rebuildWorldRoutes,routeIdBetween } from '../src/world/WorldNavigation';
import { pathCrossesWater } from '../src/world/WaterNavigation';
import { WorldMapCamera } from '../src/presentation/WorldMapCamera';
import { WorldAtlasIndex,atlasLevel } from '../src/presentation/WorldAtlasIndex';
import { projectedResidentPosition } from '../src/presentation/ResidentMotionProjection';
import type { WorldPlace } from '../src/world/types';
const fresh=async()=> (await WorldEngine.create({worldId:'atlas-world',seed:'streets',store:new InMemoryWorldStore()})).snapshot();

describe('FIX5 physical geography and bounded atlas',()=>{
  it('builds irregular rotated parcels with real clearances and fields outside town',async()=>{
    const w=await fresh(),town=w.settlements.settlement_ainkrad;
    const origin={x:town.centerX,y:town.centerY};
    for(let i=0;i<24;i++) {
      const lot=nextUrbanHomeLot(w.places,origin,town.id)!;expect(lot).toBeDefined();
      const id='new_'+i;w.places[id]={...w.places.home_agent_1,id,mapX:lot.x,mapY:lot.y,rotation:lot.rotation,urbanLot:lot.lot,urbanLayoutVersion:3,connectedPlaceIds:['commons']};
      w.places.commons.connectedPlaceIds.push(id);
    }
    repairCompactSettlementLayout(w);
    const buildings=Object.values(w.places).filter(p=>buildingRadius(p)>0);
    expect(new Set(buildings.map(p=>(p.rotation??0).toFixed(2))).size).toBeGreaterThan(8);
    for(let i=0;i<buildings.length;i++)for(let j=i+1;j<buildings.length;j++)
      expect(polygonGap(buildingPolygon(buildings[i]),buildingPolygon(buildings[j]))).toBeGreaterThanOrEqual(.03-1e-7);
    expect(town.radius).toBeLessThan(2);
    expect(town.boundaryPolygon!.length).toBeGreaterThan(4);
    expect(polygonsOverlap(w.places.resource_field.boundaryPolygon!,town.boundaryPolygon!)).toBe(false);
    for(const r of Object.values(w.routes))if(r.traversal==='walk') {
      expect(pathCrossesWater(r.waypoints,w.places)).toBe(false);
      for(const p of buildings)if(p.id!==r.fromPlaceId&&p.id!==r.toPlaceId)
        expect(r.waypoints.slice(1).some((b,i)=>segmentEntersBuilding(r.waypoints[i],b,p))).toBe(false);
    }
  });
  it('keeps a dry route around real lake water and requires explicit bridge traversal',async()=>{
    const w=await fresh(),model=w.places.commons;
    const places:Record<string,WorldPlace>={
      a:{...model,id:'a',settlementId:undefined,mapX:-1,mapY:0,connectedPlaceIds:['b']},
      b:{...model,id:'b',settlementId:undefined,mapX:1,mapY:0,connectedPlaceIds:['a']},
      lake:{...model,id:'lake',kind:'lake',surface:'shore',settlementId:undefined,mapX:0,mapY:-.5,connectedPlaceIds:[],
        waterPolygon:[{x:-.3,y:-.3},{x:.3,y:-.3},{x:.3,y:.3},{x:-.3,y:.3}]},
    };
    const id=routeIdBetween('a','b'),routes=rebuildWorldRoutes(places);
    expect(routes[id]).toBeDefined();expect(pathCrossesWater(routes[id].waypoints,places)).toBe(false);
    expect(routes[id].distance).toBeGreaterThan(2);
    const bridge=rebuildWorldRoutes(places,{[id]:{id,fromPlaceId:'a',toPlaceId:'b',traversal:'bridge',waypoints:[{x:-1,y:0},{x:1,y:0}],distance:2,completedTraversals:7}});
    expect(bridge[id].traversal).toBe('bridge');expect(bridge[id].completedTraversals).toBe(7);
  });
  it('surveys natural features once without consuming world RNG or putting banks under water',async()=>{
    const w=await fresh(),before=structuredClone({rng:w.determinism,calendar:w.calendar,people:w.agents});
    for(const [i,kind]of (['forest','mountains','river','lake'] as const).entries()) {
      const id='survey_'+kind;w.places[id]={...w.places.commons,id,name:kind,kind,settlementId:undefined,mapX:70+i*12,mapY:70,
        surface:kind==='river'||kind==='lake'?'shore':'land',connectedPlaceIds:[]};
    }
    repairCompactSettlementLayout(w);
    for(const p of Object.values(w.places).filter(p=>p.id.startsWith('survey_'))) {
      expect(p.geographyVersion).toBe(1);expect(p.waterPolygon??p.boundaryPolygon).toBeDefined();
      if(p.waterPolygon)expect(pointInPolygon({x:p.mapX,y:p.mapY},p.waterPolygon)).toBe(false);
    }
    expect({rng:w.determinism,calendar:w.calendar,people:w.agents}).toEqual(before);
    const once=structuredClone(w);expect(repairCompactSettlementLayout(w)).toBe(false);expect(w).toEqual(once);
  });
  it('keeps active field residents inside the actual agricultural polygon at every map scale',async()=>{
    const w=await fresh(),a=w.agents.agent_1;a.locationId='resource_field';a.movement=undefined;a.lastAction='gather';
    for(let frame=0;frame<30;frame++)expect(pointInPolygon(projectedResidentPosition(a,w,frame),w.places.resource_field.boundaryPolygon!)).toBe(true);
  });
  it('retains sparse planet scale, bounds tile history, and never changes the world from camera operations',async()=>{
    const w=await fresh(),id='settlement_elf_homeland';
    w.places[id]={...w.places.commons,id,name:'Эльфийское поселение',kind:'village',settlementId:id,mapX:-10000,mapY:6000};
    w.settlements[id]={id,name:w.places[id].name,kind:'village',centerPlaceId:id,centerX:-10000,centerY:6000,radius:.4,memberPlaceIds:[id],foundedAt:0};
    repairCompactSettlementLayout(w);const saved=structuredClone(w),index=new WorldAtlasIndex(),camera=new WorldMapCamera();index.update(w);
    const revision=index.revision;
    for(let i=0;i<240;i++) {
      camera.zoom([.0005,.02,2,30,300,1600][i%6]);camera.pan(i*7-200,i*3-100);
      index.update(w);index.visibleAreas(camera);index.visiblePlaces(w,camera,new Set());index.visibleRoads(w,camera);
      expect(index.tiles.size).toBeLessThanOrEqual(64);expect(camera.width*camera.height).toBeLessThanOrEqual(1280*800);
    }
    expect(index.revision).toBe(revision);expect(w).toEqual(saved);
    expect(Math.hypot(w.places[id].mapX-w.places.commons.mapX,w.places[id].mapY-w.places.commons.mapY)).toBeGreaterThan(10000);
    expect([.0005,.1,30,300,1000].map(atlasLevel)).toEqual(['world','region','settlement','street','building']);
  });
});
