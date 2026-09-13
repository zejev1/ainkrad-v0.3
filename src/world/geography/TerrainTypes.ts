import type {WorldPoint2D,WorldPlaceKind} from '../types';
export interface TerrainAnchor extends WorldPoint2D {
  id:string;kind:WorldPlaceKind;radius:number;water?:WorldPoint2D[];
}
/** Small, persisted and versioned recipe. Derived grids/tiles are disposable
 * caches, not mutable RNG state or resident discoveries. */
export interface TerrainFoundation {
  version:1;epoch:number;seed:number;key:string;anchors:TerrainAnchor[];
}
export interface TerrainRidge {id:string;name:string;points:WorldPoint2D[];height:number;width:number}
export interface RiverReach {id:string;from:WorldPoint2D;to:WorldPoint2D;points?:WorldPoint2D[];width:number;flow:number;bedFrom:number;bedTo:number;downstream?:string}
export interface TerrainSample {height:number;moisture:number;biome:'ocean'|'plains'|'forest'|'mountains'|'swamp';water:boolean;slope:number}
export const TERRAIN_GRID=161;
export const TERRAIN_BOUNDS={minX:-57000,minY:-27000,maxX:6000,maxY:29000};
