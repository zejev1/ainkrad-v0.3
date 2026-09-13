import type {WorldPoint2D} from '../types';
import {clamp,distanceToSegment,noise} from './TerrainMath';
import type {TerrainFoundation,TerrainRidge} from './TerrainTypes';

/** A coherent coastline fitted to the existing inhabited land, without
 * translating homelands or changing the 100 metres/world-unit convention. */
export function continentOutline(f:TerrainFoundation):WorldPoint2D[] {
  const ys=[...Array.from({length:145},(_,i)=>-23500+i*330),40,50,60,80,88,98].sort((a,b)=>a-b);
  const right:WorldPoint2D[]=[],left:WorldPoint2D[]=[];
  for(const y of ys) {
    const q=(y-1000)/24500,span=30000*Math.sqrt(Math.max(0,1-q*q));
    const rim=noise(y/1800,4,f.seed)*.12+.93;
    let east=Math.min(-24000+span*rim,96-(1800+8200*noise(y/2700,7,f.seed))*(1-Math.exp(-(((y-50)/1200)**2))));
    let west=-24000-span*(.92+.15*noise(y/2200,9,f.seed));
    for(const a of f.anchors) {
      const influence=Math.exp(-(((y-a.y)/800)**2));
      east=Math.max(east,(a.x+a.radius+2)*influence+east*(1-influence));
      west=Math.min(west,(a.x-a.radius-2)*influence+west*(1-influence));
    }
    // The original sea east of x=96 remains sea, including existing boat routes.
    east=Math.min(96,east);right.push({x:east,y});left.push({x:west,y});
  }
  return [...right,...left.reverse()];
}
export function ridges(f:TerrainFoundation):TerrainRidge[] {
  const lines=[[-47000,-13000,-9000,-5000,3100,1450],[-43000,16500,-10500,7000,2600,1350],[-47000,7000,-30000,-17000,2350,1150]];
  return lines.map(([x1,y1,x2,y2,height,width],i)=>({id:'range_'+i,name:['Северный хребет','Южные горы','Западный хребет'][i],height,width,
    points:Array.from({length:25},(_,n)=>{const t=n/24,wave=Math.sin(t*Math.PI*2+i)*2200*Math.sin(t*Math.PI);
      return {x:x1+(x2-x1)*t+wave+(noise(t*4,i,f.seed)-.5)*1100,
        y:y1+(y2-y1)*t+Math.sin(t*Math.PI*2.5+i*.8)*2200+(noise(t*4,i+5,f.seed)-.5)*1100};})}));
}
export function reliefHeight(x:number,y:number,f:TerrainFoundation,chains:TerrainRidge[]):number {
  const n=noise(x/2100,y/2100,f.seed),fine=noise(x/550,y/550,f.seed+31);
  let height=90+230*n+75*fine;
  for(const range of chains) {
    let d=Infinity,along=.5;for(let i=1;i<range.points.length;i++){const near=distanceToSegment({x,y},range.points[i-1],range.points[i]);if(near.distance<d){d=near.distance;along=(i-1+near.t)/(range.points.length-1);}}
    const spine=Math.exp(-((d/range.width)**2)),crags=.62+.38*noise(x/310,y/310,f.seed+17);
    height+=range.height*spine*crags*(.3+.7*Math.sin(along*Math.PI));
  }
  return height;
}
export function climate(x:number,y:number,seed:number,height:number):number {
  // Regional climate and local groves/wet ground coexist. A kilometre-scale
  // expedition must not see one uniform biome across hundreds of kilometres.
  return clamp(.20+.55*noise(x/3500,y/3500,seed+91)+.30*noise(x/24,y/24,seed+113)-height/15000);
}
