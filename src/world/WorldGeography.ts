import { buildingPolygon, buildingSize, pointInPolygon, polygonsOverlap } from './BuildingFootprints';
import type { WorldPlace, WorldPoint2D, WorldState } from './types';
import {terrainForPlaces} from './geography/WorldTerrain';
import {riverPolygon} from './geography/TerrainModel';
import {nearestRiverPoint} from './geography/RiverCourses';

export const GEOGRAPHY_VERSION=1;
export function geographySeed(id:string):number {
  let h=2166136261;for(const c of id){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}
  return (h>>>0)/4294967296;
}
function oval(center:WorldPoint2D,x:number,y:number,angle:number,seed:number):WorldPoint2D[] {
  return Array.from({length:20},(_,i)=>{
    const a=i*Math.PI/10,r=1+.06*Math.sin(a*3+seed*6);
    const dx=Math.cos(a)*x*r,dy=Math.sin(a)*y*r,c=Math.cos(angle),s=Math.sin(angle);
    return {x:center.x+dx*c-dy*s,y:center.y+dx*s+dy*c};
  });
}
function riverArea(path:WorldPoint2D[],width:number):WorldPoint2D[] {
  const side=(sign:number)=>path.map((p,i)=>{
    const a=path[Math.max(0,i-1)],b=path[Math.min(path.length-1,i+1)],d=Math.max(1e-9,Math.hypot(b.x-a.x,b.y-a.y));
    return {x:p.x-(b.y-a.y)/d*width*sign,y:p.y+(b.x-a.x)/d*width*sign};
  });
  return [...side(1),...side(-1).reverse()];
}
/** Survey only newly introduced natural sites. IDs, distances between homelands,
 * inhabitants, knowledge, ownership and RNG are never changed by this module. */
export function updateNaturalGeography(world:WorldState):boolean {
  let changed=false;const all=Object.values(world.places);
  const natural=all.filter(p=>['forest','meadow','mountains','swamp','river','lake','shore','ocean','ruins','cemetery'].includes(p.kind));
  for(const place of natural) {
    if(place.geographyVersion===GEOGRAPHY_VERSION)continue;
    // Existing explicit seas are already physical geometry; preserve their record.
    if(place.surface==='water'&&place.boundaryPolygon)continue;
    const seed=geographySeed(place.id),origin={x:place.mapX,y:place.mapY};
    const terrain=terrainForPlaces(world.places);
    if(terrain&&!place.waterPolygon&&(place.kind==='river'||place.kind==='lake')) {
      if(place.kind==='river') {
        const nearby=terrain.rivers.query({minX:origin.x-3,minY:origin.y-3,maxX:origin.x+3,maxY:origin.y+3})
          .sort((a,b)=>nearestRiverPoint(origin,a).distance-nearestRiverPoint(origin,b).distance)[0];
        if(nearby&&nearestRiverPoint(origin,nearby).distance<=nearby.width+2&&!pointInPolygon(origin,riverPolygon(nearby))) {
          place.waterPolygon=riverPolygon(nearby);place.terrainPath=nearby.points?.map(p=>({...p}))??[nearby.from,nearby.to];
        }
      } else {
        const lake=terrain.foundation.anchors.find(a=>a.kind==='lake'&&a.water?.some(p=>Math.hypot(p.x-origin.x,p.y-origin.y)<3));
        if(lake?.water&&!pointInPolygon(origin,lake.water))place.waterPolygon=lake.water.map(p=>({...p}));
      }
    }
    if(!place.boundaryPolygon&&!place.waterPolygon) {
      const nearest=Math.min(1500,...natural.filter(p=>p.id!==place.id).map(p=>Math.hypot(p.mapX-place.mapX,p.mapY-place.mapY)));
      const size=Math.max(.65,Math.min(600,nearest*.38));
      if(place.kind==='lake'||place.kind==='river') {
        // The place denotes the accessible bank. Put water beside it, never
        // underneath an inhabited place or an existing town footprint.
        for(let attempt=0;attempt<36;attempt++) {
          const angle=seed*Math.PI*2+(attempt%12)*Math.PI/6,scale=2**-Math.floor(attempt/12);
          const extent=Math.min(6,size)*scale,c=Math.cos(angle),s=Math.sin(angle);
          let polygon:WorldPoint2D[],path:WorldPoint2D[]|undefined;
          if(place.kind==='lake')polygon=oval({x:origin.x+c*(extent+.08),y:origin.y+s*(extent+.08)},extent,extent*.65,angle,seed);
          else {
            const width=Math.max(.025,Math.min(.12,extent*.07));
            path=Array.from({length:17},(_,i)=>{
              const t=(i-8)/8,along=t*extent*2,bend=Math.sin(t*Math.PI*1.25)*extent*.18;
              return {x:origin.x+along*-s+(width+.06+bend)*c,y:origin.y+along*c+(width+.06+bend)*s};
            });
            polygon=riverArea(path,width);
          }
          const blocked=all.some(p=>p.id!==place.id&&p.surface!=='water'&&
            (pointInPolygon({x:p.mapX,y:p.mapY},polygon)||(buildingSize(p).width>0&&polygonsOverlap(buildingPolygon(p,.03),polygon))));
          if(!blocked&&!pointInPolygon(origin,polygon)) {place.waterPolygon=polygon;if(path)place.terrainPath=path;break;}
        }
      } else if(place.surface!=='water') {
        place.boundaryPolygon=oval(origin,size, size*(place.kind==='mountains'?.48:.78),seed*Math.PI,seed);
      }
    }
    place.geographyVersion=GEOGRAPHY_VERSION;changed=true;
  }
  return changed;
}
export function fieldPolygon(place:WorldPlace):WorldPoint2D[] {
  const angle=place.rotation??geographySeed(place.id)*Math.PI,c=Math.cos(angle),s=Math.sin(angle);
  return [[-.24,-.17],[.22,-.19],[.27,.15],[-.21,.20]].map(([x,y])=>({x:place.mapX+x*c-y*s,y:place.mapY+x*s+y*c}));
}
export function convexHull(points:WorldPoint2D[]):WorldPoint2D[] {
  const sorted=[...points].sort((a,b)=>a.x-b.x||a.y-b.y);
  if(sorted.length<3)return sorted;
  const cross=(o:WorldPoint2D,a:WorldPoint2D,b:WorldPoint2D)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x);
  const side=(input:WorldPoint2D[])=>{const result:WorldPoint2D[]=[];for(const p of input){
    while(result.length>=2&&cross(result.at(-2)!,result.at(-1)!,p)<=0)result.pop();result.push(p);}result.pop();return result;};
  return [...side(sorted),...side([...sorted].reverse())];
}
export function finishWorldGeography(world:WorldState):boolean {
  const signature=Object.values(world.places).map(p=>[p.id,p.kind,p.mapX,p.mapY,p.rotation??0,p.urbanLayoutVersion??0,
    p.boundaryPolygon,p.waterPolygon,p.connectedPlaceIds]).map(p=>JSON.stringify(p)).sort().join('|');
  if(world.geography?.version===GEOGRAPHY_VERSION&&world.geography.signature===signature)return false;
  world.geography={version:GEOGRAPHY_VERSION,revision:(world.geography?.revision??0)+1,signature};return true;
}
