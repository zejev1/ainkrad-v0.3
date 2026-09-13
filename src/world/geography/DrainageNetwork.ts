import type {WorldPoint2D} from '../types';
import {MinHeap,distanceToSegment} from './TerrainMath';
import {TERRAIN_GRID as N,TERRAIN_BOUNDS as B,type TerrainFoundation,type RiverReach} from './TerrainTypes';
export const terrainGridPoint=(id:number):WorldPoint2D=>({x:B.minX+(id%N)/(N-1)*(B.maxX-B.minX),y:B.minY+Math.floor(id/N)/(N-1)*(B.maxY-B.minY)});
/** Priority drainage starts at the actual sea and assigns every land cell a
 * lower downstream parent. Basins cannot produce cycles or uphill rivers. */
export function drainTerrain(raw:Float64Array,land:Uint8Array,foundation:TerrainFoundation) {
  const heights=raw.slice(),parent=new Int32Array(N*N).fill(-1),visited=new Uint8Array(N*N),heap=new MinHeap(),order:number[]=[];
  for(let i=0;i<N*N;i++)if(!land[i]){visited[i]=1;heights[i]=0;heap.push(i,0);}
  while(heap.size) {
    const {id}=heap.pop();order.push(id);const x=id%N,y=Math.floor(id/N);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) {
      const nx=x+dx,ny=y+dy;if((!dx&&!dy)||nx<0||ny<0||nx>=N||ny>=N)continue;
      const next=ny*N+nx;if(visited[next])continue;
      visited[next]=1;parent[next]=id;heights[next]=Math.max(raw[next],heights[id]+.01);heap.push(next,heights[next]);
    }
  }
  const flow=new Float64Array(N*N);for(let i=0;i<N*N;i++)flow[i]=land[i]?1:0;
  for(let i=order.length-1;i>=0;i--){const id=order[i];if(parent[id]>=0)flow[parent[id]]+=flow[id];}
  const reaches:RiverReach[]=[];
  for(let i=0;i<N*N;i++) {
    const p=parent[i];if(!land[i]||p<0||flow[i]<10)continue;
    let from=terrainGridPoint(i),to=terrainGridPoint(p);
    const width=.045+Math.sqrt(flow[i])*.028;
    // Historic settlements/banks remain dry. Bend a channel around a small
    // protected parcel, retaining its shared downstream endpoint and height.
    const points=[from];
    for(const a of foundation.anchors) {
      const near=distanceToSegment(a,from,to),r=a.radius+width+1;
      if(near.distance>=r||near.t<=.001||near.t>=.999)continue;
      const dx=to.x-from.x,dy=to.y-from.y,d=Math.hypot(dx,dy),side=((a.x-near.point.x)*(-dy)+(a.y-near.point.y)*dx)>=0?-1:1;
      points.push({x:near.point.x-dy/d*r*side,y:near.point.y+dx/d*r*side});
    }
    points.push(to);points.sort((a,b)=>distanceToSegment(a,from,to).t-distanceToSegment(b,from,to).t);
    for(let j=1;j<points.length;j++)reaches.push({id:`river_${i}_${j}`,from:points[j-1],to:points[j],width,flow:flow[i],
      bedFrom:heights[i]+(heights[p]-heights[i])*(j-1)/(points.length-1),bedTo:heights[i]+(heights[p]-heights[i])*j/(points.length-1),
      downstream:j<points.length-1?`river_${i}_${j+1}`:land[p]&&flow[p]>=10?`river_${p}_1`:undefined});
  }
  return {heights,reaches,parent,flow};
}
