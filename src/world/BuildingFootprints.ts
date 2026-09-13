import type { WorldPlace, WorldPoint2D } from './types';

/** Units are 100m, angles are radians; rendering and collision share this shape. */
export function buildingSize(place: Pick<WorldPlace,'kind'>): {width:number;height:number} {
  return place.kind==='home'||place.kind==='construction_site'?{width:.12,height:.10}:
    place.kind==='workshop'?{width:.16,height:.14}:
    place.kind==='library'?{width:.16,height:.16}:{width:0,height:0};
}
export function buildingLocalPoint(point: WorldPoint2D, place: Pick<WorldPlace,'mapX'|'mapY'|'rotation'>): WorldPoint2D {
  const a=place.rotation??0,c=Math.cos(a),s=Math.sin(a),x=point.x-place.mapX,y=point.y-place.mapY;
  return {x:x*c+y*s,y:-x*s+y*c};
}
export function buildingPolygon(place: Pick<WorldPlace,'kind'|'mapX'|'mapY'|'rotation'>, margin=0): WorldPoint2D[] {
  const size=buildingSize(place),a=place.rotation??0,c=Math.cos(a),s=Math.sin(a);
  const x=size.width/2+margin,y=size.height/2+margin;
  return [[-x,-y],[x,-y],[x,y],[-x,y]].map(([dx,dy])=>({x:place.mapX+dx*c-dy*s,y:place.mapY+dx*s+dy*c}));
}
export function pointInPolygon(point:WorldPoint2D, polygon:readonly WorldPoint2D[]):boolean {
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i],b=polygon[j];
    if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
}
export function segmentHitsPolygon(a:WorldPoint2D,b:WorldPoint2D,polygon:readonly WorldPoint2D[]):boolean {
  if(pointInPolygon(a,polygon)||pointInPolygon(b,polygon)||pointInPolygon({x:(a.x+b.x)/2,y:(a.y+b.y)/2},polygon))return true;
  const cross=(p:WorldPoint2D,q:WorldPoint2D,r:WorldPoint2D)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  return polygon.some((c,i)=>{
    const d=polygon[(i+1)%polygon.length];
    return cross(a,b,c)*cross(a,b,d)<-1e-14 && cross(c,d,a)*cross(c,d,b)<-1e-14;
  });
}
export function polygonsOverlap(a:readonly WorldPoint2D[],b:readonly WorldPoint2D[]):boolean {
  return a.some((p,i)=>segmentHitsPolygon(p,a[(i+1)%a.length],b)) || b.some(p=>pointInPolygon(p,a));
}
export function pointSegmentDistance(p:WorldPoint2D,a:WorldPoint2D,b:WorldPoint2D):number {
  const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/Math.max(1e-16,dx*dx+dy*dy)));
  return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);
}
export function polygonGap(a:readonly WorldPoint2D[],b:readonly WorldPoint2D[]):number {
  if(polygonsOverlap(a,b))return 0;
  let gap=Infinity;
  for(const [points,edges]of [[a,b],[b,a]])for(const p of points)for(let i=0;i<edges.length;i++)
    gap=Math.min(gap,pointSegmentDistance(p,edges[i],edges[(i+1)%edges.length]));
  return gap;
}
export function buildingsHaveClearance(a:WorldPlace,b:WorldPlace,gap=.03):boolean {
  const sa=buildingSize(a),sb=buildingSize(b);
  if(!sa.width||!sb.width)return true;
  const maximum=Math.hypot(sa.width,sa.height)/2+Math.hypot(sb.width,sb.height)/2+gap;
  if(Math.hypot(a.mapX-b.mapX,a.mapY-b.mapY)>maximum)return true;
  return polygonGap(buildingPolygon(a),buildingPolygon(b))>=gap-1e-7;
}
