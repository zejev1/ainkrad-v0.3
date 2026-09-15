import {connectLocalWaters} from './LocalDrainage';
import {naturalRiverCourse,nearestRiverPoint} from './RiverCourses';
import {pointInPolygon} from '../BuildingFootprints';
import {PreparedPolygonQuery} from '../PreparedPolygonQuery';
import type {WorldPoint2D} from '../types';
import {continentOutline,ridges,reliefHeight,climate} from './ContinentalRelief';
import {drainTerrain,terrainGridPoint} from './DrainageNetwork';
import {FeatureIndex,featureBounds,type FeatureBounds} from './FeatureIndex';
import {clamp,lerp,distanceToSegment,noise} from './TerrainMath';
import {TERRAIN_BOUNDS as B,TERRAIN_GRID as N,type TerrainFoundation,type TerrainSample,type RiverReach} from './TerrainTypes';

export function riverPolygon(r:RiverReach):WorldPoint2D[] {
  const path=r.points??[r.from,r.to];
  const side=(sign:number)=>path.map((p,i)=>{const a=path[Math.max(0,i-1)],b=path[Math.min(path.length-1,i+1)],dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1e-9,Math.hypot(dx,dy));
    const extend=i===0?-r.width:i===path.length-1?r.width:0;
    return {x:p.x-dy/d*r.width*sign+dx/d*extend,y:p.y+dx/d*r.width*sign+dy/d*extend};});
  return [...side(1),...side(-1).reverse()];
}
export class TerrainModel {
  readonly outline:WorldPoint2D[];readonly ocean:WorldPoint2D[];readonly landOutlines:WorldPoint2D[][];readonly ranges;
  readonly heights:Float64Array;readonly land:Uint8Array;readonly reaches:RiverReach[];
  readonly rivers:FeatureIndex<RiverReach>;readonly anchors:FeatureIndex<TerrainFoundation['anchors'][number]>;
  readonly riverPolygons:WorldPoint2D[][];
  readonly polygons:FeatureIndex<WorldPoint2D[]>;
  private readonly landQueries:PreparedPolygonQuery[];
  constructor(readonly foundation:TerrainFoundation) {
    // Model caches must not adopt a new recipe key while retaining old grids.
    this.foundation=structuredClone(foundation);foundation=this.foundation;
    this.outline=continentOutline(foundation);this.ranges=ridges(foundation);
    this.landOutlines=[this.outline,...(foundation.offshore??[]).map(land=>land.outline)];
    this.landQueries=this.landOutlines.map(poly=>new PreparedPolygonQuery(poly));
    const outer=[{x:-200000,y:-100075},{x:200375,y:-100075},{x:200375,y:100075},{x:-200000,y:100075}];
    // Even-odd ocean with a land hole; the connecting edge lies in the sea.
    this.ocean=[...outer,outer[0],...this.landOutlines.flatMap(poly=>[poly[0],...poly.slice(1),poly[0],outer[0]])];
    const raw=new Float64Array(N*N);this.land=new Uint8Array(N*N);
    for(let i=0;i<N*N;i++){const p=terrainGridPoint(i);this.land[i]=Number(this.landQueries[0].contains(p));raw[i]=this.land[i]?reliefHeight(p.x,p.y,foundation,this.ranges):0;}
    const drainage=drainTerrain(raw,this.land,foundation);this.heights=drainage.heights;this.reaches=drainage.reaches;
    connectLocalWaters(foundation,drainage.parent,this.heights,this.land,this.reaches);
    for(const reach of this.reaches)reach.points=naturalRiverCourse(reach,foundation);
    this.rivers=new FeatureIndex(this.reaches,r=>featureBounds(r.points!,r.width+1));
    this.riverPolygons=this.reaches.map(riverPolygon);this.polygons=new FeatureIndex(this.riverPolygons,p=>featureBounds(p));
    this.anchors=new FeatureIndex(foundation.anchors,a=>({minX:a.x-a.radius-8,minY:a.y-a.radius-8,maxX:a.x+a.radius+8,maxY:a.y+a.radius+8}),32);
  }
  isLand(point:WorldPoint2D):boolean {return this.landQueries.some(query=>query.contains(point));}
  elevation(x:number,y:number):number {
    const land=this.foundation.offshore?.find(p=>Math.abs(x-p.center.x)<=p.radius&&Math.abs(y-p.center.y)<=p.radius&&pointInPolygon({x,y},p.outline));
    if(land){
      const shore=Math.min(...land.outline.map((p,i)=>distanceToSegment({x,y},p,land.outline[(i+1)%land.outline.length]).distance));
      const height=Math.min(1900,land.radius*8)*(1-Math.exp(-shore/Math.max(1,land.radius*.3)));
      return Math.max(.2,height*(.65+.35*noise(x/Math.max(1,land.radius*.3),y/Math.max(1,land.radius*.3),land.seed)));
    }
    const gx=clamp((x-B.minX)/(B.maxX-B.minX)*(N-1),0,N-1),gy=clamp((y-B.minY)/(B.maxY-B.minY)*(N-1),0,N-1);
    const ix=Math.min(N-2,Math.floor(gx)),iy=Math.min(N-2,Math.floor(gy)),u=gx-ix,v=gy-iy;
    return lerp(lerp(this.heights[iy*N+ix],this.heights[iy*N+ix+1],u),lerp(this.heights[(iy+1)*N+ix],this.heights[(iy+1)*N+ix+1],u),v);
  }
  /** Shared physical sampler. Rendering does not get a separate fake terrain. */
  sample(x:number,y:number,detail=true):TerrainSample {
    const p={x,y},box={minX:x,minY:y,maxX:x,maxY:y};
    if(!this.isLand(p))return {height:-100,moisture:1,biome:'ocean',water:true,slope:0};
    let height=this.elevation(x,y),water=false;const moisture=climate(x,y,this.foundation.seed,height);
    let biome:TerrainSample['biome']=height>1450?'mountains':moisture>.78&&height<300?'swamp':moisture>.62?'forest':'plains';
    if(detail) {
      for(const r of this.rivers.query(box)) {
        const near=nearestRiverPoint(p,r);if(near.distance<=r.width)water=true;
        if(near.distance<r.width+1)height=Math.min(height,lerp(r.bedFrom,r.bedTo,near.t)+Math.max(0,near.distance-r.width)*4);
      }
    }
    // Saved natural sites and homeland vegetation are part of the same
    // sampler at every detail level, including the raster overview.
    for(const a of this.anchors.query(box)) {
      const d=Math.hypot(x-a.x,y-a.y);if(d>a.radius+8)continue;
      if(a.water&&pointInPolygon(p,a.water)){water=true;continue;}
      if(d<a.radius){
        if(a.kind==='mountains')biome='mountains';else if(a.kind==='forest')biome='forest';else if(a.kind==='swamp')biome='swamp';
        else if(['home','commons','city','village','resource_field','meadow'].includes(a.kind))biome='plains';
      }
    }
    const slope=Math.hypot(this.elevation(x+1,y)-this.elevation(x-1,y),this.elevation(x,y+1)-this.elevation(x,y-1))/200;
    return {height,moisture,biome,water,slope};
  }
  waterIn(bounds:FeatureBounds):WorldPoint2D[][] {return this.polygons.query(bounds);}
}
const models=new Map<string,TerrainModel>();
export function terrainModel(f:TerrainFoundation):TerrainModel {
  let model=models.get(f.key);if(model)return model;
  model=new TerrainModel(f);models.set(f.key,model);while(models.size>2)models.delete(models.keys().next().value!);return model;
}
