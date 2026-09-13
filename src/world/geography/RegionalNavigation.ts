import type {WorldPlace,WorldPoint2D} from '../types';
import {pathCrossesWater} from '../WaterNavigation';
import {terrainForPlaces,terrainWalkingScale} from './WorldTerrain';
import {MinHeap} from './TerrainMath';

function routePhase(a:WorldPoint2D,b:WorldPoint2D):number {
  const key=[`${a.x.toFixed(3)},${a.y.toFixed(3)}`,`${b.x.toFixed(3)},${b.y.toFixed(3)}`].sort().join('|');
  let hash=2166136261;
  for(let i=0;i<key.length;i++){hash^=key.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return ((hash>>>0)%6283)/1000;
}

/** Survey a valley/pass route only when actual construction/discovery changes
 * the route graph. Camera changes cannot invoke or change this search. */
export function regionalTerrainRoute(a:WorldPoint2D,b:WorldPoint2D,places:Readonly<Record<string,WorldPlace>>):WorldPoint2D[]|undefined {
  const model=terrainForPlaces(places),distance=Math.hypot(b.x-a.x,b.y-a.y);
  if(!model||distance<12)return undefined;
  const width=65,margin=distance*.30,step=(distance+margin*2)/(width-1),dx=(b.x-a.x)/distance,dy=(b.y-a.y)/distance;
  const phase=routePhase(a,b),meander=Math.min(900,distance*.095);
  const preferredAcross=(along:number)=>{const t=Math.max(0,Math.min(1,along/distance)),edge=Math.sin(Math.PI*t);
    return meander*edge*(.62*Math.sin(t*Math.PI*3.4+phase)+.25*Math.sin(t*Math.PI*8.2+phase*1.7)+.13*Math.sin(t*Math.PI*15.6-phase*.6));};
  const node=(id:number)=>{const along=(id%width)*step-margin,across=(Math.floor(id/width)-32)*step;
    return {x:a.x+dx*along-dy*across,y:a.y+dy*along+dx*across};};
  const start=32*width+Math.round(margin/step),end=32*width+Math.round((distance+margin)/step),nodes=new Map<number,WorldPoint2D>([[start,a],[end,b]]);
  const point=(id:number)=>{let p=nodes.get(id);if(!p){p=node(id);nodes.set(id,p);}return p;};
  const scores=new Float64Array(width*width).fill(Infinity),parents=new Int32Array(width*width).fill(-1),closed=new Uint8Array(width*width),heap=new MinHeap();
  scores[start]=0;heap.push(start,distance);let visited=0;
  while(heap.size&&visited++<width*width*3) {
    const {id}=heap.pop();if(closed[id])continue;if(id===end) {
      const path:WorldPoint2D[]=[];for(let i=end;i>=0;i=parents[i])path.push(point(i));return path.reverse();
    }
    closed[id]=1;const p=point(id),x=id%width,y=Math.floor(id/width);
    for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++) {
      const nx=x+ox,ny=y+oy;if((!ox&&!oy)||nx<0||ny<0||nx>=width||ny>=width)continue;
      const next=ny*width+nx;if(closed[next])continue;const q=point(next);
      const d=Math.hypot(q.x-p.x,q.y-p.y),relX=q.x-a.x,relY=q.y-a.y;
      const along=relX*dx+relY*dy,across=-relX*dy+relY*dx;
      // A trail has a stable, imperfect preferred course. Terrain cost still
      // wins when the curve meets water, a swamp or a steep ridge.
      const trailDeviation=Math.abs(across-preferredAcross(along));
      const cost=scores[id]+d/terrainWalkingScale(places,p,q)+trailDeviation*.24;
      if(cost>=scores[next]||model.sample(q.x,q.y).water||pathCrossesWater([p,q],places))continue;
      parents[next]=id;scores[next]=cost;heap.push(next,cost+Math.hypot(q.x-b.x,q.y-b.y));
    }
  }
  // No invented bridge and no straight line through an impassable boundary.
  return undefined;
}
