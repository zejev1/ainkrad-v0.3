import type { WorldPlace, WorldState } from '../types';
import { FeatureIndex } from './FeatureIndex';
import type { WaterUnit } from '../systems/water/HydrologyModel';

type Places = Readonly<Record<string,WorldPlace>>;
const worlds = new WeakMap<Places,Readonly<WorldState>>();
const indexes = new WeakMap<object,{updates:number;index?:FeatureIndex<WaterUnit>}>();
export function bindPhysicalWater(world: Readonly<WorldState>): void { worlds.set(world.places,world); }
export function invalidatePhysicalWater(world: Readonly<WorldState>): void { if(world.hydrologySystem)indexes.delete(world.hydrologySystem); }
/** Local reservoir conditions only. Basin averages cannot flood every street
 * in a region. Shared by physical ground travel and the visible water inspector. */
export function localFloodDepth(places: Places,x:number,y:number): number {
  const state=worlds.get(places)?.hydrologySystem;if(!state)return 0;
  let cached=indexes.get(state);
  if(!cached||cached.updates!==state.updates){
    const flooded=Object.values(state.units).filter(s=>s?.active&&s.spec?.kind!=='catchment'&&s.surfaceM3>s.spec.bankfullM3);
    const index=flooded.length?new FeatureIndex(flooded,s=>{
      const r=Math.sqrt(s.spec.areaM2)/200;return {minX:s.spec.x-r,maxX:s.spec.x+r,minY:s.spec.y-r,maxY:s.spec.y+r};
    },8):undefined;
    cached={updates:state.updates,index};indexes.set(state,cached);
  }
  if(!cached.index)return 0;
  let depth=0;
  for(const s of cached.index.queryPoint(x,y)) {
    const value=Math.max(0,s.surfaceM3-s.spec.bankfullM3)/s.spec.surfaceAreaM2;
    if(Number.isFinite(value))depth=Math.max(depth,value);
  }
  return depth;
}
