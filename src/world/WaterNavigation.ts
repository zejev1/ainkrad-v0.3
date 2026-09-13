import { pointInPolygon, segmentHitsPolygon } from './BuildingFootprints';
import type { WorldPlace, WorldPoint2D } from './types';
import {terrainForPlaces} from './geography/WorldTerrain';
import {featureBounds,type FeatureBounds} from './geography/FeatureIndex';

export function worldWaterPolygons(places:Readonly<Record<string,WorldPlace>>,bounds?:FeatureBounds):WorldPoint2D[][] {
  const model=terrainForPlaces(places);
  const local=Object.values(places).filter(p=>!model||p.kind!=='ocean').flatMap(p=>p.waterPolygon?[p.waterPolygon]:p.surface==='water'&&p.boundaryPolygon?[p.boundaryPolygon]:[]);
  return [...local,...(model?[model.ocean,...(bounds?model.waterIn(bounds):model.riverPolygons)]:[])];
}
export function pathCrossesWater(path:readonly WorldPoint2D[],places:Readonly<Record<string,WorldPlace>>):boolean {
  const water=worldWaterPolygons(places,featureBounds(path));
  return path.slice(1).some((p,i)=>water.some(poly=>segmentHitsPolygon(path[i],p,poly)));
}
/** Survey a dry bank route around the actual water polygon. A bridge/boat must
 * still be explicit; zoom and a cosmetic curve can never authorize crossing. */
export function routeAroundWater(path:WorldPoint2D[],places:Readonly<Record<string,WorldPlace>>):WorldPoint2D[]|undefined {
  const water=worldWaterPolygons(places,featureBounds(path,2));
  const clear=(a:WorldPoint2D,b:WorldPoint2D)=>!water.some(poly=>segmentHitsPolygon(a,b,poly));
  if(path.slice(1).every((p,i)=>clear(path[i],p)))return path;
  const outside=path.filter((p,i)=>!i||i===path.length-1||!water.some(poly=>pointInPolygon(p,poly)));
  if(outside.length>2) {
    const result=[outside[0]];
    for(let i=1;i<outside.length;i++){const part=routeAroundWater([outside[i-1],outside[i]],places);if(!part)return undefined;result.push(...part.slice(1));}
    return result;
  }
  const [a,b]=outside;
  if(water.some(poly=>pointInPolygon(a,poly)||pointInPolygon(b,poly)))return undefined;
  const near=featureBounds(path,2);
  const intersects=(p:WorldPoint2D[])=>{const box=featureBounds(p);return box.minX<=near.maxX&&box.maxX>=near.minX&&box.minY<=near.maxY&&box.maxY>=near.minY;};
  // Include the neighbouring banks too: a detour around one tributary can
  // otherwise run into a lake that did not intersect the original line.
  const blocking=water.filter(poly=>segmentHitsPolygon(a,b,poly)||
    (intersects(poly)&&poly.length<200)).slice(0,32);
  const nodes=[a,b,...blocking.flatMap(poly=>{
    const xs=poly.map(p=>p.x),ys=poly.map(p=>p.y),margin=.02;
    const cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
    const bank=poly.map(p=>{const d=Math.max(1e-8,Math.hypot(p.x-cx,p.y-cy));return {x:p.x+(p.x-cx)/d*margin,y:p.y+(p.y-cy)/d*margin};});
    const box=[{x:Math.min(...xs)-margin,y:Math.min(...ys)-margin},{x:Math.max(...xs)+margin,y:Math.min(...ys)-margin},
      {x:Math.max(...xs)+margin,y:Math.max(...ys)+margin},{x:Math.min(...xs)-margin,y:Math.max(...ys)+margin}];
    return [...bank,...box].filter(p=>!water.some(w=>pointInPolygon(p,w)));
  })];
  const distance=nodes.map(()=>Infinity),prior=nodes.map(()=>-1),seen=new Set<number>();distance[0]=0;
  for(let n=0;n<nodes.length;n++) {
    let at=-1;for(let i=0;i<nodes.length;i++)if(!seen.has(i)&&(at<0||distance[i]<distance[at]))at=i;
    if(at<0||!Number.isFinite(distance[at]))return undefined;
    if(at===1){const result:WorldPoint2D[]=[];for(let i=1;i>=0;i=prior[i])result.push(nodes[i]);return result.reverse();}
    seen.add(at);
    for(let i=0;i<nodes.length;i++) {
      if(seen.has(i))continue;const next=distance[at]+Math.hypot(nodes[i].x-nodes[at].x,nodes[i].y-nodes[at].y);
      if(next<distance[i]&&clear(nodes[at],nodes[i])){distance[i]=next;prior[i]=at;}
    }
  }
  return undefined;
}
