import { describe, expect, it, vi } from 'vitest';
import { physicalPlaceDrawing, isPersistentMapLandmark, applyPhysicalPlaceStyle } from '../src/presentation/MapPlacePresentation';
import { coastalLandmark, surveyCoastalLandmark } from '../src/presentation/CoastalLandmark';
import { WorldEngine } from '../src/world/WorldEngine';
import { InMemoryWorldStore } from '../src/world/InMemoryWorldStore';
import { bindWorldTerrain } from '../src/world/geography/WorldTerrain';
import { WorldMapCamera } from '../src/presentation/WorldMapCamera';
import { WorldAtlasIndex } from '../src/presentation/WorldAtlasIndex';
import { waterAccess } from '../src/v21/SailingRoutes';
import type { TerrainModel } from '../src/world/geography/TerrainModel';
import type { WorldPlace, WorldPoint2D } from '../src/world/types';

function place(id:string, kind:WorldPlace['kind']='shore'):WorldPlace {
  return {
    id,
    name:id,
    kind,
    capacity:10,
    biome:'coast',
    mapX:0,
    mapY:0,
    connectedPlaceIds:[],
    fertility:.2,
    danger:.05,
    surface:'shore',
  };
}

describe('Rulid harbor map presentation',()=>{
  it('treats only the Rulid shore as a persistent civic landmark',()=>{
    expect(isPersistentMapLandmark(place('rulid_shore'))).toBe(true);
    expect(isPersistentMapLandmark(place('other_shore'))).toBe(false);
  });

  it('puts the beach and shipyard on dry land and the pier end in the actual ocean',async()=>{
    const world=(await WorldEngine.create({worldId:'coastal-presentation',seed:'coastal-presentation',store:new InMemoryWorldStore()})).snapshot();
    const before=structuredClone(world),model=bindWorldTerrain(world)!,coast=coastalLandmark(world)!;
    expect(coast).toBeDefined();
    expect(Math.hypot(coast.access.x-coast.origin.x,coast.access.y-coast.origin.y)).toBeCloseTo(.3,6);
    for(const p of [...coast.beach,...coast.yard])expect(model.sample(p.x,p.y).water).toBe(false);
    expect(model.sample(coast.pierTip.x,coast.pierTip.y).biome).toBe('ocean');
    expect(Math.hypot(coast.pierTip.x-coast.origin.x,coast.pierTip.y-coast.origin.y)).toBeCloseTo(.18,6);
    expect(coast.approach[0]).toEqual({x:world.places.rulid_shore.mapX,y:world.places.rulid_shore.mapY});
    // The historical dry destination still connects to the working boat launch.
    expect(waterAccess(world,coast.access)).toBeDefined();
    const drawing=physicalPlaceDrawing(world.places.rulid_shore,true,coast);
    expect(drawing).toContain('rulid-harbor-art');
    for(const part of ['beach','shipyard','pier','shore-approach'])expect(drawing).toContain(`data-part="${part}"`);
    expect(drawing).not.toContain('#4b8598'); // No fake sea patch or decorative boat on land.
    const generic=physicalPlaceDrawing(place('other_shore'),true);
    expect(generic).not.toContain('rulid-harbor-art');
    expect(world).toEqual(before);
  });

  it('keeps coast contact at all reported zoom levels and after save/reload',async()=>{
    const store=new InMemoryWorldStore();
    const engine=await WorldEngine.create({worldId:'coastal-scale',seed:'coastal-scale',store});
    const world=engine.snapshot(),coast=coastalLandmark(world)!;
    const styles=new Map<string,string>();
    const element={style:{setProperty:(key:string,value:string)=>styles.set(key,value)},classList:{toggle:()=>{},remove:()=>{}}} as unknown as HTMLElement;
    for(const scale of [180,447,606,1600]) {
      const camera=new WorldMapCamera();camera.pixelsPerUnit=scale;camera.x=coast.origin.x;camera.y=coast.origin.y;
      applyPhysicalPlaceStyle(element,world.places.rulid_shore,camera,coast);
      // Reconstruct CSS edges in screen pixels; compare with the physical camera.
      const left=camera.width/2+parseFloat(styles.get('--coastal-shift-x')!)-parseFloat(styles.get('--physical-width')!)/2;
      const right=left+parseFloat(styles.get('--physical-width')!);
      expect(left).toBeCloseTo(camera.point(coast.bounds.minX,coast.bounds.minY).x*camera.width/100,7);
      expect(right).toBeCloseTo(camera.point(coast.bounds.maxX,coast.bounds.maxY).x*camera.width/100,7);
    }
    const reopened=await WorldEngine.open({worldId:world.id,store});
    expect(reopened.snapshot()).toEqual(world);
    expect(coastalLandmark(reopened.snapshot())).toEqual(coast);
  });

  it('follows rotated coastlines without changing the terrain',async()=>{
    for(const angle of [0,Math.PI/4,Math.PI/2,Math.PI]) {
      const n={x:Math.cos(angle),y:Math.sin(angle)};
      const p=(x:number,y:number)=>({x:n.x*x-n.y*y,y:n.y*x+n.x*y});
      const isLand=(q:WorldPoint2D)=>q.x*n.x+q.y*n.y<0;
      const model={landOutlines:[[-10,-10],[0,-10],[0,10],[-10,10]].map(q=>p(q[0],q[1])),isLand,
        sample:(x:number,y:number)=>({water:!isLand({x,y})})};
      const terrain={...model,landOutlines:[model.landOutlines]} as unknown as TerrainModel;
      const access=p(-.3,0),shore={...place('rulid_shore'),mapX:access.x,mapY:access.y};
      const coast=surveyCoastalLandmark(shore,terrain)!;
      expect(coast).toBeDefined();
      expect(Math.hypot(coast.origin.x,coast.origin.y)).toBeLessThan(1e-10);
      expect(isLand(coast.pierTip)).toBe(false);
      expect([...coast.beach,...coast.yard].every(isLand)).toBe(true);
    }
  });

  it('reuses the survey and keeps a visible pier when its access point is off screen',async()=>{
    const world=(await WorldEngine.create({worldId:'coastal-cache',seed:'coastal-cache',store:new InMemoryWorldStore()})).snapshot();
    const coast=coastalLandmark(world)!,model=bindWorldTerrain(world)!;
    const sample=vi.spyOn(model,'sample');
    for(let i=0;i<10000;i++)expect(coastalLandmark(world)).toBe(coast);
    expect(sample).not.toHaveBeenCalled();
    const camera=new WorldMapCamera();camera.resize(80,80);camera.pixelsPerUnit=1600;camera.x=coast.origin.x+.12;camera.y=coast.origin.y;
    expect(camera.visible(coast.access.x,coast.access.y,80)).toBe(false);
    const index=new WorldAtlasIndex();index.update(world);
    expect(index.visiblePlaces(world,camera,new Set()).map(p=>p.id)).toContain('rulid_shore');
    const moved=structuredClone(world);moved.places.rulid_shore.mapX-=.02;
    expect(coastalLandmark(moved)).not.toBe(coast);
    expect(sample).toHaveBeenCalled();sample.mockRestore();
  });
});
