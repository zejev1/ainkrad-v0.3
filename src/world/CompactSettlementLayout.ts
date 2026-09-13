import {repairWorldTerrain,bindWorldTerrain} from './geography/WorldTerrain';
import { updateSettlementGeometry } from './SettlementGeometryV21';
import { updateNaturalGeography, finishWorldGeography } from './WorldGeography';
import { reconcileRouteGeometry } from './RouteGeometryMigration';
import { rebuildWorldRoutes } from './WorldNavigation';
import type { WorldPoint2D, WorldState } from './types';

/** Versioned geometry migration; calendar, RNG, identities and knowledge stay intact. */
export function repairCompactSettlementLayout(world:WorldState):boolean {
  bindWorldTerrain(world);
  const oldRoutes=world.routes;
  const moved=new Map<string,{before:WorldPoint2D;after:WorldPoint2D}>();
  const naturalChanged=updateNaturalGeography(world);
  updateSettlementGeometry(world,(id,point)=>{
    const place=world.places[id];
    moved.set(id,{before:{x:place.mapX,y:place.mapY},after:point});
    place.mapX=point.x;place.mapY=point.y;place.urbanLayoutVersion=3;
  });
  const terrainChanged=repairWorldTerrain(world);
  const geographyChanged=finishWorldGeography(world);
  if(!terrainChanged&&!naturalChanged&&!moved.size&&!geographyChanged)return false;
  world.routes=rebuildWorldRoutes(world.places,world.routes);
  reconcileRouteGeometry(world,oldRoutes,moved);
  return true;
}
