import {describe,it,expect} from 'vitest';
import {WorldEngine} from '../src/world/WorldEngine';
import {InMemoryWorldStore} from '../src/world/InMemoryWorldStore';
import {WorldMapCamera} from '../src/presentation/WorldMapCamera';
import {terrainDetails} from '../src/presentation/TerrainDetails';
import {bindWorldTerrain} from '../src/world/geography/WorldTerrain';
import {buildingPolygon,pointInPolygon} from '../src/world/BuildingFootprints';

describe('0.3.22 close terrain',()=>{
 it('shows stable forest detail through zoom without changing the world, putting trees in water or houses, or growing without bounds',async()=>{
  const w=(await WorldEngine.create({worldId:'terrain-detail',seed:'terrain-detail',store:new InMemoryWorldStore(),startTime:0})).snapshot();
  const model=bindWorldTerrain(w)!,forest=w.terrain!.anchors.find(a=>a.kind==='forest')!,c=new WorldMapCamera();
  c.x=forest.x;c.y=forest.y;c.resize(390,600);c.pixelsPerUnit=150;
  const saved=JSON.stringify(w),before=terrainDetails(model,c,w);
  expect(before.filter(p=>p.kind==='tree').length).toBeGreaterThan(10);expect(before.length).toBeLessThanOrEqual(1000);
  expect(before.every(p=>!model.sample(p.x,p.y).water)).toBe(true);
  c.pixelsPerUnit=600;const close=terrainDetails(model,c,w),ids=new Map(before.map(p=>[p.id,p]));
  const same=close.filter(p=>ids.has(p.id));expect(same.length).toBeGreaterThan(5);
  for(const item of same)expect(item).toEqual(ids.get(item.id));
  expect(JSON.stringify(w)).toBe(saved);
  const tree=close.find(p=>p.kind==='tree')!;
  w.places.test_house={...w.places.commons,id:'test_house',kind:'home',mapX:tree.x,mapY:tree.y};
  const house=buildingPolygon(w.places.test_house,.05);
  expect(terrainDetails(model,c,w).some(p=>pointInPolygon(p,house))).toBe(false);
  c.pixelsPerUnit=.005;expect(terrainDetails(model,c,w)).toEqual([]);
 });
});
