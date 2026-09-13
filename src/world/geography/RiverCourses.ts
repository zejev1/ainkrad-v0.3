import type {WorldPoint2D} from '../types';
import type {RiverReach,TerrainFoundation} from './TerrainTypes';
import {distanceToSegment,hash} from './TerrainMath';

/** Shared metre-based river centreline; the renderer and water collision use
 * these same bends. Simplifying the view never simplifies the physical water. */
export function naturalRiverCourse(r:RiverReach,f:TerrainFoundation):WorldPoint2D[] {
  const dx=r.to.x-r.from.x,dy=r.to.y-r.from.y,d=Math.max(1e-9,Math.hypot(dx,dy));
  const phase=(hash(r.id+':'+f.seed)%1000)/1000*Math.PI*2,amplitude=Math.min(35,d*.06);
  const points=Array.from({length:9},(_,i)=>{const t=i/8,bend=Math.sin(t*Math.PI)*Math.sin(t*Math.PI*2+phase)*amplitude;
    return {x:r.from.x+dx*t-dy/d*bend,y:r.from.y+dy*t+dx/d*bend};});
  const safe=[points[0]];
  for(let i=1;i<points.length;i++) {
    const a=points[i-1],b=points[i],bends:WorldPoint2D[]=[];
    for(const anchor of f.anchors) {
      const near=distanceToSegment(anchor,a,b),radius=anchor.radius+r.width+.2;
      if(near.distance>=radius||near.t<=.001||near.t>=.999)continue;
      // Sources begin inside their recorded lake; keep that connection.
      if(anchor.water&&Math.hypot(anchor.x-r.from.x,anchor.y-r.from.y)<10)continue;
      const side=((anchor.x-near.point.x)*-dy+(anchor.y-near.point.y)*dx)>=0?-1:1;
      bends.push({x:near.point.x-dy/d*radius*1.3*side,y:near.point.y+dx/d*radius*1.3*side});
    }
    bends.sort((p,q)=>distanceToSegment(p,a,b).t-distanceToSegment(q,a,b).t);safe.push(...bends,b);
  }
  safe[0]=r.from;safe[safe.length-1]=r.to;return safe;
}
export function nearestRiverPoint(p:WorldPoint2D,r:RiverReach) {
  const path=r.points??[r.from,r.to];let result={distance:Infinity,t:0,point:r.from};
  for(let i=1;i<path.length;i++){const v=distanceToSegment(p,path[i-1],path[i]);if(v.distance<result.distance)result={...v,t:(i-1+v.t)/(path.length-1)};}
  return result;
}
