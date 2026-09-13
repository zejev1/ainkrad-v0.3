import type {WorldPoint2D} from '../types';
import {TERRAIN_GRID as N,TERRAIN_BOUNDS as B,type RiverReach,type TerrainFoundation} from './TerrainTypes';
import {terrainGridPoint} from './DrainageNetwork';
import {clamp,distanceToSegment} from './TerrainMath';

/** Existing saved lakes and stream sections join the same downstream tree.
 * The save retains their place IDs, bank coordinates and historical names. */
export function connectLocalWaters(f:TerrainFoundation,parent:Int32Array,heights:Float64Array,land:Uint8Array,reaches:RiverReach[]):void {
  const network=new Map(reaches.map(r=>[r.id,r]));
  for(const anchor of f.anchors.filter(a=>a.water?.length)) {
    const polygon=anchor.water!,center={x:polygon.reduce((n,p)=>n+p.x,0)/polygon.length,y:polygon.reduce((n,p)=>n+p.y,0)/polygon.length};
    let at=Math.round(clamp((center.y-B.minY)/(B.maxY-B.minY)*(N-1),0,N-1))*N+Math.round(clamp((center.x-B.minX)/(B.maxX-B.minX)*(N-1),0,N-1));
    const points:WorldPoint2D[]=[center],levels=[heights[at]+.1];let downstream:string|undefined;
    for(let step=0;step<N*N;step++) {
      const existing=network.get(`river_${at}_1`);
      if(existing){points.push(existing.from);levels.push(existing.bedFrom);downstream=existing.id;break;}
      points.push(terrainGridPoint(at));levels.push(heights[at]);
      if(!land[at]||parent[at]<0)break;at=parent[at];
    }
    for(let i=1;i<points.length;i++) {
      const from=points[i-1],to=points[i];if(Math.hypot(from.x-to.x,from.y-to.y)<1e-8)continue;
      const bends:WorldPoint2D[]=[];
      for(const dry of f.anchors) {
        if(dry.id===anchor.id)continue;const near=distanceToSegment(dry,from,to),r=dry.radius+1;
        if(near.distance>=r||near.t<=.001||near.t>=.999)continue;
        const dx=to.x-from.x,dy=to.y-from.y,d=Math.hypot(dx,dy),side=((dry.x-near.point.x)*-dy+(dry.y-near.point.y)*dx)>=0?-1:1;
        bends.push({x:near.point.x-dy/d*r*side,y:near.point.y+dx/d*r*side});
      }
      const part=[from,...bends.sort((a,b)=>distanceToSegment(a,from,to).t-distanceToSegment(b,from,to).t),to];
      for(let j=1;j<part.length;j++)reaches.push({id:`tributary_${anchor.id}_${i}_${j}`,from:part[j-1],to:part[j],width:.04,flow:4,
        bedFrom:levels[i-1]+(levels[i]-levels[i-1])*(j-1)/(part.length-1),bedTo:levels[i-1]+(levels[i]-levels[i-1])*j/(part.length-1),
        downstream:j<part.length-1?`tributary_${anchor.id}_${i}_${j+1}`:i<points.length-1?`tributary_${anchor.id}_${i+1}_1`:downstream});
    }
  }
}
